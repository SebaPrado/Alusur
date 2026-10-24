/** Orden de avance: el más avanzado al final. */
export const CONTENEDOR_ESTADOS = [
  "en_produccion",
  "en_camino",
  "en_puerto",
  "en_deposito",
  "en_obra",
  "descargado",
];

/** Orden de la lista en pantalla (prioridad operativa). */
export const CONTENEDOR_LISTA_ORDEN = [
  "en_obra",
  "en_deposito",
  "en_puerto",
  "en_camino",
  "en_produccion",
  "descargado",
];

export const CONTENEDOR_LABEL = {
  en_produccion: "En producción",
  en_camino: "En camino",
  en_puerto: "En puerto",
  en_deposito: "En depósito",
  en_obra: "En obra",
  descargado: "Descargado",
};

/** Etiquetas cortas para la fila de conteos. */
export const CONTENEDOR_CONTEO_LABEL = {
  en_produccion: "Producción",
  en_camino: "En camino",
  en_puerto: "Puerto",
  en_deposito: "Depósito",
  en_obra: "Obra",
  descargado: "Descargados",
};

export const MODULO_LABEL = {
  en_contenedor: "En contenedor",
  descargado: "Descargado",
  instalado: "Instalado",
  terminado: "Terminado",
};

export const MODULO_TIPOS = ["ventana", "panel"];

export const MODULO_TIPO_LABEL = {
  ventana: "Ventana",
  panel: "Panel",
};

export const MODULO_TIPO_PLURAL = {
  ventana: "ventanas",
  panel: "paneles",
};

const PREFIX_PLANTA = /^Planta Aluman\s+/i;

/** "Planta Aluman Galicia" → "Galicia" */
export function plantaCorta(nombre) {
  if (!nombre) return "—";
  const s = String(nombre).replace(PREFIX_PLANTA, "").trim();
  return s || nombre;
}

export function rangoEstado(estado) {
  const i = CONTENEDOR_ESTADOS.indexOf(estado);
  return i < 0 ? 0 : i;
}

/** Índice para ordenar la lista de contenedores (menor = más arriba). */
export function ordenListaEstado(estado) {
  const i = CONTENEDOR_LISTA_ORDEN.indexOf(estado);
  return i < 0 ? CONTENEDOR_LISTA_ORDEN.length : i;
}

/** Estados donde se muestra "llega dd/mm". */
export const ESTADOS_CON_LLEGADA = new Set([
  "en_produccion",
  "en_camino",
  "en_puerto",
]);

/** Parsea date YYYY-MM-DD como fecha local (sin UTC). */
export function formatLlegada(dateStr) {
  if (!dateStr) return null;
  const m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return null;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

export function formatFechaHora(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${mi}`;
}

export function labelEstadoContenedor(estado) {
  return CONTENEDOR_LABEL[estado] ?? estado ?? "—";
}

export function labelEstadoModulo(estado) {
  return MODULO_LABEL[estado] ?? estado ?? "—";
}

export const ISO_RE = /^[A-Z]{4}[0-9]{7}$/;

export const PLANTILLA_CSV = `referencia,tipo
AL-0001,ventana
AL-0002,panel
AL-0003,ventana
`;
