/** Lógica pura de Progreso. Los componentes solo dibujan. */

export const TZ = "America/Montevideo";

export const VISUAL = {
  sin_modulo: { label: "Sin módulo", color: "#2E3A4E" },
  produccion: { label: "En producción", color: "#6E7F96" },
  camino: { label: "En camino", color: "#9B7FE8" },
  puerto: { label: "En puerto", color: "#3E7CB8" },
  deposito: { label: "En depósito", color: "#C47B4A" },
  obra: { label: "En obra", color: "#E3A63B" },
  instalado: { label: "Instalado", color: "#2BB3B4" },
  terminado: { label: "Terminado", color: "#46C08A" },
};

/** Leyenda: sin módulo al final. */
export const ORDEN_VISUAL = [
  "produccion",
  "camino",
  "puerto",
  "deposito",
  "obra",
  "instalado",
  "terminado",
  "sin_modulo",
];

const RANGO_MODULO = { en_contenedor: 0, descargado: 1, instalado: 2, terminado: 3 };
const RANGO_CONTENEDOR = {
  en_produccion: 0,
  en_camino: 1,
  en_puerto: 2,
  en_deposito: 3,
  en_obra: 4,
  descargado: 5,
};

const OBRA_CONT = new Set(["en_obra", "descargado"]);

const WD = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
const DIA = 86400000;

function partesUY(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return {
    y: Number(get("year")),
    m: Number(get("month")),
    d: Number(get("day")),
    hh: Number(get("hour")),
    min: Number(get("minute")),
    ss: Number(get("second")),
    weekday: get("weekday"),
  };
}

function offsetUY(instant) {
  const p = partesUY(instant);
  const wall = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.min, p.ss);
  return wall - instant.getTime();
}

/** 00:00 de ese día calendario en Uruguay. */
export function inicioDiaUY(y, m, d) {
  const noon = new Date(Date.UTC(y, m - 1, d, 15, 0, 0));
  const midnightWall = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
  return new Date(midnightWall - offsetUY(noon));
}

export function isoUY(date) {
  const p = partesUY(date);
  const mm = String(p.m).padStart(2, "0");
  const dd = String(p.d).padStart(2, "0");
  return `${p.y}-${mm}-${dd}`;
}

export function formatFechaUY(date) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const p = partesUY(d);
  return `${String(p.d).padStart(2, "0")}/${String(p.m).padStart(2, "0")}/${p.y}`;
}

export function formatFechaCortaUY(date) {
  const full = formatFechaUY(date);
  return full ? full.slice(0, 5) : "";
}

export function formatFechaHoraUY(date) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const p = partesUY(d);
  return `${String(p.d).padStart(2, "0")}/${String(p.m).padStart(2, "0")} ${String(p.hh).padStart(2, "0")}:${String(p.min).padStart(2, "0")}`;
}

/** Inclusive de ambos días calendario en Uruguay. Devuelve [start, end). */
export function rangoDiasUY(desde, hasta) {
  const a = typeof desde === "string" ? desde : isoUY(desde);
  const b = typeof hasta === "string" ? hasta : isoUY(hasta);
  const [x, y] = a <= b ? [a, b] : [b, a];
  const [y1, m1, d1] = x.split("-").map(Number);
  const [y2, m2, d2] = y.split("-").map(Number);
  const start = inicioDiaUY(y1, m1, d1);
  const end = new Date(inicioDiaUY(y2, m2, d2).getTime() + DIA);
  return { start, end };
}

/** Últimos `dias` días calendario, inclusive hoy en Uruguay. */
export function rangoAtajo(dias, hoy = new Date()) {
  const p = partesUY(hoy);
  const fin = inicioDiaUY(p.y, p.m, p.d);
  const ini = new Date(fin.getTime() - (dias - 1) * DIA);
  return { desde: isoUY(ini), hasta: isoUY(fin) };
}

function inicioSemanaUY(date) {
  const p = partesUY(date);
  const start = inicioDiaUY(p.y, p.m, p.d);
  const wd = WD[p.weekday] ?? 0;
  return new Date(start.getTime() - wd * DIA);
}

function enRango(date, start, end) {
  if (!date) return false;
  const t = (date instanceof Date ? date : new Date(date)).getTime();
  return t >= start.getTime() && t < end.getTime();
}

export function clavePos(piso, cara, eje) {
  return `${piso}|${cara}|${eje}`;
}

/**
 * @param {{ modulo_id?: string | null }} posicion
 * @param {{ estado?: string, contenedor_estado?: string } | null} modulo
 * @param {{ estado?: string } | null} contenedor
 */
export function estadoVisual(posicion, modulo, contenedor) {
  if (!posicion?.modulo_id && !modulo) return "sin_modulo";
  const estado = modulo?.estado;
  if (estado === "terminado") return "terminado";
  if (estado === "instalado") return "instalado";
  if (estado === "descargado") return "obra";
  if (estado === "en_contenedor") {
    const c = contenedor?.estado ?? modulo?.contenedor_estado;
    if (c === "en_produccion") return "produccion";
    if (c === "en_camino") return "camino";
    if (c === "en_puerto") return "puerto";
    if (c === "en_deposito") return "deposito";
    if (OBRA_CONT.has(c)) return "obra";
  }
  return "sin_modulo";
}

function ordenarEventos(eventos) {
  return [...(eventos ?? [])].sort((a, b) => {
    const ta = new Date(a.created_at).getTime();
    const tb = new Date(b.created_at).getTime();
    if (ta !== tb) return ta - tb;
    return String(a.id ?? "").localeCompare(String(b.id ?? ""));
  });
}

function primero(eventos, toState) {
  return ordenarEventos(eventos).find((e) => e.to_state === toState) ?? null;
}

function ultimo(eventos, toState) {
  const list = ordenarEventos(eventos).filter((e) => e.to_state === toState);
  return list.length ? list[list.length - 1] : null;
}

function fechaDe(evento) {
  if (!evento) return null;
  const d = new Date(evento.created_at);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * @returns {{ salio: Date | null, llego: Date | null, instalado: Date | null, terminado: Date | null }}
 */
export function fechasModulo(modulo, eventosModulo, eventosContenedor) {
  const rango = RANGO_MODULO[modulo?.estado] ?? -1;
  const inst = ultimo(eventosModulo, "instalado");
  const term = ultimo(eventosModulo, "terminado");
  return {
    salio: fechaDe(primero(eventosContenedor, "en_camino")),
    llego: fechaDe(primero(eventosContenedor, "en_obra")),
    instalado: rango >= RANGO_MODULO.instalado ? fechaDe(inst) : null,
    terminado: rango >= RANGO_MODULO.terminado ? fechaDe(term) : null,
  };
}

/** Evento → instalado que define al equipo (el último, si el estado sigue en esa etapa o más). */
export function eventoInstalacion(modulo, eventosModulo) {
  const rango = RANGO_MODULO[modulo?.estado] ?? -1;
  if (rango < RANGO_MODULO.instalado) return null;
  return ultimo(eventosModulo, "instalado");
}

/**
 * Equipo en el que estaba la persona en esa fecha.
 * `left_at` nulo o posterior a la fecha. No usa el equipo actual.
 * @returns {{ id: string, nombre: string | null } | null}
 */
export function equipoEnFecha(userId, fecha, miembros) {
  if (!userId || !fecha) return null;
  const t = new Date(fecha).getTime();
  if (Number.isNaN(t)) return null;
  const hit = (miembros ?? []).find((m) => {
    const uid = m.userId ?? m.user_id;
    if (uid !== userId) return false;
    const joined = new Date(m.joinedAt ?? m.joined_at).getTime();
    const leftRaw = m.leftAt ?? m.left_at;
    const left = leftRaw == null || leftRaw === "" ? null : new Date(leftRaw).getTime();
    return joined <= t && (left == null || left > t);
  });
  if (!hit) return null;
  return {
    id: hit.equipoId ?? hit.equipo_id,
    nombre: hit.nombre ?? hit.equipoNombre ?? null,
  };
}

export function esCorreccion(entidad, fromState, toState) {
  if (!fromState || !toState) return false;
  const tabla = entidad === "contenedor" ? RANGO_CONTENEDOR : RANGO_MODULO;
  if (!(fromState in tabla) || !(toState in tabla)) return false;
  return tabla[toState] < tabla[fromState];
}

function comaDecimal(n) {
  return (Math.round(n * 10) / 10).toFixed(1).replace(".", ",");
}

/**
 * @param {Array<{ piso?: number | null, salio?: Date | null, llego?: Date | null, instalado?: Date | null, terminado?: Date | null, equipoId?: string | null }>} fechas
 * @param {Array<{ id: string, nombre: string }>} equipos
 * @param {string | Date} desde
 * @param {string | Date} hasta
 * @param {string | null} equipo id de equipo, o null / "" para todos
 */
export function seguimiento(fechas, equipos, desde, hasta, equipo) {
  const { start, end } = rangoDiasUY(desde, hasta);
  const filtro = equipo || null;
  const lista = fechas ?? [];

  const cuenta = (campo, soloEquipo) =>
    lista.filter((f) => {
      if (!enRango(f[campo], start, end)) return false;
      if (!soloEquipo || !filtro) return true;
      return f.equipoId === filtro;
    }).length;

  const totalPeriodo = {
    salieron: cuenta("salio", false),
    llegaron: cuenta("llego", false),
    instalados: cuenta("instalado", true),
    terminados: cuenta("terminado", true),
  };

  const semanasDuracion = Math.max(1, (end.getTime() - start.getTime()) / (7 * DIA));
  let cursor = inicioSemanaUY(start);
  const filas = [];
  while (cursor.getTime() < end.getTime()) {
    const semanaFin = new Date(cursor.getTime() + 7 * DIA);
    const from = cursor.getTime() < start.getTime() ? start : cursor;
    const to = semanaFin.getTime() > end.getTime() ? end : semanaFin;
    const enSemana = (campo, soloEquipo) =>
      lista.filter((f) => {
        if (!enRango(f[campo], from, to)) return false;
        if (!soloEquipo || !filtro) return true;
        return f.equipoId === filtro;
      }).length;
    const ultimoDia = new Date(semanaFin.getTime() - DIA);
    filas.push({
      desde: cursor,
      hasta: ultimoDia,
      label: `${formatFechaCortaUY(cursor)} – ${formatFechaCortaUY(ultimoDia)}`,
      salieron: enSemana("salio", false),
      llegaron: enSemana("llego", false),
      instalados: enSemana("instalado", true),
      terminados: enSemana("terminado", true),
    });
    cursor = semanaFin;
  }
  filas.reverse();

  const porEquipo = (equipos ?? []).map((eq) => {
    const inst = lista.filter((f) => f.equipoId === eq.id && enRango(f.instalado, start, end));
    const term = lista.filter((f) => f.equipoId === eq.id && enRango(f.terminado, start, end)).length;
    const pisos = [...new Set(inst.map((f) => f.piso).filter((p) => p != null))].sort((a, b) => a - b);
    return {
      id: eq.id,
      nombre: eq.nombre,
      instalados: inst.length,
      terminados: term,
      porSemana: comaDecimal(inst.length / semanasDuracion),
      pisosLabel: pisos.length ? `${pisos[0]}–${pisos[pisos.length - 1]}` : "—",
    };
  });

  const instTotal = porEquipo.reduce((s, e) => s + e.instalados, 0);
  const termTotal = porEquipo.reduce((s, e) => s + e.terminados, 0);

  const vacio =
    totalPeriodo.salieron +
      totalPeriodo.llegaron +
      totalPeriodo.instalados +
      totalPeriodo.terminados ===
    0;

  return {
    vacio,
    porEquipo,
    totalEquipo: {
      instalados: instTotal,
      terminados: termTotal,
      porSemana: comaDecimal(instTotal / semanasDuracion),
    },
    porSemana: filas,
    totalPeriodo,
  };
}

/** Piso más bajo con algo que no esté instalado ni terminado. */
export function pisoInicial(posiciones) {
  const pendientes = (posiciones ?? [])
    .filter((p) => p.visual !== "instalado" && p.visual !== "terminado")
    .map((p) => p.piso);
  if (pendientes.length === 0) return null;
  return Math.min(...pendientes);
}

export function conteos(posiciones) {
  const out = Object.fromEntries(ORDEN_VISUAL.map((k) => [k, 0]));
  for (const p of posiciones ?? []) {
    if (p.visual in out) out[p.visual] += 1;
  }
  return out;
}
