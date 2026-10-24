import Papa from "papaparse";
import { MODULO_TIPOS } from "./estados";
import {
  claveCatalogo,
  existeEnCatalogo,
  normalizarCodigoTipo,
} from "./catalogoModulos";

const TIPOS_OK = new Set(MODULO_TIPOS);

/** Encabezados que identifican el código ALUMAN (fácil de ajustar). */
export const PACKING_CODIGO_HEADER = [/codigo/, /tipo/];
/** Encabezado opcional de pieza. */
export const PACKING_PIEZA_HEADER = [/pieza/];

/** Minúsculas y sin acentos, para matchear encabezados. */
export function normalizarHeader(h) {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function headerMatch(headerNorm, patterns) {
  return patterns.some((re) => re.test(headerNorm));
}

/**
 * @param {string[]} headers
 * @returns {{ iRef: number, iCodigo: number, iPieza: number }}
 */
export function detectarColumnasPacking(headers) {
  const norms = (headers ?? []).map(normalizarHeader);
  const iRef = norms.findIndex((h) => h === "referencia");
  // Preferir "codigo"/"código" sobre "tipo" si hay las dos.
  let iCodigo = norms.findIndex((h) => /codigo/.test(h) && h !== "referencia");
  if (iCodigo < 0) {
    iCodigo = norms.findIndex((h) => headerMatch(h, PACKING_CODIGO_HEADER) && h !== "referencia");
  }
  const iPieza = norms.findIndex((h) => headerMatch(h, PACKING_PIEZA_HEADER));
  return { iRef, iCodigo, iPieza };
}

/**
 * Normaliza una fila cruda (objeto o array con headers) a { referencia, tipo }.
 * @param {Record<string, unknown>} row
 */
function pickCampos(row) {
  const keys = Object.keys(row);
  const find = (name) => {
    const k = keys.find((x) => String(x).trim().toLowerCase() === name);
    return k != null ? row[k] : undefined;
  };
  const refRaw = find("referencia");
  const tipoRaw = find("tipo");
  return {
    referencia: refRaw == null ? "" : String(refRaw).trim(),
    tipo: tipoRaw == null ? "" : String(tipoRaw).trim().toLowerCase(),
  };
}

/**
 * Valida filas ya normalizadas (modo sin catálogo: ventana/panel).
 * @param {Array<{ referencia: string, tipo: string }>} rows
 */
export function validatePackingRows(rows) {
  if (!rows || rows.length === 0) {
    return {
      rows: [],
      errors: ["El archivo está vacío."],
      resumen: { total: 0, ventana: 0, panel: 0 },
      ok: false,
    };
  }

  if (rows.length > 99) {
    return {
      rows: rows.map((r) => ({ ...r })),
      errors: ["El contenedor no puede tener más de 99 módulos."],
      resumen: { total: rows.length, ventana: 0, panel: 0 },
      ok: false,
    };
  }

  const seen = new Map();
  const out = [];
  const errors = [];
  let ventana = 0;
  let panel = 0;

  rows.forEach((r, i) => {
    const line = i + 1;
    let error;

    if (!r.referencia) {
      error = "Referencia vacía";
    } else if (seen.has(r.referencia)) {
      error = `Referencia repetida (fila ${seen.get(r.referencia)})`;
    } else if (!TIPOS_OK.has(r.tipo)) {
      error = `Tipo inválido: ${r.tipo || "(vacío)"}`;
    }

    if (error) {
      errors.push(`Fila ${line}: ${error}`);
    } else {
      seen.set(r.referencia, line);
      if (r.tipo === "ventana") ventana += 1;
      if (r.tipo === "panel") panel += 1;
    }

    out.push({ referencia: r.referencia, tipo: r.tipo, ...(error ? { error } : {}) });
  });

  return {
    rows: out,
    errors,
    resumen: { total: rows.length, ventana, panel },
    ok: errors.length === 0,
  };
}

/**
 * @param {Array<{ referencia?: string, codigo_tipo?: string, pieza?: string }>} rows
 * @param {Array<{ codigo: string, pieza?: string }>} catalogo
 */
export function validarFilasCatalogo(rows, catalogo) {
  if (!rows || rows.length === 0) {
    return {
      rows: [],
      errors: ["El archivo está vacío."],
      resumen: { total: 0, porCodigo: [] },
      ok: false,
    };
  }

  if (rows.length > 99) {
    return {
      rows: rows.map((r) => ({ ...r })),
      errors: ["El contenedor no puede tener más de 99 módulos."],
      resumen: { total: rows.length, porCodigo: [] },
      ok: false,
    };
  }

  const seen = new Map();
  const out = [];
  const errors = [];
  const counts = new Map();

  rows.forEach((r, i) => {
    const line = i + 1;
    const referencia = String(r.referencia ?? "").trim();
    const codigo_tipo = normalizarCodigoTipo(r.codigo_tipo);
    const piezaRaw = String(r.pieza ?? "principal").trim().toLowerCase();
    const pieza = piezaRaw === "complemento" ? "complemento" : "principal";
    let error;
    let desconocido = false;

    if (!referencia) {
      error = "Referencia vacía";
    } else if (seen.has(referencia)) {
      error = `Referencia repetida (fila ${seen.get(referencia)})`;
    } else if (!codigo_tipo) {
      error = "Código de catálogo vacío";
      desconocido = true;
    } else if (!existeEnCatalogo(catalogo, codigo_tipo, pieza)) {
      error = `Código "${codigo_tipo}" (pieza ${pieza}) no está en el catálogo`;
      desconocido = true;
    }

    if (error) {
      errors.push(`Fila ${line}: ${error}`);
    } else {
      seen.set(referencia, line);
      const k = claveCatalogo(codigo_tipo, pieza);
      const prev = counts.get(k) ?? { codigo_tipo, pieza, n: 0 };
      prev.n += 1;
      counts.set(k, prev);
    }

    out.push({
      referencia,
      codigo_tipo: codigo_tipo || String(r.codigo_tipo ?? "").trim(),
      pieza,
      ...(error ? { error, desconocido } : {}),
    });
  });

  return {
    rows: out,
    errors,
    resumen: {
      total: rows.length,
      porCodigo: [...counts.values()].sort((a, b) =>
        a.codigo_tipo.localeCompare(b.codigo_tipo) || a.pieza.localeCompare(b.pieza),
      ),
    },
    ok: errors.length === 0,
  };
}

/**
 * Filas de hoja/objetos ya con celdas indexadas o por nombre.
 * @param {Array<Record<string, unknown> | unknown[]>} dataRows
 * @param {{ iRef: number, iCodigo: number, iPieza: number } | null} cols
 * @param {string[] | null} headers
 */
export function parseFilasConCatalogo(dataRows, cols, headers = null) {
  return (dataRows ?? [])
    .map((row) => {
      let referencia = "";
      let codigo_tipo = "";
      let pieza = "principal";

      if (Array.isArray(row) && cols) {
        referencia = row[cols.iRef] == null ? "" : String(row[cols.iRef]).trim();
        codigo_tipo = row[cols.iCodigo] == null ? "" : String(row[cols.iCodigo]).trim();
        if (cols.iPieza >= 0 && row[cols.iPieza] != null) {
          pieza = String(row[cols.iPieza]).trim().toLowerCase() || "principal";
        }
      } else if (row && typeof row === "object" && headers) {
        const { iRef, iCodigo, iPieza } = cols ?? detectarColumnasPacking(headers);
        const cells = headers.map((h) => row[h]);
        referencia = cells[iRef] == null ? "" : String(cells[iRef]).trim();
        codigo_tipo = cells[iCodigo] == null ? "" : String(cells[iCodigo]).trim();
        if (iPieza >= 0 && cells[iPieza] != null) {
          pieza = String(cells[iPieza]).trim().toLowerCase() || "principal";
        }
      }

      if (pieza !== "complemento") pieza = "principal";
      return { referencia, codigo_tipo, pieza };
    })
    .filter((r) => r.referencia || r.codigo_tipo);
}

/**
 * Parsea texto CSV a resultado validado (modo legacy).
 * @param {string} text
 */
export function parsePackingCsvText(text) {
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => String(h ?? "").trim(),
  });

  if (parsed.errors?.length) {
    const msg = parsed.errors[0]?.message || "Error al leer el CSV";
    return {
      rows: [],
      errors: [msg],
      resumen: { total: 0, ventana: 0, panel: 0 },
      ok: false,
    };
  }

  const fields = (parsed.meta?.fields ?? []).map((f) =>
    String(f ?? "").trim().toLowerCase(),
  );
  if (!fields.includes("referencia") || !fields.includes("tipo")) {
    return {
      rows: [],
      errors: ["Faltan las columnas referencia y tipo."],
      resumen: { total: 0, ventana: 0, panel: 0 },
      ok: false,
    };
  }

  const rows = (parsed.data ?? []).map(pickCampos);
  return validatePackingRows(rows);
}

/**
 * @param {string} text
 * @param {Array<{ codigo: string, pieza?: string }>} catalogo
 */
export function parsePackingCsvTextConCatalogo(text, catalogo) {
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => String(h ?? "").trim(),
  });

  if (parsed.errors?.length) {
    const msg = parsed.errors[0]?.message || "Error al leer el CSV";
    return {
      rows: [],
      errors: [msg],
      resumen: { total: 0, porCodigo: [] },
      ok: false,
    };
  }

  const headers = parsed.meta?.fields ?? [];
  const cols = detectarColumnasPacking(headers);
  if (cols.iRef < 0 || cols.iCodigo < 0) {
    return {
      rows: [],
      errors: ["Faltan las columnas referencia y código (o tipo)."],
      resumen: { total: 0, porCodigo: [] },
      ok: false,
    };
  }

  const filas = parseFilasConCatalogo(parsed.data ?? [], cols, headers);
  return validarFilasCatalogo(filas, catalogo);
}

/**
 * @param {File} file
 * @param {{ catalogo?: Array<{ codigo: string, pieza?: string }> }} [opts]
 */
export async function parsePackingFile(file, opts = {}) {
  const catalogo = opts.catalogo ?? [];
  const conCatalogo = catalogo.length > 0;
  const name = (file?.name || "").toLowerCase();

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const { default: readXlsxFile } = await import("read-excel-file/browser");
    const sheet = await readXlsxFile(file);
    if (!sheet || sheet.length === 0) {
      return conCatalogo
        ? validarFilasCatalogo([], catalogo)
        : validatePackingRows([]);
    }
    const header = (sheet[0] ?? []).map((c) => String(c ?? "").trim());

    if (conCatalogo) {
      const cols = detectarColumnasPacking(header);
      if (cols.iRef < 0 || cols.iCodigo < 0) {
        return {
          rows: [],
          errors: ["Faltan las columnas referencia y código (o tipo)."],
          resumen: { total: 0, porCodigo: [] },
          ok: false,
        };
      }
      const filas = parseFilasConCatalogo(sheet.slice(1), cols);
      return validarFilasCatalogo(filas, catalogo);
    }

    const headerLower = header.map((h) => h.toLowerCase());
    const iRef = headerLower.indexOf("referencia");
    const iTipo = headerLower.indexOf("tipo");
    if (iRef < 0 || iTipo < 0) {
      return {
        rows: [],
        errors: ["Faltan las columnas referencia y tipo."],
        resumen: { total: 0, ventana: 0, panel: 0 },
        ok: false,
      };
    }
    const rows = sheet.slice(1).map((cells) => ({
      referencia: cells[iRef] == null ? "" : String(cells[iRef]).trim(),
      tipo: cells[iTipo] == null ? "" : String(cells[iTipo]).trim().toLowerCase(),
    }));
    const filtered = rows.filter((r) => r.referencia || r.tipo);
    return validatePackingRows(filtered);
  }

  const text = await file.text();
  if (conCatalogo) return parsePackingCsvTextConCatalogo(text, catalogo);
  return parsePackingCsvText(text);
}

/**
 * Genera referencias con prefijo + número incremental (ej. AL-0001 … AL-0025).
 * Con catálogo: pasar codigo_tipo + pieza. Sin catálogo: pasar tipo.
 * @param {{
 *   prefijo?: string,
 *   desde?: number,
 *   cantidad?: number,
 *   digitos?: number,
 *   tipo?: string,
 *   codigo_tipo?: string,
 *   pieza?: string,
 * }} opts
 */
export function generarReferencias({
  prefijo = "AL-",
  desde = 1,
  cantidad = 1,
  digitos = 4,
  tipo = "ventana",
  codigo_tipo,
  pieza = "principal",
} = {}) {
  const start = Math.max(0, Math.floor(Number(desde) || 0));
  const n = Math.max(0, Math.min(99, Math.floor(Number(cantidad) || 0)));
  const pad = Math.max(1, Math.min(8, Math.floor(Number(digitos) || 4)));
  const prefix = String(prefijo ?? "");
  const conCat = Boolean(codigo_tipo);

  const rows = [];
  for (let i = 0; i < n; i += 1) {
    const num = start + i;
    const referencia = `${prefix}${String(num).padStart(pad, "0")}`;
    if (conCat) {
      rows.push({
        referencia,
        codigo_tipo: String(codigo_tipo).trim(),
        pieza: pieza === "complemento" ? "complemento" : "principal",
      });
    } else {
      rows.push({
        referencia,
        tipo: String(tipo || "ventana").trim().toLowerCase(),
      });
    }
  }
  return rows;
}
