import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { defineConfig } from "vite";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  publicDir: false,
  build: {
    outDir: "public",
    emptyOutDir: false,
    lib: {
      entry: resolve(rootDir, "src/sdk/DodoCheckout.ts"),
      name: "__DodoCheckoutBundle",
      formats: ["iife"],
      fileName: () => "dodo-checkout.js",
    },
    rollupOptions: {
      output: { exports: "named" },
    },
  },
});
