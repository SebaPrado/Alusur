import React, { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

function Root() {
  useEffect(() => {
    const mainContainer = document.querySelector('.main-container');
    
    const handleScroll = () => {
      if (window.scrollY > 0) {
        mainContainer.classList.add('scrolled');
      } else {
        mainContainer.classList.remove('scrolled');
      }
    };

    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <StrictMode>
      <App />
    </StrictMode>
  );
}

const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(<Root />);
} else {
  console.error("No se encontró el elemento raíz");
}