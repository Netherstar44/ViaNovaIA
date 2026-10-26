"""Pruebas de seguridad de api/tts.py (sin red ni proveedor real).

Se ejecutan con:
    python -m unittest discover -s tests -p "test_*.py"
"""
import base64
import hashlib
import hmac
import importlib.util
import json
import os
import sys
import threading
import time
import types
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]

# api/tts.py importa edge-tts, pero estas pruebas no generan audio real.
fake_edge = types.ModuleType("edge_tts")


class FakeCommunicate:
    def __init__(self, *_args, **_kwargs):
        pass

    async def stream(self):
        if False:  # pragma: no cover - generador vacío intencional
            yield {}


fake_edge.Communicate = FakeCommunicate
sys.modules.setdefault("edge_tts", fake_edge)

spec = importlib.util.spec_from_file_location("vianova_tts", ROOT / "api" / "tts.py")
tts = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(tts)

SECRET = "test-tts-secret-0123456789-abcdefgh"


def b64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def make_token(secret=SECRET, **overrides):
    now = int(time.time())
    payload = {
        "id": "user-1",
        "username": "alice",
        "role": "traveler",
        "exp": now + 300,
        **overrides,
    }
    header = b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    body = b64url(json.dumps(payload).encode())
    signing_input = f"{header}.{body}".encode("ascii")
    signature = b64url(hmac.new(secret.encode(), signing_input, hashlib.sha256).digest())
    return f"{header}.{body}.{signature}"


class TtsUnitTests(unittest.TestCase):
    def setUp(self):
        self.previous = {k: os.environ.get(k) for k in ("JWT_SECRET", "CORS_ALLOWED_ORIGINS")}
        os.environ["JWT_SECRET"] = SECRET
        os.environ["CORS_ALLOWED_ORIGINS"] = "https://app.example.com"
        tts._rate_hits.clear()
        tts.RATE_LIMIT_PER_MINUTE = 100

    def tearDown(self):
        for key, value in self.previous.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        tts._rate_hits.clear()

    def test_valid_token(self):
        claims = tts._verify_jwt(make_token())
        self.assertEqual(claims["id"], "user-1")
        self.assertEqual(claims["username"], "alice")

    def test_rejects_bad_signature_and_alg(self):
        token = make_token()
        parts = token.split(".")
        parts[2] = ("A" if parts[2][0] != "A" else "B") + parts[2][1:]
        bad = ".".join(parts)
        with self.assertRaises(ValueError):
            tts._verify_jwt(bad)
        with self.assertRaises(ValueError):
            tts._verify_jwt(make_token(secret="otro-secreto-de-32-caracteres-xxxx"))

        header = b64url(json.dumps({"alg": "none"}).encode())
        payload = b64url(json.dumps({"id": "x", "username": "x", "exp": int(time.time()) + 60}).encode())
        with self.assertRaises(ValueError):
            tts._verify_jwt(f"{header}.{payload}.")

    def test_rejects_expired_and_missing_claims(self):
        with self.assertRaises(ValueError):
            tts._verify_jwt(make_token(exp=int(time.time()) - 120))
        with self.assertRaises(ValueError):
            tts._verify_jwt(make_token(id=""))
        with self.assertRaises(ValueError):
            tts._verify_jwt(make_token(not_before_identity=None, id=None))
        with self.assertRaises(ValueError):
            tts._verify_jwt("not-a-token")

    def test_requires_long_secret(self):
        os.environ["JWT_SECRET"] = "corto"
        with self.assertRaises(RuntimeError):
            tts._verify_jwt(make_token())

    def test_origin_allowlist_blocks_suffix_attacks(self):
        self.assertTrue(tts._origin_allowed("https://app.example.com"))
        self.assertTrue(tts._origin_allowed("https://localhost"))
        self.assertFalse(tts._origin_allowed("https://app.example.com.evil.test"))
        self.assertFalse(tts._origin_allowed("https://evil.example"))
        self.assertFalse(tts._origin_allowed(""))
        self.assertFalse(tts._origin_allowed("not a url"))

    def test_rate_limit_per_signed_user(self):
        tts.RATE_LIMIT_PER_MINUTE = 2
        self.assertEqual(tts._rate_limit("user-a"), (True, 0))
        self.assertEqual(tts._rate_limit("user-a"), (True, 0))
        allowed, retry_after = tts._rate_limit("user-a")
        self.assertFalse(allowed)
        self.assertGreaterEqual(retry_after, 1)
        self.assertEqual(tts._rate_limit("user-b"), (True, 0))


class TtsHttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.previous_secret = os.environ.get("JWT_SECRET")
        os.environ["JWT_SECRET"] = SECRET
        os.environ["CORS_ALLOWED_ORIGINS"] = "https://app.example.com"
        tts._rate_hits.clear()
        tts.RATE_LIMIT_PER_MINUTE = 100
        tts.handler.log_message = lambda *_args, **_kwargs: None

        async def fake_audio(_self, text, voice):
            return b"ID3" + f"{text}|{voice}".encode("utf-8")

        cls.original_generate = tts.handler._generate_audio
        tts.handler._generate_audio = fake_audio
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), tts.handler)
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.httpd.server_address[1]}"

    def setUp(self):
        tts._rate_hits.clear()
        tts.RATE_LIMIT_PER_MINUTE = 100

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.thread.join(timeout=5)
        tts.handler._generate_audio = cls.original_generate
        tts._rate_hits.clear()
        if cls.previous_secret is None:
            os.environ.pop("JWT_SECRET", None)
        else:
            os.environ["JWT_SECRET"] = cls.previous_secret

    def request(self, method="POST", body=None, headers=None):
        data = body if isinstance(body, bytes) else (json.dumps(body).encode() if body is not None else None)
        req = Request(self.base + "/api/tts", data=data, headers=headers or {}, method=method)
        try:
            with urlopen(req, timeout=10) as response:
                return response.status, dict(response.headers), response.read()
        except HTTPError as error:
            return error.code, dict(error.headers), error.read()

    def auth(self, token=None):
        return {
            "Authorization": f"Bearer {token or make_token()}",
            "Content-Type": "application/json",
            "Origin": "https://app.example.com",
        }

    def test_options_rejects_unknown_origin_and_allows_known(self):
        status, headers, _ = self.request("OPTIONS", headers={"Origin": "https://evil.example"})
        self.assertEqual(status, 403)
        self.assertNotIn("Access-Control-Allow-Origin", headers)

        status, headers, _ = self.request("OPTIONS", headers={"Origin": "https://app.example.com"})
        self.assertEqual(status, 204)
        self.assertEqual(headers.get("Access-Control-Allow-Origin"), "https://app.example.com")
        self.assertIn("POST, OPTIONS", headers.get("Access-Control-Allow-Methods", ""))

    def test_get_is_method_not_allowed(self):
        status, _, body = self.request("GET")
        self.assertEqual(status, 405)
        self.assertIn(b"todo no permitido", body)

    def test_rejects_missing_and_invalid_token(self):
        status, _, _ = self.request("POST", {"text": "hola"})
        self.assertEqual(status, 401)

        status, _, body = self.request(
            "POST",
            {"text": "hola"},
            {"Authorization": "Bearer malformed", "Content-Type": "application/json"},
        )
        self.assertEqual(status, 401)
        self.assertNotIn(b"error interno", body.lower())

    def test_rejects_origin_and_does_not_echo_wildcard(self):
        status, headers, _ = self.request(
            "POST",
            {"text": "hola"},
            {**self.auth(), "Origin": "https://evil.example"},
        )
        self.assertEqual(status, 403)
        self.assertNotIn("Access-Control-Allow-Origin", headers)

    def test_rejects_unknown_voice_and_oversized_text(self):
        status, _, _ = self.request("POST", {"text": "hola", "voice": "../system"}, self.auth())
        self.assertEqual(status, 400)

        status, _, _ = self.request("POST", {"text": "x" * (tts.MAX_TEXT_CHARS + 1)}, self.auth())
        self.assertEqual(status, 413)

        status, _, _ = self.request("POST", {"text": "hola"}, {**self.auth(), "Content-Length": str(tts.MAX_BODY_BYTES + 1)})
        self.assertEqual(status, 413)

    def test_valid_request_returns_audio_with_security_headers(self):
        status, headers, body = self.request(
            "POST",
            {"text": "Hola ViaNova", "voice": "es-CO-GonzalezNeural"},
            self.auth(),
        )
        # La voz del ejemplo no está permitida: debe fallar antes de generar audio.
        self.assertEqual(status, 400)
        self.assertEqual(headers.get("X-Content-Type-Options"), "nosniff")

        status, headers, body = self.request(
            "POST",
            {"text": "Hola ViaNova", "voice": tts.DEFAULT_VOICE},
            self.auth(),
        )
        self.assertEqual(status, 200)
        self.assertEqual(headers.get("Content-Type"), "audio/mpeg")
        self.assertTrue(body.startswith(b"ID3"))
        self.assertEqual(headers.get("Cache-Control"), "no-store")
        self.assertEqual(headers.get("Access-Control-Allow-Origin"), "https://app.example.com")
        self.assertNotEqual(headers.get("Access-Control-Allow-Origin"), "*")

    def test_rate_limit_returns_429_after_threshold(self):
        tts._rate_hits.clear()
        tts.RATE_LIMIT_PER_MINUTE = 1
        first_status, _, _ = self.request("POST", {"text": "uno"}, self.auth())
        second_status, headers, _ = self.request("POST", {"text": "dos"}, self.auth())
        self.assertEqual(first_status, 200)
        self.assertEqual(second_status, 429)
        self.assertGreaterEqual(int(headers.get("Retry-After", "0")), 1)


if __name__ == "__main__":
    unittest.main()
