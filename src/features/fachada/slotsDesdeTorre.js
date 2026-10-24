/** Convierte filas de v_torre en slots con la misma forma que buildSlots. */

/**
 * @param {Array<Record<string, unknown>>} filas
 * @param {Array<{ codigo: string }>} caras  caras ya ordenadas (orden 1..n)
 * @returns {Array<{
 *   piso: number,
 *   caraCodigo: string,
 *   caraOrden: number,
 *   eje: number,
 *   tipo: string,
 *   nivel: string,
 *   codigo: string | null,
 *   posicionId: unknown,
 *   moduloId: unknown,
 *   estadoCelda: string | null,
 *   requiereComplemento: boolean,
 *   tieneComplemento: boolean,
 * }>}
 */
export function slotsDesdeTorre(filas, caras) {
  const ordenPorCodigo = new Map((caras ?? []).map((c, i) => [c.codigo, i + 1]));
  const out = [];
  for (const f of filas ?? []) {
    if (f.nivel !== "principal") continue;
    const caraOrden = ordenPorCodigo.get(f.cara_codigo);
    if (caraOrden == null) continue;
    out.push({
      piso: Number(f.piso),
      caraCodigo: f.cara_codigo,
      caraOrden,
      eje: Number(f.eje),
      tipo: f.categoria,
      nivel: f.nivel,
      codigo: f.codigo ?? null,
      posicionId: f.posicion_id ?? null,
      moduloId: f.modulo_id ?? null,
      estadoCelda: f.estado_celda ?? null,
      requiereComplemento: Boolean(f.requiere_complemento),
      tieneComplemento: Boolean(f.tiene_complemento),
    });
  }
  return out;
}

/**
 * Anchos y rango de pisos a partir de los slots dibujables.
 * Si una cara no tiene slots, conserva modulos_por_piso (asistente / buildSlots).
 *
 * @param {Array<{ piso: number, caraCodigo: string, eje: number }>} slots
 * @param {Array<{ codigo: string, modulos_por_piso: number }>} caras
 */
export function medidasDesdeSlots(slots, caras) {
  const maxEjePorCara = new Map();
  const pisos = new Set();
  for (const s of slots ?? []) {
    pisos.add(s.piso);
    const prev = maxEjePorCara.get(s.caraCodigo) ?? 0;
    if (s.eje > prev) maxEjePorCara.set(s.caraCodigo, s.eje);
  }

  const anchos = (caras ?? []).map((c) => {
    const maxEje = maxEjePorCara.get(c.codigo);
    return maxEje != null ? maxEje : c.modulos_por_piso;
  });

  const listaPisos = [...pisos].sort((a, b) => b - a);
  const pisoMin = listaPisos.length ? Math.min(...listaPisos) : null;
  const pisoMax = listaPisos.length ? Math.max(...listaPisos) : null;

  return { anchos, pisoMin, pisoMax, pisos: listaPisos };
}

/** Guarda: una página exacta de 1.000 filas suele indicar corte de PostgREST. */
export function avisoCorte(filas, caraCodigo) {
  if ((filas?.length ?? 0) !== 1000) return null;
  return `v_torre cara ${caraCodigo}: exactamente 1.000 filas; la consulta puede estar cortada.`;
}
