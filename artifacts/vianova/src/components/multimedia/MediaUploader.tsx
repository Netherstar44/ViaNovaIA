import React, { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { UploadCloud, FileText, Check, AlertCircle, Sparkles } from "lucide-react";
import { apiBase } from "@/lib/queryClient";

interface MediaUploaderProps {
  onUploadSuccess?: (asset: any) => void;
  entityType?: string;
  entityId?: string;
}

export const MediaUploader: React.FC<MediaUploaderProps> = ({
  onUploadSuccess,
  entityType = "user",
  entityId
}) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [is360, setIs360] = useState(false);
  const [isVR, setIsVR] = useState(false);
  
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const validateAndSetFile = (selectedFile: File) => {
    const ext = selectedFile.name.split(".").pop()?.toLowerCase();
    const sizeInMB = selectedFile.size / (1024 * 1024);

    // 1. File size check (max 50MB)
    if (sizeInMB > 50) {
      toast({
        title: "Archivo demasiado grande",
        description: "El límite máximo es 50MB.",
        variant: "destructive",
      });
      return;
    }

    // 2. Format validation
    const allowedExtensions = ["jpg", "jpeg", "png", "webp", "mp4", "webm", "glb", "gltf"];
    if (!ext || !allowedExtensions.includes(ext)) {
      toast({
        title: "Formato no soportado",
        description: "Formatos válidos: JPG, JPEG, PNG, WEBP, MP4, WEBM, GLB, GLTF",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
    setTitle(selectedFile.name.replace(/\.[^/.]+$/, "")); // Auto title without extension

    // Smart defaults based on extension
    if (ext === "glb" || ext === "gltf") {
      setIs360(false);
      setIsVR(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setProgress(10);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title);
    formData.append("description", description);
    formData.append("entityType", entityType);
    if (entityId) {
      formData.append("entityId", entityId);
    }
    formData.append("is360", String(is360));
    formData.append("isVR", String(isVR));

    try {
      setProgress(40);
      const res = await fetch(apiBase + "/api/media-assets/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      setProgress(80);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Error al subir el archivo.");
      }

      const data = await res.json();
      setProgress(100);

      toast({
        title: "¡Subida exitosa!",
        description: `El recurso "${title}" se ha procesado correctamente.`,
      });

      // Reset form
      setFile(null);
      setTitle("");
      setDescription("");
      setIs360(false);
      setIsVR(false);

      if (onUploadSuccess) {
        onUploadSuccess(data);
      }
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Error de subida",
        description: err.message || "No se pudo completar la operación.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const triggerSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl max-w-xl mx-auto transition-all duration-300 hover:border-slate-700">
      <div className="flex items-center gap-2 mb-6">
        <div className="p-2 bg-gradient-to-tr from-cyan-600 to-purple-600 rounded-lg text-white">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-slate-100 text-lg">Cargar Contenido Multimedia</h3>
          <p className="text-slate-400 text-xs">Imágenes, Videos, Fotos 360°, Modelos 3D y VR</p>
        </div>
      </div>

      <form onSubmit={handleUpload} className="space-y-4">
        {/* Dropzone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={triggerSelect}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${
            isDragging
              ? "border-cyan-500 bg-cyan-950/20"
              : file
              ? "border-emerald-600 bg-emerald-950/10"
              : "border-slate-700 hover:border-slate-600 hover:bg-slate-800/50"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept=".jpg,.jpeg,.png,.webp,.mp4,.webm,.glb,.gltf"
          />

          {file ? (
            <div className="flex flex-col items-center">
              <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-400 mb-3 animate-pulse">
                <Check className="w-8 h-8" />
              </div>
              <p className="text-slate-200 font-semibold text-sm max-w-xs truncate">{file.name}</p>
              <span className="text-slate-400 text-xs mt-1">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                }}
                className="mt-3 text-xs text-red-400 hover:text-red-300 underline font-medium"
              >
                Cambiar archivo
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="p-3 bg-slate-800 rounded-full text-slate-400 mb-3">
                <UploadCloud className="w-8 h-8" />
              </div>
              <p className="text-slate-200 font-semibold text-sm">
                Arrastra tu archivo aquí o haz clic para buscar
              </p>
              <span className="text-slate-500 text-xs mt-2 block">
                Soporta JPG, PNG, WEBP, MP4, GLB, GLTF (Max. 50MB)
              </span>
            </div>
          )}
        </div>

        {file && (
          <div className="space-y-4 animate-fade-in">
            {/* Metadata Fields */}
            <div>
              <label className="block text-slate-300 text-xs font-semibold uppercase mb-1.5 tracking-wider">Título</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                placeholder="Nombre descriptivo del recurso"
              />
            </div>

            <div>
              <label className="block text-slate-300 text-xs font-semibold uppercase mb-1.5 tracking-wider">Descripción (Opcional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all resize-none"
                placeholder="Escribe detalles adicionales..."
              />
            </div>

            {/* Multimedia Toggles */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <label className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl border border-slate-800 cursor-pointer hover:bg-slate-800 transition-colors">
                <input
                  type="checkbox"
                  checked={is360}
                  onChange={(e) => {
                    setIs360(e.target.checked);
                    if (e.target.checked) setIsVR(false); // Mutually exclusive for simplicity unless dual
                  }}
                  className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500 w-4 h-4"
                />
                <div>
                  <span className="block text-xs font-semibold text-slate-200">Es Foto 360°</span>
                  <span className="text-[10px] text-slate-500 block">Vista panorámica circular</span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl border border-slate-800 cursor-pointer hover:bg-slate-800 transition-colors">
                <input
                  type="checkbox"
                  checked={isVR}
                  onChange={(e) => {
                    setIsVR(e.target.checked);
                    if (e.target.checked) setIs360(false);
                  }}
                  className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500 w-4 h-4"
                />
                <div>
                  <span className="block text-xs font-semibold text-slate-200">Es Tour / Video VR</span>
                  <span className="text-[10px] text-slate-500 block">Compatible con visores</span>
                </div>
              </label>
            </div>

            {/* Uploading progress */}
            {uploading && (
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-xs text-slate-400 font-medium">
                  <span>Procesando archivo...</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-cyan-500 to-purple-500 h-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={uploading}
              className="w-full mt-4 bg-gradient-to-tr from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-bold text-sm py-3 px-4 rounded-xl shadow-lg shadow-cyan-950/20 disabled:opacity-50 transition-all duration-300 transform active:scale-[0.98]"
            >
              {uploading ? "Subiendo..." : "Comenzar Subida"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
