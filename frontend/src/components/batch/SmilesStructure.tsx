import React, { useLayoutEffect, useRef, useId, useState, useEffect } from 'react';
import { Drawer } from 'smiles-drawer';

interface SmilesStructureProps {
  smiles: string;
  width?: number;
  height?: number;
}

const SmilesStructure: React.FC<SmilesStructureProps> = ({ smiles, width = 150, height = 100 }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const uniqueId = useId();
  const [isReadyToDraw, setIsReadyToDraw] = useState(false);
  const [currentSmiles, setCurrentSmiles] = useState(''); // To track if SMILES changed for the drawing effect

  // Phase 1: Ensure SVG is in DOM, clear it, and set ready flag.
  useLayoutEffect(() => {
    // console.log(`[SmilesStructure P1] LayoutEffect for SMILES: ${smiles}, ID: ${uniqueId}`);
    setCurrentSmiles(smiles); // Update currentSmiles for the drawing effect

    if (svgRef.current && svgRef.current.isConnected) {
      // console.log('[SmilesStructure P1] SVG available, clearing and setting ready.');
      // Clear previous content from the SVG element
      while (svgRef.current.firstChild) {
        svgRef.current.removeChild(svgRef.current.firstChild);
      }
      setIsReadyToDraw(true);
    } else {
      // console.log('[SmilesStructure P1] SVG not available or not connected.');
      setIsReadyToDraw(false); // Not ready if SVG not there
    }

    return () => {
      // console.log(`[SmilesStructure P1 Cleanup] Resetting ready state for SMILES: ${smiles}`);
      setIsReadyToDraw(false); // Reset ready state on unmount or when inputs change
    };
  // Rerun this layout effect if smiles, width, height, or uniqueId changes.
  // uniqueId is stable for a component instance but included for completeness if it were dynamic.
  }, [smiles, width, height, uniqueId]);

  // Phase 2: Attempt to draw when the ready flag is set by the layout effect.
  useEffect(() => {
    // console.log(`[SmilesStructure P2] Draw Effect triggered. isReadyToDraw: ${isReadyToDraw}, currentSmiles: ${currentSmiles}`);
    if (isReadyToDraw && svgRef.current && svgRef.current.isConnected && currentSmiles) {
      // console.log('[SmilesStructure P2] Conditions met. Attempting to draw SMILES:', currentSmiles, 'on SVG:', svgRef.current);
      try {
        const drawer = new Drawer({
          width: width,
          height: height,
        });
      
        drawer.draw(currentSmiles, svgRef.current, 'light', (err: unknown) => {
          if (err) {
            console.error('[SmilesStructure P2] Error during SMILES drawing callback:', currentSmiles, err);
          } else {
            // console.log('[SmilesStructure P2] Successfully drawn (or draw callback without error):', currentSmiles);
          }
        });
      } catch (e) {
        console.error('[SmilesStructure P2] Error instantiating or calling drawer.draw:', currentSmiles, e);
      }
    } else if (isReadyToDraw) {
      // console.warn('[SmilesStructure P2] Was ready to draw, but other conditions not met. SMILES:', currentSmiles, 'SVG Ref:', svgRef.current, 'Connected:', svgRef.current?.isConnected);
    }
  // This effect depends on the readiness flag, the actual SMILES string to draw, and drawer dimensions.
  }, [isReadyToDraw, currentSmiles, width, height]);

  // The old drawing logic from the single useLayoutEffect is now split into the two effects above.

  return <svg id={uniqueId} ref={svgRef} style={{ width: width, height: height }} aria-label={`Molecular structure for ${smiles}`} />;
};

export default SmilesStructure;
