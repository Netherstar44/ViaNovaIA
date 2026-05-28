import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiBase } from "@/lib/queryClient";
import { ArrowLeft, Send, MessageCircle, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface Conversation {
  other_username: string;
  last_time: string;
  unread_count: number;
  last_message: string;
}

interface DMessage {
  id: string;
  from_username: string;
  to_username: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export default function Messages() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<DMessage[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [searchUser, setSearchUser] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) { setLocation("/login"); return; }
    loadConversations();
  }, [user]);

  useEffect(() => {
    if (selected) {
      loadMessages(selected);
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => loadMessages(selected), 4000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadConversations() {
    if (!user) return;
    const r = await fetch(`${apiBase}/api/dm/conversations/${user.username}`, { credentials: "include" });
    if (r.ok) { const d = await r.json(); setConversations(d.conversations || []); }
  }

  async function loadMessages(otherUser: string) {
    if (!user) return;
    const r = await fetch(`${apiBase}/api/dm/${user.username}/${otherUser}`, { credentials: "include" });
    if (r.ok) { const d = await r.json(); setMessages(d.messages || []); }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMsg.trim() || !selected || !user || sending) return;
    setSending(true);
    const r = await fetch(`${apiBase}/api/dm/send`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromUsername: user.username, toUsername: selected, content: newMsg.trim() }),
    });
    if (r.ok) {
      setNewMsg("");
      await loadMessages(selected);
      await loadConversations();
    }
    setSending(false);
  }

  async function startChat() {
    const target = searchUser.trim();
    if (!target || target === user?.username) return;
    setSelected(target);
    setSearchUser("");
    if (!conversations.find(c => c.other_username === target)) {
      setConversations(prev => [{ other_username: target, last_time: new Date().toISOString(), unread_count: 0, last_message: "" }, ...prev]);
    }
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>
        {/* Sidebar */}
        <aside className={`${selected ? "hidden md:flex" : "flex"} flex-col w-full md:w-80 border-r border-border bg-card`}>
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" /> Mensajes
            </h2>
            <div className="flex gap-2">
              <Input
                placeholder="Buscar usuario..."
                value={searchUser}
                onChange={e => setSearchUser(e.target.value)}
                onKeyDown={e => e.key === "Enter" && startChat()}
                className="flex-1"
              />
              <Button size="sm" onClick={startChat} disabled={!searchUser.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>Sin conversaciones aún.</p>
                <p className="mt-1">Busca un usuario para empezar a chatear.</p>
              </div>
            ) : (
              conversations.map(c => (
                <button
                  key={c.other_username}
                  onClick={() => setSelected(c.other_username)}
                  className={`w-full text-left p-4 flex items-start gap-3 border-b border-border/50 hover:bg-secondary/30 transition-colors ${selected === c.other_username ? "bg-primary/10 border-l-2 border-l-primary" : ""}`}
                >
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm truncate">@{c.other_username}</span>
                      {c.unread_count > 0 && (
                        <span className="bg-primary text-primary-foreground text-xs rounded-full px-1.5 py-0.5 ml-1 flex-shrink-0">{c.unread_count}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{c.last_message || "Nueva conversación"}</p>
                    <p className="text-xs text-muted-foreground/60 mt-0.5">
                      {c.last_time ? formatDistanceToNow(new Date(c.last_time), { addSuffix: true, locale: es }) : ""}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Chat area */}
        <main className={`${!selected ? "hidden md:flex" : "flex"} flex-col flex-1`}>
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-center p-8">
              <div>
                <MessageCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
                <p className="text-muted-foreground">Selecciona una conversación o busca un usuario</p>
              </div>
            </div>
          ) : (
            <>
              <div className="h-14 border-b border-border bg-card flex items-center px-4 gap-3">
                <button onClick={() => setSelected(null)} className="md:hidden text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <span className="font-semibold">@{selected}</span>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <AnimatePresence initial={false}>
                  {messages.map(m => {
                    const isMe = m.from_username === user.username;
                    return (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                      >
                        <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl text-sm ${isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-secondary text-foreground rounded-bl-sm"}`}>
                          <p>{m.content}</p>
                          <p className={`text-xs mt-1 ${isMe ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                            {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: es })}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                <div ref={bottomRef} />
              </div>

              <form onSubmit={sendMessage} className="p-4 border-t border-border bg-card flex gap-2">
                <Input
                  value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  placeholder="Escribe un mensaje..."
                  className="flex-1"
                  disabled={sending}
                />
                <Button type="submit" disabled={!newMsg.trim() || sending} className="gap-1">
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
