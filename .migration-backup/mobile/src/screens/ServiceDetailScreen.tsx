import React, { useEffect, useState } from "react";
import {
  View, Text, ScrollView, Image, StyleSheet, TouchableOpacity,
  TextInput, Alert, FlatList, ActivityIndicator,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { listComments, addComment, deleteComment } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Service, Comment } from "../lib/api";

const GOLD = "#c9a227";
const BG = "#050509";
const CARD = "#0d0d16";
const BORDER = "rgba(255,255,255,0.06)";

export default function ServiceDetailScreen() {
  const route = useRoute<any>();
  const nav = useNavigation();
  const { user } = useAuth();
  const service: Service = route.params?.service;

  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [rating, setRating] = useState(5);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadComments();
  }, []);

  const loadComments = async () => {
    try {
      const data = await listComments(service.id);
      setComments(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !user) return;
    setSubmitting(true);
    try {
      await addComment({
        locationId: service.id,
        authorUsername: user.username,
        content: newComment.trim(),
        rating,
      });
      setNewComment("");
      setRating(5);
      await loadComments();
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    Alert.alert("Eliminar", "¿Eliminar este comentario?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar", style: "destructive", onPress: async () => {
          await deleteComment(id);
          loadComments();
        }
      },
    ]);
  };

  return (
    <ScrollView style={s.container}>
      {/* Hero Image */}
      {service.imageUrl ? (
        <Image source={{ uri: service.imageUrl }} style={s.hero} />
      ) : (
        <View style={[s.hero, { backgroundColor: "#1a1a2e", justifyContent: "center", alignItems: "center" }]}>
          <Text style={{ fontSize: 60 }}>
            {service.category === "hotel" ? "🏨" : service.category === "restaurant" ? "🍽️" : service.category === "recreation" ? "🎡" : "🚖"}
          </Text>
        </View>
      )}

      {/* Back button */}
      <TouchableOpacity style={s.backBtn} onPress={() => nav.goBack()}>
        <Text style={s.backText}>← Volver</Text>
      </TouchableOpacity>

      {/* Info Card */}
      <View style={s.infoCard}>
        <Text style={s.category}>{service.category.toUpperCase()}</Text>
        <Text style={s.title}>{service.name}</Text>

        {service.rating && (
          <View style={s.ratingRow}>
            <Text style={{ fontSize: 18 }}>⭐</Text>
            <Text style={s.ratingNum}>{service.rating}</Text>
          </View>
        )}

        <Text style={s.desc}>{service.description || "Sin descripción disponible."}</Text>

        {service.providerUsername && (
          <View style={s.metaRow}>
            <Text style={s.metaLabel}>Proveedor</Text>
            <Text style={s.metaValue}>{service.providerUsername}</Text>
          </View>
        )}
      </View>

      {/* Comments */}
      <View style={s.commentsSection}>
        <Text style={s.sectionTitle}>Comentarios ({comments.length})</Text>

        {/* Add comment */}
        {user && (
          <View style={s.addComment}>
            {/* Star rating */}
            <View style={s.starRow}>
              {[1, 2, 3, 4, 5].map(i => (
                <TouchableOpacity key={i} onPress={() => setRating(i)}>
                  <Text style={{ fontSize: 22 }}>{i <= rating ? "⭐" : "☆"}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={s.commentInput}
              placeholder="Escribe un comentario..."
              placeholderTextColor="rgba(255,255,255,0.25)"
              value={newComment}
              onChangeText={setNewComment}
              multiline
            />
            <TouchableOpacity style={s.sendBtn} onPress={handleAddComment} disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text style={s.sendText}>Publicar</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={GOLD} style={{ marginTop: 20 }} />
        ) : comments.length === 0 ? (
          <Text style={s.noComments}>Sin comentarios aún. ¡Sé el primero!</Text>
        ) : (
          comments.map(c => (
            <View key={c.id} style={s.commentCard}>
              <View style={s.commentHeader}>
                <Text style={s.commentAuthor}>{c.authorUsername}</Text>
                {c.rating && <Text style={s.commentRating}>⭐ {c.rating}</Text>}
              </View>
              <Text style={s.commentContent}>{c.content}</Text>
              {user?.username === c.authorUsername && (
                <TouchableOpacity onPress={() => handleDelete(c.id)}>
                  <Text style={s.deleteBtn}>Eliminar</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  hero: { width: "100%", height: 280 },
  backBtn: { position: "absolute", top: 50, left: 16, backgroundColor: "rgba(5,5,9,0.8)", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  backText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  infoCard: { margin: 16, padding: 20, backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: BORDER },
  category: { color: GOLD, fontSize: 10, fontWeight: "700", letterSpacing: 2, marginBottom: 6 },
  title: { color: "#fff", fontSize: 26, fontWeight: "800", marginBottom: 8 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  ratingNum: { color: "#fff", fontSize: 18, fontWeight: "700" },
  desc: { color: "rgba(255,255,255,0.4)", fontSize: 14, lineHeight: 22, marginBottom: 16 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 12, borderTopWidth: 1, borderTopColor: BORDER },
  metaLabel: { color: "rgba(255,255,255,0.25)", fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1 },
  metaValue: { color: "rgba(255,255,255,0.5)", fontSize: 13 },
  commentsSection: { paddingHorizontal: 16, paddingBottom: 40 },
  sectionTitle: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 14 },
  addComment: { backgroundColor: CARD, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: BORDER },
  starRow: { flexDirection: "row", gap: 6, marginBottom: 10 },
  commentInput: { backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 14, color: "#fff", fontSize: 14, minHeight: 60, textAlignVertical: "top", borderWidth: 1, borderColor: BORDER },
  sendBtn: { backgroundColor: GOLD, borderRadius: 10, padding: 12, marginTop: 10, alignItems: "center" },
  sendText: { color: "#000", fontWeight: "700", fontSize: 14 },
  noComments: { color: "rgba(255,255,255,0.2)", fontSize: 14, textAlign: "center", marginTop: 20 },
  commentCard: { backgroundColor: "rgba(255,255,255,0.02)", borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: BORDER },
  commentHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  commentAuthor: { color: GOLD, fontSize: 13, fontWeight: "600" },
  commentRating: { color: "rgba(255,255,255,0.5)", fontSize: 12 },
  commentContent: { color: "rgba(255,255,255,0.5)", fontSize: 14, lineHeight: 20 },
  deleteBtn: { color: "#ef4444", fontSize: 12, marginTop: 8, fontWeight: "600" },
});
