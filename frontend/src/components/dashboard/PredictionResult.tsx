
'use client';

import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { MoleculeResult } from '@/lib/types';

interface PredictionResultProps {
  result: MoleculeResult;
}

const PredictionResult = ({ result }: PredictionResultProps) => {
  const probabilityPercent = (result.bbb_probability * 100).toFixed(1);
  const confidencePercent = (result.confidence_score * 100).toFixed(1);
  
  const getPredictionClass = () => {
    if (result.bbb_probability >= 0.7) return 'prediction-high';
    if (result.bbb_probability >= 0.3) return 'prediction-medium';
    return 'prediction-low';
  };
  
  const getPredictionLabel = () => {
    if (result.bbb_probability >= 0.7) return 'High Permeability';
    if (result.bbb_probability >= 0.3) return 'Moderate Permeability';
    return 'Low Permeability';
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Prediction Result</h3>
        <div className={`p-4 rounded-lg ${getPredictionClass()}`}>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">{getPredictionLabel()}</span>
            <Badge variant="outline" className="ml-2">
              {result.prediction_class}
            </Badge>
          </div>
          <Progress 
            value={parseFloat(probabilityPercent)} 
            className="h-2 mt-2"
          />
          <div className="flex justify-between text-xs mt-1">
            <span>0%</span>
            <span className="font-medium">{probabilityPercent}%</span>
            <span>100%</span>
          </div>
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm">Confidence Score</span>
          <span className="font-medium">{confidencePercent}%</span>
        </div>
        <Progress value={parseFloat(confidencePercent)} className="h-1.5" />
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground">SMILES</p>
          <p className="font-mono text-xs break-all">{result.smiles}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Name</p>
          <p>{result.molecule_name || 'Not specified'}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Processing Time</p>
          <p>{result.processing_time_ms.toFixed(2)} ms</p>
        </div>
      </div>
    </div>
  );
};

export default PredictionResult;
