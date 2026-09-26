import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.aevocado.go",
  appName: "Aevocado Go",
  webDir: "dist",
  server: {
    androidScheme: "https"
  }
};

export default config;
