// frontend/src/utils/initRDKit.ts
import initModule from "@rdkit/rdkit";
import type { RDKitModule } from '@/components/batch/SmilesStructure';

/*  tiny wrapper that memo-caches the compiled module */
export const loadRDKit = (() => {
  let modPromise: Promise<RDKitModule> | null = null;

  return () => {
    if (modPromise) return modPromise;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    modPromise = (initModule as any)({
      // ^ Cast to any to bypass TypeScript's strict signature check for the default export
      // Emscripten callback – receive requested filename, return actual URL
      locateFile: (file: string, scriptDirectory: string) => {
        // console.log(`[RDKit locateFile] file: ${file}, scriptDirectory: ${scriptDirectory}`);
        if (file.endsWith(".wasm")) {
          // Vite copies the wasm to /assets and this URL should resolve it.
          // The path "@rdkit/rdkit/RDKit_minimal.wasm" points to the file within the package.
          // Vite's asset handling should process this to the final fingerprinted asset path.
          return new URL("@rdkit/rdkit/RDKit_minimal.wasm", import.meta.url).href;
        }
        return file;
      },
    }) as Promise<RDKitModule>; // Cast to ensure type compatibility with our RDKitModule interface

    return modPromise;
  };
})();