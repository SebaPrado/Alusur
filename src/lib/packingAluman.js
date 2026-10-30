/**
 * Parser del packing list de ALUMAN (envío → bultos → líneas).
 * Recibe filas (array de arrays), no el archivo.
 */
import { normalizarCodigoTipo } from "../features/logistica/catalogoModulos";

/** Etiquetas de cabecera, ya normalizadas. */
export const CABECERA = {
  obra: ["obra"],
  numeroEnvio: ["n envio", "n. envio", "nº envio", "n° envio", "numero envio", "nro envio"],
  bultos: ["n bultos", "n. bultos", "nº bultos", "n° bultos", "numero bultos", "nro bultos"],
  pesoTotal: ["peso total (kg)", "peso total kg", "peso total"],
  fechaCarga: ["fecha de carga", "fecha carga"],
  matricula: ["matricula trans", "matricula"],
};

/** Encabezados de la tabla, ya normalizados. */
export const COLUMNAS = {
  numeroBulto: ["n bulto", "n. bulto", "nº bulto", "n° bulto", "numero bulto", "nro bulto"],
  pesoBruto: ["peso bruto (kg)", "peso bruto kg", "peso bruto"],
  dimensiones: ["dimensiones (mm)", "dimensiones mm", "dimensiones"],
  lote: ["lote"],
  referencia: ["referencia"],
  cantidad: ["u.c.", "u.c", "uc", "cantidad"],
  descripcion: ["descripcion", "descripción"],
  hoja: ["hoja"],
  hsCode: ["hs code", "hscode", "hs_code"],
  pieza: ["pieza"],
};

/** Minúsculas, sin acentos; º/°/N. → n; espacios colapsados. */
export function normalizarRotulo(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[º°]/g, "")
    .replace(/\bn\.\s*/g, "n ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Misma idea que la base para buscar en referencias_proveedor.referencia_norm. */
export function normalizarReferencia(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .trim();
}

function matchAlias(norm, aliases) {
  return aliases.includes(norm);
}

function celdaTexto(v) {
  if (v == null || v === "") return "";
  if (typeof v === "number" && Number.isFinite(v)) {
    // Evitar "13" → "13" ok; pero sin notación científica rara en enteros.
    if (Number.isInteger(v)) return String(v);
    return String(v);
  }
  return String(v).trim();
}

function parseNumero(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v)
    .trim()
    .replace(/\s+/g, "")
    .replace(/kg$/i, "")
    .replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parsePesoConUnidad(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const m = String(v)
    .trim()
    .replace(",", ".")
    .match(/(-?\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

/** dd/mm/aaaa o Date nativa de Excel → ISO aaaa-mm-dd. */
export function parseFechaAluman(v) {
  if (v == null || v === "") return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    // Medianoche UTC: día UTC para no correr la fecha en Uruguay.
    if (
      v.getUTCHours() === 0 &&
      v.getUTCMinutes() === 0 &&
      v.getUTCSeconds() === 0 &&
      v.getUTCMilliseconds() === 0
    ) {
      const y = v.getUTCFullYear();
      const m = String(v.getUTCMonth() + 1).padStart(2, "0");
      const d = String(v.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    // Serial Excel (días desde 1899-12-30).
    const epoch = Date.UTC(1899, 11, 30) + Math.round(v) * 86400000;
    const dt = new Date(epoch);
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const d = String(dt.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    return `${m[3]}-${mo}-${d}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function esFilaVacia(fila) {
  return !fila || fila.every((c) => c == null || String(c).trim() === "");
}

function esPieNimf(fila) {
  const t = fila.map((c) => String(c ?? "").trim()).join(" ").toLowerCase();
  return t.includes("embalaje marcado") || t.includes("nimf15") || t.includes("nimf 15");
}

function detectarEncabezadoTabla(fila) {
  const norms = (fila ?? []).map((c) => normalizarRotulo(c));
  const idx = {};
  for (const [key, aliases] of Object.entries(COLUMNAS)) {
    const i = norms.findIndex((n) => matchAlias(n, aliases));
    if (i >= 0) idx[key] = i;
  }
  if (idx.numeroBulto == null || idx.referencia == null || idx.cantidad == null) {
    return null;
  }
  return idx;
}

function esFilaEncabezadoRepetido(fila, idx) {
  const det = detectarEncabezadoTabla(fila);
  if (!det) return false;
  return (
    det.numeroBulto === idx.numeroBulto &&
    det.referencia === idx.referencia &&
    det.cantidad === idx.cantidad
  );
}

function buscarCabecera(filas) {
  const out = {
    obra: null,
    numero_envio: null,
    bultos_declarados: null,
    peso_declarado_kg: null,
    fecha_carga: null,
    matricula: null,
  };
  const visto = {
    numero_envio: false,
  };

  for (const fila of filas) {
    if (esFilaVacia(fila)) continue;
    for (let i = 0; i < fila.length - 1; i += 1) {
      const label = normalizarRotulo(fila[i]);
      if (!label) continue;
      const valor = fila[i + 1];

      if (matchAlias(label, CABECERA.obra) && out.obra == null) {
        out.obra = celdaTexto(valor) || null;
      } else if (matchAlias(label, CABECERA.numeroEnvio) && !visto.numero_envio) {
        const n = parseNumero(valor);
        if (n != null) {
          out.numero_envio = Math.trunc(n);
          visto.numero_envio = true;
        }
      } else if (matchAlias(label, CABECERA.bultos) && out.bultos_declarados == null) {
        const n = parseNumero(valor);
        if (n != null) out.bultos_declarados = Math.trunc(n);
      } else if (matchAlias(label, CABECERA.pesoTotal) && out.peso_declarado_kg == null) {
        const n = parsePesoConUnidad(valor);
        if (n != null) out.peso_declarado_kg = n;
      } else if (matchAlias(label, CABECERA.fechaCarga) && out.fecha_carga == null) {
        out.fecha_carga = parseFechaAluman(valor);
      } else if (matchAlias(label, CABECERA.matricula) && out.matricula == null) {
        const t = celdaTexto(valor);
        out.matricula = t || null;
      }
    }
  }
  return out;
}

/**
 * @param {unknown[][]} filas
 * @param {string} [nombreArchivo]
 * @returns {{ data: object | null, errores: string[], avisos: string[], obraAluman: string | null }}
 */
export function parsePackingAluman(filas, nombreArchivo = "") {
  const errores = [];
  const avisos = [];
  const rows = Array.isArray(filas) ? filas : [];

  let headerRow = -1;
  let idx = null;
  for (let i = 0; i < rows.length; i += 1) {
    const det = detectarEncabezadoTabla(rows[i]);
    if (det) {
      headerRow = i;
      idx = det;
      break;
    }
  }

  if (headerRow < 0 || !idx) {
    return {
      data: null,
      errores: ["No se encontró la fila de encabezado de la tabla."],
      avisos: [],
      obraAluman: null,
    };
  }

  const cab = buscarCabecera(rows.slice(0, headerRow + 1));
  if (cab.numero_envio == null) {
    errores.push("Falta Nº ENVÍO.");
  }

  /** @type {Map<number, { numero: number, peso_bruto_kg: number | null, dimensiones: string | null, lineas: object[] }>} */
  const bultosMap = new Map();
  let ultimoNumero = null;

  for (let i = headerRow + 1; i < rows.length; i += 1) {
    const fila = rows[i];
    if (esFilaVacia(fila)) continue;
    if (esPieNimf(fila)) continue;
    if (esFilaEncabezadoRepetido(fila, idx)) continue;

    const numRaw = fila[idx.numeroBulto];
    const refRaw = idx.referencia != null ? fila[idx.referencia] : null;
    const cantRaw = idx.cantidad != null ? fila[idx.cantidad] : null;

    const numTxt = celdaTexto(numRaw);
    const ref = celdaTexto(refRaw);
    const tieneNum = numTxt !== "" && parseNumero(numRaw) != null;
    const tieneRef = ref !== "";

    if (!tieneNum && !tieneRef) continue;

    if (!tieneRef) {
      errores.push(`Línea sin referencia (fila ${i + 1}).`);
      continue;
    }
    const cantidad = parseNumero(cantRaw);
    if (cantidad == null) {
      errores.push(`Línea sin cantidad (fila ${i + 1}).`);
      continue;
    }

    let numero;
    if (tieneNum) {
      numero = Math.trunc(parseNumero(numRaw));
      ultimoNumero = numero;
      if (!bultosMap.has(numero)) {
        const peso =
          idx.pesoBruto != null ? parseNumero(fila[idx.pesoBruto]) : null;
        const dim =
          idx.dimensiones != null ? celdaTexto(fila[idx.dimensiones]) || null : null;
        bultosMap.set(numero, {
          numero,
          peso_bruto_kg: peso,
          dimensiones: dim,
          lineas: [],
        });
      }
    } else if (ultimoNumero == null) {
      errores.push(`Línea antes del primer número de bulto (fila ${i + 1}).`);
      continue;
    } else {
      numero = ultimoNumero;
    }

    const bulto = bultosMap.get(numero);
    if (!bulto) continue;

    const linea = {
      lote: idx.lote != null ? celdaTexto(fila[idx.lote]) : "",
      referencia: ref,
      cantidad,
      descripcion: idx.descripcion != null ? celdaTexto(fila[idx.descripcion]) : "",
      hoja: idx.hoja != null ? celdaTexto(fila[idx.hoja]) : "",
      hs_code: idx.hsCode != null ? celdaTexto(fila[idx.hsCode]) : "",
    };
    if (idx.pieza != null) {
      const pieza = celdaTexto(fila[idx.pieza]);
      if (pieza) linea.pieza = pieza;
    }
    bulto.lineas.push(linea);
  }

  const bultos = [...bultosMap.values()].sort((a, b) => a.numero - b.numero);
  const pesoDetalle = bultos.reduce(
    (acc, b) => acc + (typeof b.peso_bruto_kg === "number" ? b.peso_bruto_kg : 0),
    0,
  );

  if (
    cab.bultos_declarados != null &&
    cab.bultos_declarados !== bultos.length
  ) {
    avisos.push(
      `La cabecera declara ${cab.bultos_declarados} bultos y el detalle trae ${bultos.length}`,
    );
  }
  if (
    cab.peso_declarado_kg != null &&
    Math.abs(cab.peso_declarado_kg - pesoDetalle) > 1
  ) {
    avisos.push(
      `La cabecera declara ${cab.peso_declarado_kg} kg y la suma del detalle es ${pesoDetalle} kg`,
    );
  }

  if (errores.length) {
    return {
      data: null,
      errores,
      avisos,
      obraAluman: cab.obra,
    };
  }

  const data = {
    numero_envio: cab.numero_envio,
    fecha_carga: cab.fecha_carga,
    bultos_declarados: cab.bultos_declarados,
    peso_declarado_kg: cab.peso_declarado_kg,
    matricula: cab.matricula,
    contenedor_iso: null,
    archivo_origen: nombreArchivo || null,
    bultos: bultos.map((b) => ({
      numero: b.numero,
      peso_bruto_kg: b.peso_bruto_kg,
      dimensiones: b.dimensiones,
      lineas: b.lineas,
    })),
  };

  return { data, errores: [], avisos, obraAluman: cab.obra };
}

/**
 * Misma regla que la base: 1º referencias_proveedor, 2º tipos_modulo.codigo.
 * @param {object} data
 * @param {Array<{ referencia_norm: string, tipo_modulo_id: string | null }>} mapeos
 * @param {Array<{ id?: string, codigo: string, pieza?: string }>} catalogo
 */
export function clasificarLineas(data, mapeos = [], catalogo = []) {
  const porNorm = new Map();
  for (const m of mapeos) {
    porNorm.set(String(m.referencia_norm ?? ""), m);
  }
  const porId = new Map();
  const porCodigo = new Map();
  for (const t of catalogo) {
    if (t.id) porId.set(t.id, t);
    porCodigo.set(normalizarCodigoTipo(t.codigo), t);
  }

  /** @type {Map<string, number>} */
  const modulosPorCodigo = new Map();
  let lineasMaterial = 0;

  for (const bulto of data?.bultos ?? []) {
    for (const linea of bulto.lineas ?? []) {
      const norm = normalizarReferencia(linea.referencia);
      const map = porNorm.get(norm);
      let codigo = null;

      if (map) {
        if (map.tipo_modulo_id == null) {
          lineasMaterial += 1;
          continue;
        }
        const tipo = porId.get(map.tipo_modulo_id);
        codigo = tipo?.codigo ?? null;
      } else {
        const tipo = porCodigo.get(normalizarCodigoTipo(linea.referencia));
        codigo = tipo?.codigo ?? null;
      }

      if (codigo) {
        const prev = modulosPorCodigo.get(codigo) ?? 0;
        modulosPorCodigo.set(codigo, prev + Number(linea.cantidad || 0));
      } else {
        lineasMaterial += 1;
      }
    }
  }

  const porCodigoList = [...modulosPorCodigo.entries()]
    .map(([codigo, cantidad]) => ({ codigo, cantidad }))
    .sort((a, b) => a.codigo.localeCompare(b.codigo));

  return {
    porCodigo: porCodigoList,
    lineasMaterial,
    totalModulos: porCodigoList.reduce((a, x) => a + x.cantidad, 0),
  };
}

/**
 * Arma filas (array de arrays) con el layout ALUMAN a partir del JSON de import.
 * Número, peso y dimensiones solo en la primera fila de cada bulto.
 */
export function filasDesdeFixture(fixture, opts = {}) {
  const obra = opts.obra ?? "HOTEL SOHO";
  const cabeceraLabels = opts.cabeceraLabels ?? {
    obra: "OBRA",
    numeroEnvio: "Nº ENVÍO",
    bultos: "Nº BULTOS",
    peso: "PESO TOTAL (KG)",
    fecha: "FECHA DE CARGA",
    matricula: "MATRÍCULA TRANS",
  };
  const headers = opts.headers ?? [
    "Nº BULTO",
    "PESO BRUTO (kg)",
    "DIMENSIONES (MM)",
    "LOTE",
    "REFERENCIA",
    "U.C.",
    "DESCRIPCIÓN",
    "HOJA",
    "HS CODE",
  ];

  const fecha = fixture.fecha_carga
    ? (() => {
        const [y, m, d] = String(fixture.fecha_carga).split("-");
        return `${Number(d)}/${Number(m)}/${y}`;
      })()
    : "";

  const filas = [
    [cabeceraLabels.obra, obra],
    [cabeceraLabels.numeroEnvio, fixture.numero_envio],
    [cabeceraLabels.bultos, fixture.bultos_declarados],
    [
      cabeceraLabels.peso,
      opts.pesoComoTexto
        ? `${fixture.peso_declarado_kg} Kg`
        : fixture.peso_declarado_kg,
    ],
    [
      cabeceraLabels.fecha,
      opts.fechaNativa
        ? new Date(Date.UTC(...fixture.fecha_carga.split("-").map((x, i) => (i === 1 ? Number(x) - 1 : Number(x)))))
        : fecha,
    ],
    [cabeceraLabels.matricula, fixture.matricula ?? ""],
    [],
    headers,
  ];

  for (const bulto of fixture.bultos ?? []) {
    let primera = true;
    for (const linea of bulto.lineas ?? []) {
      filas.push([
        primera ? bulto.numero : "",
        primera ? bulto.peso_bruto_kg : "",
        primera ? bulto.dimensiones ?? "" : "",
        linea.lote ?? "",
        linea.referencia ?? "",
        linea.cantidad,
        linea.descripcion ?? "",
        linea.hoja ?? "",
        linea.hs_code ?? "",
      ]);
      primera = false;
    }
  }

  if (opts.conPie) {
    filas.push([]);
    filas.push(["*Embalaje marcado NIMF15"]);
  }

  return filas;
}
