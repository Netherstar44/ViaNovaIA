const { Jimp } = require("jimp");
const fs = require("fs");

async function processIcon() {
  try {
    const inputPath = "client/src/assets/Logo_principal-removebg-preview.png";
    const foregroundPath = "assets/icon-foreground.png";

    if (!fs.existsSync(inputPath)) {
      console.error("Input file not found:", inputPath);
      return;
    }

    console.log("Loading transparent image...");
    const image = await Jimp.read(inputPath);
    
    // Auto-crop to get the exact bounds of the logo
    console.log("Auto-cropping baseline...");
    image.autocrop({ tolerance: 0.05 });
    
    // Now add a MODERATE amount of transparent padding so it's not "too huge"
    // 1.25x means a 25% larger canvas, providing a nice comfortable margin
    const maxDim = Math.max(image.bitmap.width, image.bitmap.height);
    const canvasSize = Math.floor(maxDim * 1.3); // Let's use 1.3 for a slightly smaller "un poco mas grande" look
    
    // Create a new blank transparent canvas
    const newCanvas = new Jimp({ width: canvasSize, height: canvasSize, color: 0x00000000 });
    
    // Calculate center
    const x = Math.floor((canvasSize - image.bitmap.width) / 2);
    const y = Math.floor((canvasSize - image.bitmap.height) / 2);
    
    // Paste the logo in the middle
    newCanvas.composite(image, x, y);

    console.log("Saving moderated icon-foreground.png...");
    await newCanvas.write(foregroundPath);

    console.log("Done!");
  } catch (err) {
    console.log("Error:", err.message);
  }
}

processIcon();
