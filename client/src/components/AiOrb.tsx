import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { seoPages } from "@shared/seo-content";
import GlassCanvas from "@/components/ui/GlassCanvas";
import AiSparkIcon from "@/components/ui/AiSparkIcon";

/**
 * Desktop entry point for the assistant. It stays mounted while the chat
 * chunk is still loading, and disappears as soon as the panel opens so the
 * two never overlap. Mobile uses the dock's IA tab instead.
 */
export default function AiOrb() {
  const [location] = useLocation();
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    const onChatState = (event: Event) => {
      const detail = (event as CustomEvent<{ open?: boolean }>).detail;
      setChatOpen(Boolean(detail?.open));
    };
    window.addEventListener("vianova:chat-state", onChatState);
    return () => window.removeEventListener("vianova:chat-state", onChatState);
  }, []);

  const hidden =
    chatOpen ||
    location === "/login" ||
    seoPages.some((page) => `/${page.slug}` === location);

  const openChat = () => {
    window.__vianovaChatRequested = true;
    window.dispatchEvent(new CustomEvent("vianova:open-chat"));
  };

  return (
    <AnimatePresence>
      {!hidden && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="fixed bottom-6 right-6 z-50 hidden rounded-full shadow-lg shadow-primary/30 transition-shadow hover:shadow-xl hover:shadow-primary/60 md:block"
        >
          <button
            id="chatbot-open-btn"
            type="button"
            onClick={openChat}
            aria-label="Abrir el asistente VIANova"
            className="lg-surface lg-surface--orb relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <GlassCanvas variant="orb" />
            <span className="lg-orb__core" aria-hidden="true">
              <AiSparkIcon className="lg-orb__icon h-8 w-8" />
            </span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
