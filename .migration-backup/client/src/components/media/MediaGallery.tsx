import React, { useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

import { Viewer3D } from './Viewer3D';
import { Viewer360 } from './Viewer360';
import { Maximize2, Play } from 'lucide-react';

interface MediaAsset {
  id: string;
  url: string;
  type: string; // 'image', 'video', '360_image', '3d_model'
  caption?: string | null;
}

export function MediaGallery({ media, className = "" }: { media: MediaAsset[]; className?: string }) {
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  if (!media || media.length === 0) {
    return (
      <div className={`w-full h-full bg-secondary/20 flex items-center justify-center ${className}`}>
        <span className="text-muted-foreground text-sm">Sin imágenes</span>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full group ${className}`}>
      <Swiper
        modules={[Navigation, Pagination]}
        navigation
        pagination={{ clickable: true, dynamicBullets: true }}
        className="w-full h-full"
        onSlideChange={() => setActiveVideo(null)} // pause/reset video state on slide
      >
        {media.map((asset) => (
          <SwiperSlide key={asset.id} className="w-full h-full">
            <div className="w-full h-full bg-black/5 flex items-center justify-center relative overflow-hidden">
              {asset.type === '3d_model' ? (
                <Viewer3D src={asset.url} alt={asset.caption || "3D Model"} />
              ) : asset.type === '360_image' ? (
                <Viewer360 url={asset.url} />
              ) : asset.type === 'video' ? (
                <div className="w-full h-full relative" onClick={() => setActiveVideo(asset.id)}>
                  {activeVideo === asset.id ? (
                    <video 
                      src={asset.url} 
                      controls 
                      autoPlay 
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <>
                      {/* Generamos un poster a partir del primer frame o mostramos black si no hay */}
                      <video src={asset.url} className="w-full h-full object-contain opacity-70" preload="metadata" />
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
                <div className="bg-black/60 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-xs font-medium shadow-md">
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
          background: rgba(0,0,0,0.4);
          width: 40px !important;
          height: 40px !important;
          border-radius: 50%;
          opacity: 0;
          transition: all 0.3s ease;
          backdrop-filter: blur(4px);
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
