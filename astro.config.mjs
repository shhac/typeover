import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import solid from "@astrojs/solid-js";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  /* Canonical origin for absolute URLs (og:image, og:url, sitemap).
   * typeover.paulie.app remains live as a secondary host. */
  site: "https://typeover.dev",
  integrations: [
    solid(),
    /* Auto-emit sitemap.xml at build covering every static + dynamic
     * route Astro knows about. Exclude /design-system — internal
     * dev tool, not a learner-facing page. design-docs/26. */
    sitemap({
      /* Exclude internal dev tools from the crawled index. Both
       * `/design-system` (DS primitive gallery) and `/runtime-smoke`
       * (Yaegi smoke probe) are diagnostics, not learner-facing
       * pages. design-docs/26. */
      filter: (page) => !page.includes("/design-system") && !page.includes("/runtime-smoke"),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
