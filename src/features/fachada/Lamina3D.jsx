import React, { useEffect, useRef, useState } from "react";
import { Box } from "@mui/material";
import { FiEye, FiEyeOff } from "react-icons/fi";
import * as THREE from "three";
import { TIPOS, validateConfig } from "./buildSlots";

THREE.ColorManagement.enabled = false;

const UI = {
  ground: "#0E1117",
  card: "#1E2736",
  ink: "#F2F4F7",
  muted: "#A9B3C1",
  line: "#2E3A4E",
  accent: "#249596",
};

const COLOR_ESTADO_BASE = "#6E7F96";
const COLOR = {
  ventana: new THREE.Color(TIPOS.ventana.color),
  panel: new THREE.Color(TIPOS.panel.color),
  white: new THREE.Color("#fff"),
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const slotKey = (s) => `${s.piso}|${s.caraOrden}|${s.eje}`;

const AYUDA =
  "Arrastrá para mover · Rueda para acercar · Doble clic para enfocar un módulo";

function avisoDe(config) {
  if ((config?.caras?.length ?? 0) !== 1) return "La lámina necesita exactamente 1 cara.";
  return validateConfig(config)[0] ?? null;
}

function colorOf(world, item, mode, out) {
  if (mode === "estado") {
    out.set(item.slot.color ?? COLOR_ESTADO_BASE);
    if (item.slot.tipo !== "ventana") out.multiplyScalar(0.72);
  } else {
    out.copy(COLOR[item.slot.tipo] ?? COLOR.panel);
  }
  if (item === world.hovered) out.lerp(COLOR.white, 0.4);
  return out;
}

const tmpColor = new THREE.Color();

function paintItem(world, item, mode) {
  item.mesh.setColorAt(item.inst, colorOf(world, item, mode, tmpColor));
  item.mesh.instanceColor.needsUpdate = true;
}

function paintAll(world, mode) {
  world.items.forEach((item) => item.mesh.setColorAt(item.inst, colorOf(world, item, mode, tmpColor)));
  world.meshes.forEach((mesh) => {
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });
}

function makeLabelSprite(txt, { fill = UI.ink, bg = "rgba(14,17,23,.72)", w = 64, h = 64 } = {}) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const g = cv.getContext("2d");
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = fill;
  let size = Math.floor(h * 0.55);
  do {
    g.font = `800 ${size}px Montserrat, sans-serif`;
    size -= 2;
  } while (g.measureText(txt).width > w * 0.85 && size > 10);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(txt, w / 2, h / 2 + 1);
  const map = new THREE.CanvasTexture(cv);
  map.colorSpace = THREE.NoColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map, transparent: true, depthTest: true, depthWrite: false }),
  );
  return sprite;
}

function buildWorld(config, slots) {
  const cara = config.caras[0];
  const MW = config.ancho_modulo_m;
  const FH = config.alto_piso_m;
  const { piso_desde, piso_hasta } = config;
  const W = cara.modulos_por_piso * MW;
  const baseH = Math.max(0, piso_desde) * FH;
  const activeH = (piso_hasta - piso_desde + 1) * FH;
  const H = baseH + activeH;
  // Más margen alrededor: la cámara arranca más lejos para ver espacio libre.
  const maxDist = Math.max(50, Math.max(W, H) * 2.8);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0e1117, maxDist * 1.2, maxDist * 2.4);
  scene.add(new THREE.HemisphereLight(0xcfe2ff, 0x0e1117, 0.85 * Math.PI));
  const sun = new THREE.DirectionalLight(0xffffff, 0.95 * Math.PI);
  sun.position.set(40, 80, 120);
  scene.add(sun);

  if (baseH > 0) {
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(W + 0.2, baseH, 0.18),
      new THREE.MeshStandardMaterial({
        color: 0x1a222e,
        roughness: 1,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      }),
    );
    base.position.set(0, baseH / 2, -0.15);
    scene.add(base);
  }

  const back = new THREE.Mesh(
    new THREE.BoxGeometry(W + 0.4, activeH + 0.4, 0.2),
    new THREE.MeshStandardMaterial({ color: 0x07090c, roughness: 1 }),
  );
  back.position.set(0, baseH + activeH / 2, -0.2);
  scene.add(back);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.max(80, W * 4), Math.max(80, W * 4)),
    new THREE.MeshStandardMaterial({ color: 0x10141b, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const dummy = new THREE.Object3D();
  const items = [];
  slots.forEach((slot) => {
    if (slot.caraOrden !== 1) return;
    if (slot.eje < 1 || slot.eje > cara.modulos_por_piso) return;
    if (slot.piso < piso_desde || slot.piso > piso_hasta) return;
    const x = -(cara.modulos_por_piso * MW) / 2 + (slot.eje - 0.5) * MW;
    const y = slot.piso * FH + FH / 2;
    dummy.position.set(x, y, 0.12);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    items.push({ slot, faceIdx: 0, matrix: dummy.matrix.clone(), pos: dummy.position.clone() });
  });

  const geo = new THREE.BoxGeometry(MW - 0.08, FH - 0.1, 0.24);
  const groups = [
    {
      items: items.filter((it) => it.slot.tipo === "ventana"),
      material: () =>
        new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.45, roughness: 0.22 }),
    },
    {
      items: items.filter((it) => it.slot.tipo !== "ventana"),
      material: () =>
        new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.7 }),
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

  const labels = new THREE.Group();
  labels.name = "etiquetas";
  for (let piso = piso_desde; piso <= piso_hasta; piso++) {
    const num = makeLabelSprite(String(piso), {
      fill: UI.muted,
      bg: "rgba(14,17,23,.55)",
      w: 96,
      h: 64,
    });
    num.position.set(-(W / 2) - MW * 0.55, piso * FH + FH / 2, 0.25);
    num.scale.set(MW * 0.7, FH * 0.45, 1);
    labels.add(num);
  }
  items.forEach((item) => {
    const corto = TIPOS[item.slot.tipo]?.corto ?? "?";
    const tag = makeLabelSprite(corto, {
      fill: item.slot.tipo === "ventana" ? UI.ground : UI.ink,
      bg: item.slot.tipo === "ventana" ? "rgba(111,182,198,.85)" : "rgba(30,39,54,.85)",
      w: 64,
      h: 64,
    });
    tag.position.set(item.pos.x, item.pos.y, item.pos.z + 0.2);
    tag.scale.set(MW * 0.42, FH * 0.32, 1);
    labels.add(tag);
  });
  scene.add(labels);

  return {
    scene,
    items,
    meshes,
    selBox,
    labels,
    caras: config.caras,
    H,
    W,
    maxDist,
    hovered: null,
    selected: null,
  };
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

export default function Lamina3D({ config, slots, mode = "material", onSelect }) {
  const stageRef = useRef(null);
  const hostRef = useRef(null);
  const tipRef = useRef(null);
  const engineRef = useRef(null);
  const worldRef = useRef(null);
  const modeRef = useRef(mode);
  const onSelectRef = useRef(onSelect);
  const [ayudaAbierta, setAyudaAbierta] = useState(false);
  const [etiquetasVisibles, setEtiquetasVisibles] = useState(true);
  const etiquetasRef = useRef(true);

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
    const canvas = renderer.domElement;
    canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:none;cursor:grab";
    canvas.setAttribute(
      "aria-label",
      "Lámina 3D de la fachada. Hacé clic en un módulo para ver su piso y eje.",
    );
    host.appendChild(canvas);

    const camera = new THREE.PerspectiveCamera(35, 1, 0.5, 2000);
    const cam = { x: 0, y: 40, dist: 60 };
    const goal = { ...cam };
    const limits = { H: 80, W: 40, maxDist: 120 };
    const engine = { cam, goal, limits, camInit: false, selectedKey: null };
    engineRef.current = engine;

    function updateCamera() {
      for (const k in cam) cam[k] += (goal[k] - cam[k]) * 0.16;
      camera.position.set(cam.x, cam.y, cam.dist);
      camera.lookAt(cam.x, cam.y, 0);
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
        if (prev) paintItem(world, prev, modeRef.current);
        if (item) paintItem(world, item, modeRef.current);
      }
      if (item && world) {
        const { slot } = item;
        const estado = modeRef.current === "estado";
        const dot = document.createElement("span");
        dot.style.cssText = "display:inline-block;width:9px;height:9px;margin-right:6px";
        dot.style.background = estado
          ? (slot.color ?? COLOR_ESTADO_BASE)
          : (TIPOS[slot.tipo]?.color ?? TIPOS.panel.color);
        const detalle = estado
          ? (slot.estado ?? "Sin estado")
          : (TIPOS[slot.tipo]?.label ?? slot.tipo);
        const cara = world.caras[0];
        tip.replaceChildren(
          dot,
          `Piso ${slot.piso} · ${cara?.nombre || slot.caraCodigo} · Eje ${slot.eje} — ${detalle}`,
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
      goal.x = item.pos.x;
      goal.y = item.pos.y;
      goal.dist = Math.max(12, Math.min(engine.limits.maxDist, 28));
    }

    engine.select = select;
    engine.setHover = setHover;

    const ptrs = new Map();
    let down = null;
    let pinch = null;
    const onPointerDown = (e) => {
      canvas.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) down = { lx: e.clientX, ly: e.clientY, moved: 0 };
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) };
        down = null;
      }
    };
    const onPointerMove = (e) => {
      if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        goal.dist = clamp((goal.dist * pinch.d) / d, 8, limits.maxDist);
        pinch = { d };
        return;
      }
      if (down) {
        const dx = e.clientX - down.lx;
        const dy = e.clientY - down.ly;
        down.lx = e.clientX;
        down.ly = e.clientY;
        down.moved += Math.abs(dx) + Math.abs(dy);
        const k = goal.dist * 0.0025;
        goal.x = clamp(goal.x - dx * k, -limits.W, limits.W);
        goal.y = clamp(goal.y + dy * k, 0, limits.H);
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
      goal.dist = clamp(goal.dist * Math.exp(e.deltaY * 0.0012), 8, limits.maxDist);
    };
    const onDblClick = (e) => {
      const item = pick(e.clientX, e.clientY);
      if (item) {
        select(item);
        focus(item);
      }
    };
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
    world.labels.visible = etiquetasRef.current;
    engine.limits.H = world.H;
    engine.limits.W = world.W / 2 + 4;
    engine.limits.maxDist = world.maxDist;

    if (!engine.camInit) {
      Object.assign(engine.cam, { x: 0, y: world.H * 0.5, dist: world.maxDist * 0.78 });
      Object.assign(engine.goal, engine.cam);
      engine.camInit = true;
    } else {
      engine.goal.y = clamp(engine.goal.y, 0, world.H);
      engine.goal.x = clamp(engine.goal.x, -engine.limits.W, engine.limits.W);
      engine.goal.dist = clamp(engine.goal.dist, 8, world.maxDist);
    }

    paintAll(world, modeRef.current);
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
    modeRef.current = mode;
    const world = worldRef.current;
    if (world) paintAll(world, mode);
  }, [mode]);

  useEffect(() => {
    etiquetasRef.current = etiquetasVisibles;
    if (worldRef.current?.labels) worldRef.current.labels.visible = etiquetasVisibles;
  }, [etiquetasVisibles]);

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
      }}
    >
      <Box ref={hostRef} sx={{ position: "absolute", inset: 0 }} />

      {!aviso && (
        <Box
          component="button"
          type="button"
          title={etiquetasVisibles ? "Ocultar pisos y V/P" : "Mostrar pisos y V/P"}
          aria-pressed={etiquetasVisibles}
          aria-label={etiquetasVisibles ? "Ocultar etiquetas" : "Mostrar etiquetas"}
          onClick={() => setEtiquetasVisibles((v) => !v)}
          sx={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 2,
            width: 32,
            height: 32,
            p: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: `1px solid ${etiquetasVisibles ? UI.accent : UI.line}`,
            bgcolor: "rgba(14,17,23,.75)",
            color: etiquetasVisibles ? UI.accent : UI.muted,
            cursor: "pointer",
            "&:hover": { borderColor: UI.accent, color: UI.accent },
          }}
        >
          {etiquetasVisibles ? <FiEye size={16} aria-hidden /> : <FiEyeOff size={16} aria-hidden />}
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
          <Box role="status" sx={{ flex: 1, minWidth: 0, fontSize: 11, color: UI.muted, opacity: 0.85 }}>
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
            }}
          >
            <Box sx={{ fontWeight: 800, mb: 0.5 }}>No se puede dibujar la lámina</Box>
            <Box sx={{ color: UI.muted }}>{aviso}</Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}
