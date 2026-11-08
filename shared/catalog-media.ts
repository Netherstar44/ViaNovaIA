export type CatalogMediaType = "image" | "video" | "360_image" | "3d_model" | "vr_tour";
export type CatalogMedia = { id: string; url: string; type: CatalogMediaType; caption?: string | null };
const aliases: Record<string, CatalogMediaType> = { image: "image", video: "video", image_360: "360_image", "360_image": "360_image", model_3d: "3d_model", "3d_model": "3d_model", vr_tour: "vr_tour" };
export function normalizeCatalogMedia(value: unknown): CatalogMedia[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(row => {
    if (!row || typeof row !== 'object') return [];
    const type = aliases[String(row.type ?? row.asset_type ?? '').toLowerCase()];
    const url = row.url ?? row.file_url;
    if (!type || typeof url !== 'string' || typeof row.id !== 'string') return [];
    try { if (new URL(url).protocol !== 'https:') return []; } catch { return []; }
    return [{ id: row.id, type, url, caption: typeof (row.caption ?? row.title) === 'string' ? String(row.caption ?? row.title).slice(0, 200) : null }];
  });
}
export function productGallery(cover: string | null | undefined, name: string, value: unknown): CatalogMedia[] {
  const media = normalizeCatalogMedia(value);
  if (!cover || media.some(asset => asset.url === cover)) return media;
  return [...normalizeCatalogMedia([{ id: 'cover', url: cover, type: 'image', caption: name }]), ...media];
}
export function catalogViewerSources(value: unknown) {
  const media = normalizeCatalogMedia(value);
  const model = media.find(asset => asset.type === "3d_model"), panorama = media.find(asset => asset.type === "360_image");
  return { media, modelUrl: model?.url ?? null, panoramaUrl: panorama?.url ?? null, panoramaCaption: panorama?.caption ?? undefined, hasVR: !!(model || panorama) };
}
