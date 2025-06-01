import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Download, RefreshCw } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseCSVResults = useCallback((csvText: string): MoleculeResult[] => {
    const lines = csvText.trim().split('\n');
    if (lines.length <= 1) return [];
    
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
    const resultsArr: MoleculeResult[] = [];
    
    const headerMap: { [key: string]: keyof MoleculeResult | string } = {
      'input_smiles': 'smiles', // CSV header 'input_smiles' maps to 'smiles' property
      'molecule_name': 'molecule_name',
      'bbb_probability': 'bbb_probability',
      'prediction_class': 'prediction_class', // Kept as it's in MoleculeResult & original map; parser handles if not in CSV
      'bbb_confidence': 'confidence_score', // CSV header 'bbb_confidence' maps to 'confidence_score' property
      'mw': 'molecular_weight',           // CSV header 'mw' maps to 'molecular_weight' property
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
      // num_radical_electrons & num_valence_electrons are not in the confirmed sample CSV headers.
      // If they appear in CSVs with those exact names, they can be added back here.
      // e.g., 'num_radical_electrons': 'num_radical_electrons',
      'error': 'error',
    };

    const smilesHeader = headers.find(h => h === 'input_smiles'); // Check for 'input_smiles' as per updated headerMap
    if (!smilesHeader) {
        console.error("CSV Parse Error: 'input_smiles' header not found.");
        toast({ title: 'CSV Parsing Error', description: "Mandatory 'input_smiles' column not found in results.", variant: 'destructive' });
        return [];
    }

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
      const rowData: Partial<MoleculeResult> = {};
      
      headers.forEach((header, index) => {
        const mappedKey = headerMap[header.toLowerCase()]; // Ensure header is lowercased for map lookup
        if (mappedKey) {
          const valueStr = values[index] || '';
          switch (mappedKey) {
            // Float properties
            case 'bbb_probability':
            case 'confidence_score':
            case 'molecular_weight':
            case 'logp':
            case 'tpsa':
            case 'refractivity':
            case 'exact_mw':
              rowData[mappedKey] = parseFloat(valueStr) || 0;
              break;
            // Integer properties
            case 'h_bond_donors':
            case 'h_bond_acceptors':
            case 'rotatable_bonds':
            case 'pains_alerts':
            case 'brenk_alerts':
            case 'formal_charge':
            case 'num_rings':
            case 'num_radical_electrons':
            case 'num_valence_electrons':
            // processing_time_ms is also an int, but typically not in batch CSVs, handled by default later
              rowData[mappedKey] = parseInt(valueStr, 10) || 0;
              break;
            // String properties
            case 'smiles':
            case 'molecule_name': // Will be string or undefined if column missing/empty
            case 'prediction_class':
            case 'error': // Will be string or undefined
              rowData[mappedKey] = valueStr;
              break;
            // case 'processing_time_ms': // If it could come from CSV and needs int parsing
            //   rowData[mappedKey] = parseInt(valueStr, 10) || 0;
            //   break;
            // case 'fingerprint_features': // Example for a more complex type if it were in CSV
            //   rowData[mappedKey] = valueStr ? valueStr.split(';').map(Number) : undefined;
            //   break;
            default:
              // This ensures that if MoleculeResult gains new types of properties,
              // we are alerted here if they are added to headerMap but not handled.
              // For now, all types in MoleculeResult that are in headerMap are covered.
              // const _exhaustiveCheck: never = mappedKey;
              // console.warn(`Unhandled key type in CSV parsing: ${String(mappedKey)}`);
              break;
          }
        }
      });
      
      // Ensure all required fields for MoleculeResult are present, even if with default/empty values
      resultsArr.push({
        smiles: rowData.smiles || '',
        molecule_name: rowData.molecule_name, // Retains undefined if not present or empty in CSV
        bbb_probability: rowData.bbb_probability ?? 0,
        prediction_class: rowData.prediction_class || '',
        confidence_score: rowData.confidence_score ?? 0,
        processing_time_ms: rowData.processing_time_ms ?? 0, // Defaults to 0 if not parsed from CSV
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

  const loadJobStatus = useCallback(async () => {
    if (!jobId) return;
    
    try {
      const data = await apiClient.getBatchStatus(jobId);
      setJob(data);
    } catch (err) {
      console.error('Error loading job status:', err);
      setError('Failed to load job details');
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

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await loadJobStatus();
      setLoading(false);
    };
    
    loadData();
  }, [jobId, loadJobStatus]);

  useEffect(() => {
    if (job && job.status === 'completed') {
      loadResults();
    }
  }, [job, loadResults]);

  const handleDownloadOriginal = () => {
    if (!jobId) return;
    const downloadUrl = apiClient.getBatchDownloadUrl(jobId);
    window.open(downloadUrl, '_blank');
  };

  const handleRefresh = () => {
    loadJobStatus();
    if (job?.status === 'completed') {
      loadResults();
    }
  };

  if (loading) {
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
          
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleRefresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
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
              <p className="text-muted-foreground">
                {job.status === 'processing' 
                  ? 'Job is still processing. Results will be available when complete.'
                  : job.status === 'pending'
                  ? 'Job is pending. Processing will begin shortly.'
                  : 'Job failed or was cancelled.'
                }
              </p>
              {job.status === 'processing' && (
                <div className="mt-4">
                  <p className="text-sm mb-2">
                    Progress: {job.processed_molecules} / {job.total_molecules} molecules
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
          isLoading={resultsLoading}
        />
      )}
    </div>
  );
};

export default BatchResults;
