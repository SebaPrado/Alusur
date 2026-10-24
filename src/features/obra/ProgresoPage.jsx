import { Navigate } from "react-router-dom";
import { Box, Button } from "@mui/material";
import { useObra } from "../../obras/ObraProvider";
import { ProgresoProvider, useProgreso } from "../progreso/useProgresoData.jsx";
import RecorridoDrawer from "../progreso/RecorridoDrawer";
import SectionTabs from "./SectionTabs";

const TABS = [
  { path: "torre", label: "Torre 3D", iconSrc: "/progress.png" },
  { path: "pisos", label: "Por piso", iconSrc: "/piso.png" },
  { path: "seguimiento", label: "Seguimiento", iconSrc: "/seguimiento.png" },
];

/** Progreso: visible para todos (Owner en solo lectura). */
function Actualizar() {
  const { reload, loading } = useProgreso();
  return (
    <Button onClick={reload} disabled={loading} sx={{ color: "text.secondary", minWidth: 0, px: 1 }}>
      Actualizar
    </Button>
  );
}

export default function ProgresoPage() {
  const { obraId, obra, ready, known } = useObra();

  if (!ready) {
    return <Box sx={{ color: "text.secondary", p: 2 }}>Cargando…</Box>;
  }

  if (!known) {
    return <Navigate to="/obras" replace />;
  }

  return (
    <ProgresoProvider obraId={obraId} obraNombre={obra?.nombre}>
      <SectionTabs
        base={`/obra/${obraId}/progreso`}
        tabs={TABS}
        maxWidth={false}
        fillHeight
        noPadPaths={["torre"]}
        headerEnd={<Actualizar />}
      />
      <RecorridoDrawer />
    </ProgresoProvider>
  );
}
