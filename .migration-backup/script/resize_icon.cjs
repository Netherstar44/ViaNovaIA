const { Jimp } = require("jimp");
const fs = require("fs");

async function processImage() {
  try {
    const inputPath = "client/src/assets/Logo_principal-removebg-preview.png";
    const outputPath = "assets/icon.png";

    if (!fs.existsSync(inputPath)) {
      console.error("Input file not found:", inputPath);
      return;
    }

    console.log("Loading transparent image...");
    const image = await Jimp.read(inputPath);
    
    console.log("Auto-cropping...");
    image.autocrop({ tolerance: 0.1 });

    const maxDim = Math.max(image.bitmap.width, image.bitmap.height);
    const canvasSize = Math.floor(maxDim * 1.5);
    
    // Create canvas by cloning, resizing to canvasSize
    const iconCanvas = await Jimp.read(inputPath);
    iconCanvas.resize(canvasSize, canvasSize);
    
    // Set all pixels to pure black manually without `this`
    const data = iconCanvas.bitmap.data;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 0;     // r
      data[i + 1] = 0; // g
      data[i + 2] = 0; // b
      data[i + 3] = 255; // a
    }
    
    // Calculate center
    const x = Math.floor((canvasSize - image.bitmap.width) / 2);
    const y = Math.floor((canvasSize - image.bitmap.height) / 2);
    
    // Composite
    iconCanvas.composite(image, x, y);

    console.log("Saving icon.png...");
    await iconCanvas.write(outputPath);

    console.log("Done!");
  } catch (err) {
    console.log("Error:", err.message);
  }
}

processImage();
