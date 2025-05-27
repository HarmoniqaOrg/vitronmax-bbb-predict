import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Clock, Zap, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useEffect, useState } from 'react';
import { getPlatformStatistics, PlatformStatistics } from '@/lib/api';

const DashboardStats = () => {
  const [stats, setStats] = useState<PlatformStatistics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await getPlatformStatistics();
        setStats(data);
        setError(null);
      } catch (err) {
        setError('Failed to load platform statistics.');
        console.error(err);
        setStats(null); // Clear any old stats
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Statistics</CardTitle>
        </CardHeader>
        <CardContent className="pb-4 flex justify-center items-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Statistics</CardTitle>
        </CardHeader>
        <CardContent className="pb-4 flex flex-col justify-center items-center h-48">
          <AlertTriangle className="h-8 w-8 text-destructive mb-2" />
          <p className="text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    // This case should ideally not be reached if loading and error are handled,
    // but as a fallback:
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Statistics</CardTitle>
        </CardHeader>
        <CardContent className="pb-4 flex flex-col justify-center items-center h-48">
          <p>No statistics data available.</p>
        </CardContent>
      </Card>
    );
  }

  // Original mockup data for reference:
  // const stats_mockup = {
  //   total_predictions: 1254,
  //   total_batch_jobs: 38,
  //   avg_response_time: 357, // This was in ms
  //   success_rate: 0.986, // This was a fraction
  // };

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
              <p className="text-sm">Avg. Batch Proc. Time</p> {/* Updated label */}
            </div>
            {/* Displaying in seconds as returned by backend */}
            <p className="font-semibold">{stats.avg_batch_processing_time_seconds.toFixed(1)} s</p> {/* Updated unit to 's' */}
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <CheckCircle2 className="h-5 w-5 mr-2 text-primary" />
              <p className="text-sm">Overall Success Rate</p> {/* Updated label */}
            </div>
            {/* Backend returns percentage directly */}
            <p className="font-semibold">{stats.overall_batch_success_rate_percentage.toFixed(1)}%</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DashboardStats;
