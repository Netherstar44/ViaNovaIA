import "dotenv/config";
import { v2 as cloudinary } from "cloudinary";
import path from "path";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function upload() {
  const logoPath = path.resolve("client/public/logo.jpeg");
  const result = await cloudinary.uploader.upload(logoPath, {
    folder: "vianova",
    public_id: "logo",
    overwrite: true,
  });
  console.log("Logo URL:", result.secure_url);
}

upload().catch((e) => { console.error(e); process.exit(1); });
