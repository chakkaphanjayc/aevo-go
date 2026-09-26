import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { AppProviders } from "@/app/providers";
import { router } from "@/app/router";
import { registerServiceWorker } from "@/lib/service-worker";
import "@/styles/index.css";

const root = document.getElementById("root");
if (!root) throw new Error("Aevo Go root element is missing");

createRoot(root).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>
);

registerServiceWorker();
