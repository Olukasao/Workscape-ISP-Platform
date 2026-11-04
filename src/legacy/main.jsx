import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { applyThemeToDocument, applyWorldCupThemeToDocument, readStoredTheme, readStoredWorldCupTheme } from "./utils/theme";
import "./index.css";

// Incrementar FORCE_LOGOUT_VERSION desloga todos os usuários no próximo carregamento.
const FORCE_LOGOUT_VERSION = "2026-10-10-intro-video";
try {
  if (localStorage.getItem("forceLogoutVersion") !== FORCE_LOGOUT_VERSION) {
    sessionStorage.removeItem("token");
      window.dispatchEvent(new Event('workspace:logout'));
    sessionStorage.removeItem("user");
    localStorage.setItem("forceLogoutVersion", FORCE_LOGOUT_VERSION);
  }
} catch {
  // localStorage indisponível
}

applyThemeToDocument(readStoredTheme());
applyWorldCupThemeToDocument(readStoredWorldCupTheme());

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
