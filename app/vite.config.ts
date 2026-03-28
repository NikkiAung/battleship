import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // stub out @phala/dcap-qvl — node-only dep pulled in by the
      // ephemeral-rollups-sdk barrel export (access-control/verify.js)
      "@phala/dcap-qvl": path.resolve(__dirname, "src/stubs/phala-dcap-qvl.js"),
    },
  },
  optimizeDeps: {
    include: ["buffer"],
  },
});
