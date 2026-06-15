import { Router, type Express } from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { requireAuth } from "./app.routes.js";
import { getDb } from "../storage.js";
import { mediaAssets, insertMediaAssetSchema } from "../shared/schema.js";
import { eq, and, desc } from "drizzle-orm";

const router = Router();

// Configure Multer with 50MB limit to handle videos and 3D models
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  }
});

// Configure Cloudinary (usually already initialized in app.routes.ts, but safe to re-check)
function configureCloudinary() {
  if (!cloudinary.config().cloud_name) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }
}

// REST routes
router.post("/upload", requireAuth, upload.single("file"), async (req: any, res, next) => {
  try {
    configureCloudinary();

    if (!req.file) {
      return res.status(400).json({ message: "No se proporcionó ningún archivo" });
    }

    const userId = req.user.id;
    const userRole = req.user.role;

    // Retrieve fields from body
    const title = req.body.title || req.file.originalname;
    const description = req.body.description || "";
    const entityType = req.body.entityType || "user";
    const entityId = req.body.entityId || userId;
    const is360 = req.body.is360 === "true" || req.body.is360 === true;
    const isVR = req.body.isVR === "true" || req.body.isVR === true;

    // Detect asset type and folder
    const ext = req.file.originalname.split(".").pop()?.toLowerCase();
    const mime = req.file.mimetype;

    let assetType = "IMAGE";
    let folder = `vianova/images/${userId}`;
    let resourceType: "image" | "video" | "raw" = "image";

    // Strict validations
    if (ext === "mp4" || ext === "webm" || mime.startsWith("video/")) {
      // Videos
      if (!["mp4", "webm"].includes(ext || "")) {
        return res.status(400).json({ message: "Formato de video no soportado. Use mp4 o webm." });
      }
      assetType = "VIDEO";
      resourceType = "video";
      folder = `vianova/videos/${userId}`;
    } else if (ext === "glb" || ext === "gltf" || mime === "model/gltf-binary" || mime === "model/gltf+json" || mime === "application/octet-stream") {
      // 3D Models
      if (!["glb", "gltf"].includes(ext || "")) {
        return res.status(400).json({ message: "Formato 3D no soportado. Use glb o gltf." });
      }
      assetType = "MODEL_3D";
      resourceType = "raw"; // Cloudinary handles GLB as raw files
      folder = `vianova/models/${userId}`;
    } else {
      // Images / 360 images
      if (!["jpg", "jpeg", "png", "webp"].includes(ext || "")) {
        return res.status(400).json({ message: "Formato de imagen no soportado. Use jpg, jpeg, png o webp." });
      }
      if (is360) {
        assetType = "IMAGE_360";
        folder = `vianova/360/${userId}`;
      } else {
        assetType = "IMAGE";
        folder = `vianova/images/${userId}`;
      }
      resourceType = "image";
    }

    // Override if VR tour was explicitly selected
    if (isVR) {
      assetType = "VR_TOUR";
      folder = `vianova/vr/${userId}`;
    }

    // Upload stream to Cloudinary
    const uploadOptions: any = {
      folder,
      resource_type: resourceType,
    };

    // Use compression / auto transform for images and videos
    if (resourceType === "image") {
      uploadOptions.quality = "auto";
      uploadOptions.fetch_format = "auto";
    } else if (resourceType === "video") {
      uploadOptions.quality = "auto";
      uploadOptions.fetch_format = "auto";
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      async (error, uploaded) => {
        if (error || !uploaded) {
          console.error("Cloudinary upload error:", error);
          return res.status(500).json({ message: "Error al subir archivo a Cloudinary", error });
        }

        // Generate dynamic thumbnail URL
        let thumbnailUrl = uploaded.secure_url;
        if (assetType === "VIDEO" || assetType === "VR_TOUR") {
          // Replace video extension with jpg and add start offset to get frame thumbnail
          thumbnailUrl = uploaded.secure_url.replace(/\.[^/.]+$/, ".jpg");
          // Cloudinary video thumbnail trick: insert so_0 transformation
          const parts = thumbnailUrl.split("/upload/");
          if (parts.length === 2) {
            thumbnailUrl = `${parts[0]}/upload/so_0,c_limit,h_300,w_300/${parts[1]}`;
          }
        } else if (assetType === "MODEL_3D") {
          // Fallback thumbnail icon for 3D model
          thumbnailUrl = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&auto=format&fit=crop&q=60";
        } else {
          // Image resize for thumbnail
          const parts = thumbnailUrl.split("/upload/");
          if (parts.length === 2) {
            thumbnailUrl = `${parts[0]}/upload/c_limit,h_300,w_300/${parts[1]}`;
          }
        }

        try {
          // Save to database using Drizzle
          const db = getDb();
          const newAsset = await db.insert(mediaAssets).values({
            ownerId: userId,
            ownerRole: userRole,
            entityType,
            entityId,
            title,
            description,
            assetType: assetType as any,
            fileUrl: uploaded.secure_url,
            thumbnailUrl,
            cloudinaryPublicId: uploaded.public_id,
            mimeType: req.file.mimetype,
            fileSize: req.file.size,
            width: uploaded.width || null,
            height: uploaded.height || null,
            duration: uploaded.duration ? Math.round(uploaded.duration) : null,
            is360,
            isVR,
            status: "active",
          }).returning();

          return res.status(201).json(newAsset[0]);
        } catch (dbErr) {
          console.error("Database save error:", dbErr);
          return res.status(500).json({ message: "Error al guardar metadatos en la base de datos" });
        }
      }
    );

    uploadStream.end(req.file.buffer);
  } catch (err) {
    return next(err);
  }
});

// GET list of assets
router.get("/", requireAuth, async (req: any, res, next) => {
  try {
    const db = getDb();
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const type = req.query.type as string;

    let query = db.select().from(mediaAssets).where(eq(mediaAssets.status, "active"));

    // If traveler, allow seeing all or filtering. If business owner, filter by their own by default
    // or let them check public ones
    let filterCondition = eq(mediaAssets.status, "active");
    if (req.user.role !== "admin" && req.query.own === "true") {
      filterCondition = and(filterCondition, eq(mediaAssets.ownerId, req.user.id)) as any;
    }

    if (type) {
      filterCondition = and(filterCondition, eq(mediaAssets.assetType, type as any)) as any;
    }

    const results = await db.select()
      .from(mediaAssets)
      .where(filterCondition)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(mediaAssets.createdAt));

    return res.json(results);
  } catch (err) {
    return next(err);
  }
});

// GET asset by ID
router.get("/:id", requireAuth, async (req: any, res, next) => {
  try {
    const db = getDb();
    const result = await db.select().from(mediaAssets).where(
      and(eq(mediaAssets.id, req.params.id), eq(mediaAssets.status, "active"))
    );

    if (result.length === 0) {
      return res.status(404).json({ message: "Asset no encontrado" });
    }

    return res.json(result[0]);
  } catch (err) {
    return next(err);
  }
});

// PUT update asset
router.put("/:id", requireAuth, async (req: any, res, next) => {
  try {
    const db = getDb();
    const assetId = req.params.id;
    const userId = req.user.id;

    const existing = await db.select().from(mediaAssets).where(eq(mediaAssets.id, assetId));
    if (existing.length === 0) {
      return res.status(404).json({ message: "Asset no encontrado" });
    }

    // Only owner or admin can update metadata
    if (existing[0].ownerId !== userId && req.user.role !== "admin") {
      return res.status(403).json({ message: "No tiene permiso para editar este asset" });
    }

    const { title, description, entityType, entityId, is360, isVR } = req.body || {};

    const updated = await db.update(mediaAssets)
      .set({
        title: title !== undefined ? title : existing[0].title,
        description: description !== undefined ? description : existing[0].description,
        entityType: entityType !== undefined ? entityType : existing[0].entityType,
        entityId: entityId !== undefined ? entityId : existing[0].entityId,
        is360: is360 !== undefined ? is360 : existing[0].is360,
        isVR: isVR !== undefined ? isVR : existing[0].isVR,
        updatedAt: new Date(),
      })
      .where(eq(mediaAssets.id, assetId))
      .returning();

    return res.json(updated[0]);
  } catch (err) {
    return next(err);
  }
});

// DELETE asset
router.delete("/:id", requireAuth, async (req: any, res, next) => {
  try {
    const db = getDb();
    const assetId = req.params.id;
    const userId = req.user.id;

    const existing = await db.select().from(mediaAssets).where(eq(mediaAssets.id, assetId));
    if (existing.length === 0) {
      return res.status(404).json({ message: "Asset no encontrado" });
    }

    if (existing[0].ownerId !== userId && req.user.role !== "admin") {
      return res.status(403).json({ message: "No tiene permiso para eliminar este asset" });
    }

    // Safely delete from Cloudinary
    configureCloudinary();
    try {
      const type = existing[0].assetType;
      const resourceType = (type === "VIDEO" || type === "VR_TOUR") ? "video" : (type === "MODEL_3D" ? "raw" : "image");
      await cloudinary.uploader.destroy(existing[0].cloudinaryPublicId, { resource_type: resourceType });
      console.log(`Cloudinary file ${existing[0].cloudinaryPublicId} deleted.`);
    } catch (clError) {
      console.warn("Could not delete from Cloudinary (might be raw or already deleted):", clError);
    }

    // Soft delete or hard delete depending on design; here we soft delete
    const deleted = await db.update(mediaAssets)
      .set({ status: "deleted", updatedAt: new Date() })
      .where(eq(mediaAssets.id, assetId))
      .returning();

    return res.json({ success: true, message: "Asset eliminado", asset: deleted[0] });
  } catch (err) {
    return next(err);
  }
});

// GET assets by role
router.get("/role/:role", requireAuth, async (req: any, res, next) => {
  try {
    const db = getDb();
    const results = await db.select().from(mediaAssets).where(
      and(eq(mediaAssets.ownerRole, req.params.role), eq(mediaAssets.status, "active"))
    ).orderBy(desc(mediaAssets.createdAt));

    return res.json(results);
  } catch (err) {
    return next(err);
  }
});

// GET assets by entity
router.get("/entity/:entityType/:entityId", requireAuth, async (req: any, res, next) => {
  try {
    const db = getDb();
    const results = await db.select().from(mediaAssets).where(
      and(
        eq(mediaAssets.entityType, req.params.entityType),
        eq(mediaAssets.entityId, req.params.entityId),
        eq(mediaAssets.status, "active")
      )
    ).orderBy(desc(mediaAssets.createdAt));

    return res.json(results);
  } catch (err) {
    return next(err);
  }
});

export function registerMediaAssetsRoutes(app: Express) {
  app.use("/api/media-assets", router);
}
