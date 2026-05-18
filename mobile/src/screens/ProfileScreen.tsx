import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Image,
} from "react-native";
import { useAuth, type AuthUser } from "../lib/auth";
import type { UserRole } from "../lib/api";

const GOLD = "#c9a227";
const BG = "#050509";
const CARD = "#0d0d16";
const BORDER = "rgba(255,255,255,0.06)";

const roles: { id: UserRole; label: string; emoji: string; desc: string }[] = [
  { id: "traveler", label: "Viajero", emoji: "✈️", desc: "Explora destinos y servicios" },
  { id: "hotel", label: "Hotel", emoji: "🏨", desc: "Publica y gestiona tu alojamiento" },
  { id: "restaurant", label: "Restaurante", emoji: "🍽️", desc: "Muestra tu carta y ofertas" },
  { id: "recreation", label: "Recreación", emoji: "🎡", desc: "Ofrece experiencias únicas" },
  { id: "taxi", label: "Taxista", emoji: "🚖", desc: "Conecta con viajeros" },
];

export default function ProfileScreen() {
  const { user, logout, changeRole } = useAuth();
  const [changingRole, setChangingRole] = useState(false);

  if (!user) return null;

  const handleRoleChange = async (role: UserRole) => {
    const res = await changeRole(role);
    if (res.ok) {
      Alert.alert("Listo", "Tu rol ha sido actualizado.");
      setChangingRole(false);
    } else {
      Alert.alert("Error", res.message || "No se pudo cambiar el rol.");
    }
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 20, paddingTop: 56 }}>
      {/* User card */}
      <View style={s.userCard}>
        <View style={s.avatar}>
          <Text style={{ fontSize: 32 }}>
            {user.role === "hotel" ? "🏨" : user.role === "restaurant" ? "🍽️" : user.role === "recreation" ? "🎡" : user.role === "taxi" ? "🚖" : "✈️"}
          </Text>
        </View>
        <Text style={s.userName}>{user.name || user.username}</Text>
        <Text style={s.userEmail}>{user.email || user.username}</Text>
        <View style={s.roleBadge}>
          <Text style={s.roleBadgeText}>
            {roles.find(r => r.id === user.role)?.label || "Viajero"}
          </Text>
        </View>
      </View>

      {/* Change Role */}
      <TouchableOpacity style={s.menuItem} onPress={() => setChangingRole(!changingRole)}>
        <Text style={s.menuIcon}>🔄</Text>
        <Text style={s.menuText}>Cambiar Rol</Text>
      </TouchableOpacity>

      {changingRole && (
        <View style={s.roleList}>
          {roles.map(r => (
            <TouchableOpacity
              key={r.id}
              style={[s.roleCard, user.role === r.id && s.roleCardActive]}
              onPress={() => handleRoleChange(r.id)}
              disabled={user.role === r.id}
            >
              <Text style={s.roleEmoji}>{r.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.roleLabel}>{r.label}</Text>
                <Text style={s.roleDesc}>{r.desc}</Text>
              </View>
              {user.role === r.id && <Text style={s.roleCheck}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Logout */}
      <TouchableOpacity style={[s.menuItem, { marginTop: 24 }]} onPress={() => {
        Alert.alert("Cerrar Sesión", "¿Estás seguro?", [
          { text: "Cancelar", style: "cancel" },
          { text: "Salir", style: "destructive", onPress: logout },
        ]);
      }}>
        <Text style={s.menuIcon}>🚪</Text>
        <Text style={[s.menuText, { color: "#ef4444" }]}>Cerrar Sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  userCard: { alignItems: "center", backgroundColor: CARD, borderRadius: 20, padding: 28, marginBottom: 24, borderWidth: 1, borderColor: BORDER },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: "rgba(201,162,39,0.1)", justifyContent: "center", alignItems: "center", marginBottom: 14 },
  userName: { color: "#fff", fontSize: 22, fontWeight: "700", marginBottom: 4 },
  userEmail: { color: "rgba(255,255,255,0.35)", fontSize: 13, marginBottom: 12 },
  roleBadge: { backgroundColor: "rgba(201,162,39,0.12)", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100, borderWidth: 1, borderColor: "rgba(201,162,39,0.2)" },
  roleBadgeText: { color: GOLD, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.5 },
  menuItem: { flexDirection: "row", alignItems: "center", backgroundColor: CARD, borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: BORDER },
  menuIcon: { fontSize: 18, marginRight: 14 },
  menuText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  roleList: { gap: 8, marginBottom: 12 },
  roleCard: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.02)", borderRadius: 14, padding: 16, gap: 14, borderWidth: 1, borderColor: BORDER },
  roleCardActive: { borderColor: GOLD, backgroundColor: "rgba(201,162,39,0.06)" },
  roleEmoji: { fontSize: 28 },
  roleLabel: { color: "#fff", fontSize: 15, fontWeight: "600" },
  roleDesc: { color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 2 },
  roleCheck: { color: GOLD, fontSize: 18, fontWeight: "700" },
});
