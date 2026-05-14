import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image, ScrollView,
} from "react-native";
import { useAuth } from "../lib/auth";

const GOLD = "#c9a227";
const BG = "#050509";
const CARD = "#0d0d16";
const BORDER = "rgba(255,255,255,0.06)";
const MUTED = "rgba(255,255,255,0.4)";

export default function LoginScreen() {
  const { login, register, loading } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (mode === "login") {
      if (!username || !password) { setError("Completa todos los campos"); return; }
      const res = await login(username, password);
      if (!res.ok) setError(res.message || "Error al iniciar sesión");
    } else {
      if (!username || !password || !name || !email) { setError("Completa todos los campos"); return; }
      const res = await register({ username, password, name, email });
      if (!res.ok) setError(res.message || "Error al registrarse");
    }
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={s.logoBox}>
          <Image source={require("../../assets/logo.jpeg")} style={s.logo} />
          <Text style={s.brand}>
            <Text style={{ color: GOLD }}>VIA</Text>Nova
          </Text>
        </View>

        <Text style={s.subtitle}>
          {mode === "login" ? "Inicia sesión en tu cuenta" : "Crea tu cuenta"}
        </Text>

        {/* Form Card */}
        <View style={s.card}>
          {mode === "register" && (
            <>
              <Text style={s.label}>Nombre</Text>
              <TextInput style={s.input} value={name} onChangeText={setName} placeholder="Tu nombre" placeholderTextColor={MUTED} />
              <Text style={s.label}>Correo electrónico</Text>
              <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="correo@ejemplo.com" placeholderTextColor={MUTED} keyboardType="email-address" autoCapitalize="none" />
            </>
          )}
          <Text style={s.label}>Usuario</Text>
          <TextInput style={s.input} value={username} onChangeText={setUsername} placeholder="Nombre de usuario" placeholderTextColor={MUTED} autoCapitalize="none" />
          <Text style={s.label}>Contraseña</Text>
          <TextInput style={s.input} value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor={MUTED} secureTextEntry />

          {error ? <Text style={s.error}>{error}</Text> : null}

          <TouchableOpacity style={s.btn} onPress={handleSubmit} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={s.btnText}>{mode === "login" ? "Iniciar Sesión" : "Registrarse"}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
            <Text style={s.switch}>
              {mode === "login" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 24 },
  logoBox: { alignItems: "center", marginBottom: 16 },
  logo: { width: 72, height: 72, borderRadius: 18, marginBottom: 12 },
  brand: { fontSize: 28, fontWeight: "800", color: "#fff" },
  subtitle: { color: MUTED, fontSize: 15, textAlign: "center", marginBottom: 28 },
  card: { backgroundColor: CARD, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: BORDER },
  label: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 14, textTransform: "uppercase", letterSpacing: 1 },
  input: { backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: BORDER, borderRadius: 12, padding: 14, color: "#fff", fontSize: 15 },
  error: { color: "#ef4444", fontSize: 13, marginTop: 12, textAlign: "center" },
  btn: { backgroundColor: GOLD, borderRadius: 12, paddingVertical: 16, marginTop: 24, alignItems: "center" },
  btnText: { color: "#000", fontSize: 16, fontWeight: "700" },
  switch: { color: GOLD, fontSize: 13, textAlign: "center", marginTop: 18 },
});
