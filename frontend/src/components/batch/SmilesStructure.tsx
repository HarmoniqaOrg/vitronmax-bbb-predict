import React, { useLayoutEffect, useRef } from 'react';
import { Drawer } from 'smiles-drawer';

interface SmilesStructureProps {
  smiles: string;
  width?: number;
  height?: number;
}

const SmilesStructure: React.FC<SmilesStructureProps> = ({ smiles, width = 150, height = 100 }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useLayoutEffect(() => {
    const currentSvgElement = svgRef.current;

    // Check if the element is valid, has a SMILES string, and is connected to the DOM
    if (currentSvgElement && smiles && typeof currentSvgElement.isConnected === 'boolean' && currentSvgElement.isConnected) {
      let animationFrameId: number;
      const timeoutId = setTimeout(() => {
        animationFrameId = requestAnimationFrame(() => {
          // Double-check ref still current and connected in case of rapid unmount or changes
          if (svgRef.current && svgRef.current.isConnected) {
            console.log('[SmilesStructure] Attempting to draw SMILES:', smiles);
            console.log('[SmilesStructure] Target SVG element:', svgRef.current);
            console.log('[SmilesStructure] Is connected:', svgRef.current?.isConnected);
            console.log('[SmilesStructure] SVG content before draw:', svgRef.current?.innerHTML);

            // Clear previous content just before drawing to ensure a clean slate for smiles-drawer
            // This is re-added as it's safer than assuming smiles-drawer clears appropriately in all cases.
            while (svgRef.current.firstChild) {
              svgRef.current.removeChild(svgRef.current.firstChild);
            }

            try {
              const drawer = new Drawer({
                width: width,
                height: height,
              });
            
              drawer.draw(smiles, svgRef.current, 'light', (err: unknown) => {
                if (err) {
                  console.error('[SmilesStructure] Error during SMILES drawing callback:', smiles, err);
                  if (svgRef.current) { 
                    // Placeholder for error
                  }
                }
              });
            } catch (e) {
              console.error('[SmilesStructure] Error instantiating or calling drawer.draw:', smiles, e);
            }
          }
        });
      }, 0); // setTimeout with 0ms delay

      // Cleanup function for useLayoutEffect
      return () => {
        clearTimeout(timeoutId);
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
      };
    }
  }, [smiles, width, height]);

  return <svg ref={svgRef} style={{ width: width, height: height }} aria-label={`Molecular structure for ${smiles}`} />;
};

export default SmilesStructure;
