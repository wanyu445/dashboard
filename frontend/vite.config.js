import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const devPort = Number(process.env.CYBERBOSS_DASHBOARD_FRONTEND_PORT) || 5173;
const backendPort = Number(process.env.CYBERBOSS_DASHBOARD_PORT) || 3000;

export default defineConfig({
  plugins: [vue()],
  server: {
    host: "0.0.0.0",
    port: devPort,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${backendPort}`,
        changeOrigin: true,
      },
      "/timeline-site": {
        target: `http://127.0.0.1:${backendPort}`,
        changeOrigin: true,
      },
    },
  },
});
