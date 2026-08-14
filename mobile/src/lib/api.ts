import { API_URL } from "./config";

// Types
export type UserRole = "traveler" | "hotel" | "restaurant" | "recreation" | "taxi";
export type ServiceCategory = "hotel" | "restaurant" | "recreation" | "transport";

export interface Service {
  id: string;
  providerUsername: string;
  category: ServiceCategory;
  name: string;
  description: string | null;
  imageUrl: string | null;
  locationLat: string | null;
  locationLng: string | null;
  rating: number | null;
  createdAt: Date | null;
}

export interface Comment {
  id: string;
  locationId: string;
  authorUsername: string;
  content: string;
  rating: number | null;
  createdAt: Date | null;
}

// ── Services ──────────────────────────────────────────────────────────────────

export async function listServices(): Promise<Service[]> {
  const res = await fetch(`${API_URL}/api/products`);
  if (!res.ok) throw new Error("Failed to fetch services");
  const data = await res.json();
  return data.products || data;
}

export async function listServicesByCategory(category: ServiceCategory): Promise<Service[]> {
  const res = await fetch(`${API_URL}/api/products?category=${category}`);
  if (!res.ok) throw new Error("Failed to fetch services by category");
  const data = await res.json();
  return data.products || data;
}

export async function listProviderServices(providerUsername: string): Promise<Service[]> {
  const res = await fetch(`${API_URL}/api/products/provider/${providerUsername}`);
  if (!res.ok) throw new Error("Failed to fetch provider services");
  return res.json();
}

export async function createService(data: {
  providerUsername: string;
  category: ServiceCategory;
  name: string;
  description?: string;
  imageUrl?: string;
  locationLat?: string;
  locationLng?: string;
  rating?: number;
}): Promise<Service> {
  const res = await fetch(`${API_URL}/api/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create service");
  return res.json();
}

export async function updateService(id: string, data: Partial<{
  name: string;
  description: string;
  imageUrl: string;
  locationLat: string;
  locationLng: string;
  rating: number;
}>): Promise<Service> {
  const res = await fetch(`${API_URL}/api/products/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update service");
  return res.json();
}

export async function deleteService(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/products/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete service");
}

// ── Comments ──────────────────────────────────────────────────────────────────

export async function listComments(locationId: string): Promise<Comment[]> {
  const res = await fetch(`${API_URL}/api/comments/${locationId}`);
  if (!res.ok) throw new Error("Failed to fetch comments");
  return res.json();
}

export async function addComment(data: {
  locationId: string;
  authorUsername: string;
  content: string;
  rating?: number;
}): Promise<Comment> {
  const res = await fetch(`${API_URL}/api/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to add comment");
  return res.json();
}

export async function deleteComment(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/comments/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete comment");
}
