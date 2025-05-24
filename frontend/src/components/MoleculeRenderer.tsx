
'use client';

import { useEffect, useRef } from 'react';

interface MoleculeRendererProps {
  smiles: string;
  size?: number;
  theme?: 'light' | 'dark';
}

const MoleculeRenderer = ({ smiles, size = 300, theme = 'light' }: MoleculeRendererProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    if (!smiles || !canvasRef.current) return;
    
    // Dynamically import SmilesDrawer to avoid SSR issues
    import('smiles-drawer').then(({ Drawer }) => {
      try {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const context = canvas.getContext('2d');
        if (!context) return;
        
        const drawer = new Drawer({
          width: size,
          height: size,
          bondThickness: 1.2,
          fontSizeLarge: 10,
          fontSizeSmall: 3,
          padding: 20,
          bondLength: 15,
          drawingType: 'svg',
          // Set colors based on theme
          themes: {
            light: {
              C: '#222222',
              O: '#e74c3c',
              N: '#3498db',
              F: '#27ae60',
              CL: '#16a085',
              BR: '#d35400',
              I: '#8e44ad',
              P: '#d35400',
              S: '#f1c40f',
              B: '#e67e22',
              BACKGROUND: '#ffffff',
            },
            dark: {
              C: '#ffffff',
              O: '#e74c3c',
              N: '#3498db',
              F: '#2ecc71',
              CL: '#1abc9c',
              BR: '#e67e22',
              I: '#9b59b6',
              P: '#e67e22',
              S: '#f1c40f',
              B: '#e67e22',
              BACKGROUND: 'transparent',
            }
          }
        });
        
        // Clear canvas before drawing
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        // Set theme
        drawer.theme = theme;
        
        // Draw molecule
        drawer.draw(smiles, canvas);
      } catch (error) {
        console.error('Failed to render molecule:', error);
      }
    });
  }, [smiles, size, theme]);

  return (
    <div className="flex items-center justify-center w-full h-full">
      {smiles ? (
        <canvas 
          ref={canvasRef} 
          width={size} 
          height={size} 
          className="w-full h-full"
        />
      ) : (
        <div className="flex items-center justify-center w-full h-full text-muted-foreground">
          Enter a SMILES string to view molecule
        </div>
      )}
    </div>
  );
};

export default MoleculeRenderer;
