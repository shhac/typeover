import { defineConfig } from "astro/config";
import solid from "@astrojs/solid-js";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://typeover.dev",
  integrations: [solid()],
  vite: {
    plugins: [tailwindcss()],
  },
});
