
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { Download, RefreshCw, ArrowLeft } from 'lucide-react';
import apiClient from '@/lib/api';
import type { BatchJob } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function BatchJobPage({ params }: { params: { jobId: string } }) {
  const { jobId } = params;
  const router = useRouter();
  const { toast } = useToast();
  
  const [job, setJob] = useState<BatchJob | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  const loadJobStatus = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getBatchStatus(jobId);
      setJob(data);
      setError(null);
      
      // Stop polling if job is completed or failed
      if (data.status === 'completed' || data.status === 'failed') {
        if (pollingInterval) {
          clearInterval(pollingInterval);
          setPollingInterval(null);
        }
      }
    } catch (err) {
      setError('Failed to load job status');
      console.error('Error loading job status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobStatus();
    
    // Set up polling for in-progress jobs
    const interval = setInterval(loadJobStatus, 5000);
    setPollingInterval(interval);
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [jobId]);

  const handleDownload = () => {
    if (!job || job.status !== 'completed') return;
    
    const downloadUrl = apiClient.getBatchDownloadUrl(jobId);
    window.open(downloadUrl, '_blank');
    
    toast({
      title: 'Download started',
      description: 'Your results are being downloaded',
    });
  };

  const handleRefresh = () => {
    loadJobStatus();
    toast({
      title: 'Refreshing',
      description: 'Getting the latest status',
    });
  };

  const handleBack = () => {
    router.push('/dashboard');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-success">Completed</Badge>;
      case 'processing':
        return <Badge variant="default" className="bg-primary">Processing</Badge>;
      case 'pending':
        return <Badge variant="default" className="bg-warning">Pending</Badge>;
      case 'failed':
        return <Badge variant="default" className="bg-destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (error) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card className="w-full max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Job</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
          <CardFooter>
            <Button onClick={handleBack}>Back to Dashboard</Button>
            <Button variant="outline" onClick={handleRefresh} className="ml-2">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <Button variant="ghost" onClick={handleBack} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Dashboard
      </Button>
      
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Batch Job Details</CardTitle>
            {job && getStatusBadge(job.status)}
          </div>
        </CardHeader>
        
        {loading && !job ? (
          <CardContent className="flex justify-center py-10">
            <p>Loading job details...</p>
          </CardContent>
        ) : job ? (
          <>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-medium">Job Information</h3>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Job ID</p>
                    <p className="font-mono text-sm">{job.job_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p>{job.job_name || 'Unnamed job'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Created</p>
                    <p>{format(new Date(job.created_at), 'PPp')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Last Updated</p>
                    <p>{format(new Date(job.updated_at), 'PPp')}</p>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h3 className="text-lg font-medium">Progress</h3>
                <div className="mt-2 space-y-3">
                  <Progress value={job.progress_percentage} className="h-2" />
                  <div className="flex justify-between text-sm">
                    <span>{job.processed_molecules} of {job.total_molecules} processed</span>
                    <span>{job.progress_percentage.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
              
              {job.status === 'processing' && job.estimated_completion_time && (
                <div>
                  <p className="text-sm text-muted-foreground">
                    Estimated completion: {format(new Date(job.estimated_completion_time), 'PPp')}
                  </p>
                </div>
              )}
              
              {job.status === 'failed' && job.error_message && (
                <div className="bg-destructive/10 p-4 rounded-md">
                  <h4 className="font-medium text-destructive">Error</h4>
                  <p className="mt-1 text-sm">{job.error_message}</p>
                </div>
              )}
            </CardContent>
            
            <CardFooter className="flex justify-between">
              <Button onClick={handleRefresh} variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              
              <Button 
                onClick={handleDownload} 
                disabled={job.status !== 'completed'}
              >
                <Download className="mr-2 h-4 w-4" />
                Download Results
              </Button>
            </CardFooter>
          </>
        ) : null}
      </Card>
    </div>
  );
}
