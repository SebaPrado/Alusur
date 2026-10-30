import React from "react";
import { Navigate } from "react-router-dom";
import { Box } from "@mui/material";
import { useObra } from "../../obras/ObraProvider";
import { controlTotalEnObra } from "../../obras/accesoObra";
import SectionTabs from "./SectionTabs";
import SinAcceso from "./SinAcceso";

const TABS = [
  { path: "contenedores", label: "Contenedores", iconSrc: "/contenedor.png" },
  { path: "recepciones", label: "Recepciones", iconSrc: "/recepciones.png" },
];

/** Logística: todos menos Owner. Quien tiene control total en la obra puede entrar. */
export default function LogisticaPage() {
  const { obraId, mi_rol, ready, known } = useObra();

  if (!ready) {
    return <Box sx={{ color: "text.secondary", p: 2 }}>Cargando…</Box>;
  }

  if (!known) {
    return <Navigate to="/obras" replace />;
  }

  if (!controlTotalEnObra(mi_rol) && mi_rol === "owner") {
    return <SinAcceso />;
  }

  return (
    <SectionTabs
      base={`/construccion/obra/${obraId}/logistica`}
      tabs={TABS}
      maxWidth={1200}
    />
  );
}
