import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Home from "../app/page";
import "../app/globals.css";
import { installOrderEnhancements } from "./order-enhancements";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("A gyökérelem nem található.");
}

createRoot(rootElement).render(
  <StrictMode>
    <Home />
  </StrictMode>,
);

installOrderEnhancements();
