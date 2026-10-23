import { motion } from "framer-motion";
import { ReactNode } from "react";

interface GlassContainerProps {
  children: ReactNode;
  className?: string;
}

export const GlassContainer = ({ children, className = "" }: GlassContainerProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className={`liquid-glass p-4 ${className}`}
    >
      {children}
    </motion.div>
  );
};
