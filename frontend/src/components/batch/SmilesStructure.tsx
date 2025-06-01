import React, { useLayoutEffect, useRef, useId, useState, useEffect } from 'react';
import { Drawer } from 'smiles-drawer';

interface SmilesStructureProps {
  smiles: string;
  width?: number;
  height?: number;
}

const SmilesStructure: React.FC<SmilesStructureProps> = ({ smiles, width = 150, height = 100 }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const uniqueId = useId(); // Used for the SVG id attribute
  const [drawError, setDrawError] = useState<boolean>(false);

  useLayoutEffect(() => {
    setDrawError(false); // Reset error state on new SMILES or dimension change
    // console.log(`[SmilesStructure] Effect for SMILES: ${smiles}, ID: ${uniqueId}`);

    if (!svgRef.current || !svgRef.current.isConnected || !smiles) {
      // console.log('[SmilesStructure] SVG ref not available, not connected, or no SMILES. Aborting.');
      if (svgRef.current) {
        svgRef.current.innerHTML = ''; // Clear if no SMILES to draw or SVG is unmounted
      }
      return;
    }

    const svgElement = svgRef.current;

    // Always clear and re-draw on prop changes (smiles, width, height)
    svgElement.innerHTML = ''; // Clear SVG content before any drawing attempt

    try {
      // console.log(`[SmilesStructure] Creating new Drawer and drawing SMILES: ${smiles}`);
      const drawer = new Drawer({
        width: width,
        height: height,
      });

      drawer.draw(smiles, svgElement, 'light', (err: unknown) => {
        if (err) {
          console.error('[SmilesStructure] Error during SMILES drawing callback:', smiles, err);
          setDrawError(true);
        } else {
          // console.log('[SmilesStructure] Successfully drawn:', smiles);
          // No need to setDrawError(false) here as it's done at the start of the effect
        }
      });
    } catch (e) {
      console.error('[SmilesStructure] Error instantiating Drawer or calling draw:', smiles, e);
      setDrawError(true);
    }

  }, [smiles, width, height, uniqueId]); // uniqueId is stable but good for completeness if component instance was reused

  return (
    <svg 
      id={uniqueId} 
      ref={svgRef} 
      style={{ width: width, height: height, border: drawError ? '1px solid red' : undefined }}
      aria-label={`Molecular structure for ${smiles}`}
    >
      {drawError && (
        <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fill="#dc2626" fontSize="12px" fontFamily="sans-serif">
          Error
        </text>
      )}
    </svg>
  );
};

export default SmilesStructure;
