import React, { useState, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image, ScrollView,
  Animated, Dimensions,
} from "react-native";
import { useAuth } from "../lib/auth";
import { GOOGLE_ANDROID_CLIENT_ID } from "../lib/config";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

// ── Design tokens ──
const GOLD = "#c9a227";
const GOLD_DIM = "rgba(201,162,39,0.12)";
const GOLD_BORDER = "rgba(201,162,39,0.25)";
const BG = "#050509";
const CARD = "#0d0d16";
const SURFACE = "rgba(255,255,255,0.03)";
const BORDER = "rgba(255,255,255,0.06)";
const MUTED = "rgba(255,255,255,0.4)";
const LABEL = "rgba(255,255,255,0.5)";
const DANGER = "#ef4444";
const SUCCESS = "#22c55e";
const { width: SCREEN_W } = Dimensions.get("window");

type ViewMode = "auth" | "forgot";
type Tab = "login" | "register";
type ForgotStep = "email" | "token" | "newPassword";

export default function LoginScreen() {
  const {
    login, register, loading,
    loginWithGoogleToken,
    forgotPassword, verifyResetToken, resetPassword,
  } = useAuth();

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>("auth");
  const [tab, setTab] = useState<Tab>("login");
  const [forgotStep, setForgotStep] = useState<ForgotStep>("email");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Login fields
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [showLoginPass, setShowLoginPass] = useState(false);

  // Register fields
  const [regName, setRegName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPass, setRegPass] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [showRegPass, setShowRegPass] = useState(false);

  // Forgot fields
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmNewPass, setConfirmNewPass] = useState("");
  const [showNewPass, setShowNewPass] = useState(false);

  // Google Auth
  const [_request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
  });

  React.useEffect(() => {
    if (response?.type === "success" && response.authentication?.idToken) {
      handleGoogleLogin(response.authentication.idToken);
    }
  }, [response]);

  const handleGoogleLogin = async (idToken: string) => {
    setIsSubmitting(true);
    setMessage(null);
    const res = await loginWithGoogleToken(idToken);
    setIsSubmitting(false);
    if (!res.ok) setMessage({ type: "error", text: res.message || "Error con Google" });
  };

  // ── Handlers ──
  const handleLogin = async () => {
    setMessage(null);
    if (!loginUser.trim() || !loginPass.trim()) {
      setMessage({ type: "error", text: "Completa todos los campos" });
      return;
    }
    setIsSubmitting(true);
    const res = await login(loginUser.trim(), loginPass);
    setIsSubmitting(false);
    if (!res.ok) setMessage({ type: "error", text: res.message || "Error al iniciar sesión" });
  };

  const handleRegister = async () => {
    setMessage(null);
    if (!regName.trim() || !regUsername.trim() || !regEmail.trim() || !regPass || !regConfirm) {
      setMessage({ type: "error", text: "Completa todos los campos" });
      return;
    }
    if (!regEmail.includes("@")) {
      setMessage({ type: "error", text: "Correo electrónico inválido" });
      return;
    }
    if (regPass.length < 6) {
      setMessage({ type: "error", text: "La contraseña debe tener al menos 6 caracteres" });
      return;
    }
    if (regPass !== regConfirm) {
      setMessage({ type: "error", text: "Las contraseñas no coinciden" });
      return;
    }
    setIsSubmitting(true);
    const res = await register({
      username: regUsername.trim(),
      password: regPass,
      name: regName.trim(),
      email: regEmail.trim(),
    });
    setIsSubmitting(false);
    if (!res.ok) setMessage({ type: "error", text: res.message || "Error al registrarse" });
  };

  const handleSendResetEmail = async () => {
    setMessage(null);
    if (!forgotEmail.trim() || !forgotEmail.includes("@")) {
      setMessage({ type: "error", text: "Ingresa un correo electrónico válido" });
      return;
    }
    setIsSubmitting(true);
    const res = await forgotPassword(forgotEmail.trim());
    setIsSubmitting(false);
    if (res.ok) {
      setMessage({ type: "success", text: "Código enviado. Revisa tu correo." });
      setForgotStep("token");
    } else {
      setMessage({ type: "error", text: res.message || "Error al enviar" });
    }
  };

  const handleVerifyToken = async () => {
    setMessage(null);
    if (!resetToken.trim()) {
      setMessage({ type: "error", text: "Ingresa el código del correo" });
      return;
    }
    setIsSubmitting(true);
    const res = await verifyResetToken(resetToken.trim());
    setIsSubmitting(false);
    if (res.ok) {
      setMessage({ type: "success", text: "Código verificado. Crea tu nueva contraseña." });
      setForgotStep("newPassword");
    } else {
      setMessage({ type: "error", text: res.message || "Código inválido" });
    }
  };

  const handleResetPassword = async () => {
    setMessage(null);
    if (newPass.length < 6) {
      setMessage({ type: "error", text: "Mínimo 6 caracteres" });
      return;
    }
    if (newPass !== confirmNewPass) {
      setMessage({ type: "error", text: "Las contraseñas no coinciden" });
      return;
    }
    setIsSubmitting(true);
    const res = await resetPassword(resetToken.trim(), newPass);
    setIsSubmitting(false);
    if (res.ok) {
      setMessage({ type: "success", text: "¡Contraseña actualizada! Ya puedes iniciar sesión." });
      setTimeout(() => {
        setViewMode("auth");
        setForgotStep("email");
        setResetToken("");
        setNewPass("");
        setConfirmNewPass("");
        setMessage(null);
      }, 2500);
    } else {
      setMessage({ type: "error", text: res.message || "Error" });
    }
  };

  // ── Render helpers ──
  const renderInput = (
    value: string, setValue: (v: string) => void,
    placeholder: string, opts?: {
      secure?: boolean; showToggle?: boolean; show?: boolean;
      onToggle?: () => void; keyboardType?: any; autoCapitalize?: any;
      icon?: string;
    }
  ) => (
    <View style={s.inputWrap}>
      {opts?.icon && <Text style={s.inputIcon}>{opts.icon}</Text>}
      <TextInput
        style={[s.input, opts?.icon ? { paddingLeft: 42 } : null]}
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        placeholderTextColor={MUTED}
        secureTextEntry={opts?.secure && !opts?.show}
        keyboardType={opts?.keyboardType || "default"}
        autoCapitalize={opts?.autoCapitalize || "none"}
      />
      {opts?.showToggle && (
        <TouchableOpacity style={s.eyeBtn} onPress={opts?.onToggle}>
          <Text style={s.eyeText}>{opts?.show ? "🙈" : "👁️"}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* ── Logo + Brand ── */}
        <View style={s.logoBox}>
          <View style={s.logoGlow}>
            <Image source={require("../../assets/logo.jpeg")} style={s.logo} />
          </View>
          <Text style={s.brand}>
            <Text style={{ color: GOLD }}>VIA</Text>Nova
          </Text>
          <Text style={s.tagline}>Tu asistente inteligente de viaje</Text>
        </View>

        {/* ── Message ── */}
        {message && (
          <View style={[s.msgBox, message.type === "success" ? s.msgSuccess : s.msgError]}>
            <Text style={s.msgIcon}>{message.type === "success" ? "✓" : "⚠"}</Text>
            <Text style={[s.msgText, { color: message.type === "success" ? SUCCESS : DANGER }]}>
              {message.text}
            </Text>
          </View>
        )}

        {/* ═══ AUTH VIEW ═══ */}
        {viewMode === "auth" && (
          <View style={s.card}>
            {/* Google Button */}
            <TouchableOpacity
              style={s.googleBtn}
              onPress={() => promptAsync()}
              disabled={isSubmitting}
            >
              <Text style={s.googleIcon}>G</Text>
              <Text style={s.googleText}>Continuar con Google</Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={s.divider}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>O usa tu cuenta</Text>
              <View style={s.dividerLine} />
            </View>

            {/* Tabs */}
            <View style={s.tabBar}>
              <TouchableOpacity
                style={[s.tabBtn, tab === "login" && s.tabActive]}
                onPress={() => { setTab("login"); setMessage(null); }}
              >
                <Text style={[s.tabText, tab === "login" && s.tabTextActive]}>Ingreso</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.tabBtn, tab === "register" && s.tabActive]}
                onPress={() => { setTab("register"); setMessage(null); }}
              >
                <Text style={[s.tabText, tab === "register" && s.tabTextActive]}>Registro</Text>
              </TouchableOpacity>
            </View>

            {/* ─── LOGIN TAB ─── */}
            {tab === "login" && (
              <View style={s.form}>
                <Text style={s.label}>USUARIO O CORREO</Text>
                {renderInput(loginUser, setLoginUser, "usuario o correo@ejemplo.com", { icon: "👤" })}

                <Text style={s.label}>CONTRASEÑA</Text>
                {renderInput(loginPass, setLoginPass, "••••••••", {
                  secure: true, showToggle: true, show: showLoginPass,
                  onToggle: () => setShowLoginPass(!showLoginPass), icon: "🔒",
                })}

                <TouchableOpacity onPress={() => { setViewMode("forgot"); setForgotStep("email"); setMessage(null); }}>
                  <Text style={s.forgotLink}>¿Olvidaste tu contraseña?</Text>
                </TouchableOpacity>

                <TouchableOpacity style={s.submitBtn} onPress={handleLogin} disabled={isSubmitting || loading}>
                  {isSubmitting || loading ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <Text style={s.submitText}>Acceder a mi cuenta  →</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* ─── REGISTER TAB ─── */}
            {tab === "register" && (
              <View style={s.form}>
                <View style={s.row}>
                  <View style={s.halfField}>
                    <Text style={s.label}>NOMBRE</Text>
                    {renderInput(regName, setRegName, "Tu nombre", { autoCapitalize: "words" })}
                  </View>
                  <View style={s.halfField}>
                    <Text style={s.label}>USUARIO</Text>
                    {renderInput(regUsername, setRegUsername, "juanperez")}
                  </View>
                </View>

                <Text style={s.label}>CORREO ELECTRÓNICO</Text>
                {renderInput(regEmail, setRegEmail, "correo@ejemplo.com", { icon: "✉️", keyboardType: "email-address" })}

                <View style={s.row}>
                  <View style={s.halfField}>
                    <Text style={s.label}>CONTRASEÑA</Text>
                    {renderInput(regPass, setRegPass, "Mín. 6", {
                      secure: true, showToggle: true, show: showRegPass,
                      onToggle: () => setShowRegPass(!showRegPass),
                    })}
                  </View>
                  <View style={s.halfField}>
                    <Text style={s.label}>CONFIRMAR</Text>
                    {renderInput(regConfirm, setRegConfirm, "Repetir", { secure: true })}
                  </View>
                </View>

                <Text style={s.hint}>
                  Tu cuenta se creará como <Text style={{ color: GOLD, fontWeight: "700" }}>Viajero</Text>. Después podrás cambiar tu rol.
                </Text>

                <TouchableOpacity style={s.submitBtn} onPress={handleRegister} disabled={isSubmitting || loading}>
                  {isSubmitting || loading ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <Text style={s.submitText}>Crear mi cuenta  →</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ═══ FORGOT PASSWORD FLOW ═══ */}
        {viewMode === "forgot" && (
          <View style={s.card}>
            <TouchableOpacity
              style={s.backBtn}
              onPress={() => { setViewMode("auth"); setForgotStep("email"); setMessage(null); setResetToken(""); }}
            >
              <Text style={s.backText}>← Volver a inicio de sesión</Text>
            </TouchableOpacity>

            {/* Step indicator */}
            <View style={s.stepsRow}>
              {(["email", "token", "newPassword"] as ForgotStep[]).map((step, i) => {
                const steps: ForgotStep[] = ["email", "token", "newPassword"];
                const current = steps.indexOf(forgotStep);
                const done = current > i;
                const active = forgotStep === step;
                return (
                  <React.Fragment key={step}>
                    <View style={[s.stepDot, active && s.stepDotActive, done && s.stepDotDone]}>
                      <Text style={[s.stepDotText, (active || done) && { color: done ? SUCCESS : "#000" }]}>
                        {done ? "✓" : i + 1}
                      </Text>
                    </View>
                    {i < 2 && <View style={[s.stepLine, done && { backgroundColor: SUCCESS + "66" }]} />}
                  </React.Fragment>
                );
              })}
            </View>

            <View style={s.forgotHeader}>
              <Text style={s.forgotIcon}>
                {forgotStep === "email" ? "🔑" : forgotStep === "token" ? "📧" : "🔐"}
              </Text>
              <Text style={s.forgotTitle}>
                {forgotStep === "email" && "Recuperar contraseña"}
                {forgotStep === "token" && "Verificar código"}
                {forgotStep === "newPassword" && "Nueva contraseña"}
              </Text>
              <Text style={s.forgotSubtitle}>
                {forgotStep === "email" && "Ingresa tu correo y te enviaremos un código."}
                {forgotStep === "token" && "Ingresa el código que recibiste en tu correo."}
                {forgotStep === "newPassword" && "Crea una nueva contraseña segura."}
              </Text>
            </View>

            {/* Step 1: Email */}
            {forgotStep === "email" && (
              <View style={s.form}>
                <Text style={s.label}>CORREO ELECTRÓNICO</Text>
                {renderInput(forgotEmail, setForgotEmail, "correo@ejemplo.com", { icon: "✉️", keyboardType: "email-address" })}
                <TouchableOpacity style={s.submitBtn} onPress={handleSendResetEmail} disabled={isSubmitting}>
                  {isSubmitting ? <ActivityIndicator color="#000" /> : <Text style={s.submitText}>Enviar código  ✉️</Text>}
                </TouchableOpacity>
              </View>
            )}

            {/* Step 2: Token */}
            {forgotStep === "token" && (
              <View style={s.form}>
                <Text style={s.label}>CÓDIGO DE RECUPERACIÓN</Text>
                {renderInput(resetToken, setResetToken, "Pega el código del correo")}
                <Text style={s.hint}>Revisa la bandeja de entrada (y spam) del correo que ingresaste.</Text>
                <TouchableOpacity style={s.submitBtn} onPress={handleVerifyToken} disabled={isSubmitting}>
                  {isSubmitting ? <ActivityIndicator color="#000" /> : <Text style={s.submitText}>Verificar código  →</Text>}
                </TouchableOpacity>
              </View>
            )}

            {/* Step 3: New password */}
            {forgotStep === "newPassword" && (
              <View style={s.form}>
                <Text style={s.label}>NUEVA CONTRASEÑA</Text>
                {renderInput(newPass, setNewPass, "Mín. 6 caracteres", {
                  secure: true, showToggle: true, show: showNewPass,
                  onToggle: () => setShowNewPass(!showNewPass),
                })}
                <Text style={s.label}>CONFIRMAR CONTRASEÑA</Text>
                {renderInput(confirmNewPass, setConfirmNewPass, "Repetir contraseña", { secure: true })}
                <TouchableOpacity style={s.submitBtn} onPress={handleResetPassword} disabled={isSubmitting}>
                  {isSubmitting ? <ActivityIndicator color="#000" /> : <Text style={s.submitText}>Restablecer Contraseña  ✓</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Footer */}
        <Text style={s.footer}>VIANova © 2026 — Tu viaje comienza aquí</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 20, paddingTop: 50, paddingBottom: 30 },

  // Logo
  logoBox: { alignItems: "center", marginBottom: 24 },
  logoGlow: {
    borderRadius: 24, overflow: "hidden", marginBottom: 14,
    shadowColor: GOLD, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 20,
    elevation: 15,
    borderWidth: 2, borderColor: GOLD_BORDER,
  },
  logo: { width: 80, height: 80 },
  brand: { fontSize: 32, fontWeight: "900", color: "#fff", letterSpacing: 1 },
  tagline: { color: MUTED, fontSize: 13, marginTop: 4 },

  // Card
  card: {
    backgroundColor: CARD, borderRadius: 24, padding: 24,
    borderWidth: 1, borderColor: BORDER,
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 24,
    elevation: 10,
  },

  // Google
  googleBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 14, paddingVertical: 14, gap: 12,
  },
  googleIcon: {
    fontSize: 20, fontWeight: "900",
    color: "#4285F4",
  },
  googleText: { color: "#fff", fontSize: 15, fontWeight: "600" },

  // Divider
  divider: { flexDirection: "row", alignItems: "center", marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: BORDER },
  dividerText: { color: MUTED, fontSize: 11, marginHorizontal: 12, textTransform: "uppercase", letterSpacing: 1 },

  // Tabs
  tabBar: {
    flexDirection: "row", backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14, padding: 4, marginBottom: 20,
  },
  tabBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  tabActive: { backgroundColor: CARD, borderWidth: 1, borderColor: GOLD_BORDER, shadowColor: GOLD, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  tabText: { color: MUTED, fontSize: 14, fontWeight: "600" },
  tabTextActive: { color: GOLD },

  // Form
  form: {},
  label: {
    color: LABEL, fontSize: 11, fontWeight: "700",
    marginBottom: 6, marginTop: 14, textTransform: "uppercase", letterSpacing: 1.5,
  },
  inputWrap: { position: "relative" },
  input: {
    backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER,
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16,
    color: "#fff", fontSize: 15,
  },
  inputIcon: { position: "absolute", left: 14, top: 14, fontSize: 16, zIndex: 1 },
  eyeBtn: { position: "absolute", right: 14, top: 12, padding: 4 },
  eyeText: { fontSize: 18 },

  // Row (side-by-side fields)
  row: { flexDirection: "row", gap: 12 },
  halfField: { flex: 1 },

  // Forgot link
  forgotLink: { color: GOLD, fontSize: 12, fontWeight: "600", textAlign: "right", marginTop: 10 },

  // Submit
  submitBtn: {
    backgroundColor: GOLD, borderRadius: 14, paddingVertical: 16,
    marginTop: 22, alignItems: "center",
    shadowColor: GOLD, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12,
    elevation: 6,
  },
  submitText: { color: "#000", fontSize: 16, fontWeight: "800", letterSpacing: 0.5 },

  // Hint
  hint: { color: MUTED, fontSize: 11, textAlign: "center", marginTop: 12, lineHeight: 16 },

  // Message
  msgBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 14, borderRadius: 14, marginBottom: 16, borderWidth: 1,
  },
  msgSuccess: { backgroundColor: "rgba(34,197,94,0.08)", borderColor: "rgba(34,197,94,0.25)" },
  msgError: { backgroundColor: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)" },
  msgIcon: { fontSize: 16 },
  msgText: { flex: 1, fontSize: 13, fontWeight: "500", lineHeight: 18 },

  // Back
  backBtn: { marginBottom: 16 },
  backText: { color: MUTED, fontSize: 13, fontWeight: "500" },

  // Steps
  stepsRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  stepDot: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: BORDER,
    alignItems: "center", justifyContent: "center",
  },
  stepDotActive: { backgroundColor: GOLD, borderColor: GOLD },
  stepDotDone: { backgroundColor: "rgba(34,197,94,0.15)", borderColor: "rgba(34,197,94,0.3)" },
  stepDotText: { fontSize: 12, fontWeight: "700", color: MUTED },
  stepLine: { width: 40, height: 2, backgroundColor: BORDER, borderRadius: 1 },

  // Forgot header
  forgotHeader: { alignItems: "center", marginBottom: 8 },
  forgotIcon: { fontSize: 32, marginBottom: 8 },
  forgotTitle: { color: "#fff", fontSize: 22, fontWeight: "700", marginBottom: 4 },
  forgotSubtitle: { color: MUTED, fontSize: 13, textAlign: "center", lineHeight: 18 },

  // Footer
  footer: { color: "rgba(255,255,255,0.15)", fontSize: 11, textAlign: "center", marginTop: 24 },

  // Switch (legacy compat)
  switch: { color: GOLD, fontSize: 13, textAlign: "center", marginTop: 18 },
});
