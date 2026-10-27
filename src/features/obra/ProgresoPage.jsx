import { Navigate } from "react-router-dom";
import { Box, IconButton } from "@mui/material";
import { FiRefreshCw } from "react-icons/fi";
import { useObra } from "../../obras/ObraProvider";
import { ProgresoProvider, useProgreso } from "../progreso/useProgresoData.jsx";
import RecorridoDrawer from "../progreso/RecorridoDrawer";
import SectionTabs from "./SectionTabs";

const TABS = [
  { path: "torre", label: "3D", iconSrc: "/progress.png" },
  { path: "pisos", label: "Por piso", iconSrc: "/piso.png" },
  { path: "seguimiento", label: "Avance", iconSrc: "/seguimiento.png" },
];

/** Progreso: visible para todos (Owner en solo lectura). */
function HeaderEnd() {
  const { reload, loading } = useProgreso();

  return (
    <IconButton
      size="small"
      aria-label="Actualizar"
      onClick={reload}
      disabled={loading}
      sx={{ color: "text.secondary", borderRadius: 0 }}
    >
      <FiRefreshCw size={16} />
    </IconButton>
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
        base={`/construccion/obra/${obraId}/progreso`}
        tabs={TABS}
        maxWidth={false}
        fillHeight
        noPadPaths={["torre"]}
        headerEnd={<HeaderEnd />}
      />
      <RecorridoDrawer />
    </ProgresoProvider>
  );
}
