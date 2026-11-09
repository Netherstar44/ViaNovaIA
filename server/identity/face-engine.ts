import path from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { FACE_MODEL, type FaceEngine, type FaceSample } from "./policy.js";

// Static module specifier lets serverless file tracing include TFJS dependencies.
let initialization: Promise<any> | undefined;
async function api() {
  if (!initialization) initialization = (async () => {
    if (Number(process.versions.node.split(".")[0]) !== 22) throw new Error("El motor facial requiere Node 22.");
    const imported = await import("@vladmandic/face-api/dist/face-api.node-wasm.js");
    const face: any = (imported as any).default ?? imported;
    await face.tf.setBackend("cpu");
    await face.tf.ready();
    const models = path.resolve("node_modules/@vladmandic/face-api/model");
    await Promise.all([face.nets.tinyFaceDetector, face.nets.ssdMobilenetv1, face.nets.faceLandmark68Net, face.nets.faceRecognitionNet].map(net => net.loadFromDisk(models)));
    return face;
  })().catch(error => { initialization = undefined; throw error; });
  return initialization;
}

export class VladFaceEngine implements FaceEngine {
  readonly model = FACE_MODEL;
  async analyze(image: Buffer, enrollment: boolean): Promise<FaceSample> {
    // Reject formats/dimensions before invoking the native decoder (decompression bomb).
    if (image.length > 240_000 || image.length < 10 || image.readUInt16BE(0) !== 0xffd8) throw new Error("Usa un fotograma JPEG de hasta 240 KB.");
    const { jpegDimensions } = await import("./jpeg.js");
    const dimensions = jpegDimensions(image);
    if (!dimensions || dimensions.width > 960 || dimensions.height > 960 || dimensions.width < 160 || dimensions.height < 160) throw new Error("Usa una imagen entre 160 y 960 píxeles por lado.");
    const face = await api();
    const decoded = await loadImage(image);
    const canvas = createCanvas(decoded.width, decoded.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(decoded, 0, 0);
    const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = new Int32Array(canvas.width * canvas.height * 3);
    for (let i = 0, j = 0; i < rgba.data.length; i += 4) {
      pixels[j++] = rgba.data[i]; pixels[j++] = rgba.data[i + 1]; pixels[j++] = rgba.data[i + 2];
    }
    const tensor = face.tf.tensor3d(pixels, [canvas.height, canvas.width, 3], "int32");
    try {
      const options = enrollment ? new face.SsdMobilenetv1Options({ minConfidence: 0.7, maxResults: 2 })
        : new face.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.65 });
      const faces = await face.detectAllFaces(tensor, options).withFaceLandmarks().withFaceDescriptors();
      if (faces.length !== 1) throw new Error("Debe aparecer un solo rostro, completo y bien iluminado.");
      const result = faces[0];
      const points = result.landmarks.positions;
      const left = points[36], right = points[45], nose = points[30];
      const eyeDistance = Math.hypot(right.x - left.x, right.y - left.y);
      const yaw = (nose.x - (left.x + right.x) / 2) / Math.max(1, eyeDistance);
      const roll = Math.atan2(right.y - left.y, right.x - left.x) * 180 / Math.PI;
      const box = result.detection.box;
      let sum = 0, sharp = 0, count = 0;
      const grey = (x: number, y: number) => {
        const i = (y * canvas.width + x) * 4;
        return rgba.data[i] * 0.299 + rgba.data[i + 1] * 0.587 + rgba.data[i + 2] * 0.114;
      };
      for (let y = Math.max(1, Math.ceil(box.y)); y < Math.min(canvas.height - 1, box.y + box.height); y += 2) {
        for (let x = Math.max(1, Math.ceil(box.x)); x < Math.min(canvas.width - 1, box.x + box.width); x += 2) {
          const c = grey(x, y);
          const laplacian = grey(x - 1, y) + grey(x + 1, y) + grey(x, y - 1) + grey(x, y + 1) - 4 * c;
          sum += c; sharp += laplacian ** 2; count++;
        }
      }
      return { descriptor: Array.from(result.descriptor), yaw, roll, pitch: result.angle?.pitch, facePixels: Math.min(box.width, box.height), light: sum / Math.max(1, count), sharpness: sharp / Math.max(1, count) };
    } finally { tensor.dispose(); canvas.width = 1; canvas.height = 1; }
  }
}
