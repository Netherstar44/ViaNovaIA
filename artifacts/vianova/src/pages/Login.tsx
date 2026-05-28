import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRight, Mail, KeyRound, ArrowLeft, Check, AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import logoPrincipal from "@/assets/Logo_principal-removebg-preview.png";

// forgot flow steps: email → token → newPassword
type ForgotStep = "email" | "token" | "newPassword";
type ViewMode = "auth" | "forgot";

export default function Login() {
  // Login state
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPass, setShowLoginPass] = useState(false);

  // Register state
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regName, setRegName] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [showRegPass, setShowRegPass] = useState(false);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotStep, setForgotStep] = useState<ForgotStep>("email");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>("auth");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login, loginDirect, register, isAuthenticated, forgotPassword, verifyResetToken, resetPassword, loading } = useAuth();
  const [_, setLocation] = useLocation();

  // Parse google_user or reset_token from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const g = params.get("google_user");
    const t = params.get("token");
    if (g) {
      try {
        if (t) localStorage.setItem('auth_token', t);
        const { username: u, name, email, role, roleChangedAt } = JSON.parse(decodeURIComponent(g));
        loginDirect(u, role || "traveler", name, email, roleChangedAt);
        setLocation("/");
      } catch (err) {
        console.error("failed to parse google_user", err);
      }
    }
    const rt = params.get("reset_token");
    if (rt) {
      setResetToken(rt);
      setViewMode("forgot");
      // Auto-verify the token from the email link
      verifyResetToken(rt).then((result) => {
        if (result.ok) {
          setForgotStep("newPassword");
          setMessage({ type: "success", text: "Código verificado. Crea tu nueva contraseña." });
        } else {
          setForgotStep("token");
          setMessage({ type: "error", text: result.message || "Código inválido o expirado" });
        }
      });
    }
  }, [loginDirect, setLocation]);

  // No redirigir mientras se verifica la sesión con el backend (evita race condition)
  if (loading) return null;

  if (isAuthenticated) {
    setLocation("/");
    return null;
  }


  const clearMessage = () => setMessage(null);

  // ─── Google Login handler ───
  const handleGoogleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessage();
    const isApp = Capacitor.isNativePlatform() || navigator.userAgent.includes('wv');
    
    if (isApp) {
      try {
        let result: any = null;
        try {
          // Intentar inicio de sesión
          result = await GoogleAuth.signIn();
        } catch (initialErr) {
          console.warn("First Google Auth attempt failed, retrying in 500ms...", initialErr);
          // Retry automatically once for cold boot issues
          await new Promise(r => setTimeout(r, 500));
          result = await GoogleAuth.signIn();
        }
        
        // Find idToken: some versions put it in result.authentication.idToken, others in result.idToken, others in result.serverAuthCode
        const idToken = result?.authentication?.idToken || result?.idToken || result?.serverAuthCode;
        
        if (result && result.email) {
          const baseUrl = "https://via-nova-ia.vercel.app";
          
          // Helper function for fetch with retry
          const fetchWithRetry = async (url: string, options: any, retries = 1) => {
            for (let i = 0; i <= retries; i++) {
              try {
                const res = await fetch(url, options);
                if (res.ok || i === retries) return res;
              } catch (e) {
                if (i === retries) throw e;
                await new Promise(r => setTimeout(r, 1000)); // wait 1s before retrying
              }
            }
            throw new Error("Fetch failed");
          };

          const res = await fetchWithRetry(`${baseUrl}/api/auth/google/mobile`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              idToken: idToken,
              email: result.email, 
              name: result.name || result.givenName || result.email.split('@')[0]
            })
          });
          
          if (res.ok) {
            const data = await res.json();
            loginDirect(data.user.username, data.user.role, data.user.name, data.user.email, data.user.roleChangedAt);
            setLocation("/");
          } else {
            const data = await res.json();
            setMessage({ type: "error", text: data.message || "Error al iniciar sesión con Google." });
          }
        } else {
          setMessage({ type: "error", text: "Google Auth no retornó un email." });
        }
      } catch (err: any) {
        console.error("Google Auth Error:", err);
        setMessage({ type: "error", text: "Error en Google Auth: " + (err.message || JSON.stringify(err)) });
      }
    } else {
      window.location.href = import.meta.env.DEV ? "/api/auth/google" : "https://via-nova-ia.vercel.app/api/auth/google";
    }
  };

  // ─── Login handler ───
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessage();
    setIsSubmitting(true);
    const result = await login(loginUsername, loginPassword);
    setIsSubmitting(false);
    if (result.ok) {
      setLocation("/");
    } else {
      setMessage({ type: "error", text: result.message || "Error al iniciar sesión" });
    }
  };

  // ─── Register handler ───
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessage();
    if (regPassword !== regConfirmPassword) {
      setMessage({ type: "error", text: "Las contraseñas no coinciden" });
      return;
    }
    if (regPassword.length < 6) {
      setMessage({ type: "error", text: "La contraseña debe tener al menos 6 caracteres" });
      return;
    }
    if (!regEmail.includes("@")) {
      setMessage({ type: "error", text: "Ingresa un correo electrónico válido" });
      return;
    }
    setIsSubmitting(true);
    const result = await register({
      username: regUsername,
      password: regPassword,
      name: regName,
      email: regEmail,
    });
    setIsSubmitting(false);
    if (result.ok) {
      setLocation("/");
    } else {
      setMessage({ type: "error", text: result.message || "Error al registrarse" });
    }
  };

  // ─── Forgot: Step 1 — Send email ───
  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessage();
    setIsSubmitting(true);
    const result = await forgotPassword(forgotEmail);
    setIsSubmitting(false);
    if (result.ok) {
      setMessage({ type: "success", text: " Recibiste un codigo de recuperacion. Verifica la bandeja de entrada de tu correo electronico." });
      setForgotStep("token");
    } else {
      setMessage({ type: "error", text: result.message || "Error al enviar el correo" });
    }
  };

  // ─── Forgot: Step 2 — Verify token ───
  const handleVerifyToken = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessage();
    if (!resetToken.trim()) {
      setMessage({ type: "error", text: "Ingresa el código que recibiste por correo" });
      return;
    }
    setIsSubmitting(true);
    const result = await verifyResetToken(resetToken.trim());
    setIsSubmitting(false);
    if (result.ok) {
      setMessage({ type: "success", text: "¡Código verificado! Ahora crea tu nueva contraseña." });
      setForgotStep("newPassword");
    } else {
      setMessage({ type: "error", text: result.message || "Código inválido" });
    }
  };

  // ─── Forgot: Step 3 — Set new password ───
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessage();
    if (newPassword !== confirmNewPassword) {
      setMessage({ type: "error", text: "Las contraseñas no coinciden" });
      return;
    }
    if (newPassword.length < 6) {
      setMessage({ type: "error", text: "La contraseña debe tener al menos 6 caracteres" });
      return;
    }
    setIsSubmitting(true);
    const result = await resetPassword(resetToken.trim(), newPassword);
    setIsSubmitting(false);
    if (result.ok) {
      setMessage({ type: "success", text: result.message || "Contraseña actualizada. Ya puedes iniciar sesión." });
      setTimeout(() => {
        setViewMode("auth");
        setForgotStep("email");
        setResetToken("");
        setNewPassword("");
        setConfirmNewPassword("");
        clearMessage();
      }, 3000);
    } else {
      setMessage({ type: "error", text: result.message || "Error al restablecer la contraseña" });
    }
  };

  // ────────────────────────── RENDER ──────────────────────────

  return (
    <div className="flex min-h-screen bg-background relative overflow-hidden text-foreground">
      {/* LEFT SIDE — BRANDING */}
      <div className="hidden lg:flex w-1/2 relative bg-secondary/20 items-center justify-center overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="z-10 text-center px-12 max-w-xl">
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1 }} className="mb-8 flex justify-center">
            <img src={logoPrincipal} alt="VIANova" className="w-48 h-48 md:w-64 md:h-64 object-contain drop-shadow-2xl" />
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }} className="text-5xl font-heading font-extrabold tracking-tight mb-6">
            Bienvenido a <span className="text-primary notranslate">VIANova</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4 }} className="text-lg text-muted-foreground/80 leading-relaxed">
            Tu asistente inteligente de viaje. Descubre destinos increíbles, planifica rutas y conéctate con los mejores servicios locales.
          </motion.p>
        </div>
      </div>

      {/* RIGHT SIDE — FORMS */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 relative z-10 bg-background/95 backdrop-blur-3xl shadow-[-20px_0_40px_rgba(0,0,0,0.5)]">
        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-8 lg:hidden flex flex-col items-center">
            <img src={logoPrincipal} alt="VIANova" className="w-32 h-32 sm:w-40 sm:h-40 object-contain drop-shadow-2xl mb-2" />
            <h1 className="text-3xl font-heading font-bold notranslate">VIANova</h1>
          </div>

          {/* Message */}
          <AnimatePresence>
            {message && (
              <motion.div initial={{ opacity: 0, y: -10, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: -10, height: 0 }}
                className={`mb-6 p-4 rounded-xl flex items-start gap-3 text-sm border ${message.type === "success" ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-red-500/10 border-red-500/30 text-red-400"}`}>
                {message.type === "success" ? <Check className="h-5 w-5 shrink-0 mt-0.5" /> : <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />}
                <span>{message.text}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {/* ═══════════════ AUTH VIEW ═══════════════ */}
            {viewMode === "auth" && (
              <motion.div key="auth" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                <div className="mb-10 lg:text-left text-center">
                  <h2 className="text-3xl font-semibold mb-2">Ingresar</h2>
                  <p className="text-muted-foreground text-sm">Elige tu método preferido para acceder</p>
                </div>

                {/* Google */}
                <div className="mb-8">
                  <Button variant="outline" className="w-full h-12 flex items-center justify-center gap-3 bg-secondary/30 hover:bg-secondary/60 border-border transition-all group" onClick={handleGoogleLogin}>
                    <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24"><path d="M21.35 11.1h-9.17v2.92h5.28c-.23 1.34-.92 2.48-1.96 3.25v2.7h3.17c1.85-1.71 2.92-4.22 2.92-7.27 0-.63-.06-1.24-.18-1.82z" fill="#4285F4" /><path d="M12.18 22c2.63 0 4.83-.87 6.44-2.36l-3.17-2.7c-.88.59-2.01.94-3.27.94-2.52 0-4.66-1.7-5.43-3.99H3.48v2.5C5.09 19.9 8.35 22 12.18 22z" fill="#34A853" /><path d="M6.75 13.89c-.2-.6-.31-1.24-.31-1.89s.11-1.29.31-1.89V7.6H3.48C2.57 8.97 2 10.57 2 12.33s.57 3.36 1.48 4.73l3.27-2.5z" fill="#FBBC05" /><path d="M12.18 5.5c1.43 0 2.72.49 3.74 1.46l2.8-2.8C16.99 2.5 14.79 1.5 12.18 1.5 8.35 1.5 5.09 3.6 3.48 6.5l3.27 2.5c.77-2.29 2.91-3.99 5.43-3.99z" fill="#EA4335" /></svg>
                    <span className="font-medium">Continuar con Google</span>
                  </Button>
                </div>

                <div className="relative mb-8">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/50" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-4 text-muted-foreground/60">O usa tu cuenta local</span></div>
                </div>

                <Tabs defaultValue="login" className="w-full" onValueChange={clearMessage}>
                  <TabsList className="grid w-full grid-cols-2 mb-8 bg-secondary/50 p-1 rounded-xl">
                    <TabsTrigger value="login" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">Ingreso</TabsTrigger>
                    <TabsTrigger value="register" className="rounded-lg data-[state=active]:bg-card data-[state=active]:shadow-sm">Registro</TabsTrigger>
                  </TabsList>

                  {/* ─── LOGIN TAB ─── */}
                  <TabsContent value="login" className="space-y-6 mt-0">
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="login-username" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Usuario o Correo</Label>
                        <Input id="login-username" placeholder="usuario o correo@ejemplo.com" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} required className="bg-secondary/20 h-12 px-4 rounded-xl border-border/50 focus-visible:ring-primary focus-visible:border-primary transition-all" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="login-password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contraseña</Label>
                          <button type="button" onClick={() => { clearMessage(); setViewMode("forgot"); setForgotStep("email"); }} className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">
                            ¿Olvidaste tu contraseña?
                          </button>
                        </div>
                        <div className="relative">
                          <Input id="login-password" type={showLoginPass ? "text" : "password"} placeholder="••••••••" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required className="bg-secondary/20 h-12 px-4 pr-12 rounded-xl border-border/50 focus-visible:ring-primary focus-visible:border-primary transition-all" />
                          <button type="button" onClick={() => setShowLoginPass(!showLoginPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                            {showLoginPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <Button className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl mt-4 text-md group" type="submit" disabled={isSubmitting || loading}>
                        {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificando...</> : <>Acceder a mi cuenta <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" /></>}
                      </Button>
                    </form>
                  </TabsContent>

                  {/* ─── REGISTER TAB (no role selection) ─── */}
                  <TabsContent value="register" className="mt-0">
                    <form onSubmit={handleRegister} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="reg-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nombre Completo</Label>
                          <Input id="reg-name" placeholder="Juan Pérez" value={regName} onChange={(e) => setRegName(e.target.value)} required className="bg-secondary/20 h-12 px-4 rounded-xl border-border/50 focus-visible:ring-primary transition-all" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="reg-username" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Usuario</Label>
                          <Input id="reg-username" placeholder="juanperez" value={regUsername} onChange={(e) => setRegUsername(e.target.value)} required className="bg-secondary/20 h-12 px-4 rounded-xl border-border/50 focus-visible:ring-primary transition-all" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reg-email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Correo Electrónico</Label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input id="reg-email" type="email" placeholder="correo@ejemplo.com" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required className="bg-secondary/20 h-12 pl-12 pr-4 rounded-xl border-border/50 focus-visible:ring-primary transition-all" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="reg-password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contraseña</Label>
                          <div className="relative">
                            <Input id="reg-password" type={showRegPass ? "text" : "password"} placeholder="Mín. 6 caracteres" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required className="bg-secondary/20 h-12 px-4 pr-12 rounded-xl border-border/50 focus-visible:ring-primary transition-all" />
                            <button type="button" onClick={() => setShowRegPass(!showRegPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                              {showRegPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="reg-confirm" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confirmar</Label>
                          <Input id="reg-confirm" type="password" placeholder="Repetir" value={regConfirmPassword} onChange={(e) => setRegConfirmPassword(e.target.value)} required className="bg-secondary/20 h-12 px-4 rounded-xl border-border/50 focus-visible:ring-primary transition-all" />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground/60 text-center">Tu cuenta se creará como <strong className="text-primary">Viajero</strong>. Después podrás cambiar tu rol desde la configuración de tu perfil.</p>
                      <Button className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl mt-2 text-md group" type="submit" disabled={isSubmitting || loading}>
                        {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creando cuenta...</> : <>Crear mi cuenta <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" /></>}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </motion.div>
            )}

            {/* ═══════════════ FORGOT PASSWORD FLOW ═══════════════ */}
            {viewMode === "forgot" && (
              <motion.div key="forgot" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                <button onClick={() => { clearMessage(); setViewMode("auth"); setForgotStep("email"); setResetToken(""); }} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
                  <ArrowLeft className="h-4 w-4" /> Volver a inicio de sesión
                </button>

                {/* Step indicator */}
                <div className="flex items-center gap-2 mb-8">
                  {["email", "token", "newPassword"].map((step, i) => (
                    <div key={step} className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${forgotStep === step ? "bg-primary text-black scale-110" :
                        ["email", "token", "newPassword"].indexOf(forgotStep) > i ? "bg-green-500/20 text-green-400 border border-green-500/30" :
                          "bg-secondary/50 text-muted-foreground border border-border/50"
                        }`}>
                        {["email", "token", "newPassword"].indexOf(forgotStep) > i ? <Check className="h-3.5 w-3.5" /> : i + 1}
                      </div>
                      {i < 2 && <div className={`w-12 h-0.5 rounded ${["email", "token", "newPassword"].indexOf(forgotStep) > i ? "bg-green-500/40" : "bg-border/30"}`} />}
                    </div>
                  ))}
                </div>

                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-3">
                    <KeyRound className="h-10 w-10 text-primary" />
                    <div>
                      <h2 className="text-2xl font-semibold">
                        {forgotStep === "email" && "Recuperar contraseña"}
                        {forgotStep === "token" && "Verificar código"}
                        {forgotStep === "newPassword" && "Nueva contraseña"}
                      </h2>
                    </div>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {forgotStep === "email" && "Ingresa tu correo electrónico y te enviaremos un código de recuperación."}
                    {forgotStep === "token" && "Ingresa el código que recibiste en tu correo electrónico."}
                    {forgotStep === "newPassword" && "Crea una nueva contraseña segura para tu cuenta."}
                  </p>
                </div>

                {/* STEP 1: Email */}
                {forgotStep === "email" && (
                  <form onSubmit={handleSendResetEmail} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="forgot-email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Correo Electrónico</Label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="forgot-email" type="email" placeholder="correo@ejemplo.com" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required className="bg-secondary/20 h-12 pl-12 pr-4 rounded-xl border-border/50 focus-visible:ring-primary transition-all" />
                      </div>
                    </div>
                    <Button className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl group" type="submit" disabled={isSubmitting}>
                      {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</> : <>Enviar código <Mail className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" /></>}
                    </Button>
                  </form>
                )}

                {/* STEP 2: Token verification */}
                {forgotStep === "token" && (
                  <form onSubmit={handleVerifyToken} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="reset-token" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Código de Recuperación</Label>
                      <Input id="reset-token" placeholder="Pega aquí el código completo del correo" value={resetToken} onChange={(e) => setResetToken(e.target.value)} required className="bg-secondary/20 h-12 px-4 rounded-xl border-border/50 focus-visible:ring-primary transition-all font-mono text-sm" />
                      <p className="text-xs text-muted-foreground/50">Revisa la bandeja de entrada (y spam) del correo que ingresaste.</p>
                    </div>
                    <Button className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl group" type="submit" disabled={isSubmitting}>
                      {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificando...</> : <>Verificar código <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" /></>}
                    </Button>
                  </form>
                )}

                {/* STEP 3: New password */}
                {forgotStep === "newPassword" && (
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nueva Contraseña</Label>
                      <div className="relative">
                        <Input id="new-password" type={showNewPass ? "text" : "password"} placeholder="Mín. 6 caracteres" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="bg-secondary/20 h-12 px-4 pr-12 rounded-xl border-border/50 focus-visible:ring-primary transition-all" />
                        <button type="button" onClick={() => setShowNewPass(!showNewPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                          {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-new-password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confirmar Contraseña</Label>
                      <Input id="confirm-new-password" type="password" placeholder="Repetir contraseña" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} required className="bg-secondary/20 h-12 px-4 rounded-xl border-border/50 focus-visible:ring-primary transition-all" />
                    </div>
                    <Button className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl mt-2 group" type="submit" disabled={isSubmitting}>
                      {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Actualizando...</> : <>Restablecer Contraseña <Check className="ml-2 h-4 w-4 group-hover:scale-110 transition-transform" /></>}
                    </Button>
                  </form>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
