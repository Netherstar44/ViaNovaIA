const { Jimp } = require("jimp");

async function run() {
  try {
    // Jimp 1.x allows creating a new image from scratch using options
    const bg = new Jimp({ width: 1024, height: 1024, color: '#000000' });
    await bg.write("assets/icon-background.png");
    console.log("Black background created.");
  } catch (err) {
    console.error("Error creating black background:", err);
  }
}

run();
