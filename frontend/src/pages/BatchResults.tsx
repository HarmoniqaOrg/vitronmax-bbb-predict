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
    
    const headerMap: { [key: string]: keyof MoleculeResult | string } = {
      'input_smiles': 'smiles',
      'smiles': 'smiles',
      'molecule_name': 'molecule_name',
      'bbb_probability': 'bbb_probability',
      'prediction_class': 'prediction_class',
      'bbb_confidence': 'confidence_score',
      'mw': 'molecular_weight',
      'logp': 'logp',
      'tpsa': 'tpsa',
      'h_bond_donors': 'h_bond_donors',
      'h_bond_acceptors': 'h_bond_acceptors',
      'rotatable_bonds': 'rotatable_bonds',
      'pains_alerts': 'pains_alerts',
      'brenk_alerts': 'brenk_alerts',
      'formal_charge': 'formal_charge',
      'refractivity': 'refractivity',
      'num_rings': 'num_rings',
      'exact_mw': 'exact_mw',
      'error': 'error',
    };

    let actualSmilesHeader: string | undefined = headers.find(h => h === 'input_smiles');
    if (!actualSmilesHeader) {
      actualSmilesHeader = headers.find(h => h === 'smiles');
    }

    if (!actualSmilesHeader) {
        console.error("CSV Parse Error: Neither 'input_smiles' nor 'smiles' header found.");
        toast({ title: 'CSV Parsing Error', description: "Mandatory SMILES column (expected 'input_smiles' or 'smiles') not found in results.", variant: 'destructive' });
        return [];
    }

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
      const rowData: Partial<MoleculeResult> = {};
      
      headers.forEach((header, index) => {
        const mappedKey = headerMap[header.toLowerCase()];
        if (mappedKey) {
          const valueStr = values[index] || '';
          switch (mappedKey) {
            case 'bbb_probability':
            case 'confidence_score':
            case 'molecular_weight':
            case 'logp':
            case 'tpsa':
            case 'refractivity':
            case 'exact_mw':
              rowData[mappedKey] = parseFloat(valueStr) || 0;
              break;
            case 'h_bond_donors':
            case 'h_bond_acceptors':
            case 'rotatable_bonds':
            case 'pains_alerts':
            case 'brenk_alerts':
            case 'formal_charge':
            case 'num_rings':
            case 'num_radical_electrons':
            case 'num_valence_electrons':
              rowData[mappedKey] = parseInt(valueStr, 10) || 0;
              break;
            case 'smiles':
            case 'molecule_name':
            case 'prediction_class':
            case 'error':
              rowData[mappedKey] = valueStr;
              break;
            default:
              break;
          }
        }
      });
      
      resultsArr.push({
        smiles: rowData.smiles || '',
        molecule_name: rowData.molecule_name,
        bbb_probability: rowData.bbb_probability ?? 0,
        prediction_class: rowData.prediction_class || '',
        confidence_score: rowData.confidence_score ?? 0,
        processing_time_ms: rowData.processing_time_ms ?? 0,
        molecular_weight: rowData.molecular_weight ?? 0,
        logp: rowData.logp || 0,
        tpsa: rowData.tpsa || 0,
        h_bond_donors: rowData.h_bond_donors || 0,
        h_bond_acceptors: rowData.h_bond_acceptors || 0,
        rotatable_bonds: rowData.rotatable_bonds || 0,
        pains_alerts: rowData.pains_alerts || 0,
        brenk_alerts: rowData.brenk_alerts || 0,
        formal_charge: rowData.formal_charge || 0,
        refractivity: rowData.refractivity || 0,
        num_rings: rowData.num_rings || 0,
        exact_mw: rowData.exact_mw || 0,
        num_radical_electrons: rowData.num_radical_electrons || 0,
        num_valence_electrons: rowData.num_valence_electrons || 0,
        error: rowData.error,
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
