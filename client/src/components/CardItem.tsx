import { LocationItem } from "@/data/mockData";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Star, Box, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { lazy, Suspense, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import TranslatedText from "./TranslatedText";

const VRViewer = lazy(() => import("./VRViewer"));

interface CardItemProps {
  item: LocationItem;
  onViewMap?: () => void;
  ratingOverride?: number;
}

export default function CardItem({ item, onViewMap, ratingOverride }: CardItemProps) {
  const { t } = useTranslation();
  const [vrMode, setVrMode] = useState<'product' | 'interior' | null>(null);
  const displayRating = ratingOverride ?? item.rating ?? 0;
  const hasPanorama = Boolean(item.panoramaUrl);

  return (
    <motion.div 
      whileHover={{ y: -5 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="h-full"
    >
      <div className="overflow-hidden transition-all h-full flex flex-col group border-none shadow-none bg-transparent cursor-pointer">
        <div className="relative aspect-[1/1] w-full overflow-hidden rounded-[12px] mb-3">
        <img 
          src={item.image} 
          alt={item.name} 
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute top-3 right-3">
           <span className="liquid-glass-chip inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-[#1f1f1f]">
             {t(`categories.${item.category}`)}
           </span>
        </div>
      </div>
      
      <div className="flex flex-col px-1 pb-2">
        <div className="flex justify-between items-start">
          <h3 className="text-[14px] font-bold text-foreground notranslate truncate pr-2">{item.name}</h3>
          <div className="flex items-center gap-1 text-foreground shrink-0">
            <Star className="h-3 w-3 fill-current" />
            <span className="text-[14px] font-medium">{displayRating}</span>
          </div>
        </div>
        {item.priceRange && (
           <div className="text-[14px] text-muted-foreground mt-1 truncate">{item.priceRange} • {t(`categories.${item.category}`)}</div>
        )}
      </div>
      
      <div className="flex-grow px-1">
        <p className="text-[14px] text-muted-foreground line-clamp-2">
          <TranslatedText text={item.description} />
        </p>
      </div>
      
      <div className="flex flex-col gap-2 pt-3 px-1">
        {item.hasVR && (
          <div className="grid grid-cols-2 gap-2 w-full">
             <Button 
                variant="outline" 
                size="sm" 
                className={`w-full gap-1 text-xs ${hasPanorama ? '' : 'col-span-2'}`}
                onClick={(e) => { e.stopPropagation(); setVrMode('product'); }}
             >
               <Box className="h-3 w-3" />
               {t('home.3d_model', 'Ver Producto 3D')}
             </Button>
            <Dialog open={vrMode === 'product'} onOpenChange={(open) => !open && setVrMode(null)}>
              <DialogContent 
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="glass-none h-[min(82dvh,720px)] max-h-[calc(100dvh-0.75rem)] w-[calc(100vw-0.75rem)] max-w-lg overflow-hidden rounded-2xl border-none bg-transparent p-0 shadow-none sm:h-[80vh] sm:w-full sm:max-w-[800px]"
                onInteractOutside={(e) => e.preventDefault()}
                onPointerDownOutside={(e) => e.preventDefault()}
              >
                <DialogTitle className="sr-only">Visor de producto 3D</DialogTitle>
                 <Suspense fallback={<div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">Cargando visor…</div>}>
                   <VRViewer mode="product" onClose={() => setVrMode(null)} />
                 </Suspense>
              </DialogContent>
            </Dialog>

             {hasPanorama && (
               <>
             <Button 
                variant="secondary" 
                size="sm" 
                className="w-full gap-1 text-xs"
                onClick={(e) => { e.stopPropagation(); setVrMode('interior'); }}
             >
               <Eye className="h-3 w-3" />
               {t('home.virtual_tour', 'Ver Interior 360°')}
             </Button>
            <Dialog open={vrMode === 'interior'} onOpenChange={(open) => !open && setVrMode(null)}>
              <DialogContent 
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="glass-none h-[min(82dvh,720px)] max-h-[calc(100dvh-0.75rem)] w-[calc(100vw-0.75rem)] max-w-lg overflow-hidden rounded-2xl border-none bg-transparent p-0 shadow-none sm:h-[80vh] sm:w-full sm:max-w-[800px]"
                onInteractOutside={(e) => e.preventDefault()}
                onPointerDownOutside={(e) => e.preventDefault()}
              >
                <DialogTitle className="sr-only">Tour virtual interior 360°</DialogTitle>
                 <Suspense fallback={<div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">Cargando visor…</div>}>
                   <VRViewer
                     mode="interior"
                     onClose={() => setVrMode(null)}
                     panoramaUrl={item.panoramaUrl}
                     panoramaCaption={item.panoramaCaption ?? item.name}
                   />
                 </Suspense>
              </DialogContent>
            </Dialog>
               </>
             )}
          </div>
        )}
        <Button className="w-full gap-2" onClick={(e) => { e.stopPropagation(); if (onViewMap) onViewMap(); }}>
           <MapPin className="h-4 w-4" />
           {t('home.explore_btn', 'Ver en Mapa')}
        </Button>
      </div>
    </div>
    </motion.div>
  );
}
