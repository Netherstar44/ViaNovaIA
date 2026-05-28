import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import * as Location from "expo-location";
import { listServices } from "../lib/api";
import type { Service } from "../lib/api";
import { useNavigation } from "@react-navigation/native";

const GOLD = "#c9a227";
const BG = "#050509";

const EMOJI_MAP: Record<string, string> = {
  hotel: "🏨", restaurant: "🍽️", recreation: "🎡", transport: "🚖",
};

export default function MapScreen() {
  const nav = useNavigation<any>();
  const mapRef = useRef<MapView>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Request location
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({});
        setUserLoc({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }
      // Load services
      try {
        const data = await listServices();
        setServices(data);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <View style={[s.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={GOLD} size="large" />
        <Text style={{ color: "rgba(255,255,255,0.4)", marginTop: 12 }}>Cargando mapa...</Text>
      </View>
    );
  }

  const initialRegion = userLoc
    ? { ...userLoc, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : { latitude: 2.936, longitude: -75.289, latitudeDelta: 0.1, longitudeDelta: 0.1 };

  return (
    <View style={s.container}>
      <MapView
        ref={mapRef}
        style={s.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton
      >
        {services
          .filter(svc => svc.locationLat && svc.locationLng)
          .map(svc => (
            <Marker
              key={svc.id}
              coordinate={{
                latitude: parseFloat(svc.locationLat!),
                longitude: parseFloat(svc.locationLng!),
              }}
              title={svc.name}
              description={svc.category}
              onCalloutPress={() => nav.navigate("ServiceDetail", { service: svc })}
            />
          ))}
      </MapView>

      {/* Title overlay */}
      <View style={s.overlay}>
        <Text style={s.overlayTitle}>
          <Text style={{ color: GOLD }}>VIA</Text>Nova — Mapa
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  map: { flex: 1 },
  overlay: {
    position: "absolute", top: 50, left: 16,
    backgroundColor: "rgba(5,5,9,0.85)", paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  overlayTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
