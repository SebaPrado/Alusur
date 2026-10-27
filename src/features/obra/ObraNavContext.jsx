import React, { createContext, useContext } from "react";

const ObraNavContext = createContext({
  collapsed: false,
  setCollapsed: () => {},
  toggleNav: null,
});

export function ObraNavProvider({ collapsed, setCollapsed, toggleNav, children }) {
  return (
    <ObraNavContext.Provider value={{ collapsed, setCollapsed, toggleNav }}>
      {children}
    </ObraNavContext.Provider>
  );
}

export function useObraNav() {
  return useContext(ObraNavContext);
}
