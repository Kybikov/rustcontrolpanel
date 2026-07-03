import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("lucide-react")) return "vendor-icons";
          if (id.includes("recharts") || id.includes("victory-vendor") || id.includes("react-smooth") || id.includes("react-is") || id.includes("\\d3-") || id.includes("/d3-")) return "vendor-charts";
          if (id.includes("react-dom") || id.includes("react-router-dom") || id.includes("@remix-run") || id.includes("scheduler") || id.includes("react")) return "vendor-react";
          if (id.includes("@tanstack")) return "vendor-query";
          return "vendor";
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
