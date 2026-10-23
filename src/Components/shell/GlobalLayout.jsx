import React from "react";
import { Outlet } from "react-router-dom";
import { Alert, Box } from "@mui/material";
import { useAuth } from "../../auth/AuthProvider";
import TopBar, { BAR_HEIGHT } from "./TopBar";

/** Layout sin menú lateral: `/obras`, `/sin-obras`. */
export default function GlobalLayout() {
  const { loadError } = useAuth();

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <TopBar />
      <Box
        component="main"
        sx={{
          pt: `${BAR_HEIGHT}px`,
          minHeight: "100vh",
        }}
      >
        {loadError && (
          <Alert severity="error" sx={{ m: 2 }}>
            No se pudo cargar el perfil: {loadError}
          </Alert>
        )}
        <Outlet />
      </Box>
    </Box>
  );
}
