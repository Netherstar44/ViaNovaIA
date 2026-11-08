// Consent text is a legal draft, never part of general terms.
export const CONSENT_VERSION = "co-biometria-borrador-2026-11-08";
export const BIOMETRIC_CONSENT = `BORRADOR — REVISAR CON ABOGADO. Autorizo de forma previa, expresa, informada y específica a VIANova IA a tratar mi plantilla facial, dato sensible, únicamente para comprobar mi identidad al verificar mi cuenta e iniciar o continuar un turno. La cámara enviará fotogramas al servidor de VIANova para analizarlos en memoria; no se conservarán fotografías ni se enviarán a proveedores de IA. La plantilla se cifra, se vincula a una identidad documental aprobada por un administrador y se elimina al revocar esta autorización o al vencer el plazo informado (máximo 30 días). Puedo no autorizar y solicitar revisión manual sin biometría. Puedo consultar, corregir, revocar y solicitar supresión desde esta pantalla. El reto de movimiento no garantiza protección frente a videos o deepfakes. Antes de habilitar esta opción deben completarse y revisarse la identidad y contacto del responsable, canales de derechos, política, encargados y plazos de respuesta conforme a la Ley 1581 de 2012 y el Decreto 1074 de 2015.`;
export type PublicIdentity = {
  verified: boolean;
  name: string | null;
  verifiedAt: string | null;
  validUntil: string | null;
  method: "face" | "manual" | null;
};
