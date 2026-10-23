import React, { createContext, useContext, useState } from "react";
import { createPortal } from "react-dom";

const PageActionsContext = createContext(null);

/** Slot de acciones a la derecha del encabezado de 44 px (pestañas o título). */
export function PageActionsProvider({ children }) {
  const [slotEl, setSlotEl] = useState(null);

  return (
    <PageActionsContext.Provider value={{ slotEl, setSlotEl }}>
      {children}
    </PageActionsContext.Provider>
  );
}

/** Contenedor vacío en el encabezado; las acciones se montan aquí vía portal. */
export function PageActionsSlot() {
  const ctx = useContext(PageActionsContext);
  if (!ctx) return null;
  return (
    <div
      ref={ctx.setSlotEl}
      style={{ display: "flex", alignItems: "center", gap: 8 }}
    />
  );
}

/**
 * Monta hijos en el slot del encabezado mientras esté montado.
 * Uso: <PageActions><Button>…</Button></PageActions>
 */
export function PageActions({ children }) {
  const ctx = useContext(PageActionsContext);
  if (!ctx?.slotEl) return null;
  return createPortal(children, ctx.slotEl);
}
