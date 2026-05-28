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
    
    // Auto-crop to remove all empty transparent space so the logo fills the entire image
    console.log("Auto-cropping to make it larger...");
    image.autocrop({ tolerance: 0.05 });
    
    // Capacitor will automatically add the required padding for the "safe zone"
    // So by removing the image's internal padding, the final icon will be significantly larger.
    
    console.log("Saving icon-foreground.png...");
    await image.write(foregroundPath);

    console.log("Done!");
  } catch (err) {
    console.log("Error:", err.message);
  }
}

processIcon();
