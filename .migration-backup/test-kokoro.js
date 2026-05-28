import { KokoroTTS } from "kokoro-js";
import fs from "fs";

async function test() {
  console.log("Loading model...");
  const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
    dtype: "q8",
    device: "wasm",
  });
  console.log("Generating audio...");
  const audio = await tts.generate("Hola, esta es una prueba.", { voice: "ef_dora" });
  console.log(Object.keys(audio));
  console.log(audio.audio.constructor.name);
}
test().catch(console.error);
