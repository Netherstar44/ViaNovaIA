import assert from "node:assert/strict";
import { test } from "node:test";
import { catalogViewerSources, normalizeCatalogMedia, productGallery } from "../shared/catalog-media.js";
import { attachCatalogMedia } from "../server/catalog-media.js";
const model = { id: "test-model", asset_type: "MODEL_3D", file_url: "https://assets.example/test.glb" };
const panorama = { id: "test-sphere", asset_type: "IMAGE_360", file_url: "https://assets.example/test.jpg" };
test("los tipos de PostgreSQL y sus alias abren el visor correcto", () => {
  const sources = catalogViewerSources([model, panorama]);
  assert.equal(sources.modelUrl, model.file_url); assert.equal(sources.panoramaUrl, panorama.file_url); assert.equal(sources.hasVR, true);
  assert.deepEqual(normalizeCatalogMedia([{ ...model, asset_type: "3d_model" }]), normalizeCatalogMedia([model]));
  assert.equal(catalogViewerSources([panorama]).modelUrl, null); assert.equal(catalogViewerSources([panorama]).hasVR, true);
  assert.equal(catalogViewerSources([]).hasVR, false);
});
test("una portada 360 no pierde su tipo al formar la galería", () => {
  const gallery = productGallery(panorama.file_url, "Prueba", [panorama]);
  assert.equal(gallery.length, 1); assert.equal(gallery[0].type, "360_image");
  assert.equal(productGallery(null, "Prueba", []).length, 0);
});
test("los archivos públicos no exponen campos privados ni esquemas ejecutables", () => {
  const rows = normalizeCatalogMedia([{ ...model, owner_id: "private", secret: "private" }, { ...panorama, file_url: "javascript:alert(1)" }, { ...panorama, asset_type: "unknown" }]);
  assert.equal(rows.length, 1); assert.equal("owner_id" in rows[0], false); assert.equal("secret" in rows[0], false);
});
test("los archivos se agrupan por entidad; faltantes quedan vacíos y no se inventa contenido", async () => {
  let calls = 0;
  const result = await attachCatalogMedia([{ id: "service-a" }, { id: "service-b" }], "service", async () => {
    calls++; return { rows: [{ ...model, entity_id: "service-a" }, { ...panorama, entity_id: "another-service" }] };
  });
  assert.equal(calls, 1); assert.equal(result[0].media.length, 1); assert.deepEqual(result[1].media, []);
  assert.deepEqual(await attachCatalogMedia([], "service", async () => { throw new Error("No debe consultar sin IDs"); }), []);
});
