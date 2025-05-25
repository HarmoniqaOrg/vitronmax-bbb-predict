
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { Layers, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import apiClient from '@/lib/api';
import type { BatchJob } from '@/lib/types';

const RecentActivityList = () => {
  const router = useRouter();
  const [batchJobs, setBatchJobs] = useState<BatchJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchBatchJobs = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching batch jobs from API...');
      const jobs = await apiClient.getAllBatchJobs();
      console.log('Received batch jobs:', jobs);
      setBatchJobs(jobs.slice(0, 5)); // Show only recent 5 jobs
    } catch (err) {
      console.error('Failed to fetch batch jobs:', err);
      setError('Failed to load recent activity');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatchJobs();
    
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchBatchJobs, 5000);
    return () => clearInterval(interval);
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
  
  const renderBatchJob = (job: BatchJob) => (
    <div 
      key={job.job_id}
      className="flex items-center justify-between p-3 rounded-md hover:bg-muted transition-colors cursor-pointer"
      onClick={() => router.push(`/batch/${job.job_id}`)}
    >
      <div className="flex items-center">
        <Layers className="h-5 w-5 mr-3 text-primary" />
        <div>
          <p className="font-medium text-sm">{job.job_name || `Batch Job ${job.job_id.slice(0, 8)}`}</p>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })} • {job.total_molecules} molecules
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {job.status === 'processing' && (
          <span className="text-xs text-muted-foreground">
            {job.progress_percentage.toFixed(0)}%
          </span>
        )}
        {getStatusBadge(job.status)}
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Recent Activity</CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchBatchJobs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        {loading && batchJobs.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        ) : error ? (
          <div className="text-center py-6">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="ghost" size="sm" onClick={fetchBatchJobs} className="mt-2">
              Try Again
            </Button>
          </div>
        ) : batchJobs.length > 0 ? (
          <div className="space-y-2">
            {batchJobs.map(renderBatchJob)}
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">No recent activity</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentActivityList;
