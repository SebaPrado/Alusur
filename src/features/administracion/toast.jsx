import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { Alert, Snackbar } from "@mui/material";

const ToastContext = createContext(null);

export function AdminToastProvider({ children }) {
  const [state, setState] = useState({
    open: false,
    message: "",
    severity: "error",
  });

  const showError = useCallback((message) => {
    setState({ open: true, message: String(message || "Error"), severity: "error" });
  }, []);

  const showSuccess = useCallback((message) => {
    setState({
      open: true,
      message: String(message || "Listo"),
      severity: "success",
    });
  }, []);

  const showInfo = useCallback((message) => {
    setState({
      open: true,
      message: String(message || ""),
      severity: "info",
    });
  }, []);

  const handleClose = useCallback((_, reason) => {
    if (reason === "clickaway") return;
    setState((s) => ({ ...s, open: false }));
  }, []);

  const value = useMemo(
    () => ({ showError, showSuccess, showInfo }),
    [showError, showSuccess, showInfo],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Snackbar
        open={state.open}
        autoHideDuration={6000}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={handleClose}
          severity={state.severity}
          variant="filled"
          sx={{ width: "100%", borderRadius: 0 }}
        >
          {state.message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}

export function useAdminToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useAdminToast debe usarse dentro de AdminToastProvider");
  return ctx;
}
