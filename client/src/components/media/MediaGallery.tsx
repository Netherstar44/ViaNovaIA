import React, { lazy, Suspense, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

import { Maximize2, Play, Loader2 } from 'lucide-react';

// Heavy viewers are loaded only when a 3D/360 slide is actually present.
const Viewer3D = lazy(() => import('./Viewer3D').then((module) => ({ default: module.Viewer3D })));
const Viewer360 = lazy(() => import('./Viewer360').then((module) => ({ default: module.Viewer360 })));

function ViewerFallback() {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
      <Loader2 className="h-7 w-7 animate-spin text-primary" />
    </div>
  );
}

function ViewerPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-black/40 text-white/60">
      <span className="text-xs font-bold uppercase tracking-widest">{label}</span>
      <span className="text-[11px] text-white/40">Desliza para cargar</span>
    </div>
  );
}

interface MediaAsset {
  id: string;
  url: string;
  type: string; // 'image', 'video', '360_image', '3d_model'
  caption?: string | null;
}

export function MediaGallery({ media, className = "" }: { media: MediaAsset[]; className?: string }) {
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  if (!media || media.length === 0) {
    return (
      <div className={`w-full h-full bg-secondary/20 flex items-center justify-center ${className}`}>
        <span className="text-muted-foreground text-sm">Sin imágenes</span>
      </div>
    );
  }

  return (
    <div className={`relative h-full w-full group ${className}`}>
      <Swiper
        modules={[Navigation, Pagination]}
        navigation
        pagination={{ clickable: true, dynamicBullets: true }}
        className="h-full w-full"
        onSlideChange={(swiper) => {
          setActiveVideo(null);
          setActiveIndex(swiper.activeIndex);
        }}
      >
        {media.map((asset, index) => (
          <SwiperSlide key={asset.id} className="w-full h-full">
            <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black/5">
              {asset.type === '3d_model' || asset.type === 'model_3d' ? (
                activeIndex === index ? (
                  <Suspense fallback={<ViewerFallback />}>
                    <Viewer3D src={asset.url} alt={asset.caption || "3D Model"} />
                  </Suspense>
                ) : (
                  <ViewerPlaceholder label="Modelo 3D" />
                )
              ) : asset.type === '360_image' || asset.type === 'image_360' ? (
                activeIndex === index ? (
                  <Suspense fallback={<ViewerFallback />}>
                    <Viewer360 url={asset.url} />
                  </Suspense>
                ) : (
                  <ViewerPlaceholder label="Imagen 360°" />
                )
              ) : asset.type === 'video' ? (
                <div className="w-full h-full relative" onClick={() => setActiveVideo(asset.id)}>
                  {activeVideo === asset.id ? (
                    <video 
                      src={asset.url} 
                      controls 
                      autoPlay 
                      playsInline
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <>
                      {/* Generamos un poster a partir del primer frame o mostramos black si no hay */}
                      <video src={asset.url} playsInline className="w-full h-full object-contain opacity-70" preload="metadata" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors cursor-pointer">
                        <div className="w-16 h-16 rounded-full bg-primary/90 text-black flex items-center justify-center pl-1 shadow-lg hover:scale-110 transition-transform">
                          <Play className="h-8 w-8" />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <img 
                  src={asset.url} 
                  alt={asset.caption || "Image"} 
                  className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" 
                />
              )}
            </div>
            {asset.caption && (
              <div className="absolute bottom-10 left-0 right-0 z-10 flex justify-center pointer-events-none">
                <div className="liquid-glass-chip px-4 py-1.5 rounded-lg text-xs font-medium text-[#1f1f1f]">
                  {asset.caption}
                </div>
              </div>
            )}
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Global CSS overrides for Swiper within this component */}
      <style dangerouslySetInnerHTML={{__html: `
        .swiper-button-next, .swiper-button-prev {
          color: #c9a227 !important;
          background: rgba(9, 10, 12, 0.78);
          border: 1px solid rgba(255, 255, 255, 0.16);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.26), 0 6px 18px -8px rgba(0, 0, 0, 0.55);
          width: 40px !important;
          height: 40px !important;
          border-radius: 50%;
          opacity: 0;
          transition: all 0.3s ease;
        }
        .swiper-button-next:after, .swiper-button-prev:after {
          font-size: 16px !important;
          font-weight: bold;
        }
        .group:hover .swiper-button-next, .group:hover .swiper-button-prev {
          opacity: 1;
        }
        .swiper-pagination-bullet {
          background: rgba(255,255,255,0.7) !important;
        }
        .swiper-pagination-bullet-active {
          background: #c9a227 !important;
        }
      `}} />
    </div>
  );
}
