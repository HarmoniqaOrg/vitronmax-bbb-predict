/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import wasm from "vite-plugin-wasm";
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { componentTagger } from "lovable-tagger";
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    nodePolyfills(),
    wasm(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/@rdkit/rdkit/dist/RDKit_minimal.wasm',
          dest: 'assets'
        }
      ]
    }),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: false, 
  },
}));
