import React, { useEffect, useState } from "react";
import { apiBase } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Play, Eye, Trash2, Edit3, Image as ImageIcon, Video, Rotate3d, Glasses, Compass, Globe 
} from "lucide-react";

export interface MediaAsset {
  id: string;
  ownerId: string;
  ownerRole: string;
  entityType: string;
  entityId: string | null;
  title: string | null;
  description: string | null;
  assetType: "IMAGE" | "VIDEO" | "IMAGE_360" | "MODEL_3D" | "VR_TOUR";
  fileUrl: string;
  thumbnailUrl: string | null;
  cloudinaryPublicId: string;
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  is360: boolean;
  isVR: boolean;
  createdAt: string;
}

interface MediaGalleryProps {
  assets?: MediaAsset[];
  refreshTrigger?: number;
  onSelectAsset?: (asset: MediaAsset) => void;
  entityType?: string;
  entityId?: string;
  showFilters?: boolean;
  isEditable?: boolean;
}

export const MediaGallery: React.FC<MediaGalleryProps> = ({
  assets: initialAssets,
  refreshTrigger = 0,
  onSelectAsset,
  entityType,
  entityId,
  showFilters = true,
  isEditable = true
}) => {
  const { toast } = useToast();
  const [assets, setAssets] = useState<MediaAsset[]>(initialAssets || []);
  const [loading, setLoading] = useState(!initialAssets);
  const [filterType, setFilterType] = useState<string>("ALL");
  
  // Edit State
  const [editingAsset, setEditingAsset] = useState<MediaAsset | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [updating, setUpdating] = useState(false);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      let url = `${apiBase}/api/media-assets?own=true`;
      
      // Override url if filtering by entity
      if (entityType && entityId) {
        url = `${apiBase}/api/media-assets/entity/${entityType}/${entityId}`;
      }

      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Error fetching assets");
      const data = await res.json();
      setAssets(data);
    } catch (err) {
      console.error(err);
      toast({
        title: "Error al cargar galería",
        description: "No se pudieron obtener los archivos multimedia.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialAssets) {
      fetchAssets();
    } else {
      setAssets(initialAssets);
    }
  }, [initialAssets, refreshTrigger, entityType, entityId]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("¿Está seguro de que desea eliminar este recurso multimedia?")) return;

    try {
      const res = await fetch(`${apiBase}/api/media-assets/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Error deleting asset");

      toast({
        title: "Recurso eliminado",
        description: "El archivo multimedia fue removido exitosamente.",
      });

      // Filter from local state
      setAssets(assets.filter(a => a.id !== id));
    } catch (err) {
      console.error(err);
      toast({
        title: "Error al eliminar",
        description: "No se pudo completar la operación.",
        variant: "destructive",
      });
    }
  };

  const handleEditOpen = (asset: MediaAsset, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingAsset(asset);
    setEditTitle(asset.title || "");
    setEditDesc(asset.description || "");
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset) return;

    try {
      setUpdating(true);
      const res = await fetch(`${apiBase}/api/media-assets/${editingAsset.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: editTitle,
          description: editDesc,
        }),
      });

      if (!res.ok) throw new Error("Error updating asset");
      const updatedData = await res.json();

      toast({
        title: "Recurso actualizado",
        description: "Los metadatos fueron actualizados correctamente.",
      });

      setAssets(assets.map(a => a.id === editingAsset.id ? { ...a, ...updatedData } : a));
      setEditingAsset(null);
    } catch (err) {
      console.error(err);
      toast({
        title: "Error al actualizar",
        description: "No se pudieron guardar los cambios.",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const filteredAssets = assets.filter(a => {
    if (filterType === "ALL") return true;
    return a.assetType === filterType;
  });

  const getAssetIcon = (type: string) => {
    switch (type) {
      case "IMAGE": return <ImageIcon className="w-4 h-4" />;
      case "VIDEO": return <Video className="w-4 h-4" />;
      case "IMAGE_360": return <Compass className="w-4 h-4 text-cyan-400" />;
      case "MODEL_3D": return <Rotate3d className="w-4 h-4 text-purple-400" />;
      case "VR_TOUR": return <Glasses className="w-4 h-4 text-pink-400" />;
      default: return <ImageIcon className="w-4 h-4" />;
    }
  };

  const formatSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return mb > 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
  };

  return (
    <div className="space-y-6">
      {/* Category Tabs */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 justify-center bg-slate-950/40 p-1.5 rounded-xl border border-slate-800 max-w-2xl mx-auto">
          {["ALL", "IMAGE", "VIDEO", "IMAGE_360", "MODEL_3D", "VR_TOUR"].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterType(tab)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                filterType === tab
                  ? "bg-slate-800 text-cyan-400 shadow-md border border-slate-700"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab === "ALL" ? "Todos" : tab.replace("_", " ")}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/40 rounded-xl border border-slate-800/80">
          <Globe className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-medium">No se encontraron archivos multimedia.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredAssets.map((asset) => (
            <div
              key={asset.id}
              onClick={() => onSelectAsset && onSelectAsset(asset)}
              className="group relative bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-xl overflow-hidden cursor-pointer shadow-lg transition-all duration-300 hover:scale-[1.02] flex flex-col"
            >
              {/* Thumbnail Container */}
              <div className="relative aspect-video w-full bg-slate-950 overflow-hidden flex items-center justify-center">
                {asset.thumbnailUrl ? (
                  <img
                    src={asset.thumbnailUrl}
                    alt={asset.title || ""}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                  />
                ) : (
                  <div className="text-slate-600 flex flex-col items-center gap-1">
                    {getAssetIcon(asset.assetType)}
                    <span className="text-[10px] uppercase font-bold tracking-wider">{asset.assetType}</span>
                  </div>
                )}

                {/* Overlays / Badges */}
                <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 bg-slate-950 bg-opacity-80 backdrop-blur-md rounded border border-slate-700 text-slate-300 text-[10px] font-bold uppercase tracking-wider">
                  {getAssetIcon(asset.assetType)}
                  <span>{asset.assetType.replace("_", " ")}</span>
                </div>

                {/* Play Button Hover indicator for video */}
                {asset.assetType === "VIDEO" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-950/20 group-hover:bg-slate-950/40 transition-colors">
                    <div className="p-3 bg-cyan-500/10 backdrop-blur-md border border-cyan-400/20 rounded-full text-cyan-400 scale-90 group-hover:scale-100 transition-transform">
                      <Play className="w-5 h-5 fill-current" />
                    </div>
                  </div>
                )}

                {/* Hover Quick View Overlay */}
                <div className="absolute inset-0 bg-slate-950 bg-opacity-0 group-hover:bg-slate-950/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                  <div className="p-2 bg-slate-900 border border-slate-700 rounded-full text-cyan-400 shadow-xl">
                    <Eye className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Title & Stats */}
              <div className="p-3.5 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="font-semibold text-slate-200 text-xs truncate uppercase tracking-wider mb-0.5">
                    {asset.title || "Sin título"}
                  </h4>
                  {asset.description && (
                    <p className="text-[11px] text-slate-400 line-clamp-1 mb-2">
                      {asset.description}
                    </p>
                  )}
                </div>
                
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium border-t border-slate-800/80 pt-2 mt-2">
                  <span>{formatSize(asset.fileSize)}</span>
                  
                  {/* Action buttons */}
                  {isEditable && (
                    <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleEditOpen(asset, e)}
                        className="p-1 hover:text-cyan-400 hover:bg-slate-800 rounded transition-colors"
                        title="Editar metadatos"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(asset.id, e)}
                        className="p-1 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                        title="Eliminar recurso"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Dialog Modal */}
      {editingAsset && (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-950 bg-opacity-70 backdrop-blur-sm z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-scale-up">
            <h3 className="font-bold text-slate-100 text-lg mb-4">Editar Recurso Multimedia</h3>
            
            <form onSubmit={handleEditSave} className="space-y-4">
              <div>
                <label className="block text-slate-400 text-xs font-semibold uppercase mb-1.5">Título</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-xs font-semibold uppercase mb-1.5">Descripción</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingAsset(null)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs py-2.5 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="flex-1 bg-gradient-to-tr from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-bold text-xs py-2.5 rounded-xl shadow-lg disabled:opacity-50 transition-all"
                >
                  {updating ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
