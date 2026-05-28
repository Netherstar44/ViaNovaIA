import { apiBase } from "@/lib/queryClient";
import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth, UserRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, User, Building2, Utensils, TentTree, Car, Shield, Check,
  AlertCircle, Loader2, Plus, ChevronDown, Pencil, Save, X, Trash2,
  Wallet, Star, Languages,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import PaymentMethods from "@/components/PaymentMethods";
import { ReviewList } from "@/components/ReviewSystem";

const ROLES: { value: UserRole; label: string; icon: React.ReactElement; desc: string; color: string; fields: string[] }[] = [
  { value: "traveler", label: "Viajero", icon: <User className="h-5 w-5" />, desc: "Explora destinos, hoteles y experiencias", color: "text-blue-400", fields: [] },
  { value: "hotel", label: "Hotel", icon: <Building2 className="h-5 w-5" />, desc: "Publica y administra tu alojamiento", color: "text-purple-400", fields: ["businessName", "businessAddress", "businessPhone"] },
  { value: "restaurant", label: "Restaurante", icon: <Utensils className="h-5 w-5" />, desc: "Promueve tu gastronomía local", color: "text-orange-400", fields: ["businessName", "businessAddress", "businessPhone"] },
  { value: "recreation", label: "Recreación", icon: <TentTree className="h-5 w-5" />, desc: "Ofrece experiencias y actividades", color: "text-green-400", fields: ["businessName", "businessAddress", "businessPhone"] },
  { value: "taxi", label: "Taxista", icon: <Car className="h-5 w-5" />, desc: "Ofrece servicios de transporte", color: "text-yellow-400", fields: ["vehicleType", "plate", "phone"] },
  { value: "translator", label: "Traductor", icon: <Languages className="h-5 w-5" />, desc: "Interpreta entre visitantes extranjeros y locales", color: "text-teal-400", fields: ["languages", "businessPhone"] },
];

const FIELD_LABELS: Record<string, string> = {
  businessName: "Nombre del Negocio",
  businessAddress: "Dirección",
  businessPhone: "Teléfono de Contacto",
  vehicleType: "Tipo de Vehículo",
  plate: "Placa",
  phone: "Teléfono",
  languages: "Idiomas (separados por coma)",
};

const FIELD_PLACEHOLDERS: Record<string, string> = {
  businessName: "Ej: Hotel El Dorado",
  businessAddress: "Ej: Calle 10 #5-23, Neiva",
  businessPhone: "Ej: 3001234567",
  vehicleType: "Ej: Sedan, SUV, Van",
  plate: "Ej: ABC123",
  phone: "Ej: 3001234567",
  languages: "Ej: Inglés, Francés, Portugués",
};

export default function AccountSettings() {
  const { user, switchActiveRole, addRole, removeRole, fetchRoles } = useAuth();
  const [_, setLocation] = useLocation();
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);

  // Add role form
  const [showAddRole, setShowAddRole] = useState(false);
  const [addingRole, setAddingRole] = useState<UserRole | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});

  // Vehicle edit
  const [editVehicle, setEditVehicle] = useState(false);
  const [vehicleData, setVehicleData] = useState({ vehicleType: "", plate: "", phone: "" });
  const [savingVehicle, setSavingVehicle] = useState(false);

  // Reviews section
  const [showReviews, setShowReviews] = useState(false);

  // Profile Edit
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (user) {
      fetchRoles();
      // Load current vehicle data if taxi
      if (user.role === "taxi") {
        fetch(`${apiBase}/api/taxi/profile/${user.username}`)
          .then((r) => r.json())
          .then((data) => {
            if (data.profile) {
              setVehicleData({
                vehicleType: data.profile.vehicleType || "",
                plate: data.profile.plate || "",
                phone: data.profile.phone || "",
              });
            }
          })
          .catch(() => {});
      }
    }
  }, [user?.username, user?.role]);

  if (!user) {
    setLocation("/login");
    return null;
  }

  const currentRoleData = ROLES.find((r) => r.value === user.role);
  const userRoles = user.roles || [user.role];
  const availableToAdd = ROLES.filter((r) => !userRoles.includes(r.value));

  const handleSwitchRole = async (role: UserRole) => {
    if (role === user.role) return;
    setIsSubmitting(true);
    setMessage(null);
    const result = await switchActiveRole(role);
    setIsSubmitting(false);
    setRoleDropdownOpen(false);
    if (result.ok) {
      setMessage({ type: "success", text: `Cambiado a ${ROLES.find((r) => r.value === role)?.label}` });
    } else {
      setMessage({ type: "error", text: result.message || "Error al cambiar rol" });
    }
  };

  const handleAddRole = async () => {
    if (!addingRole) return;
    const roleConfig = ROLES.find((r) => r.value === addingRole);
    // Validate required fields
    if (roleConfig && roleConfig.fields.length > 0) {
      const missing = roleConfig.fields.filter((f) => !formData[f]?.trim());
      if (missing.length > 0) {
        setMessage({ type: "error", text: "Completa todos los campos obligatorios" });
        return;
      }
    }
    setIsSubmitting(true);
    setMessage(null);
    const result = await addRole(addingRole, formData);
    setIsSubmitting(false);
    if (result.ok) {
      setMessage({ type: "success", text: `Cuenta de ${roleConfig?.label} agregada exitosamente` });
      setShowAddRole(false);
      setAddingRole(null);
      setFormData({});
    } else {
      setMessage({ type: "error", text: result.message || "Error al agregar cuenta" });
    }
  };

  const handleRemoveRole = async (role: UserRole) => {
    if (userRoles.length <= 1) {
      setMessage({ type: "error", text: "No puedes eliminar tu único tipo de cuenta" });
      return;
    }
    setIsSubmitting(true);
    const result = await removeRole(role);
    setIsSubmitting(false);
    if (result.ok) {
      setMessage({ type: "success", text: "Tipo de cuenta eliminado" });
    } else {
      setMessage({ type: "error", text: result.message || "Error" });
    }
  };

  const handleSaveVehicle = async () => {
    setSavingVehicle(true);
    try {
      const res = await fetch(apiBase + "/api/taxi/vehicle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user.username, ...vehicleData }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setMessage({ type: "success", text: "Datos del vehículo actualizados" });
      setEditVehicle(false);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Error al guardar" });
    } finally {
      setSavingVehicle(false);
    }
  };

  const handleSaveName = async () => {
    if (!newName.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(apiBase + "/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user.username, name: newName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      
      // Update local context manually or reload
      window.location.reload();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Error al actualizar perfil" });
    } finally {
      setIsSubmitting(false);
      setIsEditingName(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="container max-w-5xl py-12 px-4">
        <button onClick={() => setLocation("/")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8">
          <ArrowLeft className="h-4 w-4" /> Volver al inicio
        </button>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <h1 className="text-3xl font-bold mb-2">Configuración de Cuenta</h1>
          <p className="text-muted-foreground mb-10">Administra tu perfil, cuentas y ajustes específicos.</p>

          {/* Message */}
          <AnimatePresence>
            {message && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className={`mb-6 p-4 rounded-xl flex items-start gap-3 text-sm border ${message.type === "success" ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>
                {message.type === "success" ? <Check className="h-5 w-5 shrink-0 mt-0.5" /> : <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />}
                <span>{message.text}</span>
                <button onClick={() => setMessage(null)} className="ml-auto p-0.5 hover:opacity-70"><X className="h-3.5 w-3.5" /></button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* LEFT COLUMN: Profile & Roles */}
            <div className="md:col-span-1 space-y-6">
              {/* ── Current Info & Role Selection ── */}
              <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-5">Perfil Principal</h3>
                
                <div className="space-y-4 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Nombre</span>
                    {isEditingName ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          className="flex-1 bg-background border border-border rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder="Tu nombre completo"
                        />
                        <button onClick={handleSaveName} disabled={isSubmitting} className="text-green-500 hover:text-green-400 p-1">
                          <Check className="h-4 w-4" />
                        </button>
                        <button onClick={() => setIsEditingName(false)} disabled={isSubmitting} className="text-muted-foreground hover:text-red-400 p-1">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between group">
                        <p className="font-medium text-base">{user.name || user.username}</p>
                        <button 
                          onClick={() => { setIsEditingName(true); setNewName(user.name || user.username); }} 
                          className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-primary transition-all"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Usuario</span>
                    <p className="font-medium">{user.username}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Email</span>
                    <p className="font-medium">{user.email || "—"}</p>
                  </div>
                  
                  <div className="pt-2 border-t border-border/30">
                    <span className="text-xs text-muted-foreground block mb-2">Rol Activo</span>
                    <div className="relative">
                      <button
                        onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                        disabled={isSubmitting}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border transition-all ${
                          roleDropdownOpen
                            ? "border-primary/50 bg-primary/5"
                            : "border-border/50 bg-secondary/30 hover:border-border"
                        } ${isSubmitting ? "opacity-50" : "cursor-pointer"}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={currentRoleData?.color}>{currentRoleData?.icon}</span>
                          <span className="font-medium text-sm">{currentRoleData?.label}</span>
                        </div>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${roleDropdownOpen ? "rotate-180" : ""}`} />
                      </button>

                      <AnimatePresence>
                        {roleDropdownOpen && userRoles.length > 1 && (
                          <motion.div
                            initial={{ opacity: 0, y: -5, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -5, scale: 0.95 }}
                            className="absolute z-20 top-full left-0 right-0 mt-1 bg-card border border-border/50 rounded-xl shadow-xl overflow-hidden"
                          >
                            {userRoles.filter((r) => r !== user.role).map((roleVal) => {
                              const rd = ROLES.find((r) => r.value === roleVal);
                              if (!rd) return null;
                              return (
                                <button
                                  key={roleVal}
                                  onClick={() => handleSwitchRole(roleVal)}
                                  className="w-full flex items-center gap-2 px-3 py-3 text-left text-sm hover:bg-primary/5 hover:text-primary transition-colors"
                                >
                                  <span className={rd.color}>{rd.icon}</span>
                                  <span className="font-medium">{rd.label}</span>
                                </button>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    {userRoles.length === 1 && (
                      <p className="text-xs text-muted-foreground mt-2">Añade más tipos de cuenta para cambiar de rol.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* ── My Account Types ── */}
              <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-4">Mis Tipos de Cuenta</h3>
                
                <div className="space-y-2 mb-4">
                  {userRoles.map((roleVal) => {
                    const rd = ROLES.find((r) => r.value === roleVal);
                    if (!rd) return null;
                    const isActive = roleVal === user.role;
                    return (
                      <div key={roleVal} className={`flex items-center justify-between p-3 rounded-xl border ${isActive ? "border-primary/30 bg-primary/5" : "border-border/30 bg-secondary/10"}`}>
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${isActive ? "bg-primary/20" : "bg-secondary"}`}>
                            {React.cloneElement(rd.icon as React.ReactElement<any>, { className: `h-4 w-4 ${rd.color}` })}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{rd.label}</p>
                            {isActive && <div className="flex items-center gap-1.5 text-primary text-xs font-bold"><div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> Activo</div>}
                          </div>
                        </div>
                        {!isActive && (
                          <button onClick={() => handleRemoveRole(roleVal)} disabled={isSubmitting} className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors" aria-label="Eliminar rol">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {!showAddRole && availableToAdd.length > 0 && (
                  <Button onClick={() => setShowAddRole(true)} variant="outline" className="w-full rounded-xl border-dashed border-border/60 hover:border-primary/50 hover:bg-primary/5 gap-2 text-sm text-muted-foreground hover:text-primary transition-all">
                    <Plus className="h-4 w-4" /> Agregar cuenta
                  </Button>
                )}
                
                <AnimatePresence>
                  {showAddRole && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="pt-4 border-t border-border/40 mt-4">
                        {!addingRole ? (
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground mb-3">Selecciona el tipo de cuenta:</p>
                            {availableToAdd.map((rd) => (
                              <button key={rd.value} onClick={() => setAddingRole(rd.value)} className="w-full flex items-center gap-3 p-3 text-left rounded-xl border border-border/30 hover:border-primary/40 hover:bg-primary/5 transition-colors group">
                                <span className={rd.color}>{rd.icon}</span>
                                <div>
                                  <p className="font-medium text-sm group-hover:text-primary transition-colors">{rd.label}</p>
                                  <p className="text-xs text-muted-foreground">{rd.desc}</p>
                                </div>
                              </button>
                            ))}
                            <Button variant="ghost" onClick={() => setShowAddRole(false)} className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground">Cancelar</Button>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2 text-primary font-medium text-sm">
                                {ROLES.find(r => r.value === addingRole)?.icon}
                                {ROLES.find(r => r.value === addingRole)?.label}
                              </div>
                              <button onClick={() => setAddingRole(null)} className="text-xs text-muted-foreground hover:text-foreground">Cambiar</button>
                            </div>
                            
                            {ROLES.find(r => r.value === addingRole)?.fields.map(field => (
                              <div key={field} className="space-y-1.5">
                                <label className="text-xs text-muted-foreground">{FIELD_LABELS[field]}</label>
                                <input type="text" placeholder={FIELD_PLACEHOLDERS[field]} value={formData[field] || ""} onChange={(e) => setFormData({ ...formData, [field]: e.target.value })} className="w-full px-3 py-2 bg-secondary/30 border border-border/50 rounded-lg text-sm focus:outline-none focus:border-primary/50" />
                              </div>
                            ))}

                            <div className="flex gap-2 pt-2">
                              <Button variant="outline" onClick={() => { setAddingRole(null); setShowAddRole(false); setFormData({}); }} className="flex-1 rounded-xl text-xs h-9">Cancelar</Button>
                              <Button onClick={handleAddRole} disabled={isSubmitting} className="flex-1 rounded-xl text-xs h-9 bg-primary text-black font-semibold hover:bg-primary/90">
                                {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Guardar"}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* RIGHT COLUMN: Context Specific Settings */}
            <div className="md:col-span-2 space-y-6">
              
              {/* ── Vehicle Info (Taxi Only) ── */}
              {user.role === "taxi" && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                      <Car className="h-5 w-5 text-primary" />
                      Datos del Vehículo
                    </h2>
                    {!editVehicle ? (
                      <Button variant="ghost" onClick={() => setEditVehicle(true)} className="text-sm gap-1.5 text-muted-foreground hover:text-primary">
                        <Pencil className="h-4 w-4" /> Editar
                      </Button>
                    ) : (
                      <Button variant="ghost" onClick={() => setEditVehicle(false)} className="text-sm gap-1.5 text-muted-foreground">
                        <X className="h-4 w-4" /> Cancelar
                      </Button>
                    )}
                  </div>

                  {!editVehicle ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 bg-secondary/10 p-5 rounded-xl border border-border/30">
                      <div>
                        <span className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Tipo de Vehículo</span>
                        <p className="font-medium">{vehicleData.vehicleType || <span className="text-muted-foreground/50 italic">No especificado</span>}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Placa</span>
                        {vehicleData.plate ? (
                          <span className="inline-flex items-center gap-2 bg-secondary/40 text-foreground border border-white/10 px-3 py-1.5 rounded-lg text-sm font-mono font-semibold shadow-inner">{vehicleData.plate}</span>
                        ) : (
                          <span className="text-muted-foreground/50 italic">No especificada</span>
                        )}
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Teléfono</span>
                        <p className="font-medium">{vehicleData.phone || <span className="text-muted-foreground/50 italic">No especificado</span>}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs text-muted-foreground">Tipo de Vehículo</label>
                          <input type="text" placeholder="Ej: Sedan, SUV" value={vehicleData.vehicleType} onChange={(e) => setVehicleData({ ...vehicleData, vehicleType: e.target.value })} className="w-full px-3 py-2 bg-secondary/30 border border-border/50 rounded-lg text-sm focus:outline-none focus:border-primary/50" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs text-muted-foreground">Placa</label>
                          <input type="text" placeholder="Ej: ABC-123" value={vehicleData.plate} onChange={(e) => setVehicleData({ ...vehicleData, plate: e.target.value })} className="w-full px-3 py-2 bg-secondary/30 border border-border/50 rounded-lg text-sm font-mono uppercase focus:outline-none focus:border-primary/50" />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <label className="text-xs text-muted-foreground">Teléfono</label>
                          <input type="text" placeholder="Ej: 3001234567" value={vehicleData.phone} onChange={(e) => setVehicleData({ ...vehicleData, phone: e.target.value })} className="w-full px-3 py-2 bg-secondary/30 border border-border/50 rounded-lg text-sm focus:outline-none focus:border-primary/50" />
                        </div>
                      </div>
                      <Button onClick={handleSaveVehicle} disabled={savingVehicle} className="w-full sm:w-auto mt-4 gap-2 rounded-xl bg-primary text-black hover:bg-primary/90 font-semibold">
                        {savingVehicle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Guardar Cambios
                      </Button>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── Payment Methods (Traveler Only) ── */}
              {user.role === "traveler" && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-6">
                    <Wallet className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-bold">Métodos de Pago</h2>
                  </div>
                  <PaymentMethods username={user.username} />
                </motion.div>
              )}

              {/* ── Reviews ── */}
              <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Star className="h-5 w-5 fill-primary text-primary" />
                    Mis Reseñas
                  </h2>
                  <Button variant="outline" size="sm" onClick={() => setShowReviews(!showReviews)} className="text-xs rounded-xl">
                    {showReviews ? "Ocultar" : "Mostrar"}
                  </Button>
                </div>

                <AnimatePresence>
                  {showReviews && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="pt-2">
                        <ReviewList username={user.username} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {!showReviews && (
                  <p className="text-sm text-muted-foreground italic">Tus reseñas están ocultas. Haz clic en "Mostrar" para verlas.</p>
                )}
              </div>

            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
