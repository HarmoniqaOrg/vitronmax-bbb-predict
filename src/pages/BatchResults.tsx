
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Download, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import BatchResultsTable from '@/components/batch/BatchResultsTable';
import apiClient from '@/lib/api';
import type { BatchJob } from '@/lib/types';

interface MoleculeResult {
  smiles: string;
  molecule_name?: string;
  bbb_probability: number;
  prediction_class: string;
  confidence_score: number;
  fingerprint_hash?: string;
  error?: string;
}

const BatchResults = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [job, setJob] = useState<BatchJob | null>(null);
  const [results, setResults] = useState<MoleculeResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadJobStatus = async () => {
    if (!jobId) return;
    
    try {
      const data = await apiClient.getBatchStatus(jobId);
      setJob(data);
    } catch (err) {
      console.error('Error loading job status:', err);
      setError('Failed to load job details');
    }
  };

  const loadResults = async () => {
    if (!jobId) return;
    
    try {
      setResultsLoading(true);
      // Since we don't have a direct API endpoint for parsed results,
      // we'll need to download and parse the CSV file
      const downloadUrl = apiClient.getBatchDownloadUrl(jobId);
      const response = await fetch(downloadUrl);
      
      if (!response.ok) {
        throw new Error('Failed to download results');
      }
      
      const csvText = await response.text();
      const parsedResults = parseCSVResults(csvText);
      setResults(parsedResults);
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
  };

  const parseCSVResults = (csvText: string): MoleculeResult[] => {
    const lines = csvText.trim().split('\n');
    if (lines.length <= 1) return [];
    
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    const results: MoleculeResult[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
      const row: any = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      results.push({
        smiles: row.smiles || '',
        molecule_name: row.molecule_name || '',
        bbb_probability: parseFloat(row.bbb_probability) || 0,
        prediction_class: row.prediction_class || '',
        confidence_score: parseFloat(row.confidence_score) || 0,
        fingerprint_hash: row.fingerprint_hash,
        error: row.error
      });
    }
    
    return results;
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await loadJobStatus();
      setLoading(false);
    };
    
    loadData();
  }, [jobId]);

  useEffect(() => {
    if (job && job.status === 'completed') {
      loadResults();
    }
  }, [job]);

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
