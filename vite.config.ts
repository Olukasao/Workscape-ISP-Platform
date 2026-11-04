import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "local-integration-manifest",
      generateBundle(_options, bundle) {
        const chunks = Object.values(bundle)
          .filter((entry) => entry.type === "chunk")
          .map((entry) => ({
            file: entry.fileName,
            modules: Object.keys(entry.modules)
              .filter(
                (id) => id.includes("/src/") && !id.includes("/node_modules/"),
              )
              .map((id) =>
                path.relative(process.cwd(), id).split(path.sep).join("/"),
              ),
          }));
        this.emitFile({
          type: "asset",
          fileName: "local-integration.json",
          source: JSON.stringify(
            { framework: "React", remoteFrontends: false, chunks },
            null,
            2,
          ),
        });
      },
    },
  ],
  base: "./",
  html: process.env.WORKSPACE_CSP_NONCE
    ? { cspNonce: process.env.WORKSPACE_CSP_NONCE }
    : undefined,
  server: { host: "127.0.0.1", port: 5178, strictPort: true },
  build: { sourcemap: false },
});
