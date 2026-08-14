import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity, Image,
  StyleSheet, RefreshControl, ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { listServices, listServicesByCategory } from "../lib/api";
import type { Service, ServiceCategory } from "../lib/api";

const GOLD = "#c9a227";
const BG = "#050509";
const CARD = "#0d0d16";
const BORDER = "rgba(255,255,255,0.06)";

const categories: { id: ServiceCategory | "all"; label: string; emoji: string }[] = [
  { id: "all", label: "Todos", emoji: "🌎" },
  { id: "hotel", label: "Hoteles", emoji: "🏨" },
  { id: "restaurant", label: "Restaurantes", emoji: "🍽️" },
  { id: "recreation", label: "Recreación", emoji: "🎡" },
  { id: "transport", label: "Transporte", emoji: "🚖" },
];

export default function HomeScreen() {
  const nav = useNavigation<any>();
  const [services, setServices] = useState<Service[]>([]);
  const [category, setCategory] = useState<ServiceCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = category === "all"
        ? await listServices()
        : await listServicesByCategory(category);
      setServices(data);
    } catch (err) {
      console.error("Error loading services:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [category]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const filtered = services.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.description || "").toLowerCase().includes(search.toLowerCase())
  );

  const renderItem = ({ item }: { item: Service }) => (
    <TouchableOpacity
      style={s.card}
      activeOpacity={0.7}
      onPress={() => nav.navigate("ServiceDetail", { service: item })}
    >
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={s.cardImg} />
      ) : (
        <View style={[s.cardImg, { backgroundColor: "#1a1a2e", justifyContent: "center", alignItems: "center" }]}>
          <Text style={{ fontSize: 40 }}>
            {item.category === "hotel" ? "🏨" : item.category === "restaurant" ? "🍽️" : item.category === "recreation" ? "🎡" : "🚖"}
          </Text>
        </View>
      )}
      <View style={s.cardBody}>
        <Text style={s.cardCat}>{item.category.toUpperCase()}</Text>
        <Text style={s.cardTitle} numberOfLines={1}>{item.name}</Text>
        <Text style={s.cardDesc} numberOfLines={2}>{item.description || "Sin descripción"}</Text>
        {item.rating && (
          <View style={s.ratingRow}>
            <Text style={s.ratingStar}>⭐</Text>
            <Text style={s.ratingText}>{item.rating}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>
          <Text style={{ color: GOLD }}>VIA</Text>Nova
        </Text>
      </View>

      {/* Search Bar */}
      <View style={s.searchBox}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          placeholder="Buscar servicios..."
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Category Pills */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={categories}
        keyExtractor={(c) => c.id}
        contentContainerStyle={s.pills}
        renderItem={({ item: cat }) => (
          <TouchableOpacity
            style={[s.pill, category === cat.id && s.pillActive]}
            onPress={() => setCategory(cat.id)}
          >
            <Text style={s.pillEmoji}>{cat.emoji}</Text>
            <Text style={[s.pillText, category === cat.id && s.pillTextActive]}>{cat.label}</Text>
          </TouchableOpacity>
        )}
      />

      {/* Service List */}
      {loading ? (
        <ActivityIndicator color={GOLD} size="large" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(s) => s.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD} />}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 60 }}>
              <Text style={{ fontSize: 48, marginBottom: 12 }}>📭</Text>
              <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 15 }}>No se encontraron servicios</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: { paddingTop: 56, paddingBottom: 12, paddingHorizontal: 20 },
  headerTitle: { fontSize: 26, fontWeight: "800", color: "#fff" },
  searchBox: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 14, paddingHorizontal: 14, marginBottom: 12, borderWidth: 1, borderColor: BORDER },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, color: "#fff", fontSize: 14, paddingVertical: 12 },
  pills: { paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: BORDER },
  pillActive: { backgroundColor: GOLD, borderColor: GOLD },
  pillEmoji: { fontSize: 14 },
  pillText: { color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: "600" },
  pillTextActive: { color: "#000" },
  card: { backgroundColor: CARD, borderRadius: 18, marginBottom: 14, overflow: "hidden", borderWidth: 1, borderColor: BORDER },
  cardImg: { width: "100%", height: 180 },
  cardBody: { padding: 16 },
  cardCat: { color: GOLD, fontSize: 10, fontWeight: "700", letterSpacing: 2, marginBottom: 4 },
  cardTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 4 },
  cardDesc: { color: "rgba(255,255,255,0.35)", fontSize: 13, lineHeight: 19, marginBottom: 8 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingStar: { fontSize: 13 },
  ratingText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
