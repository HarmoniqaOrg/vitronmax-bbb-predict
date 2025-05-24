
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Clock, Zap, CheckCircle2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import type { AppStats } from '@/lib/types';

// Mock stats for demo
const mockStats: AppStats = {
  total_predictions: 1254,
  total_batch_jobs: 38,
  avg_response_time: 357,
  success_rate: 0.986,
};

const DashboardStats = () => {
  const [stats, setStats] = useState<AppStats | null>(null);
  
  useEffect(() => {
    // In a real app, fetch stats from API
    // For now, use mock data
    setStats(mockStats);
  }, []);
  
  if (!stats) {
    return (
      <Card className="animate-pulse">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 bg-muted rounded-md" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Statistics</CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="grid gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Activity className="h-5 w-5 mr-2 text-primary" />
              <p className="text-sm">Total Predictions</p>
            </div>
            <p className="font-semibold">{stats.total_predictions.toLocaleString()}</p>
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Zap className="h-5 w-5 mr-2 text-primary" />
              <p className="text-sm">Batch Jobs</p>
            </div>
            <p className="font-semibold">{stats.total_batch_jobs.toLocaleString()}</p>
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Clock className="h-5 w-5 mr-2 text-primary" />
              <p className="text-sm">Avg. Response Time</p>
            </div>
            <p className="font-semibold">{stats.avg_response_time.toFixed(1)} ms</p>
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <CheckCircle2 className="h-5 w-5 mr-2 text-primary" />
              <p className="text-sm">Success Rate</p>
            </div>
            <p className="font-semibold">{(stats.success_rate * 100).toFixed(1)}%</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DashboardStats;
