import React, { useEffect, useRef } from 'react';
import { Drawer } from 'smiles-drawer';

interface SmilesStructureProps {
  smiles: string;
  width?: number;
  height?: number;
}

const SmilesStructure: React.FC<SmilesStructureProps> = ({ smiles, width = 150, height = 100 }) => {
  const svgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (svgRef.current && smiles) {
      svgRef.current.innerHTML = ''; // Clear previous SVG
      const drawer = new Drawer({
        width: width,
        height: height,
      });
      
      drawer.draw(smiles, svgRef.current, 'light', (err: any) => {
        if (err) {
          console.error('Error drawing SMILES:', err);
          // Optionally, display an error message or placeholder in the div
          if (svgRef.current) {
            svgRef.current.innerHTML = `<div style="width:${width}px; height:${height}px; display:flex; align-items:center; justify-content:center; border:1px dashed #ccc; font-size:12px; color:#888;">Invalid SMILES</div>`;
          }
        }
      });
    }
  }, [smiles, width, height]);

  return <div ref={svgRef} style={{ width: width, height: height }} />;
};

export default SmilesStructure;
