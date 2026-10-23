import { apiBase } from "@/lib/queryClient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Loader2, MessageCircle, Search, Send } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

interface Conversation {
  username: string;
  name?: string | null;
  avatarUrl?: string | null;
  lastMessage: string;
  lastAt: string;
  lastSender: string;
  unread: number;
}

interface DirectMessage {
  id: string;
  sender: string;
  recipient: string;
  content: string;
  isRead: string;
  createdAt: string;
}

function Avatar({ username, src }: { username: string; src?: string | null }) {
  return src ? (
    <img src={src} alt={username} className="w-10 h-10 rounded-full object-cover shrink-0" />
  ) : (
    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-primary shrink-0">
      {username.slice(0, 2).toUpperCase()}
    </div>
  );
}

export default function Messages() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const initialTo = useMemo(() => new URLSearchParams(window.location.search).get("to") || "", []);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState(initialTo);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [text, setText] = useState("");
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [newTo, setNewTo] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) setLocation("/login");
  }, [user, setLocation]);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`${apiBase}/api/social/messages/conversations`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }
    } finally {
      setLoadingConversations(false);
    }
  }, [user]);

  const loadMessages = useCallback(async (other: string) => {
    if (!user || !other) return;
    try {
      const res = await fetch(`${apiBase}/api/social/messages/${encodeURIComponent(other)}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } finally {
      setLoadingMessages(false);
    }
  }, [user]);

  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => {
    if (!selected) return;
    setLoadingMessages(true);
    loadMessages(selected);
  }, [selected, loadMessages]);

  useEffect(() => {
    const id = setInterval(() => {
      loadConversations();
      if (selected) loadMessages(selected);
    }, 4000);
    return () => clearInterval(id);
  }, [loadConversations, loadMessages, selected]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = async () => {
    const content = text.trim();
    if (!content || !selected || sending) return;
    setSending(true);
    setText("");
    try {
      const res = await fetch(`${apiBase}/api/social/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientUsername: selected, content }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages(prev => [...prev, data]);
        loadConversations();
      } else {
        setText(content);
      }
    } finally {
      setSending(false);
    }
  };

  const startConversation = () => {
    const target = newTo.trim().replace(/^@/, "");
    if (!target || target === user?.username) return;
    setSelected(target);
    setNewTo("");
    window.history.replaceState(null, "", `/messages?to=${encodeURIComponent(target)}`);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="container max-w-5xl mx-auto px-4 py-6 mt-16">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setLocation("/social")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Volver a ViaSocial
          </button>
          <h1 className="text-xl font-bold flex items-center gap-2"><MessageCircle className="h-5 w-5 text-primary" /> Mensajes</h1>
        </div>

        <div className="grid md:grid-cols-[280px_1fr] gap-4 rounded-2xl border border-border/50 bg-card overflow-hidden min-h-[70vh]">
          <aside className={`border-r border-border/40 ${selected ? "hidden md:block" : "block"}`}>
            <div className="p-3 border-b border-border/40 flex gap-2">
              <input
                value={newTo}
                onChange={e => setNewTo(e.target.value)}
                onKeyDown={e => e.key === "Enter" && startConversation()}
                placeholder="@usuario"
                className="flex-1 min-w-0 bg-secondary/30 border border-border/40 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary/50"
              />
              <Button size="sm" variant="outline" onClick={startConversation}><Search className="h-3.5 w-3.5" /></Button>
            </div>
            <div className="max-h-[62vh] overflow-y-auto">
              {loadingConversations ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : conversations.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8 px-4">Sin conversaciones todavía. Busca un usuario para escribirle.</p>
              ) : (
                conversations.map(c => (
                  <button
                    key={c.username}
                    onClick={() => {
                      setSelected(c.username);
                      window.history.replaceState(null, "", `/messages?to=${encodeURIComponent(c.username)}`);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-secondary/30 transition-colors ${selected === c.username ? "bg-secondary/40" : ""}`}
                  >
                    <Avatar username={c.username} src={c.avatarUrl} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold truncate">@{c.username}</span>
                        {c.unread > 0 && <span className="text-[10px] bg-primary text-black rounded-full px-1.5 py-0.5 font-bold">{c.unread}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{c.lastSender === user.username ? "Tú: " : ""}{c.lastMessage}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className={`flex flex-col ${selected ? "flex" : "hidden md:flex"}`}>
            {selected ? (
              <>
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40">
                  <button className="md:hidden" onClick={() => setSelected("")}><ArrowLeft className="h-5 w-5" /></button>
                  <Avatar username={selected} />
                  <div>
                    <p className="font-semibold text-sm">@{selected}</p>
                    <p className="text-[11px] text-muted-foreground">Conversación privada</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[52vh]">
                  {loadingMessages ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                  ) : messages.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-12">Envía el primer mensaje a @{selected}.</p>
                  ) : (
                    messages.map(m => {
                      const own = m.sender === user.username;
                      return (
                        <div key={m.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${own ? "bg-primary text-black rounded-br-sm" : "bg-secondary/50 text-foreground rounded-bl-sm"}`}>
                            <p className="whitespace-pre-wrap break-words">{m.content}</p>
                            <p className={`text-[10px] mt-1 ${own ? "text-black/60" : "text-muted-foreground"}`}>
                              {new Date(m.createdAt.endsWith("Z") ? m.createdAt : `${m.createdAt}Z`).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={endRef} />
                </div>

                <div className="p-3 border-t border-border/40 flex gap-2">
                  <input
                    value={text}
                    onChange={e => setText(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
                    placeholder="Escribe un mensaje…"
                    maxLength={2000}
                    className="flex-1 bg-secondary/30 border border-border/40 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                  />
                  <Button onClick={send} disabled={sending || !text.trim()}>
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-3">
                <MessageCircle className="h-12 w-12 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Selecciona una conversación o busca un usuario para empezar.</p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
