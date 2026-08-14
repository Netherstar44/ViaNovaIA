import { useTranslation } from "react-i18next";
import TranslatedText from "./TranslatedText";
import { apiBase } from "@/lib/queryClient";
import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Image as ImageIcon, Loader2, Bot, Sparkles, MapPin, Hotel, UtensilsCrossed, Car, Ticket, CheckCircle2, Mic, MicOff, AudioLines } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/lib/auth';
import { motion, AnimatePresence } from 'framer-motion';
import botLogo from '../assets/bot-logo.png';
import aiSvgIcon from '../assets/iasvg.png';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
}

export default function Chatbot() {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: t('chatbot.start') }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sharedLocation, setSharedLocation] = useState<{lat: number, lng: number} | undefined>();
  const [isLocating, setIsLocating] = useState(false);
  const [manualLocationInput, setManualLocationInput] = useState('');
  const [destinationCity, setDestinationCity] = useState('');
  const [isSendingBookings, setIsSendingBookings] = useState(false);
  const [bookingsSent, setBookingsSent] = useState(false);

  // Voice Mode States
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  
  const messagesRef = useRef(messages);
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptRef = useRef('');
  const isHandlingVoiceRef = useRef(false);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current && !isVoiceMode) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isLoading, isVoiceMode]);

  useEffect(() => {
    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true; // Listen continuously like Gemini
        recognition.interimResults = true;
        const langMap: Record<string, string> = { es: 'es-ES', en: 'en-US', fr: 'fr-FR', pt: 'pt-BR', zh: 'zh-CN' };
        recognition.lang = langMap[i18n.language] || 'es-ES';
        
        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';
          let isFinal = false;

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
              isFinal = true;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          
          const currentText = (transcriptRef.current + " " + finalTranscript).trim() + (interimTranscript ? " " + interimTranscript : "");
          setVoiceTranscript(currentText);
          
          if (isFinal) {
            transcriptRef.current = (transcriptRef.current + " " + finalTranscript).trim();
            // Auto-send after 2 seconds of silence (Gemini style)
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => {
              if (transcriptRef.current.trim() && !isHandlingVoiceRef.current) {
                handleVoiceSend(transcriptRef.current.trim());
              }
            }, 2000);
          }
        };

        recognition.onerror = (event: any) => {
          if (event.error !== 'no-speech') {
            console.error('Speech recognition error', event.error);
            setIsListening(false);
          }
        };

        recognition.onend = () => {
          // Restart automatically if still in voice mode and not speaking (continuous mode drops sometimes)
          if (!isHandlingVoiceRef.current && isVoiceMode) {
             try { recognition.start(); } catch(e) {}
          } else {
             setIsListening(false);
          }
        };

        recognitionRef.current = recognition;
      }
    } catch (e) {
      console.error("SpeechRecognition initialization failed", e);
    }
    
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch(e) {}
      }
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current = null;
        } catch(e) {}
      }
    };
  }, []);

  const playTTS = async (text: string, onReady?: () => void) => {
    // Clean text: remove asterisks completely, remove code blocks, and markdown structure
    const cleanText = text
      .replace(/\*/g, '') // Remove all asterisks
      .replace(/###.*/g, '')
      .replace(/\[.*?\]/g, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/📋 Solicitudes de Reserva[\s\S]*/g, '')
      .replace(/[#_~`>|]/g, '')
      .trim();
      
    if (!cleanText) {
      if (onReady) onReady();
      return;
    }

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setIsSpeaking(true);

    try {
      const edgeVoices: Record<string, string> = {
        es: 'es-CO-GonzaloNeural',
        en: 'en-US-AriaNeural',
        fr: 'fr-FR-DeniseNeural',
        pt: 'pt-BR-FranciscaNeural',
        zh: 'zh-CN-XiaoxiaoNeural'
      };
      const selectedVoice = edgeVoices[i18n.language] || 'es-CO-GonzaloNeural';

      // Edge TTS – Microsoft Neural Voice
      const res = await fetch(apiBase + '/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText, voice: selectedVoice })
      });

      if (!res.ok) throw new Error('TTS request failed');

      const audioBlob = await res.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
        // Resume listening after speaking (Gemini style)
        if (isVoiceMode) {
          try { recognitionRef.current?.start(); setIsListening(true); } catch(e) {}
        }
      };

      audio.onerror = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
        if (isVoiceMode) {
          try { recognitionRef.current?.start(); setIsListening(true); } catch(e) {}
        }
      };

      // Pause mic while speaking so it doesn't hear itself
      try { recognitionRef.current?.stop(); setIsListening(false); } catch(e) {}
      
      if (onReady) onReady();
      await audio.play();
    } catch (err) {
      console.error('Edge TTS error, falling back to Web Speech:', err);
      setIsSpeaking(false);
      // Fallback: Web Speech API
      try {
        const synth = window.speechSynthesis;
        const utterance = new SpeechSynthesisUtterance(cleanText);
        const langMap: Record<string, string> = { es: 'es-CO', en: 'en-US', fr: 'fr-FR', pt: 'pt-BR', zh: 'zh-CN' };
        utterance.lang = langMap[i18n.language] || 'es-CO';
        utterance.rate = 1.05;
        utterance.pitch = 1.1;
        utterance.onstart = () => {
          setIsSpeaking(true);
          try { recognitionRef.current?.stop(); setIsListening(false); } catch(e) {}
        };
        utterance.onend = () => {
          setIsSpeaking(false);
          if (isVoiceMode) {
            try { recognitionRef.current?.start(); setIsListening(true); } catch(e) {}
          }
        };
        synth.cancel();
        if (onReady) onReady();
        synth.speak(utterance);
      } catch (e) {
        console.error('Fallback TTS also failed', e);
        if (onReady) onReady();
      }
    }
  };

  const toggleVoiceMode = () => {
    if (isVoiceMode) {
      setIsVoiceMode(false);
      setIsListening(false);
      recognitionRef.current?.stop();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      try { window.speechSynthesis?.cancel(); } catch(e) {}
      setIsSpeaking(false);
      setVoiceTranscript('');
      transcriptRef.current = '';
    } else {
      setIsVoiceMode(true);
      startListening();
    }
  };

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setVoiceTranscript('');
      transcriptRef.current = '';
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      try { window.speechSynthesis?.cancel(); } catch(e) {}
      setIsSpeaking(false);
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleVoiceSend = async (text: string) => {
    isHandlingVoiceRef.current = true;
    transcriptRef.current = ''; 
    
    const newUserMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text
    };

    setMessages(prev => [...prev, newUserMsg]);
    setIsLoading(true);
    setVoiceTranscript('Pensando...');

    try {
      const res = await fetch(apiBase + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user?.username || 'anon',
          name: user?.name || user?.username || 'Viajero',
          message: newUserMsg.content,
          location: sharedLocation,
          destinationCity: destinationCity.trim() || undefined,
          history: messagesRef.current.slice(-14).map(m => ({ role: m.role, content: m.content })),
          language: i18n.language
        })
      });
      const data = await res.json();
      const reply = data.reply || 'Lo siento, mi conexión ha fallado temporalmente.';

      setVoiceTranscript('Generando voz...');

      const onAudioReady = () => {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: reply
        }]);
        setVoiceTranscript(reply);
        setIsLoading(false);
        isHandlingVoiceRef.current = false;
      };

      await playTTS(reply, onAudioReady);

    } catch (err) {
      const errorMsg = 'Hubo un error al procesar tu mensaje. Intenta nuevamente.';
      
      const onAudioReady = () => {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: errorMsg
        }]);
        setVoiceTranscript(errorMsg);
        setIsLoading(false);
        isHandlingVoiceRef.current = false;
      };

      await playTTS(errorMsg, onAudioReady);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const newUserMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue
    };

    setMessages(prev => [...prev, newUserMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      const res = await fetch(apiBase + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user?.username || 'anon',
          name: user?.name || user?.username || 'Viajero',
          message: newUserMsg.content,
          location: sharedLocation,
          destinationCity: destinationCity.trim() || undefined,
          history: messages.slice(-14).map(m => ({ role: m.role, content: m.content })),
          language: i18n.language
        })
      });
      const data = await res.json();
      const reply = data.reply || 'Lo siento, mi conexión ha fallado temporalmente.';

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: reply
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: t('chatbot.error_processing')
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShareLocation = async () => {
    setIsLocating(true);
    try {
      const getPosition = () => new Promise<GeolocationPosition | null>((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(pos),
          () => resolve(null),
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );
      });
      const pos = await getPosition();
      if (pos) {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setSharedLocation(loc);
        
        const newUserMsg: Message = {
          id: Date.now().toString(),
          role: 'user',
          content: t('chatbot.location_shared')
        };
        setMessages(prev => [...prev, newUserMsg]);
        setIsLoading(true);
        
        const res = await fetch(apiBase + '/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: user?.username || 'anon',
            name: user?.name || user?.username || 'Viajero',
            message: newUserMsg.content,
            location: loc,
            destinationCity: destinationCity.trim() || undefined,
            history: messages.slice(-14).map(m => ({ role: m.role, content: m.content })),
            language: i18n.language
          })
        });
        const data = await res.json();
        const reply = data.reply || t('chatbot.location_received');
        
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: reply
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: t('chatbot.location_error')
        }]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLocating(false);
      setIsLoading(false);
    }
  };

  const handleManualLocationSubmit = async () => {
    if (!manualLocationInput.trim()) return;
    
    const val = manualLocationInput.trim();
    setManualLocationInput('');
    
    const newUserMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: t('chatbot.manual_location', { val })
    };
    setMessages(prev => [...prev, newUserMsg]);
    setIsLoading(true);
    
    try {
      const res = await fetch(apiBase + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user?.username || 'anon',
          name: user?.name || user?.username || 'Viajero',
          message: newUserMsg.content,
          location: undefined,
          destinationCity: destinationCity.trim() || undefined,
          history: messages.slice(-14).map(m => ({ role: m.role, content: m.content })),
          language: i18n.language
        })
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply || t('chatbot.location_received')
      }]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
      setSharedLocation({lat: 0, lng: 0}); 
    }
  };

  const handleQuickUpload = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      if (!input.files || input.files.length === 0) return;
      const file = input.files[0];

      const form = new FormData();
      form.append('file', file);
      form.append('category', "otros");
      form.append('userId', user?.username || 'anon');

      setIsLoading(true);
      try {
        const res = await fetch(apiBase + '/api/upload', { method: 'POST', body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || 'Error de carga');

        const newUserMsg: Message = {
          id: Date.now().toString(),
          role: 'user',
          content: t('chatbot.image_attached'),
          image: data.url
        };
        setMessages(prev => [...prev, newUserMsg]);
        
        setTimeout(() => {
          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: t('chatbot.image_received')
          }]);
          setIsLoading(false);
        }, 1500);

      } catch (e) {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: t('chatbot.image_error') }]);
        setIsLoading(false);
      }
    };
    input.click();
  };

  type BookingItem = { type: string; icon: any; color: string; details: string; providerUsername: string };

  function parseBookings(content: string): BookingItem[] {
    const section = content.split('### SOLICITUDES DE RESERVA:')[1];
    if (!section) return [];
    const lines = section.split('\n').filter(l => l.trim().startsWith('-'));
    return lines.map(line => {
      const typeMatch = line.match(/\[(HOTEL|RESTAURANTE|TAXI|RECREACION|TRADUCTOR)\]/);
      const usernameMatch = line.match(/@([\w._-]+)/);
      const type = typeMatch?.[1] ?? 'GENERAL';
      const iconMap: Record<string, any> = { HOTEL: Hotel, RESTAURANTE: UtensilsCrossed, TAXI: Car, RECREACION: Ticket, TRADUCTOR: MessageCircle };
      const colorMap: Record<string, string> = { HOTEL: 'bg-blue-500/20 border-blue-500/30 text-blue-300', RESTAURANTE: 'bg-orange-500/20 border-orange-500/30 text-orange-300', TAXI: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-300', RECREACION: 'bg-green-500/20 border-green-500/30 text-green-300', TRADUCTOR: 'bg-purple-500/20 border-purple-500/30 text-purple-300' };
      return {
        type,
        icon: iconMap[type] ?? Sparkles,
        color: colorMap[type] ?? 'bg-primary/20 border-primary/30 text-primary',
        details: line.replace(/^.*?\]:\s*/, '').replace(/@[\w._-]+/, '').trim(),
        providerUsername: usernameMatch?.[1] ?? ''
      };
    });
  }

  async function handleConfirmBookings(content: string) {
    const items = parseBookings(content);
    if (!items.length) return;
    setIsSendingBookings(true);
    try {
      await fetch(apiBase + '/api/bookings/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          travelerName: user?.name || user?.username || 'Viajero',
          travelerEmail: user?.email || '',
          bookings: items.map(b => ({ type: b.type, providerUsername: b.providerUsername, details: b.details }))
        })
      });
      setBookingsSent(true);
    } catch (e) { console.error(e); }
    finally { setIsSendingBookings(false); }
  }

  function BookingCards({ content, msgIdx, totalMsgs }: { content: string; msgIdx: number; totalMsgs: number }) {
    const items = parseBookings(content);
    if (!items.length) return null;
    const isLast = msgIdx === totalMsgs - 1;
    return (
      <div className="mt-4 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary/70 mb-3">📋 Solicitudes de Reserva</p>
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`flex items-start gap-3 p-3 rounded-xl border ${item.color} text-[11px] leading-relaxed`}
            >
              <Icon className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block mb-0.5">{item.type}</span>
                <span>{item.details.replace(/\*/g, '')}</span>
                {item.providerUsername && <span className="block mt-0.5 opacity-60">@{item.providerUsername}</span>}
              </div>
            </motion.div>
          );
        })}
        {isLast && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: items.length * 0.08 }}>
            {bookingsSent
              ? <div className="flex items-center gap-2 mt-3 text-green-400 text-xs font-bold"><CheckCircle2 className="h-4 w-4" />{t('chatbot.bookings_sent')}</div>
              : <Button onClick={() => handleConfirmBookings(content)} disabled={isSendingBookings} className="w-full mt-3 bg-primary text-black hover:bg-primary/80 font-bold text-xs h-9 rounded-xl">
                  {isSendingBookings ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  {t('chatbot.confirm_bookings')}
                </Button>
            }
          </motion.div>
        )}
      </div>
    );
  }

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 rounded-full shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/60 transition-shadow"
          >
            <Button
              onClick={() => setIsOpen(true)}
              className="h-16 w-16 rounded-full bg-primary text-primary-foreground border-2 border-primary/20 p-0 overflow-hidden"
            >
              <div className="w-full h-full bg-gradient-to-br from-primary via-primary/80 to-primary/50 rounded-full flex items-center justify-center p-[2px]">
                <div className="w-full h-full bg-black/80 rounded-full flex items-center justify-center relative">
                  <div className="h-10 w-10 relative z-10 bg-primary" style={{ maskImage: `url(${aiSvgIcon})`, WebkitMaskImage: `url(${aiSvgIcon})`, maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center' }} />
                </div>
              </div>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 30, scale: 0.95, filter: "blur(10px)" }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="fixed bottom-6 right-6 z-50 w-[90vw] md:w-[400px] h-[600px] max-h-[85vh]"
          >
            <div className="w-full h-full rounded-[2rem] shadow-2xl flex flex-col overflow-hidden bg-card border border-border/50 ring-1 ring-primary/20">
              
              {/* HEADER */}
              <div className="bg-gradient-to-r from-background to-secondary/30 p-5 flex items-center justify-between border-b border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-[50px] -mr-10 -mt-10 rounded-full" />
                <div className="flex items-center gap-3 relative z-10">
                  <div className="relative">
                    <Avatar className="h-12 w-12 border-0 shadow-lg shadow-primary/50 ring-2 ring-primary/40 bg-gradient-to-br from-primary via-primary/80 to-primary/50 p-[2px]">
                      <div className="w-full h-full bg-black/80 rounded-full flex items-center justify-center">
                        <div className="h-8 w-8 bg-primary" style={{ maskImage: `url(${aiSvgIcon})`, WebkitMaskImage: `url(${aiSvgIcon})`, maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center' }} />
                      </div>
                    </Avatar>
                    <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-background animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.6)]" />
                  </div>
                  <div>
                    <h3 className="font-heading font-extrabold text-foreground text-lg tracking-tight notranslate">VIANova AI</h3>
                    <p className="text-xs text-primary/80 font-medium tracking-wide">Impulsado por Llama 3.1</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 relative z-10">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className={`h-9 w-9 rounded-full transition-colors ${isVoiceMode ? 'bg-primary/20 text-primary' : 'hover:bg-white/10 text-muted-foreground'}`}
                    onClick={toggleVoiceMode}
                    title="Modo Voz (Kokoro TTS)"
                  >
                    {isVoiceMode ? <AudioLines className="h-5 w-5 animate-pulse" /> : <Mic className="h-5 w-5" />}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 rounded-full hover:bg-white/10 transition-colors" 
                    onClick={() => setIsOpen(false)}
                  >
                    <X className="h-5 w-5 text-muted-foreground" />
                  </Button>
                </div>
              </div>

              {/* MESSAGES AREA / VOICE OVERLAY */}
              <div className="flex-1 overflow-hidden bg-black/5 relative">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none mix-blend-overlay" />
                
                <AnimatePresence mode="wait">
                  {isVoiceMode ? (
                    <motion.div 
                      key="voice-mode"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="absolute inset-0 z-20 bg-background/95 backdrop-blur-3xl flex flex-col items-center justify-center p-6 text-center border-t border-white/5"
                    >
                      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-primary/5 pointer-events-none" />
                      {/* Data Cards Overlay (if assistant sent booking cards recently) */}
                      <div className="absolute top-4 left-4 right-4 z-20 max-h-[40vh] overflow-y-auto hidden-scrollbar flex justify-center">
                        <div className="w-full max-w-lg space-y-4">
                          {messages.length > 0 && messages[messages.length - 1].role === 'assistant' && messages[messages.length - 1].content.includes('📋 Solicitudes de Reserva') && (
                            <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                              <BookingCards content={messages[messages.length - 1].content} msgIdx={messages.length - 1} totalMsgs={messages.length} />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Grok-style waves visualizer */}
                      <div className="flex items-center justify-center h-32 gap-1.5 mb-8 relative z-10 w-full mt-12">
                        {[...Array(12)].map((_, i) => (
                          <motion.div
                            key={i}
                            animate={
                              isSpeaking
                                ? {
                                    height: ["10%", "100%", "20%", "80%", "10%"],
                                  }
                                : isListening 
                                ? {
                                    height: ["10%", "30%", "10%"],
                                  }
                                : {
                                    height: "10%",
                                  }
                            }
                            transition={{
                              duration: isSpeaking ? 0.7 : 1.5,
                              repeat: Infinity,
                              delay: i * 0.05,
                              ease: "easeInOut",
                            }}
                            className={`w-2 rounded-full ${isSpeaking ? 'bg-primary' : 'bg-primary/50'}`}
                            style={{ height: "10%" }}
                          />
                        ))}
                      </div>

                      <div className="relative z-10 max-w-full">
                        <p className={`text-lg font-medium transition-colors ${isListening ? 'text-foreground' : 'text-primary'}`}>
                          {isListening ? t('chatbot.listening', 'Escuchando...') : isSpeaking ? t('chatbot.speaking', 'VIANova está hablando...') : t('chatbot.tap_mic', 'Toca el micrófono para hablar')}
                        </p>
                        <p className="mt-4 text-sm text-muted-foreground min-h-[3rem] line-clamp-4 px-4 italic">
                          {voiceTranscript ? `"${voiceTranscript}"` : ""}
                        </p>
                      </div>

                      <div className="mt-8 relative z-10">
                        <Button
                          onClick={isListening ? () => recognitionRef.current?.stop() : startListening}
                          className={`h-20 w-20 rounded-full shadow-2xl transition-all duration-300 ${isListening ? 'bg-red-500/20 text-red-500 border border-red-500/50 hover:bg-red-500/30' : 'bg-primary text-black hover:bg-primary/80 hover:scale-105'}`}
                        >
                          {isListening ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
                        </Button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="chat-mode"
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      exit={{ opacity: 0 }}
                      className="h-full w-full"
                    >
                      <ScrollArea className="h-full px-4 py-6">
                        <div className="flex flex-col gap-6">
                          <AnimatePresence>
                            {messages.map((msg, idx) => (
                              <motion.div
                                key={msg.id}
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ duration: 0.3, delay: idx * 0.05 }}
                                className={`flex gap-3 items-end ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                              >
                                {msg.role === 'assistant' && (
                                  <Avatar className="h-8 w-8 shrink-0 shadow-md shadow-primary/40 bg-gradient-to-br from-primary via-primary/80 to-primary/50 p-[2px]">
                                    <div className="w-full h-full bg-black/80 rounded-full flex items-center justify-center">
                                      <div className="h-5 w-5 bg-primary" style={{ maskImage: `url(${aiSvgIcon})`, WebkitMaskImage: `url(${aiSvgIcon})`, maskSize: 'contain', maskRepeat: 'no-repeat', maskPosition: 'center' }} />
                                    </div>
                                  </Avatar>
                                )}
                                <div
                                  className={`rounded-2xl p-4 text-sm max-w-[85%] shadow-sm leading-relaxed ${
                                    msg.role === 'user'
                                      ? 'bg-primary text-black font-medium rounded-br-sm'
                                      : 'bg-secondary/40 backdrop-blur-md text-foreground border border-white/5 rounded-bl-sm'
                                  }`}
                                >
                                  <div className="whitespace-pre-wrap tracking-wide">
                                    {msg.content.includes('### SOLICITUDES DE RESERVA:')
                                      ? <>
                                          <span><TranslatedText text={msg.content.split('### SOLICITUDES DE RESERVA:')[0]} /></span>
                                          <BookingCards content={msg.content} msgIdx={idx} totalMsgs={messages.length} />
                                        </>
                                      : <span><TranslatedText text={msg.content} /></span>
                                    }
                                  </div>
                                  {msg.image && (
                                    <img 
                                      src={msg.image} 
                                      alt="Referencia" 
                                      className="mt-3 rounded-lg border border-black/10 w-full h-auto shadow-md"
                                    />
                                  )}
                                  {msg.role === 'assistant' && msg.content.toLowerCase().includes('ubicación') && !sharedLocation && idx === messages.length - 1 && (
                                    <div className="mt-4 p-3 bg-background/50 rounded-xl border border-primary/20 shadow-sm">
                                      <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
                                        <strong className="text-primary font-bold">💡 {t('chatbot.note', 'Nota')}:</strong> {t('chatbot.gps_warning', 'El GPS automático en computadoras puede ser impreciso.')}
                                      </p>
                                      <div className="flex flex-col gap-3">
                                        <Button 
                                          onClick={handleShareLocation}
                                          disabled={isLocating || isLoading}
                                          className="w-full bg-primary/20 text-primary hover:bg-primary/30 border border-primary/50 text-xs font-bold transition-all"
                                        >
                                          {isLocating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MapPin className="h-4 w-4 mr-2" />}
                                          {t('chatbot.auto_gps', 'Usar GPS Automático')}
                                        </Button>
                                        
                                        <div className="flex gap-2 items-center">
                                          <div className="h-[1px] flex-1 bg-border/50"></div>
                                          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{t('chatbot.or_manual', 'O ingresa manualmente')}</span>
                                          <div className="h-[1px] flex-1 bg-border/50"></div>
                                        </div>

                                        <div className="flex gap-2">
                                          <Input 
                                            placeholder="Ej. Pitalito, Huila" 
                                            value={manualLocationInput}
                                            onChange={(e) => setManualLocationInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleManualLocationSubmit()}
                                            className="h-8 text-xs bg-background/50 border-primary/20 focus-visible:ring-primary/50"
                                            disabled={isLoading || isLocating}
                                          />
                                          <Button 
                                            size="sm" 
                                            onClick={handleManualLocationSubmit}
                                            disabled={!manualLocationInput.trim() || isLoading || isLocating}
                                            className="h-8 px-3 text-xs bg-primary text-black hover:bg-primary/80"
                                          >
                                            {t('chatbot.send')}
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                          
                          {isLoading && (
                             <motion.div 
                               initial={{ opacity: 0, y: 10 }}
                               animate={{ opacity: 1, y: 0 }}
                               className="flex gap-3 items-end"
                             >
                               <Avatar className="h-8 w-8 shrink-0 shadow-[0_0_10px_rgba(251,191,36,0.4)] bg-gradient-to-br from-primary via-amber-400 to-orange-500 p-[2px]">
                                  <div className="w-full h-full bg-black/80 rounded-full flex items-center justify-center">
                                    <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                                  </div>
                               </Avatar>
                               <div className="bg-secondary/40 backdrop-blur-md border border-white/5 rounded-2xl rounded-bl-sm p-4 flex items-center gap-2 shadow-sm">
                                 <div className="flex gap-1 items-center justify-center">
                                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
                                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
                                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
                                 </div>
                               </div>
                             </motion.div>
                          )}
                          <div ref={scrollRef} className="h-1" />
                        </div>
                      </ScrollArea>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* FOOTER / INPUT */}
              {!isVoiceMode && (
                <div className="p-4 bg-background/95 backdrop-blur-xl border-t border-white/5 relative z-10 flex flex-col gap-3">
                  <div className="flex items-center gap-2 px-1">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">{t('chatbot.destination', 'Destino de viaje:')}</span>
                    <input
                      type="text"
                      placeholder="Opcional (Ej. Cali)"
                      value={destinationCity}
                      onChange={(e) => setDestinationCity(e.target.value)}
                      disabled={isLoading}
                      className="bg-transparent border-b border-white/10 focus:border-primary outline-none text-sm text-foreground placeholder:text-muted-foreground/40 w-32 pb-0.5 transition-colors"
                    />
                  </div>
                  
                  <div className="relative flex items-center">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute left-2 h-9 w-9 rounded-full text-muted-foreground hover:bg-secondary hover:text-primary transition-colors"
                      onClick={handleQuickUpload}
                      title="Enviar Imagen"
                    >
                      <ImageIcon className="h-5 w-5" />
                    </Button>
                    <div className="flex-1 ml-12 pr-14">
                      <Input
                        placeholder={t('chatbot.placeholder')}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        disabled={isLoading}
                        className="w-full h-14 bg-secondary/30 border-white/10 rounded-full focus-visible:ring-primary focus-visible:ring-1 text-sm shadow-inner transition-all hover:bg-secondary/50 placeholder:text-muted-foreground/70"
                      />
                    </div>
                    <Button 
                      size="icon" 
                      onClick={handleSend} 
                      disabled={!inputValue.trim() || isLoading}
                      className="absolute right-2 h-10 w-10 rounded-full bg-primary text-black shadow-md hover:scale-105 hover:shadow-primary/50 transition-all disabled:opacity-50 disabled:hover:scale-100"
                    >
                      <Send className="h-4 w-4 ml-0.5" />
                    </Button>
                  </div>
                  <div className="mt-3 flex justify-center items-center gap-1 text-[10px] text-muted-foreground/50 font-medium uppercase tracking-widest">
                     <MapPin className="h-3 w-3" /> VIANova Context-Aware AI
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
