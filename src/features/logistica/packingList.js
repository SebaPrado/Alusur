import Papa from "papaparse";
import { MODULO_TIPOS } from "./estados";

const TIPOS_OK = new Set(MODULO_TIPOS);

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
 * Valida filas ya normalizadas.
 * @param {Array<{ referencia: string, tipo: string }>} rows
 * @returns {{ rows: Array<{ referencia: string, tipo: string, error?: string }>, errors: string[], resumen: { total: number, ventana: number, panel: number }, ok: boolean }}
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
 * Parsea texto CSV a resultado validado.
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
 * @param {File} file
 */
export async function parsePackingFile(file) {
  const name = (file?.name || "").toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const { default: readXlsxFile } = await import("read-excel-file/browser");
    const sheet = await readXlsxFile(file);
    if (!sheet || sheet.length === 0) {
      return validatePackingRows([]);
    }
    const header = (sheet[0] ?? []).map((c) =>
      String(c ?? "").trim().toLowerCase(),
    );
    const iRef = header.indexOf("referencia");
    const iTipo = header.indexOf("tipo");
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
    // omitir filas totalmente vacías
    const filtered = rows.filter((r) => r.referencia || r.tipo);
    return validatePackingRows(filtered);
  }

  const text = await file.text();
  return parsePackingCsvText(text);
}

/**
 * Genera referencias con prefijo + número incremental (ej. AL-0001 … AL-0025).
 * @param {{
 *   prefijo?: string,
 *   desde?: number,
 *   cantidad?: number,
 *   digitos?: number,
 *   tipo?: string,
 * }} opts
 * @returns {Array<{ referencia: string, tipo: string }>}
 */
export function generarReferencias({
  prefijo = "AL-",
  desde = 1,
  cantidad = 1,
  digitos = 4,
  tipo = "ventana",
} = {}) {
  const start = Math.max(0, Math.floor(Number(desde) || 0));
  const n = Math.max(0, Math.min(99, Math.floor(Number(cantidad) || 0)));
  const pad = Math.max(1, Math.min(8, Math.floor(Number(digitos) || 4)));
  const t = String(tipo || "ventana").trim().toLowerCase();
  const prefix = String(prefijo ?? "");

  const rows = [];
  for (let i = 0; i < n; i += 1) {
    const num = start + i;
    rows.push({
      referencia: `${prefix}${String(num).padStart(pad, "0")}`,
      tipo: t,
    });
  }
  return rows;
}
