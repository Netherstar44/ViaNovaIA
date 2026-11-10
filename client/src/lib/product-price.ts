const supportedCurrencies = new Set(
  (Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.("currency") ?? [],
);

export function productAmount(price: unknown): number | null {
  if ((typeof price !== "number" && typeof price !== "string") ||
      (typeof price === "string" && !/^(?:\d+\.?\d*|\.\d+)$/.test(price.trim()))) return null;
  const amount = Number(price);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

/** A missing currency must never turn into an invented COP price. */
export function formatProductPrice(price: unknown, currency: unknown): string {
  const amount = productAmount(price);
  if (amount === null) return "Precio no disponible";

  const code = typeof currency === "string" ? currency.trim().toUpperCase() : "";
  // Unknown codes can otherwise be accepted by NumberFormat as arbitrary labels.
  if (/^[A-Z]{3}$/.test(code) && supportedCurrencies.has(code)) {
    return amount.toLocaleString("es-CO", { style: "currency", currency: code, maximumFractionDigits: 2 });
  }
  return `${amount.toLocaleString("es-CO", { maximumFractionDigits: 2 })} · moneda no disponible`;
}
