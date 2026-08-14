from http.server import BaseHTTPRequestHandler
import edge_tts
import asyncio
import json


class handler(BaseHTTPRequestHandler):
    """
    Vercel Serverless Function – Edge TTS (Microsoft Neural Voices)
    Expone un endpoint POST /api/tts que recibe { text, voice? }
    y devuelve audio MP3 generado con voz colombiana masculina (es-CO-GonzaloNeural).
    """

    def do_OPTIONS(self):
        """Handle CORS preflight."""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "86400")
        self.end_headers()

    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body) if body else {}
            text = data.get("text", "").strip()

            if not text:
                self._send_json(400, {"error": "No text provided"})
                return

            # Truncar a 1500 caracteres para evitar timeouts en Vercel (10s hobby)
            if len(text) > 1500:
                text = text[:1500]

            # Voces colombianas disponibles:
            #   es-CO-SalomeNeural  (Femenina – natural, cálida)
            #   es-CO-GonzaloNeural (Masculina)
            voice = data.get("voice", "es-CO-GonzaloNeural")

            audio = asyncio.run(self._generate_audio(text, voice))

            self.send_response(200)
            self.send_header("Content-Type", "audio/mpeg")
            self.send_header("Content-Length", str(len(audio)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "public, max-age=3600")
            self.end_headers()
            self.wfile.write(audio)

        except Exception as e:
            self._send_json(500, {"error": str(e)})

    async def _generate_audio(self, text: str, voice: str) -> bytes:
        """Genera audio MP3 usando Microsoft Edge TTS."""
        communicate = edge_tts.Communicate(text, voice)
        audio_data = b""
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_data += chunk["data"]
        return audio_data

    def _send_json(self, status: int, payload: dict):
        """Helper para enviar respuestas JSON con CORS."""
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode("utf-8"))
