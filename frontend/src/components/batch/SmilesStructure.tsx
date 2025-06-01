import React, { useEffect, useRef } from 'react';
import { Drawer } from 'smiles-drawer';

interface SmilesStructureProps {
  smiles: string;
  width?: number;
  height?: number;
}

const SmilesStructure: React.FC<SmilesStructureProps> = ({ smiles, width = 150, height = 100 }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current && smiles) {
      // For SVG, clearing is handled by drawer.draw on a fresh element or if it handles clearing itself.
      // If not, ensure the SVG element is empty before drawing if re-using the same SVG element for different SMILES.
      // However, with React's reconciliation, this component instance is likely fresh or props changed, re-triggering useEffect.
      // Let's ensure the target is clean if the smiles string changes for an existing component instance.
      if (svgRef.current) {
        while (svgRef.current.firstChild) {
          svgRef.current.removeChild(svgRef.current.firstChild);
        }
      }
      const drawer = new Drawer({
        width: width,
        height: height,
      });
      
      drawer.draw(smiles, svgRef.current, 'light', (err: unknown) => {
        if (err) {
          console.error('Error drawing SMILES:', err);
          // Optionally, display an error message or placeholder
          // For an SVG, injecting HTML div is not valid. We could draw a text element or a placeholder SVG.
          // For now, we'll rely on the console error and the SVG remaining blank or showing a partial structure if drawer fails gracefully.
          if (svgRef.current) {
            // Example: svgRef.current.textContent = 'Error'; // Not ideal for SVG
          }
        }
      });
    }
  }, [smiles, width, height]);

  return <svg ref={svgRef} style={{ width: width, height: height }} />;
};

export default SmilesStructure;
