import React, { useEffect, useRef, useState } from "react";
import { Box } from "@mui/material";
import * as THREE from "three";
import { ENTORNOS, TIPOS, validateConfig } from "./buildSlots";
import { medidasDesdeSlots } from "./slotsDesdeTorre";

// La maqueta usa r128, sin gestión de color: los hex se toman como lineales y la salida no se convierte.
THREE.ColorManagement.enabled = false;

const UI = {
  ground: "#0E1117",
  card: "#1E2736",
  ink: "#F2F4F7",
  muted: "#A9B3C1",
  line: "#2E3A4E",
  accent: "#249596",
};

const FACE_THETA = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
// Altura de la torre de la maqueta (50 pisos de 3,3 m): distancias de cámara y niebla escalan desde ahí.
const MAQUETA_ALTO = 165;
// Cada entorno se arma frente a la cara en posición 2 (z negativo) y se rota hacia su cara.
const ROTACION_ENTORNO = [Math.PI, -Math.PI / 2, 0, Math.PI / 2];
const MAQUETA_SEMIANCHO = 8;
// Distancias desde la cara hacia afuera. La arena de la maqueta empieza a 22 m de la cara.
const ARENA_DESDE = 30 - MAQUETA_SEMIANCHO;
const LARGO_ENTORNO = 700;
// Cardinales a ~8 m; calle/parque arrancan más afuera para no pisarlos.
const LABEL_DIST = 8;
const ENTORNO_DESDE = 18;
const CALLE = {
  vereda: [ENTORNO_DESDE, ENTORNO_DESDE + 3],
  calzada: [ENTORNO_DESDE + 3, ENTORNO_DESDE + 15],
  veredaLejana: [ENTORNO_DESDE + 15, ENTORNO_DESDE + 18],
};
const PARQUE_FONDO = [ENTORNO_DESDE, ENTORNO_DESDE + 60];
// Alturas separadas para que las capas planas no parpadeen al alejarse.
const ALTURA = { cesped: 0.1, sendero: 0.16, vereda: 0.22, calzada: 0.3, linea: 0.36 };

const COLOR_ESTADO_BASE = "#6E7F96";
const COLOR_DIM = {
  ventana: "#1C232D",
  panel: "#12161D",
};
const COLOR = {
  ventana: new THREE.Color(TIPOS.ventana.color),
  panel: new THREE.Color(TIPOS.panel.color),
  white: new THREE.Color("#fff"),
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const slotKey = (s) => `${s.piso}|${s.caraOrden}|${s.eje}`;

function rng(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function avisoDe(config) {
  const n = config?.caras?.length ?? 0;
  if (n !== 4) return `La torre necesita exactamente 4 caras (hay ${n}).`;
  return validateConfig(config)[0] ?? null;
}

function colorOf(world, item, view, out) {
  const { mode, pisoFiltro, estadoFiltro } = view;
  const fuera =
    (pisoFiltro != null && item.slot.piso !== pisoFiltro) ||
    (estadoFiltro != null && item.slot.estadoVisual !== estadoFiltro);
  if (fuera) {
    out.set(item.slot.tipo === "ventana" ? COLOR_DIM.ventana : COLOR_DIM.panel);
  } else if (mode === "estado") {
    out.set(item.slot.color ?? COLOR_ESTADO_BASE);
    if (item.slot.tipo !== "ventana") out.multiplyScalar(0.72);
  } else {
    out.copy(COLOR[item.slot.tipo] ?? COLOR.panel);
  }
  if (item === world.hovered) out.lerp(COLOR.white, 0.4);
  return out;
}

const tmpColor = new THREE.Color();

function paintItem(world, item, view) {
  item.mesh.setColorAt(item.inst, colorOf(world, item, view, tmpColor));
  item.mesh.instanceColor.needsUpdate = true;
}

function paintAll(world, view) {
  world.items.forEach((item) => item.mesh.setColorAt(item.inst, colorOf(world, item, view, tmpColor)));
  world.meshes.forEach((mesh) => {
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });
}

// Baldosa plana en el piso (mira hacia arriba).
function labelBaldosa(txt) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const g = cv.getContext("2d");
  g.fillStyle = UI.accent;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = UI.ground;
  let fontSize = 72;
  do {
    g.font = `800 ${fontSize}px Montserrat, sans-serif`;
    fontSize -= 4;
  } while (g.measureText(txt).width > 100 && fontSize > 16);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(txt, 64, 70);
  const map = new THREE.CanvasTexture(cv);
  map.colorSpace = THREE.NoColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(5.5, 5.5),
    new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

function franja(h, [s0, s1], [t0, t1], y, material) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(s1 - s0, t1 - t0), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set((s0 + s1) / 2, y, -(h + (t0 + t1) / 2));
  return mesh;
}

// Plano a 45° por la esquina de la torre: deja solo la parte que queda frente a esta cara.
function planoDiagonal(h, w, lado, rot) {
  const plano = new THREE.Plane(new THREE.Vector3(-lado, 0, -1).normalize(), (w - h) / Math.SQRT2);
  return plano.applyMatrix4(new THREE.Matrix4().makeRotationY(rot));
}

function buildMar(semiancho, clippingPlanes) {
  const group = new THREE.Group();
  const d = semiancho - MAQUETA_SEMIANCHO;
  const rand = rng(20261021);
  const pts = [];
  for (let x = 700; x >= -700; x -= 14) {
    const k = Math.round((x + 700) / 14);
    pts.push([x, d + 60 + (k % 2 ? 9 : 0) + rand() * 4]);
  }
  const sh = new THREE.Shape();
  sh.moveTo(-700, d + 30);
  sh.lineTo(700, d + 30);
  pts.forEach((p) => sh.lineTo(p[0], p[1]));
  sh.closePath();
  const sand = new THREE.Mesh(
    new THREE.ShapeGeometry(sh),
    new THREE.MeshStandardMaterial({ color: 0x423d33, roughness: 1, clippingPlanes }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.y = 0.45;
  group.add(sand);
  const foam = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p[0], 0.5, -p[1]))),
    new THREE.LineBasicMaterial({ color: 0x7c8a92, clippingPlanes }),
  );
  group.add(foam);
  // Recortado en diagonal, el mar tiene que ser más ancho para llegar hasta el fondo de su lado.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(clippingPlanes.length ? 4000 : 1400, 800),
    new THREE.MeshStandardMaterial({ color: 0x1a2f3d, roughness: 0.95, metalness: 0, clippingPlanes }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.35, -(d + 55 + 400));
  group.add(sea);
  return group;
}

function buildCalle(h, w, lados) {
  const group = new THREE.Group();
  const hasta = (lado) => (lado === "mar" ? w + ARENA_DESDE - 2 : LARGO_ENTORNO);
  const largo = [-hasta(lados.izq), hasta(lados.der)];
  const vereda = new THREE.MeshStandardMaterial({ color: 0x262d38, roughness: 1 });
  group.add(franja(h, largo, CALLE.vereda, ALTURA.vereda, vereda));
  group.add(franja(h, largo, CALLE.veredaLejana, ALTURA.vereda, vereda));
  group.add(
    franja(
      h,
      largo,
      CALLE.calzada,
      ALTURA.calzada,
      new THREE.MeshStandardMaterial({ color: 0x171b22, roughness: 1 }),
    ),
  );

  // La línea del medio se corta donde se cruza con la calle de una cara vecina.
  const enCruce = (s) =>
    [
      [lados.der, s],
      [lados.izq, -s],
    ].some(
      ([lado, v]) => lado === "calle" && v > w + CALLE.calzada[0] - 2 && v < w + CALLE.calzada[1] + 2,
    );
  const centros = [];
  for (let s = largo[0] + 2; s <= largo[1] - 2; s += 7) if (!enCruce(s)) centros.push(s);
  const lineas = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(3, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x8b97a8, roughness: 1 }),
    centros.length,
  );
  const tMedio = (CALLE.calzada[0] + CALLE.calzada[1]) / 2;
  const acostada = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
  const m = new THREE.Matrix4();
  centros.forEach((s, k) => {
    lineas.setMatrixAt(k, m.makeTranslation(s, ALTURA.linea, -(h + tMedio)).multiply(acostada));
  });
  group.add(lineas);
  return group;
}

function buildParque(h, w, lados, semilla) {
  const group = new THREE.Group();
  const hasta = (lado) => w + (lado === "mar" ? ARENA_DESDE - 2 : PARQUE_FONDO[1]);
  const ancho = [-hasta(lados.izq), hasta(lados.der)];
  group.add(
    franja(
      h,
      ancho,
      PARQUE_FONDO,
      ALTURA.cesped,
      new THREE.MeshStandardMaterial({ color: 0x1b2e23, roughness: 1 }),
    ),
  );
  group.add(
    franja(
      h,
      [-1.5, 1.5],
      PARQUE_FONDO,
      ALTURA.sendero,
      new THREE.MeshStandardMaterial({ color: 0x2c3036, roughness: 1 }),
    ),
  );

  const libre = (s, t) => {
    if (Math.abs(s) < 4) return false;
    return [
      [lados.der, s - w],
      [lados.izq, -s - w],
    ].every(([lado, fuera]) => {
      if (lado === "calle") return fuera < CALLE.vereda[0] - 2 || fuera > CALLE.veredaLejana[1] + 2;
      // Pasando la diagonal de la esquina, los árboles los pone el parque vecino.
      if (lado === "parque") return fuera <= t;
      return true;
    });
  };
  const rand = rng(semilla);
  const arboles = [];
  for (let s = ancho[0] + 3; s <= ancho[1] - 3; s += 6.5) {
    for (let t = PARQUE_FONDO[0] + 4; t <= PARQUE_FONDO[1] - 3; t += 6.5) {
      const arbol = {
        s: s + (rand() - 0.5) * 4,
        t: t + (rand() - 0.5) * 4,
        escala: 0.75 + rand() * 0.6,
        giro: rand() * Math.PI * 2,
      };
      if (rand() >= 0.3 && libre(arbol.s, arbol.t)) arboles.push(arbol);
    }
  }

  const tronco = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.22, 0.3, 2.4, 6),
    new THREE.MeshStandardMaterial({ color: 0x3b3029, roughness: 1 }),
    arboles.length,
  );
  const copa = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(2, 0),
    new THREE.MeshStandardMaterial({ color: 0x2a4d36, roughness: 0.9 }),
    arboles.length,
  );
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const giro = new THREE.Quaternion();
  const escala = new THREE.Vector3();
  const vertical = new THREE.Vector3(0, 1, 0);
  arboles.forEach((a, k) => {
    giro.setFromAxisAngle(vertical, a.giro);
    escala.setScalar(a.escala);
    pos.set(a.s, ALTURA.cesped + 1.2 * a.escala, -(h + a.t));
    tronco.setMatrixAt(k, m.compose(pos, giro, escala));
    pos.y = ALTURA.cesped + 3.6 * a.escala;
    copa.setMatrixAt(k, m.compose(pos, giro, escala));
  });
  group.add(tronco, copa);
  return group;
}

function buildEntorno(i, caras, W, D) {
  const h = i % 2 === 0 ? D / 2 : W / 2;
  const w = i % 2 === 0 ? W / 2 : D / 2;
  // Ya rotado, el lado +x del armado da a la cara anterior (en el orden N, E, S, O) y el -x a la siguiente.
  const lados = { der: caras[(i + 3) % 4].entorno, izq: caras[(i + 1) % 4].entorno };
  const rot = ROTACION_ENTORNO[i];
  let group;
  if (caras[i].entorno === "mar") {
    const planos = [];
    if (lados.der === "mar") planos.push(planoDiagonal(h, w, 1, rot));
    if (lados.izq === "mar") planos.push(planoDiagonal(h, w, -1, rot));
    group = buildMar(h, planos);
  } else if (caras[i].entorno === "calle") {
    group = buildCalle(h, w, lados);
  } else if (caras[i].entorno === "parque") {
    group = buildParque(h, w, lados, 7919 * (i + 1));
  } else {
    return null;
  }
  group.rotation.y = rot;
  return group;
}

function buildWorld(config, slots) {
  const { caras } = config;
  const MW = config.ancho_modulo_m;
  const FH = config.alto_piso_m;
  const { anchos, pisoMin, pisoMax } = medidasDesdeSlots(slots, caras);
  const colsNS = Math.max(anchos[0] ?? 0, anchos[2] ?? 0);
  const colsEO = Math.max(anchos[1] ?? 0, anchos[3] ?? 0);
  const W = colsNS * MW;
  const D = colsEO * MW;
  // Pisos por debajo del mínimo presente: zócalo semiopaco para que la sección no flote.
  const pisoDesde = pisoMin ?? config.piso_desde;
  const pisoHasta = pisoMax ?? config.piso_hasta;
  const baseH = Math.max(0, pisoDesde) * FH;
  const activeH = (pisoHasta - pisoDesde + 1) * FH;
  const H = baseH + activeH;
  const escala = Math.max(1, H / MAQUETA_ALTO);
  const maxDist = 450 * escala;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0e1117, 450 * escala, 900 * escala);
  // Desde r155 las intensidades no se multiplican por π internamente: se compensa para igualar r128.
  scene.add(new THREE.HemisphereLight(0xcfe2ff, 0x0e1117, 0.85 * Math.PI));
  const sun = new THREE.DirectionalLight(0xffffff, 0.95 * Math.PI);
  sun.position.set(120, 260, 160);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x88aacc, 0.35 * Math.PI);
  fill.position.set(-150, 80, -120);
  scene.add(fill);

  if (baseH > 0) {
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x1a222e,
      roughness: 1,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    });
    const base = new THREE.Mesh(new THREE.BoxGeometry(W - 0.4, baseH, D - 0.4), baseMat);
    base.position.y = baseH / 2;
    scene.add(base);
    const baseEdgeGeo = new THREE.BoxGeometry(W - 0.35, baseH, D - 0.35);
    const baseEdge = new THREE.LineSegments(
      new THREE.EdgesGeometry(baseEdgeGeo),
      new THREE.LineBasicMaterial({ color: 0x3a4658, transparent: true, opacity: 0.55 }),
    );
    baseEdgeGeo.dispose();
    baseEdge.position.y = baseH / 2;
    scene.add(baseEdge);
  }

  const core = new THREE.Mesh(
    new THREE.BoxGeometry(W - 0.2, activeH, D - 0.2),
    new THREE.MeshStandardMaterial({ color: 0x07090c, roughness: 1 }),
  );
  core.position.y = baseH + activeH / 2;
  scene.add(core);
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(W + 0.6, 1.2, D + 0.6),
    new THREE.MeshStandardMaterial({ color: 0x2a3446, roughness: 0.8 }),
  );
  roof.position.y = baseH + activeH + 0.6;
  scene.add(roof);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1400),
    new THREE.MeshStandardMaterial({ color: 0x10141b, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const grid = new THREE.GridHelper(400, 40, 0x26303f, 0x1a212c);
  grid.position.y = 0.02;
  scene.add(grid);

  caras.forEach((_, i) => {
    const entorno = buildEntorno(i, caras, W, D);
    if (entorno) scene.add(entorno);
  });

  // Baldosas en el piso frente a cada cara; rotation.z orienta la letra para leerse desde afuera.
  [
    { pos: [0, 0.05, D / 2 + LABEL_DIST], yaw: Math.PI },
    { pos: [W / 2 + LABEL_DIST, 0.05, 0], yaw: Math.PI / 2 },
    { pos: [0, 0.05, -D / 2 - LABEL_DIST], yaw: 0 },
    { pos: [-W / 2 - LABEL_DIST, 0.05, 0], yaw: -Math.PI / 2 },
  ].forEach((p, i) => {
    const tile = labelBaldosa(String(caras[i].codigo));
    tile.position.set(...p.pos);
    tile.rotation.z = p.yaw;
    scene.add(tile);
  });

  const offZ = D / 2 + 0.12;
  const offX = W / 2 + 0.12;
  const dummy = new THREE.Object3D();
  const items = [];
  slots.forEach((slot) => {
    const faceIdx = slot.caraOrden - 1;
    const cara = caras[faceIdx];
    const nEjes = anchos[faceIdx];
    if (!cara || nEjes == null || slot.eje < 1) return;
    const u = -(nEjes * MW) / 2 + (slot.eje - 0.5) * MW;
    const y = slot.piso * FH + FH / 2;
    if (faceIdx === 0) {
      dummy.position.set(u, y, offZ);
      dummy.rotation.set(0, 0, 0);
    } else if (faceIdx === 1) {
      dummy.position.set(offX, y, -u);
      dummy.rotation.set(0, Math.PI / 2, 0);
    } else if (faceIdx === 2) {
      dummy.position.set(-u, y, -offZ);
      dummy.rotation.set(0, Math.PI, 0);
    } else {
      dummy.position.set(-offX, y, u);
      dummy.rotation.set(0, -Math.PI / 2, 0);
    }
    dummy.updateMatrix();
    items.push({ slot, faceIdx, matrix: dummy.matrix.clone(), pos: dummy.position.clone() });
  });

  const geo = new THREE.BoxGeometry(MW - 0.08, FH - 0.1, 0.24);
  const groups = [
    {
      items: items.filter((it) => it.slot.tipo === "ventana"),
      material: () => new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.45, roughness: 0.22 }),
    },
    {
      items: items.filter((it) => it.slot.tipo !== "ventana"),
      material: () => new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.7 }),
    },
  ];
  const meshes = [];
  groups.forEach((group) => {
    if (group.items.length === 0) return;
    const mesh = new THREE.InstancedMesh(geo, group.material(), group.items.length);
    group.items.forEach((item, i) => {
      mesh.setMatrixAt(i, item.matrix);
      item.mesh = mesh;
      item.inst = i;
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.userData.items = group.items;
    meshes.push(mesh);
    scene.add(mesh);
  });
  if (meshes.length === 0) geo.dispose();

  const selBase = new THREE.BoxGeometry(MW + 0.15, FH + 0.12, 0.5);
  const selBox = new THREE.LineSegments(
    new THREE.EdgesGeometry(selBase),
    new THREE.LineBasicMaterial({ color: 0xffffff }),
  );
  selBase.dispose();
  selBox.visible = false;
  selBox.matrixAutoUpdate = false;
  scene.add(selBox);

  return { scene, items, meshes, selBox, caras, H, maxDist, hovered: null, selected: null };
}

function disposeScene(scene) {
  const geometries = new Set();
  const materials = new Set();
  scene.traverse((obj) => {
    if (obj.geometry && !obj.isSprite) geometries.add(obj.geometry);
    if (obj.material) [].concat(obj.material).forEach((m) => materials.add(m));
    if (obj.isInstancedMesh) obj.dispose();
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => {
    if (m.map) m.map.dispose();
    m.dispose();
  });
}

const AYUDA =
  "Arrastrá para girar · Rueda para acercar · Clic derecho o Shift + arrastre para subir/bajar · Doble clic para enfocar";

export default function Torre3D({
  config,
  slots,
  mode = "material",
  onSelect,
  pisoFiltro = null,
  estadoFiltro = null,
  seleccion,
  enfocar = 0,
}) {
  const stageRef = useRef(null);
  const hostRef = useRef(null);
  const tipRef = useRef(null);
  const engineRef = useRef(null);
  const worldRef = useRef(null);
  const viewRef = useRef({ mode, pisoFiltro, estadoFiltro });
  const onSelectRef = useRef(onSelect);
  const [ayudaAbierta, setAyudaAbierta] = useState(false);
  viewRef.current = { mode, pisoFiltro, estadoFiltro };

  const aviso = avisoDe(config);

  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  useEffect(() => {
    const stage = stageRef.current;
    const host = hostRef.current;
    const tip = tipRef.current;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x0e1117);
    renderer.localClippingEnabled = true;
    const canvas = renderer.domElement;
    canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:none;cursor:grab";
    canvas.setAttribute(
      "aria-label",
      "Modelo 3D de la torre. Hacé clic en un módulo para ver su piso, cara y eje.",
    );
    host.appendChild(canvas);

    const camera = new THREE.PerspectiveCamera(35, 1, 1, 2000);
    const cam = { theta: 0.65, phi: 1.42, dist: 340, ty: 82.5 };
    const goal = { ...cam };
    const limits = { H: 165, maxDist: 450 };
    const engine = { cam, goal, limits, camInit: false, selectedKey: null };
    engineRef.current = engine;

    function updateCamera() {
      for (const k in cam) cam[k] += (goal[k] - cam[k]) * 0.16;
      camera.position.set(
        cam.dist * Math.sin(cam.phi) * Math.sin(cam.theta),
        cam.ty + cam.dist * Math.cos(cam.phi),
        cam.dist * Math.sin(cam.phi) * Math.cos(cam.theta),
      );
      camera.lookAt(0, cam.ty, 0);
    }
    function faceTheta(fi) {
      let t = FACE_THETA[fi];
      while (t - goal.theta > Math.PI) t -= 2 * Math.PI;
      while (t - goal.theta < -Math.PI) t += 2 * Math.PI;
      return t;
    }

    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    function pick(x, y) {
      const world = worldRef.current;
      if (!world) return null;
      const r = canvas.getBoundingClientRect();
      ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(world.meshes, false)[0];
      if (!hit) return null;
      return hit.object.userData.items[hit.instanceId];
    }

    function setHover(item, x, y) {
      const world = worldRef.current;
      if (world && item !== world.hovered) {
        const prev = world.hovered;
        world.hovered = item;
        if (prev) paintItem(world, prev, viewRef.current);
        if (item) paintItem(world, item, viewRef.current);
      }
      if (item && world) {
        const { slot } = item;
        const estado = viewRef.current.mode === "estado";
        const dot = document.createElement("span");
        dot.style.cssText = "display:inline-block;width:9px;height:9px;margin-right:6px";
        dot.style.background = estado
          ? (slot.color ?? COLOR_ESTADO_BASE)
          : (TIPOS[slot.tipo]?.color ?? TIPOS.panel.color);
        const detalle = estado ? (slot.estado ?? "Sin estado") : (TIPOS[slot.tipo]?.label ?? slot.tipo);
        const cara = world.caras[item.faceIdx];
        const codigo = slot.codigo ? ` · ${slot.codigo}` : "";
        tip.replaceChildren(
          dot,
          `Piso ${slot.piso} · ${cara?.nombre || slot.caraCodigo} · Eje ${slot.eje}${codigo} — ${detalle}`,
        );
        const r = stage.getBoundingClientRect();
        tip.style.left = `${x - r.left}px`;
        tip.style.top = `${y - r.top}px`;
        tip.style.display = "block";
        canvas.style.cursor = "pointer";
      } else {
        tip.style.display = "none";
        canvas.style.cursor = "grab";
      }
    }

    function select(item) {
      const world = worldRef.current;
      if (world) {
        world.selected = item;
        if (item) world.selBox.matrix.copy(item.matrix);
        world.selBox.visible = Boolean(item);
      }
      engine.selectedKey = item ? slotKey(item.slot) : null;
      onSelectRef.current?.(item ? item.slot : null);
    }

    function focus(item) {
      goal.ty = item.pos.y;
      goal.dist = 48;
      goal.phi = 1.45;
      goal.theta = faceTheta(item.faceIdx);
    }

    engine.select = select;
    engine.setHover = setHover;
    engine.viewFace = (fi) => {
      goal.theta = faceTheta(fi);
      goal.phi = 1.3;
    };
    engine.focus = focus;
    engine.focusPiso = (piso) => {
      const world = worldRef.current;
      const item = world?.items.find((it) => it.slot.piso === piso);
      if (!item) return;
      goal.ty = item.pos.y;
      goal.dist = Math.min(95, limits.maxDist);
      goal.phi = 1.38;
    };

    const ptrs = new Map();
    let down = null;
    let pinch = null;
    const onContextMenu = (e) => e.preventDefault();
    const onPointerDown = (e) => {
      canvas.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) {
        down = { lx: e.clientX, ly: e.clientY, pan: e.button === 2 || e.shiftKey, moved: 0 };
      }
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), my: (a.y + b.y) / 2 };
        down = null;
      }
    };
    const onPointerMove = (e) => {
      if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const my = (a.y + b.y) / 2;
        goal.dist = clamp((goal.dist * pinch.d) / d, 22, limits.maxDist);
        goal.ty = clamp(goal.ty + (my - pinch.my) * goal.dist * 0.003, 0, limits.H);
        pinch = { d, my };
        return;
      }
      if (down) {
        const dx = e.clientX - down.lx;
        const dy = e.clientY - down.ly;
        down.lx = e.clientX;
        down.ly = e.clientY;
        down.moved += Math.abs(dx) + Math.abs(dy);
        if (down.pan) {
          goal.ty = clamp(goal.ty + dy * goal.dist * 0.0028, 0, limits.H);
        } else {
          goal.theta -= dx * 0.006;
          goal.phi = clamp(goal.phi - dy * 0.004, 0.25, 1.5);
        }
        setHover(null);
        canvas.style.cursor = "grabbing";
        return;
      }
      if (e.pointerType === "mouse") setHover(pick(e.clientX, e.clientY), e.clientX, e.clientY);
    };
    const onPointerEnd = (e) => {
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (down && ptrs.size === 0) {
        if (down.moved < 6) select(pick(e.clientX, e.clientY));
        down = null;
        canvas.style.cursor = "grab";
      }
    };
    const onPointerLeave = () => {
      if (!down) setHover(null);
    };
    const onWheel = (e) => {
      e.preventDefault();
      goal.dist = clamp(goal.dist * Math.exp(e.deltaY * 0.0012), 22, limits.maxDist);
    };
    const onDblClick = (e) => {
      const item = pick(e.clientX, e.clientY);
      if (item) {
        select(item);
        focus(item);
      }
    };
    canvas.addEventListener("contextmenu", onContextMenu);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerEnd);
    canvas.addEventListener("pointercancel", onPointerEnd);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("dblclick", onDblClick);

    function resize() {
      const r = host.getBoundingClientRect();
      if (!r.width || !r.height) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(r.width, r.height, false);
      camera.aspect = r.width / r.height;
      camera.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const world = worldRef.current;
      if (!world) {
        renderer.clear();
        return;
      }
      updateCamera();
      renderer.render(world.scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("contextmenu", onContextMenu);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerEnd);
      canvas.removeEventListener("pointercancel", onPointerEnd);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("dblclick", onDblClick);
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      tip.style.display = "none";
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return undefined;

    if (avisoDe(config)) {
      worldRef.current = null;
      engine.setHover(null);
      if (engine.selectedKey) engine.select(null);
      return undefined;
    }

    const world = buildWorld(config, slots);
    worldRef.current = world;

    engine.limits.H = world.H;
    engine.limits.maxDist = world.maxDist;
    if (!engine.camInit) {
      Object.assign(engine.cam, {
        theta: 0.65,
        phi: 1.42,
        dist: 340 * Math.max(1, world.H / MAQUETA_ALTO),
        ty: world.H * 0.5,
      });
      Object.assign(engine.goal, engine.cam);
      engine.camInit = true;
    } else {
      engine.goal.ty = clamp(engine.goal.ty, 0, world.H);
      engine.goal.dist = clamp(engine.goal.dist, 22, world.maxDist);
    }

    paintAll(world, viewRef.current);

    if (engine.selectedKey) {
      engine.select(world.items.find((it) => slotKey(it.slot) === engine.selectedKey) ?? null);
    }

    return () => {
      if (worldRef.current === world) worldRef.current = null;
      engineRef.current?.setHover(null);
      disposeScene(world.scene);
    };
  }, [config, slots]);

  useEffect(() => {
    viewRef.current = { mode, pisoFiltro, estadoFiltro };
    const world = worldRef.current;
    if (world) paintAll(world, viewRef.current);
  }, [mode, pisoFiltro, estadoFiltro]);

  useEffect(() => {
    const engine = engineRef.current;
    const world = worldRef.current;
    if (!engine || !world || seleccion === undefined) return;
    if (!seleccion) {
      if (engine.selectedKey) engine.select(null);
      return;
    }
    const item = world.items.find(
      (it) =>
        it.slot.piso === seleccion.piso &&
        it.slot.caraCodigo === seleccion.caraCodigo &&
        it.slot.eje === seleccion.eje,
    );
    if (!item) return;
    const key = slotKey(item.slot);
    if (engine.selectedKey !== key) engine.select(item);
    if (enfocar && engine.lastFocus !== enfocar) {
      engine.lastFocus = enfocar;
      engine.focus(item);
    }
  }, [seleccion, enfocar, slots]);

  const enfocarPrevio = useRef(enfocar);
  useEffect(() => {
    const enfocarCambio = enfocarPrevio.current !== enfocar;
    enfocarPrevio.current = enfocar;
    if (pisoFiltro == null) return;
    if (enfocarCambio && seleccion) return;
    engineRef.current?.focusPiso(pisoFiltro);
  }, [pisoFiltro, slots, seleccion, enfocar]);

  return (
    <Box
      ref={stageRef}
      sx={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 320,
        bgcolor: UI.ground,
        overflow: "hidden",
        userSelect: "none",
        borderRadius: 0,
      }}
    >
      <Box ref={hostRef} sx={{ position: "absolute", inset: 0 }} />

      {!aviso && (
        <Box
          aria-label="Ver cara"
          sx={{ position: "absolute", right: 16, top: 16, display: "flex", gap: "6px" }}
        >
          {config.caras.map((cara, i) => (
            <Box
              component="button"
              type="button"
              key={i}
              title={`Cara ${cara.nombre} (${(ENTORNOS[cara.entorno]?.label ?? "nada").toLowerCase()})`}
              onClick={() => engineRef.current?.viewFace(i)}
              sx={{
                minWidth: 34,
                height: 34,
                px: "6px",
                border: `1px solid ${UI.line}`,
                borderRadius: 0,
                bgcolor: "rgba(14,17,23,.7)",
                color: UI.ink,
                font: "inherit",
                fontSize: 13,
                fontWeight: 800,
                cursor: "pointer",
                "&:hover": { borderColor: UI.accent },
              }}
            >
              {cara.codigo}
            </Box>
          ))}
        </Box>
      )}

      <Box
        sx={{
          position: "absolute",
          left: 16,
          right: 16,
          bottom: 14,
          display: "flex",
          alignItems: "flex-end",
          gap: 1,
          pointerEvents: "none",
        }}
      >
        <Box
          component="button"
          type="button"
          aria-label={ayudaAbierta ? "Cerrar ayuda de controles" : "Ayuda de controles"}
          aria-expanded={ayudaAbierta}
          onClick={() => setAyudaAbierta((v) => !v)}
          sx={{
            width: 22,
            height: 22,
            flexShrink: 0,
            p: 0,
            border: `1px solid ${UI.muted}`,
            borderRadius: "50%",
            bgcolor: "rgba(14,17,23,.7)",
            color: UI.muted,
            font: "inherit",
            fontSize: 12,
            fontWeight: 700,
            fontStyle: "italic",
            lineHeight: 1,
            cursor: "pointer",
            pointerEvents: "auto",
            opacity: 0.85,
            "&:hover": { borderColor: UI.accent, color: UI.accent, opacity: 1 },
          }}
        >
          i
        </Box>
        {ayudaAbierta && (
          <Box
            role="status"
            sx={{
              flex: 1,
              minWidth: 0,
              fontSize: 11,
              color: UI.muted,
              opacity: 0.85,
              lineHeight: 1.35,
            }}
          >
            {AYUDA}
          </Box>
        )}
      </Box>

      <Box
        ref={tipRef}
        sx={{
          position: "absolute",
          display: "none",
          pointerEvents: "none",
          px: "10px",
          py: "6px",
          bgcolor: UI.ink,
          color: UI.ground,
          fontSize: 13,
          fontWeight: 600,
          whiteSpace: "nowrap",
          transform: "translate(14px,14px)",
          boxShadow: "0 4px 14px rgba(0,0,0,.4)",
          borderRadius: 0,
        }}
      />

      {aviso && (
        <Box
          role="status"
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            p: 3,
          }}
        >
          <Box
            sx={{
              maxWidth: 420,
              p: 2,
              bgcolor: UI.card,
              borderLeft: `4px solid ${UI.accent}`,
              color: UI.ink,
              fontSize: 14,
              borderRadius: 0,
            }}
          >
            <Box sx={{ fontWeight: 800, mb: 0.5 }}>No se puede dibujar la torre</Box>
            <Box sx={{ color: UI.muted }}>{aviso}</Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}
