import React from "react";
import { X } from "lucide-react";
import { MediaAsset } from "./MediaGallery";
import { Media360Viewer } from "./Media360Viewer";
import { Model3DViewer } from "./Model3DViewer";
import { VRViewer } from "./VRViewer";

interface MediaViewerProps {
  asset: MediaAsset | null;
  onClose: () => void;
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return "";
  const mb = bytes / (1024 * 1024);
  return mb > 0.1 ? `${mb.toFixed(2)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

export const MediaViewer: React.FC<MediaViewerProps> = ({ asset, onClose }) => {
  if (!asset) return null;

  const renderContent = () => {
    switch (asset.assetType) {
      case "IMAGE_360":
        return <Media360Viewer imageUrl={asset.fileUrl} title={asset.title || ""} />;

      case "MODEL_3D":
        return <Model3DViewer modelUrl={asset.fileUrl} title={asset.title || ""} />;

      case "VR_TOUR":
        return <VRViewer mediaUrl={asset.fileUrl} title={asset.title || ""} />;

      case "VIDEO":
        return (
          <div className="relative w-full bg-black rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center" style={{ minHeight: 320 }}>
            <video
              src={asset.fileUrl}
              controls
              playsInline
              muted={false}
              className="max-w-full max-h-[60vh] block object-contain"
              onLoadStart={(e) => {
                const v = e.currentTarget;
                v.style.opacity = "0";
              }}
              onCanPlay={(e) => {
                const v = e.currentTarget;
                v.style.opacity = "1";
                v.style.transition = "opacity 0.3s";
              }}
            />
          </div>
        );

      case "IMAGE":
      default:
        return (
          <div className="relative w-full bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center" style={{ minHeight: 320 }}>
            <img
              src={asset.fileUrl}
              alt={asset.title || "Imagen"}
              className="max-w-full max-h-[65vh] object-contain block"
              loading="eager"
            />
          </div>
        );
    }
  };

  const sizeStr = formatFileSize(asset.fileSize);
  const hasFooter = asset.description || sizeStr || asset.width || asset.duration;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-slate-950/90 backdrop-blur-md z-[100] p-4 md:p-6 overflow-y-auto"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Modal Wrapper */}
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md flex-shrink-0">
          <div>
            <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest block mb-0.5">
              Visualizador Multimedia • {asset.assetType.replace("_", " ")}
            </span>
            <h3 className="font-bold text-slate-100 text-base md:text-lg truncate max-w-md md:max-w-xl">
              {asset.title || "Archivo Multimedia"}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-200 transition-colors flex-shrink-0"
            title="Cerrar Visualizador"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Viewer viewport */}
        <div className="p-4 md:p-6 bg-slate-950/60 flex-1">
          {renderContent()}
        </div>

        {/* Footer info — only shown when there's real data */}
        {hasFooter && (
          <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/50 text-sm flex-shrink-0">
            {asset.description && (
              <p className="text-slate-300 font-medium text-sm mb-3 leading-relaxed">
                {asset.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-semibold uppercase tracking-wider">
              {asset.width && asset.height && (
                <span>Resolución: {asset.width}×{asset.height} px</span>
              )}
              {asset.duration && (
                <span>Duración: {asset.duration}s</span>
              )}
              <span>Tipo: {asset.mimeType}</span>
              {sizeStr && <span>Peso: {sizeStr}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
