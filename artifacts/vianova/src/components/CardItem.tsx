import { apiBase } from "@/lib/queryClient";
import { LocationItem } from "@/data/mockData";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Star, Box, Eye, Clock, DollarSign, Bed, Utensils, ImageIcon, ConciergeBell, Map } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import VRViewer from "./VRViewer";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import TranslatedText from "./TranslatedText";

interface CardItemProps {
  item: LocationItem;
  onViewMap?: () => void;
}

export default function CardItem({ item, onViewMap }: CardItemProps) {
  const { t } = useTranslation();
  const [vrMode, setVrMode] = useState<'product' | 'interior' | null>(null);
  const [realRating, setRealRating] = useState<number>(item.rating || 0);

  useEffect(() => {
    fetch(`${apiBase}/api/comments?locationId=${item.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.comments && data.comments.length > 0) {
          const sum = data.comments.reduce((a: number, b: any) => a + (b.rating || 0), 0);
          setRealRating(Number((sum / data.comments.length).toFixed(1)));
        }
      })
      .catch(() => {});
  }, [item.id]);

  const isRestaurant = item.category === 'restaurant';
  const hasMenu = isRestaurant && item.menuData && (item.menuData.pdfUrl || item.menuData.imageUrl || (item.menuData.categories && item.menuData.categories.length > 0));
  const hasGallery = item.mediaGallery?.images && item.mediaGallery.images.length > 0;

  return (
    <motion.div 
      whileHover={{ y: -5 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="h-full"
    >
      <Card className="overflow-hidden transition-all hover:shadow-2xl h-full flex flex-col group border-primary/10">
        {/* ─── IMAGE HEADER ─── */}
        <div className="relative h-48 w-full overflow-hidden">
          <img 
            src={item.image} 
            alt={item.name} 
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {/* Category badge (top-right) */}
          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
            <Badge variant="secondary" className="backdrop-blur-md bg-black/70 text-white border-none font-semibold shadow-lg">
              {t(`categories.${item.category}`)}
            </Badge>
          </div>

          {/* Bottom-left overlay badges */}
          <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
            {item.hasVR && (
              <Badge className="bg-purple-600/90 text-white border-none text-[10px] font-bold backdrop-blur-sm shadow-md">
                🥽 VR 360
              </Badge>
            )}
            {item.hasAR && (
              <Badge className="bg-indigo-600/90 text-white border-none text-[10px] font-bold backdrop-blur-sm shadow-md">
                <Box className="h-3 w-3 mr-0.5" /> 3D
              </Badge>
            )}
            {isRestaurant && item.roomService && (
              <Badge className="bg-emerald-600/90 text-white border-none text-[10px] font-bold backdrop-blur-sm shadow-md">
                <ConciergeBell className="h-3 w-3 mr-0.5" /> Room Service
              </Badge>
            )}
            {isRestaurant && item.parentHotelId && (
              <Badge className="bg-amber-600/90 text-white border-none text-[10px] font-bold backdrop-blur-sm shadow-md">
                <Bed className="h-3 w-3 mr-0.5" /> Hotel
              </Badge>
            )}
            {hasGallery && (
              <Badge className="bg-sky-600/90 text-white border-none text-[10px] font-bold backdrop-blur-sm shadow-md">
                <ImageIcon className="h-3 w-3 mr-0.5" /> {item.mediaGallery!.images.length}
              </Badge>
            )}
          </div>
        </div>
       
        {/* ─── HEADER ─── */}
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <CardTitle className="text-lg font-bold notranslate">{item.name}</CardTitle>
            <div className="flex items-center gap-1 text-amber-500">
              <Star className="h-4 w-4 fill-current" />
              <span className="text-sm font-medium">{realRating}</span>
            </div>
          </div>
          {/* Price info row */}
          <div className="flex items-center gap-2 flex-wrap">
            {item.priceRange && (
              <span className="text-sm text-muted-foreground">{item.priceRange} • {t(`categories.${item.category}`)}</span>
            )}
            {isRestaurant && item.price != null && item.price > 0 && (
              <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                <DollarSign className="h-3 w-3" />
                ~{item.price.toLocaleString()}
              </span>
            )}
          </div>
        </CardHeader>
       
        {/* ─── CONTENT ─── */}
        <CardContent className="flex-grow space-y-2">
          <p className="text-sm text-muted-foreground line-clamp-2">
            <TranslatedText text={item.description} />
          </p>

          {/* Schedule (text as-is) */}
          {item.schedule && (
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground/80">
              <Clock className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <span className="line-clamp-1">{item.schedule}</span>
            </div>
          )}

          {/* Room service schedule */}
          {isRestaurant && item.roomService && item.roomServiceSchedule && (
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground/80">
              <ConciergeBell className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span className="line-clamp-1">Room Service: {item.roomServiceSchedule}</span>
            </div>
          )}
        </CardContent>
       
        {/* ─── FOOTER ACTIONS ─── */}
        <CardFooter className="flex flex-col gap-2 pt-0">
          {/* VR/3D buttons */}
          {item.hasVR && (
            <div className="grid grid-cols-2 gap-2 w-full">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full gap-1 text-xs"
                onClick={(e) => { e.stopPropagation(); setVrMode('product'); }}
              >
                <Box className="h-3 w-3" />
                {t('home.3d_model', 'Ver Producto 3D')}
              </Button>
              <Dialog open={vrMode === 'product'} onOpenChange={(open) => !open && setVrMode(null)}>
                <DialogContent 
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="sm:max-w-[800px] h-[80vh] p-0 border-none bg-transparent shadow-none"
                  onInteractOutside={(e) => e.preventDefault()}
                  onPointerDownOutside={(e) => e.preventDefault()}
                >
                  <VRViewer mode="product" onClose={() => setVrMode(null)} />
                </DialogContent>
              </Dialog>

              <Button 
                variant="secondary" 
                size="sm" 
                className="w-full gap-1 text-xs"
                onClick={(e) => { e.stopPropagation(); setVrMode('interior'); }}
              >
                <Eye className="h-3 w-3" />
                {t('home.virtual_tour', 'Ver Interior VR')}
              </Button>
              <Dialog open={vrMode === 'interior'} onOpenChange={(open) => !open && setVrMode(null)}>
                <DialogContent 
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="sm:max-w-[800px] h-[80vh] p-0 border-none bg-transparent shadow-none"
                  onInteractOutside={(e) => e.preventDefault()}
                  onPointerDownOutside={(e) => e.preventDefault()}
                >
                  <VRViewer mode="interior" onClose={() => setVrMode(null)} />
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* Action buttons row */}
          <div className={`grid gap-2 w-full ${hasMenu ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {/* Ver Carta button — only if restaurant has menu data */}
            {hasMenu && (
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full gap-1 text-xs border-orange-500/40 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300"
                onClick={(e) => {
                  e.stopPropagation();
                  const url = item.menuData!.pdfUrl || item.menuData!.imageUrl;
                  if (url) window.open(url, '_blank');
                }}
              >
                <Utensils className="h-3 w-3" />
                Ver Carta
              </Button>
            )}

            {/* Ver Mapa button — uses googleMapsUrl if available, fallback to onViewMap */}
            <Button 
              size="sm"
              className="w-full gap-1 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                if (item.googleMapsUrl) {
                  window.open(item.googleMapsUrl, '_blank');
                } else if (onViewMap) {
                  onViewMap();
                }
              }}
            >
              <Map className="h-3 w-3" />
              Ver Mapa
            </Button>
          </div>

          {/* Ver Detalles — always visible */}
          <Button className="w-full gap-2" variant="secondary" onClick={(e) => { e.stopPropagation(); if (onViewMap) onViewMap(); }}>
            <MapPin className="h-4 w-4" />
            {t('home.explore_btn', 'Ver Detalles')}
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
