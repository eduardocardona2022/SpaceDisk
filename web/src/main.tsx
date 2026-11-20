import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { I18nProvider } from "./i18n";
import { ToastProvider } from "./components/Toast";
import "./styles.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(
  <React.StrictMode>
    <I18nProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </I18nProvider>
  </React.StrictMode>
);
