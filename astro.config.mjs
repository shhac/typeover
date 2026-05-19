import { defineConfig } from "astro/config";
import solid from "@astrojs/solid-js";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  /* Canonical origin for absolute URLs (og:image, og:url, sitemap).
   * Currently the Vercel preview deploy; flips to https://typeover.dev
   * when the domain is claimed (design-docs/07 pre-launch checklist). */
  site: "https://typeover.paulie.app",
  integrations: [solid()],
  vite: {
    plugins: [tailwindcss()],
  },
});
