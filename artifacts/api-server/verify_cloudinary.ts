import "dotenv/config";
import { v2 as cloudinary } from "cloudinary";

async function run() {
  console.log("🔍 CLOUDINARY CREDENTIAL AUDIT:\n");

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.error("❌ Missing Cloudinary env keys!");
    process.exit(1);
  }

  console.log(`Cloud Name: ${cloudName}`);
  console.log(`API Key: ${apiKey.substring(0, 4)}***`);

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret
  });

  try {
    const res = await cloudinary.api.ping();
    console.log("✅ Cloudinary connection check: SUCCESS!", res);
  } catch (err) {
    console.error("❌ Cloudinary ping failed:", err);
  }
}

run();
