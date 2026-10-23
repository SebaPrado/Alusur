import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Box } from "@mui/material";
import { supabase } from "../../lib/supabase";
import { buildSlots } from "../fachada/buildSlots";
import { plantaCorta } from "../logistica/estados";
import {
  clavePos,
  conteos,
  equipoEnFecha,
  estadoVisual,
  eventoInstalacion,
  fechasModulo,
  pisoInicial,
} from "./model";

const PAGE = 1000;
const ProgresoContext = createContext(null);

async function fetchAll(makeQuery) {
  const all = [];
  let from = 0;
  for (;;) {
    const { data, error } = await makeQuery().range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

function actorDe(evento) {
  const p = evento.profiles;
  if (Array.isArray(p)) return p[0]?.full_name ?? null;
  return p?.full_name ?? null;
}

function num(value) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : value;
}

function secuenciaDe(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    return raw
      .replace(/^\{|\}$/g, "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function nombrePlanta(contenedor) {
  const p = contenedor?.plantas;
  if (!p) return null;
  if (Array.isArray(p)) return p[0]?.nombre ?? null;
  return p.nombre ?? null;
}

async function cargar(obraId) {
  const fachadaQ = supabase
    .from("fachadas")
    .select("piso_desde, piso_hasta, ancho_modulo_m, alto_piso_m, modo, vista_simple")
    .eq("obra_id", obraId)
    .maybeSingle();
  const carasQ = supabase
    .from("fachada_caras")
    .select("orden, codigo, nombre, modulos_por_piso, secuencia, entorno")
    .eq("obra_id", obraId)
    .order("orden");
  const equiposQ = supabase.from("equipos").select("id, nombre").eq("obra_id", obraId).order("nombre");

  const [fachadaRes, carasRes, posiciones, modulos, contenedores, eventos, equiposRes, miembros] =
    await Promise.all([
      fachadaQ,
      carasQ,
      fetchAll(() =>
        supabase
          .from("modulo_posiciones")
          .select("modulo_id, piso, cara_codigo, eje")
          .eq("obra_id", obraId)
          .order("piso")
          .order("cara_codigo")
          .order("eje"),
      ),
      fetchAll(() =>
        supabase
          .from("v_modulos")
          .select(
            "id, codigo, tipo, estado, referencia, contenedor_id, contenedor_codigo, contenedor_estado",
          )
          .eq("obra_id", obraId)
          .order("codigo"),
      ),
      fetchAll(() =>
        supabase
          .from("contenedores")
          .select("id, codigo, estado, llegada_estimada, plantas(nombre)")
          .eq("obra_id", obraId)
          .order("codigo"),
      ),
      fetchAll(() =>
        supabase
          .from("status_events")
          .select(
            "id, modulo_id, contenedor_id, from_state, to_state, nota, user_id, created_at, profiles(full_name)",
          )
          .eq("obra_id", obraId)
          .or("modulo_id.not.is.null,contenedor_id.not.is.null")
          .order("created_at", { ascending: true })
          .order("id", { ascending: true }),
      ),
      equiposQ,
      fetchAll(() =>
        supabase
          .from("equipo_members")
          .select("equipo_id, user_id, joined_at, left_at")
          .eq("obra_id", obraId)
          .order("joined_at"),
      ),
    ]);

  if (fachadaRes.error) throw fachadaRes.error;
  if (carasRes.error) throw carasRes.error;
  if (equiposRes.error) throw equiposRes.error;

  return {
    fachada: fachadaRes.data,
    caras: carasRes.data ?? [],
    posiciones,
    modulos,
    contenedores,
    eventos: eventos.map((e) => ({
      id: e.id,
      modulo_id: e.modulo_id,
      contenedor_id: e.contenedor_id,
      from_state: e.from_state,
      to_state: e.to_state,
      nota: e.nota,
      user_id: e.user_id,
      created_at: e.created_at,
      actor: actorDe(e),
    })),
    equipos: equiposRes.data ?? [],
    miembros,
  };
}

function armar(obraNombre, raw) {
  if (!raw?.fachada) {
    return {
      config: null,
      filas: [],
      fechasSeg: [],
      equipos: raw?.equipos ?? [],
      conteo: conteos([]),
      pisoDefault: null,
      porCodigo: new Map(),
    };
  }

  const config = {
    nombre: obraNombre || "Obra",
    modo: raw.fachada.modo,
    vista_simple: raw.fachada.vista_simple,
    piso_desde: num(raw.fachada.piso_desde),
    piso_hasta: num(raw.fachada.piso_hasta),
    ancho_modulo_m: num(raw.fachada.ancho_modulo_m),
    alto_piso_m: num(raw.fachada.alto_piso_m),
    caras: [...raw.caras]
      .sort((a, b) => a.orden - b.orden)
      .map((c) => ({
        codigo: c.codigo,
        nombre: c.nombre,
        modulos_por_piso: num(c.modulos_por_piso),
        secuencia: secuenciaDe(c.secuencia),
        entorno: c.entorno,
      })),
  };

  const slots = buildSlots(config);
  const asigPorClave = new Map(
    raw.posiciones.map((p) => [clavePos(p.piso, p.cara_codigo, p.eje), p]),
  );
  const modPorId = new Map(raw.modulos.map((m) => [m.id, m]));
  const contPorId = new Map(raw.contenedores.map((c) => [c.id, c]));
  const evMod = new Map();
  const evCont = new Map();
  for (const e of raw.eventos) {
    if (e.modulo_id) {
      if (!evMod.has(e.modulo_id)) evMod.set(e.modulo_id, []);
      evMod.get(e.modulo_id).push(e);
    }
    if (e.contenedor_id) {
      if (!evCont.has(e.contenedor_id)) evCont.set(e.contenedor_id, []);
      evCont.get(e.contenedor_id).push(e);
    }
  }

  const nombreEquipo = new Map(raw.equipos.map((e) => [e.id, e.nombre]));
  const miembros = raw.miembros.map((m) => ({
    ...m,
    nombre: nombreEquipo.get(m.equipo_id) ?? null,
  }));

  function ficha(modulo) {
    const evsM = evMod.get(modulo.id) ?? [];
    const evsC = evCont.get(modulo.contenedor_id) ?? [];
    const fechas = fechasModulo(modulo, evsM, evsC);
    const inst = eventoInstalacion(modulo, evsM);
    const equipo = inst ? equipoEnFecha(inst.user_id, inst.created_at, miembros) : null;
    return { fechas, equipo, evsM, evsC };
  }

  const filas = slots.map((slot) => {
    const asig = asigPorClave.get(clavePos(slot.piso, slot.caraCodigo, slot.eje)) ?? null;
    const modulo = asig ? (modPorId.get(asig.modulo_id) ?? null) : null;
    const contenedor = modulo ? (contPorId.get(modulo.contenedor_id) ?? null) : null;
    const visual = estadoVisual(
      { modulo_id: modulo?.id ?? null },
      modulo,
      { estado: modulo?.contenedor_estado ?? contenedor?.estado },
    );
    const extra = modulo ? ficha(modulo) : null;
    return {
      ...slot,
      modulo,
      contenedor,
      visual,
      fechas: extra?.fechas ?? { salio: null, llego: null, instalado: null, terminado: null },
      equipo: extra?.equipo ?? null,
      eventosModulo: extra?.evsM ?? [],
      eventosContenedor: extra?.evsC ?? [],
      planta: plantaCorta(nombrePlanta(contenedor)),
      llegada: contenedor?.llegada_estimada ?? null,
    };
  });

  const filaPorModulo = new Map(filas.filter((f) => f.modulo).map((f) => [f.modulo.id, f]));
  const fechasSeg = raw.modulos.map((modulo) => {
    const { fechas, equipo } = ficha(modulo);
    const fila = filaPorModulo.get(modulo.id);
    return {
      moduloId: modulo.id,
      piso: fila?.piso ?? null,
      salio: fechas.salio,
      llego: fechas.llego,
      instalado: fechas.instalado,
      terminado: fechas.terminado,
      equipoId: equipo?.id ?? null,
    };
  });

  const porCodigo = new Map(filas.filter((f) => f.modulo).map((f) => [f.modulo.codigo, f]));

  return {
    config,
    filas,
    fechasSeg,
    equipos: raw.equipos,
    conteo: conteos(filas),
    pisoDefault: pisoInicial(filas) ?? config.piso_desde,
    porCodigo,
  };
}

const VACIO = {
  config: null,
  filas: [],
  fechasSeg: [],
  equipos: [],
  conteo: conteos([]),
  pisoDefault: null,
  porCodigo: new Map(),
};

export function ProgresoProvider({ obraId, obraNombre, children }) {
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);
  const [recorridoId, setRecorridoId] = useState(null);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  const abrirRecorrido = useCallback((moduloId) => setRecorridoId(moduloId), []);
  const cerrarRecorrido = useCallback(() => setRecorridoId(null), []);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError(null);
    cargar(obraId)
      .then((data) => {
        if (!cancel) {
          setRaw(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancel) {
          setError(err?.message || "No se pudieron cargar los datos de progreso.");
          setLoading(false);
        }
      });
    return () => {
      cancel = true;
    };
  }, [obraId, tick]);

  const { modelo, armadoError } = useMemo(() => {
    if (!raw) return { modelo: VACIO, armadoError: null };
    try {
      return { modelo: armar(obraNombre, raw), armadoError: null };
    } catch (err) {
      return {
        modelo: VACIO,
        armadoError: err?.message || "No se pudo armar el progreso de la obra.",
      };
    }
  }, [raw, obraNombre]);

  const errorVista = error || armadoError;

  const value = useMemo(
    () => ({
      loading,
      error: errorVista,
      reload,
      recorridoId,
      abrirRecorrido,
      cerrarRecorrido,
      ...modelo,
    }),
    [loading, errorVista, reload, recorridoId, abrirRecorrido, cerrarRecorrido, modelo],
  );

  return <ProgresoContext.Provider value={value}>{children}</ProgresoContext.Provider>;
}

export function useProgreso() {
  const ctx = useContext(ProgresoContext);
  if (!ctx) throw new Error("useProgreso debe usarse dentro de ProgresoProvider");
  return ctx;
}

export function ProgresoGate({ children }) {
  const { loading, error, config } = useProgreso();
  if (loading) return <BoxMensaje>Cargando…</BoxMensaje>;
  if (error) return <BoxMensaje color="error.main">{error}</BoxMensaje>;
  if (!config) return <BoxMensaje>Esta obra no tiene la fachada configurada.</BoxMensaje>;
  return children;
}

function BoxMensaje({ children, color = "text.secondary" }) {
  return (
    <Box sx={{ color, p: 2 }} role="status">
      {children}
    </Box>
  );
}
