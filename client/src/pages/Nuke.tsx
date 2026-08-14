import { useEffect, useState } from "react";
import { apiBase } from "@/lib/queryClient";
import { motion } from "framer-motion";
import { Skull } from "lucide-react";

export default function Nuke() {
  const [status, setStatus] = useState("Iniciando secuencia de autodestrucción...");

  useEffect(() => {
    fetch(`${apiBase}/api/nuke-local232`)
      .then(r => r.json())
      .then(d => {
        setStatus(d.message || "Destruido!");
        
        // Trigger DB seed automatically
        setStatus("Inyectando 60 lugares reales...");
        fetch(`${apiBase}/api/seed-60`)
          .then(r2 => r2.json())
          .then(d2 => {
            setStatus("DB Limpia y 60 lugares inyectados.");
          });
      })
      .catch(e => {
        setStatus("Error: " + e.message);
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-red-500 font-mono flex-col gap-6 p-4 text-center">
      <motion.div
        animate={{ scale: [1, 1.2, 1], rotate: [0, -5, 5, 0] }}
        transition={{ repeat: Infinity, duration: 0.5 }}
      >
        <Skull className="h-32 w-32" />
      </motion.div>
      <h1 className="text-4xl font-bold animate-pulse uppercase tracking-widest text-red-600 drop-shadow-[0_0_15px_rgba(220,38,38,0.8)]">
        Protocolo Autodestrucción
      </h1>
      <p className="text-xl text-red-400 bg-red-950/30 px-6 py-3 rounded-lg border border-red-500/30">
        {status}
      </p>
      {status.includes("inyectados") && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm mt-10 text-red-300/50">
          Ya puedes cerrar esta ventana y volver al inicio.
        </motion.p>
      )}
    </div>
  );
}
