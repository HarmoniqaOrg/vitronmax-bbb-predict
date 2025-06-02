import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { MoleculeResult } from '@/lib/types';

interface PredictionResultProps {
  result: MoleculeResult;
}

const PredictionResult = ({ result }: PredictionResultProps) => {
  // Ensure result.prediction_certainty and result.applicability_score are handled gracefully if undefined/null

  const probabilityPercent = (result.bbb_probability * 100).toFixed(1);
  
  const displayPredictionCertainty = 
    typeof result.confidence_score === 'number' && !isNaN(result.confidence_score)
      ? (result.confidence_score * 100).toFixed(1) + '%'
      : 'N/A';

  const progressPredictionCertaintyValue =
    typeof result.confidence_score === 'number' && !isNaN(result.confidence_score)
      ? result.confidence_score * 100
      : 0;

  const displayApplicabilityScore =
    typeof result.applicability_score === 'number' && !isNaN(result.applicability_score)
      ? (result.applicability_score * 100).toFixed(1) + '%'
      : 'N/A';

  const progressApplicabilityScoreValue =
    typeof result.applicability_score === 'number' && !isNaN(result.applicability_score)
      ? result.applicability_score * 100
      : 0;
  
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
        { (result.bbb_probability >= 0.2 && result.bbb_probability <= 0.6) &&
          <p className="text-xs text-muted-foreground mt-1 italic">
            Note: Model predictions for probabilities between 0.2 and 0.6 may be slightly overestimated.
          </p>
        }
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm">Prediction Certainty</span>
          <span className="font-medium">{displayPredictionCertainty}</span>
        </div>
        <Progress value={progressPredictionCertaintyValue} className="h-1.5" />
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm">Applicability Score (Similarity to Training Data)</span>
          <span className="font-medium">{displayApplicabilityScore}</span>
        </div>
        <Progress value={progressApplicabilityScoreValue} className="h-1.5" />
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

      <div>
        <h4 className="text-md font-medium mt-6 mb-3">Molecular Properties</h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <p className="text-muted-foreground">Molecular Weight</p>
            <p>{result.mw?.toFixed(2) ?? 'N/A'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Exact MW</p>
            <p>{result.exact_mw?.toFixed(2) ?? 'N/A'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Molecular Formula</p>
            <p>{result.mol_formula ?? 'N/A'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">LogP</p>
            <p>{result.logp?.toFixed(2) ?? 'N/A'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">TPSA</p>
            <p>{result.tpsa?.toFixed(2) ?? 'N/A'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">H-Bond Donors</p>
            <p>{result.h_donors ?? 'N/A'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">H-Bond Acceptors</p>
            <p>{result.h_acceptors ?? 'N/A'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Rotatable Bonds</p>
            <p>{result.rot_bonds ?? 'N/A'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Formal Charge</p>
            <p>{result.formal_charge ?? 'N/A'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Molar Refractivity</p>
            <p>{result.molar_refractivity?.toFixed(2) ?? 'N/A'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Number of Rings</p>
            <p>{result.num_rings ?? 'N/A'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Fraction CSP3</p>
            <p>{result.frac_csp3?.toFixed(2) ?? 'N/A'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Heavy Atoms</p>
            <p>{result.heavy_atoms ?? 'N/A'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">ESOL LogS (Solubility)</p>
            <p>{result.log_s_esol?.toFixed(2) ?? 'N/A'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">GI Absorption</p>
            <p>{result.gi_absorption ?? 'N/A'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Lipinski's Rule</p>
            <p>{typeof result.lipinski_passes === 'boolean' ? (result.lipinski_passes ? 'Passes' : 'Fails') : 'N/A'}</p>
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-md font-medium mt-4 mb-3">Structural Alerts</h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <p className="text-muted-foreground">PAINS Alerts</p>
            <p className={result.pains_alerts > 0 ? 'text-orange-600 font-semibold' : ''}>
              {result.pains_alerts ?? 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Brenk Alerts</p>
            <p className={result.brenk_alerts > 0 ? 'text-orange-600 font-semibold' : ''}>
              {result.brenk_alerts ?? 'N/A'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PredictionResult;
