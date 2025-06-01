// frontend/src/utils/initRDKit.ts
import initModule from "@rdkit/rdkit";
import type { RDKitModule } from '@/components/batch/SmilesStructure';
import rdkitWasmUrl from '@rdkit/rdkit/RDKit_minimal.wasm?url';

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
          // Use the URL provided by Vite's ?url import
          return rdkitWasmUrl;
        }
        return file;
      },
    }) as Promise<RDKitModule>; // Cast to ensure type compatibility with our RDKitModule interface

    return modPromise;
  };
})();