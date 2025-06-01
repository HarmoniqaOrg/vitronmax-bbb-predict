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
          // Assume vite-plugin-wasm places the Wasm file (e.g., RDKit_minimal.wasm or a version of it)
          // in the /assets/ directory. The 'file' argument will be 'RDKit_minimal.wasm'.
          return `/assets/${file}`;
        }
        // Fallback for other files, though RDKit primarily requests the .wasm file.
        // scriptDirectory is the path to the directory where the JS file is.
        return scriptDirectory + file;
      },
    }) as Promise<RDKitModule>; // Cast to ensure type compatibility with our RDKitModule interface

    return modPromise;
  };
})();