"""Vercel Serverless Function: Edge TTS.

Security notes:
- Requires the same HS256 JWT issued by the Node API (Authorization: Bearer).
- The browser never receives a CORS wildcard; origins are allowlisted.
- Voice names are allowlisted, text length is bounded, and errors are opaque.
- Rate limiting is in-memory per function instance. For a hard global limit,
  configure the platform/WAF limit as documented in the security report.
"""

from http.server import BaseHTTPRequestHandler
import asyncio
import base64
import binascii
import hashlib
import hmac
import json
import os
import threading
import time
from urllib.parse import urlparse

import edge_tts

DEFAULT_VOICE = "es-CO-GonzaloNeural"
ALLOWED_VOICES = {
    "es-CO-GonzaloNeural",
    "es-CO-SalomeNeural",
    "en-US-AriaNeural",
    "en-US-GuyNeural",
    "fr-FR-DeniseNeural",
    "pt-BR-FranciscaNeural",
    "zh-CN-XiaoxiaoNeural",
}
MAX_TEXT_CHARS = 1200
MAX_BODY_BYTES = 20_000
RATE_LIMIT_PER_MINUTE = int(os.environ.get("TTS_RATE_LIMIT_PER_MINUTE", "20") or "20")

_rate_lock = threading.Lock()
_rate_hits = {}


def _allowed_origins():
    configured = []
    for name in ("CORS_ALLOWED_ORIGINS", "CLIENT_URL", "APP_URL", "PUBLIC_URL"):
        value = os.environ.get(name, "")
        configured.extend(part.strip() for part in value.split(",") if part.strip())

    defaults = [
        "https://via-nova-ia.vercel.app",
        "https://localhost",
        "capacitor://localhost",
        "http://localhost:5000",
        "http://127.0.0.1:5000",
        "http://localhost:5055",
        "http://127.0.0.1:5055",
    ]
    result = []
    for value in configured + defaults:
        try:
            parsed = urlparse(value)
            if parsed.scheme in ("http", "https", "capacitor") and parsed.netloc:
                origin = f"{parsed.scheme}://{parsed.netloc}"
                if origin not in result:
                    result.append(origin)
        except ValueError:
            continue
    return result


def _origin_allowed(origin):
    if not origin:
        return False
    try:
        parsed = urlparse(origin)
        normalized = f"{parsed.scheme}://{parsed.netloc}"
    except ValueError:
        return False
    return normalized in _allowed_origins()


def _b64url_decode(value):
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _verify_jwt(token):
    """Verify the HS256 token issued by server/security.ts.

    Raises ValueError for any malformed, expired or incorrectly signed token.
    """
    if not token or token.count(".") != 2:
        raise ValueError("malformed token")
    header_part, payload_part, signature_part = token.split(".")
    try:
        header = json.loads(_b64url_decode(header_part))
        payload = json.loads(_b64url_decode(payload_part))
        signature = _b64url_decode(signature_part)
    except (ValueError, TypeError, binascii.Error, UnicodeDecodeError):
        raise ValueError("malformed token")

    if not isinstance(header, dict) or header.get("alg") != "HS256":
        raise ValueError("unsupported algorithm")

    secret = os.environ.get("JWT_SECRET", "")
    if len(secret) < 32:
        raise RuntimeError("JWT_SECRET is missing or too short")

    signing_input = f"{header_part}.{payload_part}".encode("ascii")
    expected = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    if not hmac.compare_digest(expected, signature):
        raise ValueError("bad signature")

    if not isinstance(payload, dict):
        raise ValueError("bad payload")
    now = int(time.time())
    exp = payload.get("exp")
    nbf = payload.get("nbf")
    if not isinstance(exp, (int, float)) or exp < now - 30:
        raise ValueError("expired token")
    if isinstance(nbf, (int, float)) and nbf > now + 30:
        raise ValueError("token not active")
    if not payload.get("id") or not payload.get("username"):
        raise ValueError("missing identity claims")
    return payload


def _rate_limit(key):
    now = time.time()
    window_start = now - 60
    with _rate_lock:
        hits = [stamp for stamp in _rate_hits.get(key, []) if stamp > window_start]
        if len(hits) >= max(1, RATE_LIMIT_PER_MINUTE):
            retry_after = max(1, int(60 - (now - hits[0])))
            _rate_hits[key] = hits
            return False, retry_after
        hits.append(now)
        _rate_hits[key] = hits
        if len(_rate_hits) > 5000:
            for old_key in [k for k, v in _rate_hits.items() if not v or v[-1] <= window_start]:
                _rate_hits.pop(old_key, None)
    return True, 0


class handler(BaseHTTPRequestHandler):
    server_version = "ViaNovaTTS/1.0"

    def _cors_origin(self):
        origin = self.headers.get("Origin", "")
        return origin if _origin_allowed(origin) else ""

    def _send_common_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cache-Control", "no-store")
        origin = self._cors_origin()
        if origin:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Access-Control-Allow-Credentials", "true")
            self.send_header("Vary", "Origin")

    def do_OPTIONS(self):
        origin = self.headers.get("Origin", "")
        if origin and not _origin_allowed(origin):
            self._send_json(403, {"error": "Origen no permitido"})
            return
        self.send_response(204)
        self._send_common_headers()
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header(
            "Access-Control-Allow-Headers",
            "Authorization, Content-Type, X-Client-Platform",
        )
        self.send_header("Access-Control-Max-Age", "600")
        self.end_headers()

    def do_GET(self):
        self._send_json(405, {"error": "Método no permitido"})

    def do_POST(self):
        try:
            origin = self.headers.get("Origin", "")
            if origin and not _origin_allowed(origin):
                self._send_json(403, {"error": "Origen no permitido"})
                return

            auth_header = self.headers.get("Authorization", "")
            if not auth_header.startswith("Bearer "):
                self._send_json(401, {"error": "No autenticado"})
                return
            try:
                claims = _verify_jwt(auth_header[7:].strip())
            except RuntimeError:
                self._send_json(503, {"error": "Servicio no disponible"})
                return
            except ValueError:
                self._send_json(401, {"error": "Sesión inválida o expirada"})
                return

            # Never trust X-Forwarded-For here: it is client-controlled unless
            # the platform overwrites it. The signed user id is the stable key.
            allowed, retry_after = _rate_limit(str(claims.get("id")))
            if not allowed:
                self.send_response(429)
                self._send_common_headers()
                self.send_header("Content-Type", "application/json")
                self.send_header("Retry-After", str(retry_after))
                self.end_headers()
                self.wfile.write(b'{"error":"Demasiadas solicitudes"}')
                return

            content_length = int(self.headers.get("Content-Length", "0") or "0")
            if content_length <= 0 or content_length > MAX_BODY_BYTES:
                self._send_json(413, {"error": "Solicitud demasiado grande"})
                return
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body) if body else {}
            except (ValueError, UnicodeDecodeError):
                self._send_json(400, {"error": "JSON inválido"})
                return

            text = str(data.get("text", "")).strip() if isinstance(data, dict) else ""
            if not text:
                self._send_json(400, {"error": "No text provided"})
                return
            if len(text) > MAX_TEXT_CHARS:
                self._send_json(413, {"error": "Texto demasiado largo"})
                return

            voice = data.get("voice", DEFAULT_VOICE) if isinstance(data, dict) else DEFAULT_VOICE
            if voice not in ALLOWED_VOICES:
                self._send_json(400, {"error": "Voz no permitida"})
                return

            audio = asyncio.run(self._generate_audio(text, voice))
            if not audio:
                self._send_json(502, {"error": "No se pudo generar el audio"})
                return

            self.send_response(200)
            self._send_common_headers()
            self.send_header("Content-Type", "audio/mpeg")
            self.send_header("Content-Length", str(len(audio)))
            self.end_headers()
            self.wfile.write(audio)
        except Exception as exc:  # noqa: BLE001 - never leak provider details
            print(f"[tts] error: {type(exc).__name__}: {exc}", flush=True)
            self._send_json(500, {"error": "Error interno"})

    async def _generate_audio(self, text, voice):
        communicate = edge_tts.Communicate(text, voice)
        audio_data = b""
        async for chunk in communicate.stream():
            if chunk.get("type") == "audio":
                audio_data += chunk.get("data", b"")
        return audio_data

    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self._send_common_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
