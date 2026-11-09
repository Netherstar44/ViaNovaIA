// Consent text is a legal draft, never part of general terms.
export const CONSENT_VERSION = "co-biometria-borrador-2026-11-08";
export const BIOMETRIC_CONSENT = `BORRADOR — REVISAR CON ABOGADO. Autorizo de forma previa, expresa, informada y específica a VIANova IA a tratar mi plantilla facial, dato sensible, únicamente para comprobar mi identidad al verificar mi cuenta e iniciar o continuar un turno. La cámara enviará fotogramas al servidor de VIANova para analizarlos en memoria; no se conservarán fotografías ni se enviarán a proveedores de IA. La plantilla se cifra, se vincula a una identidad documental aprobada por un administrador y se elimina al revocar esta autorización o al vencer el plazo informado (máximo 30 días). Puedo no autorizar y solicitar revisión manual sin biometría. Puedo consultar, corregir, revocar y solicitar supresión desde esta pantalla. El reto de movimiento no garantiza protección frente a videos o deepfakes. Antes de habilitar esta opción deben completarse y revisarse la identidad y contacto del responsable, canales de derechos, política, encargados y plazos de respuesta conforme a la Ley 1581 de 2012 y el Decreto 1074 de 2015.`;
// Consentimiento específico del piloto experimental. No sustituye al
// consentimiento legal definitivo ni activa FACE_CONSENT_LEGAL_APPROVED.
export const PILOT_CONSENT_VERSION = "co-piloto-experimental-2026-11-09";
export const PILOT_CONSENT = `PRUEBA EXPERIMENTAL. Autorizo que VIANova procese fotogramas de mi rostro solo para probar el reconocimiento facial entre personas invitadas. La comparación ocurre en el servidor y el resultado es únicamente una coincidencia técnica: NO valida mi identidad, NO me da una insignia verificada, NO inicia sesión y NO autoriza cambios sensibles. La muestra facial piloto se cifra, se guarda como máximo 7 días y se elimina al revocar esta autorización. No se guardan fotografías ni se envían a terceros. Puedo revocar y eliminar la muestra en cualquier momento. Al no existir calibración aprobada, el resultado puede fallar incluso con mi propio rostro.`;
export type PublicIdentity = {
  verified: boolean;
  name: string | null;
  verifiedAt: string | null;
  validUntil: string | null;
  method: "face" | "manual" | null;
};
export type PilotIdentityStatus = {
  invited: boolean;
  consent: boolean;
  enrolled: boolean;
  ready: boolean;
  model: string | null;
  threshold: number | null;
  retentionDays: number;
  last: { at: string; distance: number | null; quality: number | null } | null;
};
