import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { AuthProvider } from "./auth/AuthProvider";
import { OrganizacionProvider } from "./org/OrganizacionProvider";
import { MisObrasProvider } from "./obras/MisObrasProvider";
import { theme } from "./theme";
import App from "./App.jsx";
import "./App.css";

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <OrganizacionProvider>
            <MisObrasProvider>
              <App />
            </MisObrasProvider>
          </OrganizacionProvider>
        </AuthProvider>
      </ThemeProvider>
    </StrictMode>,
  );
} else {
  console.error("No se encontró el elemento raíz");
}
