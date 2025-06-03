import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Download, RefreshCw, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import BatchResultsTable from '@/components/batch/BatchResultsTable';
import apiClient from '@/lib/api';
import type { BatchJob, MoleculeResult } from '@/lib/types';

const BatchResults = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [job, setJob] = useState<BatchJob | null>(null);
  const [results, setResults] = useState<MoleculeResult[]>([]);
  const [loading, setLoading] = useState(true); // For initial page load
  const [resultsLoading, setResultsLoading] = useState(false); // For CSV results loading
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false); // For polls or manual refresh
  const [error, setError] = useState<string | null>(null);

  const parseCSVResults = useCallback((csvText: string): MoleculeResult[] => {
    const lines = csvText.trim().split('\n');
    if (lines.length <= 1) return [];

    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
    const resultsArr: MoleculeResult[] = [];

    // Maps CSV headers (lowercase) to MoleculeResult field names
    const headerMap: { [key: string]: keyof MoleculeResult } = {
      'input_smiles': 'smiles',
      'smiles': 'smiles', 
      'molecule_name': 'molecule_name',
      'bbb_probability': 'bbb_probability',
      'prediction_class': 'bbb_class', // CSV 'prediction_class' maps to 'bbb_class' in MoleculeResult
      'bbb_confidence': 'prediction_certainty', // CSV 'bbb_confidence' maps to 'prediction_certainty'
      'applicability_score': 'applicability_score',
      'mw': 'mw',
      'logp': 'logp',
      'tpsa': 'tpsa',
      'rot_bonds': 'rot_bonds', // CSV 'rotatable_bonds' might be used, map to 'rot_bonds'
      'rotatable_bonds': 'rot_bonds',
      'h_acceptors': 'h_acceptors', // CSV 'h_bond_acceptors' might be used
      'h_bond_acceptors': 'h_acceptors',
      'h_donors': 'h_donors', // CSV 'h_bond_donors' might be used
      'h_bond_donors': 'h_donors',
      'frac_csp3': 'frac_csp3',
      'molar_refractivity': 'molar_refractivity', // CSV 'refractivity' might be used
      'refractivity': 'molar_refractivity',
      'log_s_esol': 'log_s_esol',
      'gi_absorption': 'gi_absorption',
      'lipinski_passes': 'lipinski_passes',
      'pains_alerts': 'pains_alerts',
      'brenk_alerts': 'brenk_alerts',
      'num_heavy_atoms': 'num_heavy_atoms', // CSV 'heavy_atoms' might be used
      'heavy_atoms': 'num_heavy_atoms',
      'molecular_formula': 'molecular_formula', // CSV 'mol_formula' might be used
      'mol_formula': 'molecular_formula',
      'exact_mw': 'exact_mw',
      'formal_charge': 'formal_charge',
      'num_rings': 'num_rings',
      'error': 'error',
    };

    let smilesHeaderKey: keyof MoleculeResult | undefined;
    if (headers.includes('input_smiles')) {
        smilesHeaderKey = headerMap['input_smiles'];
    } else if (headers.includes('smiles')) {
        smilesHeaderKey = headerMap['smiles'];
    }

    if (!smilesHeaderKey) {
        console.error("CSV Parse Error: SMILES header ('input_smiles' or 'smiles') not found.");
        toast({ title: 'CSV Parsing Error', description: "Mandatory SMILES column not found.", variant: 'destructive' });
        return [];
    }

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
      const rowData: Partial<MoleculeResult> = {};

      headers.forEach((header, index) => {
        const mappedKey = headerMap[header.toLowerCase()]; 
        if (mappedKey) {
          const valueStr = values[index] || '';
          const lowerValueStr = valueStr.toLowerCase();
          const isNA = lowerValueStr === 'n/a' || lowerValueStr === 'nan' || lowerValueStr === '';

          switch (mappedKey) {
            case 'bbb_probability':
            case 'prediction_certainty':
            case 'applicability_score':
            case 'mw':
            case 'logp':
            case 'tpsa':
            case 'frac_csp3':
            case 'molar_refractivity':
            case 'log_s_esol':
            case 'exact_mw':
              rowData[mappedKey] = isNA ? null : parseFloat(valueStr);
              break;
            case 'rot_bonds':
            case 'h_acceptors':
            case 'h_donors':
            case 'pains_alerts':
            case 'brenk_alerts':
            case 'num_heavy_atoms':
            case 'formal_charge':
            case 'num_rings':
              rowData[mappedKey] = isNA ? null : parseInt(valueStr, 10);
              break;
            case 'lipinski_passes':
              rowData[mappedKey] = isNA ? null : lowerValueStr === 'true';
              break;
            case 'smiles': 
            case 'molecule_name':
            case 'bbb_class': 
            case 'gi_absorption':
            case 'molecular_formula': 
            case 'error':
              rowData[mappedKey] = isNA ? null : valueStr;
              break;
            default:
              break;
          }
        }
      });

      const smilesValue = rowData.smiles || ''; // Ensure smiles is always a string

      resultsArr.push({
        smiles: smilesValue,
        molecule_name: rowData.molecule_name ?? null,
        bbb_probability: rowData.bbb_probability ?? 0, 
        bbb_class: rowData.bbb_class ?? '', 
        prediction_certainty: rowData.prediction_certainty ?? 0, 
        applicability_score: rowData.applicability_score === undefined ? null : rowData.applicability_score,
        processing_time_ms: 0, // Not available from CSV, default to 0
        mw: rowData.mw ?? null,
        logp: rowData.logp ?? null,
        tpsa: rowData.tpsa ?? null,
        rot_bonds: rowData.rot_bonds ?? null,
        h_acceptors: rowData.h_acceptors ?? null,
        h_donors: rowData.h_donors ?? null,
        frac_csp3: rowData.frac_csp3 ?? null,
        molar_refractivity: rowData.molar_refractivity ?? null,
        log_s_esol: rowData.log_s_esol ?? null,
        gi_absorption: rowData.gi_absorption ?? null,
        lipinski_passes: rowData.lipinski_passes ?? null,
        pains_alerts: rowData.pains_alerts ?? null,
        brenk_alerts: rowData.brenk_alerts ?? null,
        num_heavy_atoms: rowData.num_heavy_atoms ?? null,
        molecular_formula: rowData.molecular_formula ?? null,
        exact_mw: rowData.exact_mw ?? null,
        formal_charge: rowData.formal_charge ?? null,
        num_rings: rowData.num_rings ?? null,
        error: rowData.error ?? null,
      });
    }
    return resultsArr;
  }, [toast]);

  const loadJobStatus = useCallback(async (options: { initialLoad?: boolean; isPoll?: boolean } = {}) => {
    if (!jobId) return;

    if (options.initialLoad) setLoading(true);
    else setIsBackgroundLoading(true);
    
    try {
      const data = await apiClient.getBatchStatus(jobId);
      console.log('Fetched job status in BatchResults:', JSON.stringify(data)); // Diagnostic log
      setJob(data);
    } catch (err) {
      console.error('Error loading job status:', err);
      setError('Failed to load job details');
    } finally {
      if (options.initialLoad) setLoading(false);
      else setIsBackgroundLoading(false);
    }
  }, [jobId]);

  const loadResults = useCallback(async () => {
    if (!jobId) return;
    
    try {
      setResultsLoading(true);
      const downloadUrl = apiClient.getBatchDownloadUrl(jobId);
      const response = await fetch(downloadUrl);
      
      if (!response.ok) {
        throw new Error('Failed to download results');
      }
      
      const csvText = await response.text();
      const parsedData = parseCSVResults(csvText);
      setResults(parsedData);
    } catch (err) {
      console.error('Error loading results:', err);
      toast({
        title: 'Error',
        description: 'Failed to load detailed results',
        variant: 'destructive'
      });
    } finally {
      setResultsLoading(false);
    }
  }, [jobId, parseCSVResults, toast]);

  // Initial load of job status
  useEffect(() => {
    if (jobId) {
      loadJobStatus({ initialLoad: true });
    }
  }, [jobId, loadJobStatus]);

  // Load results when job completes
  useEffect(() => {
    if (job && job.status === 'completed' && results.length === 0) { // also check results.length to avoid re-fetch if already loaded
      loadResults();
    }
  }, [job, loadResults, results.length]);

  // Polling logic - always active if job is pending or processing
  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;
    if (job && (job.status === 'pending' || job.status === 'processing')) {
      intervalId = setInterval(() => {
        loadJobStatus({ isPoll: true });
      }, 5000);
    } 
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [job, loadJobStatus]);

  const handleDownloadOriginal = () => {
    if (!jobId) return;
    const downloadUrl = apiClient.getBatchDownloadUrl(jobId);
    window.open(downloadUrl, '_blank');
  };

  

  if (loading) { // Initial page load state
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p>Loading batch results...</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-destructive mb-4">{error || 'Job not found'}</p>
              <Button onClick={() => navigate('/dashboard')}>
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isJobActive = job.status === 'pending' || job.status === 'processing';

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              {job.job_name || `Batch Job ${job.job_id.slice(0, 8)}`}
            </h1>
            <p className="text-muted-foreground">
              Detailed results and analysis for your batch prediction
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Refresh and Auto-Refresh toggle removed for always-on auto-refresh */}
            {job.status === 'completed' && (
              <Button onClick={handleDownloadOriginal}>
                <Download className="mr-2 h-4 w-4" />
                Download CSV
              </Button>
            )}
          </div>
        </div>
      </div>

      {job.status !== 'completed' ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-muted-foreground flex items-center justify-center">
                {isBackgroundLoading && isJobActive && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <span>
                  {job.status === 'processing' 
                    ? `Job is processing. Last update: ${new Date(job.updated_at).toLocaleString()}`
                    : job.status === 'pending'
                    ? `Job is pending. Created: ${new Date(job.created_at).toLocaleString()}`
                    : `Job status: ${job.status}.` // Fallback for other non-completed states like 'failed'
                  }
                </span>
              </p>
              {job.status === 'processing' && (
                <div className="mt-4">
                  <p className="text-sm mb-2">
                    Progress: {job.processed_molecules ?? 0} / {job.total_molecules ?? 0} molecules
                  </p>
                  <div className="w-full max-w-md mx-auto bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${job.progress_percentage}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <BatchResultsTable 
          results={results}
          jobName={job.job_name}
          isLoading={resultsLoading} // This is for the results table itself after job is complete
        />
      )}
    </div>
  );
};

export default BatchResults;
