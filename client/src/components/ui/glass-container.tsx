import { motion, useReducedMotion } from "framer-motion";
import { ReactNode } from "react";

interface GlassContainerProps {
  children: ReactNode;
  className?: string;
  strong?: boolean;
  hover?: boolean;
}

export const GlassContainer = ({
  children,
  className = "",
  strong = false,
  hover = false,
}: GlassContainerProps) => {
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }}
      transition={
        reduce
          ? { duration: 0.2, ease: "easeOut" }
          : { type: "spring", duration: 0.5, bounce: 0.15 }
      }
      whileHover={
        hover && !reduce
          ? { y: -2, boxShadow: "0 16px 48px 0 rgba(15, 23, 42, 0.24)" }
          : undefined
      }
      className={`liquid-glass ${strong ? "liquid-glass--strong" : ""} ${
        hover ? "liquid-glass--hover" : ""
      } p-4 ${className}`}
    >
      {children}
    </motion.div>
  );
};
