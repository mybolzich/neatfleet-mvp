import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { NeatFleetApp } from "@/components/neatfleet-app";
import "@/app/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <NeatFleetApp />
  </StrictMode>,
);
