import React, { useEffect, useRef, memo } from 'react';
// import $3Dmol from '3dmol'; // Commenting out direct import

declare global {
  interface Window {
    $3Dmol?: any;
  }
}

interface MoleculeViewerProps {
  pdbData: string | null;
  width?: number;
  height?: number;
}

const MoleculeViewer: React.FC<MoleculeViewerProps> = ({ 
  pdbData,
  width = 300, // Default width
  height = 300, // Default height
}) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const glViewer = useRef<any>(null); // To store the 3Dmol viewer instance

  useEffect(() => {
    if (!viewerRef.current) {
      console.error('3Dmol viewer container (ref) not found.');
      return;
    }
    if (!window.$3Dmol) {
      console.error('$3Dmol library not found on window object. Please ensure the 3Dmol.js CDN script is included in your index.html, e.g., <script src="https://3Dmol.org/build/3Dmol-min.js"></script>');
      return;
    }

    // Initialize viewer if it hasn't been initialized yet
    if (!glViewer.current) {
      glViewer.current = window.$3Dmol.createViewer(viewerRef.current, { // Use window.$3Dmol
        defaultcolors: window.$3Dmol.elementColors.rasmol, // Use window.$3Dmol
      });
      glViewer.current.setBackgroundColor(0xffffff);
    }

    // Clear previous model and add new one if PDB data is provided
    glViewer.current.clear();
    if (pdbData) {
      try {
        glViewer.current.addModel(pdbData, 'pdb'); // Use pdbData and 'pdb' format
        glViewer.current.setStyle({}, {stick: {}}); // Apply stick style
        glViewer.current.zoomTo();
        glViewer.current.render();
        console.log('3Dmol: Attempted to load PDB data.');
      } catch (error) {
        console.error('Error processing PDB data with 3Dmol:', error);
        // Fallback or error display for the user could be added here
      }
    } else {
      // If no PDB data, ensure the viewer is empty
      glViewer.current.render(); // Render an empty scene
    }

    // Resize viewer
    glViewer.current.resize();

    // Cleanup function for when the component unmounts or PDB data changes triggering re-initialization (though we try to reuse viewer)
    // return () => {
    //   if (glViewer.current) {
    //     // glViewer.current.clear(); // Or more thorough cleanup if createViewer is called every time
    //   }
    // };
  }, [pdbData]); // Rerun effect if PDB data changes

  return (
    <div 
      ref={viewerRef} 
      style={{ width: `${width}px`, height: `${height}px`, position: 'relative', border: '1px solid #ccc' }}
      aria-label="Molecule viewer"
    >
      {!pdbData && (
        <div style={{
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          color: '#888',
          fontSize: '0.9em',
          textAlign: 'center' // Center text
        }}>
          Enter a SMILES string above to view the 3D structure.
        </div>
      )}
    </div>
  );
};

export default memo(MoleculeViewer);
