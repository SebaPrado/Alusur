import { supabase } from "../../lib/supabase";
import { fetchAll } from "../../lib/fetchAll";
import { buildSlots } from "./buildSlots";
import { avisoCorte, slotsDesdeTorre } from "./slotsDesdeTorre";

const COLUMNAS_V_TORRE = [
  "posicion_id",
  "obra_id",
  "cara_codigo",
  "piso",
  "nivel",
  "eje",
  "cota_m",
  "codigo",
  "categoria",
  "descripcion",
  "partida",
  "valor_unitario",
  "modulo_id",
  "modulo_codigo",
  "modulo_estado",
  "estado_celda",
  "requiere_complemento",
  "tiene_complemento",
].join(", ");

/**
 * Grilla de la obra: v_torre si hay posiciones; si no, buildSlots(config).
 * Cuatro consultas en paralelo (una por cara). Sin count previo.
 *
 * @param {string} obraId
 * @param {object} config  fachada ya armada (con caras ordenadas)
 * @returns {Promise<{ slots: Array, fuente: 'v_torre' | 'buildSlots' }>}
 */
export async function loadSlots(obraId, config) {
  const caras = config?.caras ?? [];
  if (caras.length === 0) {
    return { slots: buildSlots(config), fuente: "buildSlots" };
  }

  const porCara = await Promise.all(
    caras.map(async (cara) => {
      const filas = await fetchAll(() =>
        supabase
          .from("v_torre")
          .select(COLUMNAS_V_TORRE)
          .eq("obra_id", obraId)
          .eq("cara_codigo", cara.codigo)
          .order("piso")
          .order("nivel")
          .order("eje"),
      );
      const aviso = avisoCorte(filas, cara.codigo);
      if (aviso) console.error(aviso);
      return filas;
    }),
  );

  const filas = porCara.flat();
  if (filas.length === 0) {
    return { slots: buildSlots(config), fuente: "buildSlots" };
  }

  return { slots: slotsDesdeTorre(filas, caras), fuente: "v_torre" };
}
