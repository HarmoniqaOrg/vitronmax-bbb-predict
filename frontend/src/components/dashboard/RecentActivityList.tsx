
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { FlaskConical, Layers } from 'lucide-react';
import type { RecentActivity } from '@/lib/types';

// Mock data for recent activity
const mockRecentActivity: RecentActivity[] = [
  {
    id: '1',
    type: 'single',
    title: 'Ibuprofen',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    result: {
      smiles: 'CC(C)CC1=CC=C(C=C1)C(C)C(=O)O',
      molecule_name: 'Ibuprofen',
      bbb_probability: 0.72,
      prediction_class: 'permeable',
      confidence_score: 0.88,
      processing_time_ms: 345.2
    }
  },
  {
    id: '2',
    type: 'batch',
    title: 'GPCR Ligands Batch',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    status: 'completed',
    result: {
      job_id: '2',
      status: 'completed',
      created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      total_molecules: 128,
      processed_molecules: 128,
      failed_molecules: 2,
      progress_percentage: 100
    }
  },
  {
    id: '3',
    type: 'single',
    title: 'Fluoxetine',
    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    result: {
      smiles: 'CNCCC(C1=CC=CC=C1)OC2=CC=C(C=C2)C(F)(F)F',
      molecule_name: 'Fluoxetine',
      bbb_probability: 0.92,
      prediction_class: 'permeable',
      confidence_score: 0.94,
      processing_time_ms: 378.6
    }
  },
  {
    id: '4',
    type: 'batch',
    title: 'Screening Library',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'completed',
    result: {
      job_id: '4',
      status: 'completed',
      created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      total_molecules: 512,
      processed_molecules: 512,
      failed_molecules: 7,
      progress_percentage: 100
    }
  }
];

const RecentActivityList = () => {
  const router = useRouter();
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  
  useEffect(() => {
    // In a real app, fetch data from API
    // For now, use mock data
    setActivities(mockRecentActivity);
  }, []);
  
  const getStatusBadge = (status?: string) => {
    if (!status) return null;
    
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
        return null;
    }
  };
  
  const renderActivityItem = (activity: RecentActivity) => (
    <div 
      key={activity.id}
      className="flex items-center justify-between p-3 rounded-md hover:bg-muted transition-colors cursor-pointer"
      onClick={() => {
        if (activity.type === 'batch' && activity.result?.job_id) {
          router.push(`/batch/${activity.result.job_id}`);
        }
      }}
    >
      <div className="flex items-center">
        {activity.type === 'single' ? (
          <FlaskConical className="h-5 w-5 mr-3 text-primary" />
        ) : (
          <Layers className="h-5 w-5 mr-3 text-primary" />
        )}
        
        <div>
          <p className="font-medium text-sm">{activity.title}</p>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
          </p>
        </div>
      </div>
      
      {activity.status && getStatusBadge(activity.status)}
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        {activities.length > 0 ? (
          <div className="space-y-2">
            {activities.map(renderActivityItem)}
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
