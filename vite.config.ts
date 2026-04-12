import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        admin: resolve(__dirname, "autofilm-admin.html"),
        app: resolve(__dirname, "autofilm-app.html"),
        command: resolve(__dirname, "autofilm-command.html"),
        landing: resolve(__dirname, "autofilm-landing.html"),
        pitch: resolve(__dirname, "autofilm-pitch.html"),
        player: resolve(__dirname, "autofilm-player.html"),
        trade: resolve(__dirname, "hartecash-trade.html"),
      },
    },
  },
  publicDir: false,
});