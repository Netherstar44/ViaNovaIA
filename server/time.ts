/**
 * Convierte fechas provenientes de columnas `timestamp without time zone`.
 *
 * La base de datos guarda esos valores en UTC (la sesión usa GMT), pero el
 * driver los entrega como texto sin zona. Si se pasan directo a `new Date()`,
 * JavaScript los interpreta como hora local del servidor y desplaza el
 * resultado. Esta función los trata siempre como UTC y devuelve ISO 8601.
 */
export function databaseTimestampToIso(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  const raw = String(value).trim();
  if (!raw) return null;

  let normalized = raw.replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    normalized = `${normalized}T00:00:00Z`;
  } else if (/(?:Z|[+-]\d{2}(?::?\d{2})?)$/i.test(normalized)) {
    // PostgreSQL puede devolver `+00`; JavaScript espera `+00:00`.
    normalized = normalized.replace(/([+-]\d{2})$/, "$1:00");
  } else {
    normalized = `${normalized}Z`;
  }

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
