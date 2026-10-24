/** Catálogo tipos_modulo: etiquetas, claves y normalización. */

/** "ce 10.1" → "CE10.1" (misma regla que la base). */
export function normalizarCodigoTipo(s) {
  return String(s ?? "")
    .toUpperCase()
    .replace(/\s+/g, "");
}

export function claveCatalogo(codigo, pieza = "principal") {
  const p = String(pieza ?? "principal").trim().toLowerCase() || "principal";
  return `${normalizarCodigoTipo(codigo)}|${p}`;
}

/**
 * @param {{ codigo: string, pieza?: string, descripcion?: string | null }} row
 */
export function etiquetaOpcion(row) {
  const codigo = String(row?.codigo ?? "").trim();
  const desc = String(row?.descripcion ?? "").trim();
  const pieza = String(row?.pieza ?? "principal").toLowerCase();
  const base = desc ? `${codigo} · ${desc}` : codigo;
  if (pieza === "complemento") return `${base} (complemento)`;
  return base;
}

/**
 * @param {Array<{ id?: string, codigo: string, pieza?: string, categoria?: string, descripcion?: string | null }>} catalogo
 */
export function opcionesDeCatalogo(catalogo) {
  return (catalogo ?? []).map((row) => {
    const codigo_tipo = String(row.codigo ?? "").trim();
    const pieza = String(row.pieza ?? "principal").toLowerCase() || "principal";
    const label = etiquetaOpcion(row);
    return {
      key: claveCatalogo(codigo_tipo, pieza),
      codigo_tipo,
      pieza,
      categoria: row.categoria ?? null,
      label,
      filterText: `${label} ${codigo_tipo} ${pieza}`.toLowerCase(),
    };
  });
}

/**
 * @param {Array<{ codigo: string, pieza?: string }>} catalogo
 * @param {string} codigo
 * @param {string} [pieza]
 */
export function existeEnCatalogo(catalogo, codigo, pieza = "principal") {
  const key = claveCatalogo(codigo, pieza);
  return (catalogo ?? []).some(
    (row) => claveCatalogo(row.codigo, row.pieza ?? "principal") === key,
  );
}
