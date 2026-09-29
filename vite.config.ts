import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_API_BASE_URL?.trim() || "http://localhost:4000";
  const tunnelRequested = ["1", "true", "yes", "on"].includes((env.AEVO_DEV_TUNNEL ?? env.VITE_DEV_TUNNEL)?.trim().toLowerCase() ?? "");
  const tunnelAutoStart = ["1", "true", "yes", "on"].includes(env.AEVO_DEV_TUNNEL_AUTOSTART?.trim().toLowerCase() ?? "");
  const accountsTarget = env.VITE_ACCOUNTS_URL?.trim() || "http://localhost:8787";

  return {
    plugins: [
      react(),
      tailwindcss(),
      cloudflare({
        tunnel: tunnelRequested ? (tunnelAutoStart ? { autoStart: true } : true) : false
      })
    ],
    define: {
      "import.meta.env.VITE_DEV_TUNNEL": JSON.stringify(tunnelRequested ? "1" : "0")
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url))
      }
    },
    optimizeDeps: {
      // MapLibre creates a module worker from its package-local worker file.
      // Keeping the package out of esbuild's dependency optimizer lets Vite
      // resolve that worker URL without losing the emitted module in dev.
      exclude: ["maplibre-gl"]
    },
    server: {
      proxy: {
        "/health": { target: apiTarget, changeOrigin: true },
        "/ready": { target: apiTarget, changeOrigin: true },
        "/api": { target: apiTarget, changeOrigin: true, secure: false },
        "/accounts": {
          target: accountsTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/accounts/, "")
        }
      }
    },
    preview: {
      proxy: {
        "/health": { target: apiTarget, changeOrigin: true },
        "/ready": { target: apiTarget, changeOrigin: true },
        "/api": { target: apiTarget, changeOrigin: true, secure: false },
        "/accounts": {
          target: accountsTarget,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/accounts/, "")
        }
      }
    },
    build: {
      sourcemap: mode !== "production"
    }
  };
});
