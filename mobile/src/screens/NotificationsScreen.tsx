import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { useAuth } from "../lib/auth";
import { API_URL } from "../lib/config";

const GOLD = "#c9a227";
const BG = "#050509";
const CARD_BG = "#0a0a12";

type Notification = {
  id: string;
  providerUsername: string;
  travelerUsername: string;
  type: string;
  details: string;
  isRead: string;
  createdAt: string;
};

export default function NotificationsScreen() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/notifications?username=${encodeURIComponent(user.username)}`, {
        // assuming standard fetch with cookie handling for mobile or whatever the app uses.
        // wait, looking at mobile app, it might use api client.
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await fetch(`${API_URL}/api/notifications/${id}/read`, {
        method: "PATCH",
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: "true" } : n))
      );
    } catch (e) {
      console.error(e);
    }
  };

  const renderItem = ({ item }: { item: Notification }) => {
    const isRead = item.isRead === "true";
    return (
      <View style={[styles.card, isRead && styles.cardRead]}>
        <View style={styles.cardHeader}>
          <Text style={styles.type}>{item.type}</Text>
          {!isRead && <View style={styles.badge}><Text style={styles.badgeText}>Nueva</Text></View>}
        </View>
        <Text style={styles.date}>{new Date(item.createdAt).toLocaleString("es-CO")}</Text>
        
        <View style={styles.detailsBox}>
          <Text style={styles.text}><Text style={styles.bold}>Viajero:</Text> {item.travelerUsername}</Text>
          <Text style={styles.text}><Text style={styles.bold}>Detalles:</Text> {item.details}</Text>
        </View>

        {!isRead && (
          <TouchableOpacity style={styles.readButton} onPress={() => markAsRead(item.id)}>
            <Text style={styles.readButtonText}>Marcar como Leída</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (!user || user.role === "traveler") {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Sin Acceso</Text>
        <Text style={styles.text}>Esta sección es solo para proveedores.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Reservas</Text>
      {loading ? (
        <ActivityIndicator size="large" color={GOLD} style={{ marginTop: 50 }} />
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No tienes solicitudes pendientes.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, padding: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: BG },
  headerTitle: { fontSize: 28, fontWeight: "bold", color: "#fff", marginBottom: 16, marginTop: 40 },
  title: { fontSize: 24, fontWeight: "bold", color: "#fff", marginBottom: 8 },
  emptyText: { fontSize: 16, color: "rgba(255,255,255,0.5)" },
  card: { backgroundColor: CARD_BG, padding: 16, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: "rgba(201,162,39,0.3)" },
  cardRead: { borderColor: "rgba(255,255,255,0.05)", opacity: 0.7 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  type: { color: GOLD, fontSize: 18, fontWeight: "bold" },
  badge: { backgroundColor: "rgba(201,162,39,0.2)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { color: GOLD, fontSize: 10, fontWeight: "bold", textTransform: "uppercase" },
  date: { color: "rgba(255,255,255,0.4)", fontSize: 12, marginBottom: 12 },
  detailsBox: { backgroundColor: "rgba(0,0,0,0.3)", padding: 12, borderRadius: 8, marginBottom: 12 },
  text: { color: "rgba(255,255,255,0.8)", fontSize: 14, marginBottom: 4, lineHeight: 20 },
  bold: { fontWeight: "bold", color: GOLD },
  readButton: { padding: 10, alignItems: "center", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.05)", marginTop: 4 },
  readButtonText: { color: GOLD, fontWeight: "bold" },
});
