import path from "node:path";
import { defineConfig } from "vitest/config";

// "server-only" lança incondicionalmente quando importado fora do build do
// Next.js (o alias real é feito pelo webpack do Next). Sem este alias,
// nenhum módulo de lib/ que importa "server-only" pode ser testado por
// vitest — ver test/stubs/server-only.ts.
export default defineConfig({
  resolve: {
    alias: {
      "server-only": path.resolve(__dirname, "test/stubs/server-only.ts"),
      "@": __dirname,
    },
  },
});
