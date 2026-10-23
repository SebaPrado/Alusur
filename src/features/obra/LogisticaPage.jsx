import React from "react";
import { Navigate } from "react-router-dom";
import { Box } from "@mui/material";
import { useAuth } from "../../auth/AuthProvider";
import { useObra } from "../../obras/ObraProvider";
import SectionTabs from "./SectionTabs";
import SinAcceso from "./SinAcceso";

const TABS = [
  { path: "contenedores", label: "Contenedores" },
  { path: "recepciones", label: "Recepciones" },
];

/** Logística: todos menos Owner. CEO puede entrar. */
export default function LogisticaPage() {
  const { isCeo } = useAuth();
  const { obraId, mi_rol, ready, known } = useObra();

  if (!ready) {
    return <Box sx={{ color: "text.secondary", p: 2 }}>Cargando…</Box>;
  }

  if (!known) {
    return <Navigate to="/obras" replace />;
  }

  if (!isCeo && mi_rol === "owner") {
    return <SinAcceso />;
  }

  return (
    <SectionTabs
      base={`/obra/${obraId}/logistica`}
      tabs={TABS}
      maxWidth={1200}
    />
  );
}
