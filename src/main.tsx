import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DispatcherWorkspace } from "@/components/dispatcher-workspace";
import "@/app/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DispatcherWorkspace />
  </StrictMode>,
);
