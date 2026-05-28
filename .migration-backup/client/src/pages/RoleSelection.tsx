import React, { useState } from "react";
import { useLocation } from "wouter";
import { useAuth, UserRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { User, Building2, Utensils, TentTree, Car, ArrowRight, Loader2, Languages } from "lucide-react";
import { motion } from "framer-motion";

const ROLES: { value: UserRole; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: "traveler", label: "Viajero", icon: <User className="h-6 w-6" />, desc: "Quiero explorar destinos y servicios" },
  { value: "hotel", label: "Hotel", icon: <Building2 className="h-6 w-6" />, desc: "Tengo un alojamiento para ofrecer" },
  { value: "restaurant", label: "Restaurante", icon: <Utensils className="h-6 w-6" />, desc: "Quiero promover mi restaurante" },
  { value: "recreation", label: "Recreacion", icon: <TentTree className="h-6 w-6" />, desc: "Ofrezco actividades y experiencias" },
  { value: "taxi", label: "Transporte", icon: <Car className="h-6 w-6" />, desc: "Brindo servicios de transporte" },
  { value: "translator", label: "Traductor", icon: <Languages className="h-6 w-6" />, desc: "Intermedío entre extranjeros y locales" },
];

export default function RoleSelection() {
  const { user, changeRole } = useAuth();
  const [_, setLocation] = useLocation();
  const [selected, setSelected] = useState<UserRole>("traveler");
  const [submitting, setSubmitting] = useState(false);

  if (!user) {
    setLocation("/login");
    return null;
  }

  const handleConfirm = async () => {
    setSubmitting(true);
    if (selected === "traveler") {
      // Just mark role as "chosen" by calling changeRole even with same value
      await changeRole("traveler");
    } else {
      await changeRole(selected);
    }
    setSubmitting(false);
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-lg"
      >
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 px-4 py-2 rounded-2xl mb-6">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="hsl(45,100%,50%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21l9-18 9 18H3z"/><path d="M9 21v-8"/><path d="M15 21v-8"/></svg>
            <span className="font-heading font-bold text-lg"><span className="text-primary">VIA</span>Nova</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">¿Cómo usarás VIANova?</h1>
          <p className="text-muted-foreground text-sm">Selecciona tu tipo de cuenta. Podrás cambiarlo después desde la configuración.</p>
        </div>

        {/* Role options */}
        <div className="space-y-3 mb-8">
          {ROLES.map((role) => (
            <button
              key={role.value}
              onClick={() => setSelected(role.value)}
              className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-4 ${
                selected === role.value
                  ? "bg-primary/10 border-primary/40 ring-1 ring-primary/20"
                  : "bg-card/30 border-border/30 hover:border-border/60 hover:bg-card/50"
              }`}
            >
              <div className={`p-2.5 rounded-xl transition-colors ${
                selected === role.value ? "bg-primary/20 text-primary" : "bg-secondary/50 text-muted-foreground"
              }`}>
                {role.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{role.label}</p>
                <p className="text-xs text-muted-foreground">{role.desc}</p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                selected === role.value ? "border-primary bg-primary" : "border-border/50"
              }`}>
                {selected === role.value && (
                  <div className="w-2 h-2 rounded-full bg-black" />
                )}
              </div>
            </button>
          ))}
        </div>

        <Button
          onClick={handleConfirm}
          disabled={submitting}
          className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl text-md group"
        >
          {submitting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</>
          ) : (
            <>Continuar <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" /></>
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground/50 mt-4">
          Puedes cambiar tu rol cada 15 días desde la configuración de tu perfil.
        </p>
      </motion.div>
    </div>
  );
}
