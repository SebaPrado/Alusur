export const TIPOS = {
  ventana: { label: "Ventana", plural: "Ventanas", corto: "V", color: "#6FB6C6" },
  panel: { label: "Panel", plural: "Paneles", corto: "P", color: "#1E2736" },
};

export const ENTORNOS = {
  mar: { label: "Mar" },
  calle: { label: "Calle" },
  parque: { label: "Parque" },
  nada: { label: "Nada" },
};

export const MODOS = {
  torre: { label: "Torre 3D", detalle: "Cuatro caras" },
  simple: { label: "Fachada simple", detalle: "Una cara" },
};

// Las dos vistas del modo simple: el default es provisional hasta que se elija uno.
export const VISTAS_SIMPLE = {
  plano: { label: "Plano 2D", detalle: "Grilla plana (HTML), sin Three.js." },
  lamina: { label: "Lámina 3D", detalle: "Un plano con módulos en Three.js." },
};

export const MAX_CARAS = 4;

const secuenciaBase = () => ["ventana", "panel"];

const caraBase = (codigo, nombre, entorno) => ({
  codigo,
  nombre,
  modulos_por_piso: 10,
  secuencia: secuenciaBase(),
  entorno,
});

export const carasTorre = () => [
  caraBase("N", "Norte", "nada"),
  caraBase("E", "Este", "nada"),
  caraBase("S", "Sur", "mar"),
  caraBase("O", "Oeste", "nada"),
];

export const carasSimple = () => [caraBase("F", "Frente", "nada")];

export const DEFAULT_CONFIG = {
  nombre: "",
  ubicacion: "",
  modo: "torre",
  vista_simple: "plano",
  piso_desde: 1,
  piso_hasta: 50,
  ancho_modulo_m: 1.6,
  alto_piso_m: 3.3,
  caras: carasTorre(),
};

/** Payload para guardar_fachada (sin nombre/ubicación de la obra). */
export function configParaGuardar(config) {
  return {
    modo: config.modo,
    vista_simple: config.vista_simple,
    piso_desde: config.piso_desde,
    piso_hasta: config.piso_hasta,
    ancho_modulo_m: config.ancho_modulo_m,
    alto_piso_m: config.alto_piso_m,
    caras: config.caras,
  };
}

/** Cambia de modo y deja las caras típicas de ese modo (conserva pisos y medidas). */
export function aplicarModo(config, modo) {
  if (modo === config.modo) return config;
  return {
    ...config,
    modo,
    caras: modo === "simple" ? carasSimple() : carasTorre(),
  };
}

const nombreCara = (cara, i) => (cara.codigo ? cara.codigo : `#${i + 1}`);

export function validateConfig(config) {
  const errores = [];
  const { piso_desde, piso_hasta, modo } = config;
  const caras = config.caras ?? [];

  if (!String(config.nombre ?? "").trim()) {
    errores.push("La obra necesita un nombre.");
  }

  if (!Object.hasOwn(MODOS, modo ?? "")) {
    errores.push("Elegí si la fachada es torre 3D o simple.");
  }

  if (modo === "simple" && !Object.hasOwn(VISTAS_SIMPLE, config.vista_simple ?? "")) {
    errores.push("Elegí la vista del modo simple (plano 2D o lámina 3D).");
  }

  if (!Number.isInteger(piso_desde) || !Number.isInteger(piso_hasta)) {
    errores.push("Los pisos desde y hasta tienen que ser números enteros.");
  } else if (piso_desde > piso_hasta) {
    errores.push(
      `El piso desde (${piso_desde}) no puede ser mayor que el piso hasta (${piso_hasta}).`,
    );
  }

  if (modo === "torre" && caras.length !== 4) {
    errores.push(`El modo torre necesita exactamente 4 caras (hay ${caras.length}).`);
  } else if (modo === "simple" && caras.length !== 1) {
    errores.push(`El modo simple necesita exactamente 1 cara (hay ${caras.length}).`);
  } else if (caras.length > MAX_CARAS) {
    errores.push(`Hay ${caras.length} caras: el máximo es ${MAX_CARAS}.`);
  }

  caras.forEach((cara, i) => {
    if (!cara.codigo || !String(cara.codigo).trim()) {
      errores.push(`La cara ${i + 1} no tiene código.`);
    }
    if (!Number.isInteger(cara.modulos_por_piso) || cara.modulos_por_piso < 1) {
      errores.push(`La cara ${nombreCara(cara, i)} no tiene módulos por piso.`);
    }
    if (!Array.isArray(cara.secuencia) || cara.secuencia.length === 0) {
      errores.push(`La cara ${nombreCara(cara, i)} tiene la secuencia vacía.`);
    }
    if (typeof cara.entorno !== "string" || !Object.hasOwn(ENTORNOS, cara.entorno)) {
      errores.push(
        `La cara ${nombreCara(cara, i)} no tiene un entorno válido (mar, calle, parque o nada).`,
      );
    }
  });

  const vistos = new Set();
  const repetidos = new Set();
  caras.forEach((cara) => {
    if (!cara.codigo) return;
    if (vistos.has(cara.codigo)) repetidos.add(cara.codigo);
    vistos.add(cara.codigo);
  });
  repetidos.forEach((codigo) => {
    errores.push(`El código de cara "${codigo}" está repetido.`);
  });

  return errores;
}

export function buildSlots(config) {
  if (validateConfig(config).length > 0) return [];

  const slots = [];
  for (let piso = config.piso_desde; piso <= config.piso_hasta; piso++) {
    config.caras.forEach((cara, i) => {
      const { secuencia } = cara;
      for (let eje = 1; eje <= cara.modulos_por_piso; eje++) {
        slots.push({
          piso,
          caraCodigo: cara.codigo,
          caraOrden: i + 1,
          eje,
          tipo: secuencia[(eje - 1) % secuencia.length],
        });
      }
    });
  }
  return slots;
}
