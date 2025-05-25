
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { Download, RefreshCw, ArrowLeft, Eye } from 'lucide-react';
import apiClient from '@/lib/api';
import type { BatchJob } from '@/lib/types';

export default function BatchJobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.getAllBatchJobs();
      setJobs(data);
    } catch (err) {
      console.error('Failed to fetch batch jobs:', err);
      setError('Failed to load batch jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-600">Completed</Badge>;
      case 'processing':
        return <Badge variant="default" className="bg-blue-600">Processing</Badge>;
      case 'pending':
        return <Badge variant="default" className="bg-yellow-600">Pending</Badge>;
      case 'failed':
        return <Badge variant="default" className="bg-red-600">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleDownload = (jobId: string) => {
    const downloadUrl = apiClient.getBatchDownloadUrl(jobId);
    window.open(downloadUrl, '_blank');
  };

  const handleViewDetails = (jobId: string) => {
    router.push(`/batch/${jobId}`);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Button variant="ghost" onClick={() => router.push('/dashboard')} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold">Batch Jobs</h1>
          <p className="text-muted-foreground">Manage and monitor your batch prediction jobs</p>
        </div>
        
        <Button onClick={fetchJobs} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-destructive mb-4">{error}</p>
              <Button onClick={fetchJobs}>Try Again</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {jobs.length === 0 && !loading ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No batch jobs found</p>
                  <Button 
                    onClick={() => router.push('/dashboard')} 
                    className="mt-4"
                  >
                    Start New Batch Job
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            jobs.map((job) => (
              <Card key={job.job_id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">
                        {job.job_name || `Batch Job ${job.job_id.slice(0, 8)}`}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Created {format(new Date(job.created_at), 'PPp')}
                      </p>
                    </div>
                    {getStatusBadge(job.status)}
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total Molecules</p>
                        <p className="font-medium">{job.total_molecules}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Processed</p>
                        <p className="font-medium">{job.processed_molecules}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Failed</p>
                        <p className="font-medium">{job.failed_molecules}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Progress</p>
                        <p className="font-medium">{job.progress_percentage.toFixed(1)}%</p>
                      </div>
                    </div>
                    
                    {job.status === 'processing' || job.status === 'pending' ? (
                      <Progress value={job.progress_percentage} className="h-2" />
                    ) : null}
                    
                    {job.error_message && (
                      <div className="bg-destructive/10 p-3 rounded-md">
                        <p className="text-sm text-destructive">{job.error_message}</p>
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleViewDetails(job.job_id)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </Button>
                      
                      {job.status === 'completed' && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDownload(job.job_id)}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download Results
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
