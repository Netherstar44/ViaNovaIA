import { apiBase } from "@/lib/queryClient";
import { LocationItem } from "@/data/mockData";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Star, Box, Eye } from "lucide-react";
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

  return (
    <motion.div 
      whileHover={{ y: -5 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="h-full"
    >
      <Card className="overflow-hidden transition-all hover:shadow-2xl h-full flex flex-col group border-primary/10">
        <div className="relative h-48 w-full overflow-hidden">
        <img 
          src={item.image} 
          alt={item.name} 
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute top-2 right-2">
           <Badge variant="secondary" className="backdrop-blur-md bg-black/70 text-white border-none font-semibold shadow-lg">
             {t(`categories.${item.category}`)}
           </Badge>
        </div>
      </div>
      
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-bold notranslate">{item.name}</CardTitle>
          <div className="flex items-center gap-1 text-amber-500">
            <Star className="h-4 w-4 fill-current" />
            <span className="text-sm font-medium">{realRating}</span>
          </div>
        </div>
        {item.priceRange && (
           <div className="text-sm text-muted-foreground">{item.priceRange} • {t(`categories.${item.category}`)}</div>
        )}
      </CardHeader>
      
      <CardContent className="flex-grow">
        <p className="text-sm text-muted-foreground line-clamp-2">
          <TranslatedText text={item.description} />
        </p>
      </CardContent>
      
      <CardFooter className="flex flex-col gap-2 pt-0">
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
        <Button className="w-full gap-2" onClick={(e) => { e.stopPropagation(); if (onViewMap) onViewMap(); }}>
           <MapPin className="h-4 w-4" />
           {t('home.explore_btn', 'Ver en Mapa')}
        </Button>
      </CardFooter>
    </Card>
    </motion.div>
  );
}
