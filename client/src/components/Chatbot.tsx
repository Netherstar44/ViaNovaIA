import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Image as ImageIcon, Loader2, Bot, Sparkles, MapPin, Hotel, UtensilsCrossed, Car, Ticket, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/lib/auth';
import { motion, AnimatePresence } from 'framer-motion';
import logoImg from '../assets/logo.jpeg';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
}

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: '¡Hola! Soy VIANova, tu conserje inteligente. ¿A dónde viajaremos hoy?' }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sharedLocation, setSharedLocation] = useState<{lat: number, lng: number} | undefined>();
  const [isLocating, setIsLocating] = useState(false);
  const [manualLocationInput, setManualLocationInput] = useState('');
  const [destinationCity, setDestinationCity] = useState('');
  const [isSendingBookings, setIsSendingBookings] = useState(false);
  const [bookingsSent, setBookingsSent] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isLoading]);

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
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user?.username || 'anon',
          name: user?.name || user?.username || 'Viajero',
          message: newUserMsg.content,
          location: sharedLocation,
          destinationCity: destinationCity.trim() || undefined,
          // Send session history from React state (reliable, no DB contamination)
          history: messages.slice(-14).map(m => ({ role: m.role, content: m.content }))
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
        content: 'Hubo un error al procesar tu mensaje. Intenta nuevamente.'
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
          content: '📍 He compartido mi ubicación actual.'
        };
        setMessages(prev => [...prev, newUserMsg]);
        setIsLoading(true);
        
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: user?.username || 'anon',
            name: user?.name || user?.username || 'Viajero',
            message: newUserMsg.content,
            location: loc,
            destinationCity: destinationCity.trim() || undefined,
            history: messages.slice(-14).map(m => ({ role: m.role, content: m.content }))
          })
        });
        const data = await res.json();
        const reply = data.reply || 'Ubicación recibida.';
        
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: reply
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'No pude acceder a tu ubicación. Por favor revisa los permisos de tu navegador.'
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
      content: `📍 Mi ubicación es: ${val}`
    };
    setMessages(prev => [...prev, newUserMsg]);
    setIsLoading(true);
    
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: user?.username || 'anon',
          name: user?.name || user?.username || 'Viajero',
          message: newUserMsg.content,
          location: undefined, // Bypass GPS
          destinationCity: destinationCity.trim() || undefined,
          history: messages.slice(-14).map(m => ({ role: m.role, content: m.content }))
        })
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply || 'Ubicación recibida.'
      }]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
      setSharedLocation({lat: 0, lng: 0}); // Marcar como compartida para ocultar el cuadro
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
        const res = await fetch('/api/upload', { method: 'POST', body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || 'Error de carga');

        const newUserMsg: Message = {
          id: Date.now().toString(),
          role: 'user',
          content: 'He adjuntado una referencia visual:',
          image: data.url
        };
        setMessages(prev => [...prev, newUserMsg]);
        
        // Simular respuesta por la imagen
        setTimeout(() => {
          setMessages(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: 'He recibido la imagen. ¡Se ve increíble! ¿Qué te gustaría saber o encontrar relacionado a este estilo?'
          }]);
          setIsLoading(false);
        }, 1500);

      } catch (e) {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: 'No pude cargar la imagen, el archivo es inválido o muy pesado.' }]);
        setIsLoading(false);
      }
    };
    input.click();
  };

  // ── Booking helpers ────────────────────────────────────────────────────────
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
      await fetch('/api/bookings/confirm', {
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
                <span>{item.details}</span>
                {item.providerUsername && <span className="block mt-0.5 opacity-60">@{item.providerUsername}</span>}
              </div>
            </motion.div>
          );
        })}
        {isLast && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: items.length * 0.08 }}>
            {bookingsSent
              ? <div className="flex items-center gap-2 mt-3 text-green-400 text-xs font-bold"><CheckCircle2 className="h-4 w-4" />¡Solicitudes enviadas a todos los proveedores!</div>
              : <Button onClick={() => handleConfirmBookings(content)} disabled={isSendingBookings} className="w-full mt-3 bg-primary text-black hover:bg-primary/80 font-bold text-xs h-9 rounded-xl">
                  {isSendingBookings ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Confirmar y Enviar Reservas
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
            className="fixed bottom-6 right-6 z-50 rounded-full shadow-[0_0_30px_rgba(255,215,0,0.3)] hover:shadow-[0_0_40px_rgba(255,215,0,0.6)] transition-shadow"
          >
            <Button
              onClick={() => setIsOpen(true)}
              className="h-16 w-16 rounded-full bg-gradient-to-tr from-primary to-yellow-300 text-black border-2 border-primary/20"
            >
              <Sparkles className="h-8 w-8 absolute opacity-50 blur-[2px] animate-pulse" />
              <Bot className="h-8 w-8 relative z-10" />
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
                    <Avatar className="h-12 w-12 border-2 border-primary/50 shadow-lg ring-2 ring-background">
                      <AvatarImage src={logoImg} alt="VIANova Bot" />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-yellow-600 text-black">
                        <Bot className="h-6 w-6" />
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-background animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.6)]" />
                  </div>
                  <div>
                    <h3 className="font-heading font-extrabold text-foreground text-lg tracking-tight">VIANova AI</h3>
                    <p className="text-xs text-primary/80 font-medium tracking-wide">Impulsado por Groq</p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-9 w-9 rounded-full hover:bg-white/10 relative z-10 transition-colors" 
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-5 w-5 text-muted-foreground" />
                </Button>
              </div>

              {/* MESSAGES AREA */}
              <div className="flex-1 overflow-hidden bg-black/5 relative">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none mix-blend-overlay" />
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
                            <Avatar className="h-8 w-8 shrink-0 shadow-md">
                              <AvatarImage src={logoImg} />
                              <AvatarFallback className="bg-primary/20 text-primary border border-primary/30"><Bot className="h-4 w-4" /></AvatarFallback>
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
                                    <span>{msg.content.split('### SOLICITUDES DE RESERVA:')[0]}</span>
                                    <BookingCards content={msg.content} msgIdx={idx} totalMsgs={messages.length} />
                                  </>
                                : <span>{msg.content}</span>
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
                                  <strong className="text-primary font-bold">💡 Nota:</strong> El GPS automático en computadoras puede ser impreciso o mostrar "Bogotá" debido a tu proveedor de internet.
                                </p>
                                <div className="flex flex-col gap-3">
                                  <Button 
                                    onClick={handleShareLocation}
                                    disabled={isLocating || isLoading}
                                    className="w-full bg-primary/20 text-primary hover:bg-primary/30 border border-primary/50 text-xs font-bold transition-all"
                                  >
                                    {isLocating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MapPin className="h-4 w-4 mr-2" />}
                                    Usar GPS Automático
                                  </Button>
                                  
                                  <div className="flex gap-2 items-center">
                                    <div className="h-[1px] flex-1 bg-border/50"></div>
                                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">O ingresa manualmente</span>
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
                                      Enviar
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
                         <Avatar className="h-8 w-8 shrink-0 shadow-md">
                            <AvatarFallback className="bg-primary/20 text-primary border border-primary/30"><Bot className="h-4 w-4" /></AvatarFallback>
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
              </div>

              {/* FOOTER / INPUT */}
              <div className="p-4 bg-background/95 backdrop-blur-xl border-t border-white/5 relative z-10 flex flex-col gap-3">
                <div className="flex items-center gap-2 px-1">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wider">Destino de viaje:</span>
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
                      placeholder="Pregúntame sobre restaurantes, hoteles..."
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

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
