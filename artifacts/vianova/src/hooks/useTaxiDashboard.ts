import { apiBase } from "@/lib/queryClient";
// ─────────────────────────────────────────────────────────────────────────────
// client/src/hooks/useTaxiDashboard.ts
// Hook principal del dashboard del taxista
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { Ride } from "@shared/taxi.schema";

const POLLING_INTERVAL = 5000; // 5 segundos

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Error en la petición");
  return data as T;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTaxiDashboard(taxiUsername: string) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const prevRidesCount = useRef<number>(0);
  const [justCompletedRide, setJustCompletedRide] = useState<Ride | null>(null);

  // ── Viajes pendientes (polling) ────────────────────────────────────────────
  const { data: nearbyData, isLoading: loadingNearby } = useQuery({
    queryKey: ["rides", "nearby"],
    queryFn: () => apiFetch<{ rides: Ride[] }>("/api/rides/nearby"),
    refetchInterval: POLLING_INTERVAL,
    enabled: !!taxiUsername,
  });

  const pendingRides = nearbyData?.rides ?? [];

  // Notificar cuando llegan nuevas solicitudes
  useEffect(() => {
    if (pendingRides.length > prevRidesCount.current) {
      toast({
        title: "🚕 Nueva solicitud de viaje",
        description: `${pendingRides.length - prevRidesCount.current} solicitud(es) nueva(s) cerca de ti`,
      });
    }
    prevRidesCount.current = pendingRides.length;
  }, [pendingRides.length]);

  // ── Ride activo del taxista ────────────────────────────────────────────────
  const { data: taxiRidesData, isLoading: loadingActive } = useQuery({
    queryKey: ["rides", "taxi", taxiUsername],
    queryFn: () =>
      apiFetch<{ activeRide: Ride | null; history: Ride[] }>(
        `/api/rides/taxi/${taxiUsername}`
      ),
    refetchInterval: POLLING_INTERVAL,
    enabled: !!taxiUsername,
  });

  const activeRide = taxiRidesData?.activeRide ?? null;
  const rideHistory = taxiRidesData?.history ?? [];

  useEffect(() => {
    if (activeRide && activeRide.status !== "completed") {
      setJustCompletedRide(null);
    }
  }, [activeRide]);

  // ── Perfil (isAvailable) ───────────────────────────────────────────────────
  const { data: profileData } = useQuery({
    queryKey: ["taxi", "profile", taxiUsername],
    queryFn: () =>
      apiFetch<{ profile: { isAvailable: boolean; vehicleType: string | null; plate: string | null; phone: string | null } }>(
        `/api/taxi/profile/${taxiUsername}`
      ),
    enabled: !!taxiUsername,
  });

  const isAvailable = profileData?.profile?.isAvailable ?? false;

  // ── Mutations ──────────────────────────────────────────────────────────────

  const invalidateAll = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["rides"] });
    qc.invalidateQueries({ queryKey: ["taxi"] });
  }, [qc]);

  // Toggle disponibilidad (envía GPS del taxista)
  const availabilityMutation = useMutation({
    mutationFn: async (newVal: boolean) => {
      // Get current location to send with availability
      let lat: number | undefined;
      let lng: number | undefined;
      if (newVal && navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 })
          );
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        } catch { /* fallback: no location */ }
      }
      return apiFetch("/api/taxi/status", {
        method: "PATCH",
        body: JSON.stringify({ username: taxiUsername, isAvailable: newVal, lat, lng }),
      });
    },
    onSuccess: (_, newVal) => {
      qc.invalidateQueries({ queryKey: ["taxi", "profile"] });
      toast({
        title: newVal ? "✅ Disponible" : "⛔ No disponible",
        description: newVal
          ? "Ahora recibirás solicitudes de viaje — tu ubicación fue enviada"
          : "No recibirás nuevas solicitudes",
      });
    },
  });

  // Aceptar ride
  const acceptMutation = useMutation({
    mutationFn: (rideId: string) =>
      apiFetch(`/api/rides/${rideId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "accepted", taxiUsername }),
      }),
    onSuccess: () => {
      invalidateAll();
      toast({ title: "✅ Viaje aceptado", description: "Dirígete al punto de recogida" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // Rechazar (cancel) ride
  const rejectMutation = useMutation({
    mutationFn: (rideId: string) =>
      apiFetch(`/api/rides/${rideId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled" }),
      }),
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Solicitud rechazada" });
    },
  });

  // Iniciar viaje
  const startMutation = useMutation({
    mutationFn: (rideId: string) =>
      apiFetch(`/api/rides/${rideId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "in_progress" }),
      }),
    onSuccess: () => {
      invalidateAll();
      toast({ title: "🚗 Viaje iniciado", description: "¡Buen viaje!" });
    },
  });

  // Finalizar viaje
  const completeMutation = useMutation({
    mutationFn: (rideId: string) =>
      apiFetch<{ ride: Ride }>(`/api/rides/${rideId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "completed" }),
      }),
    onSuccess: (data) => {
      if (data.ride) {
        setJustCompletedRide(data.ride);
      }
      invalidateAll();
      toast({
        title: "🏁 Viaje completado",
        description: "La ganancia fue registrada en tu cuenta",
      });
    },
  });

  return {
    // Estado
    isAvailable,
    pendingRides,
    activeRide,
    rideHistory,
    profile: profileData?.profile ?? null,
    // Loading
    loadingNearby,
    loadingActive,
    // Actions
    toggleAvailability: (val: boolean) => availabilityMutation.mutate(val),
    acceptRide: (id: string) => acceptMutation.mutate(id),
    rejectRide: (id: string) => rejectMutation.mutate(id),
    startRide: (id: string) => startMutation.mutate(id),
    completeRide: (id: string) => completeMutation.mutate(id),
    // Mutation states
    isAccepting: acceptMutation.isPending,
    isRejecting: rejectMutation.isPending,
    isStarting: startMutation.isPending,
    isCompleting: completeMutation.isPending,
    // Completed state
    justCompletedRide,
    clearCompletedRide: () => setJustCompletedRide(null),
  };
}
