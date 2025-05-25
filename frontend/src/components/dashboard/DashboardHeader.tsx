
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Brain, Layers, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';

const DashboardHeader = () => {
  const router = useRouter();

  return (
    <div className="mb-8">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">VitronMax Dashboard</h1>
          <p className="text-muted-foreground">
            Blood-Brain Barrier Permeability Prediction Platform
          </p>
        </div>
        
        <Button 
          variant="outline"
          onClick={() => router.push('/batch-jobs')}
        >
          <Layers className="mr-2 h-4 w-4" />
          View All Batch Jobs
        </Button>
      </div>
      
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center">
              <Brain className="h-8 w-8 text-primary mr-3" />
              <div>
                <p className="text-sm font-medium">AI-Powered Predictions</p>
                <p className="text-xs text-muted-foreground">Random Forest with Morgan Fingerprints</p>
              </div>
            </div>
            
            <div className="flex items-center">
              <Layers className="h-8 w-8 text-primary mr-3" />
              <div>
                <p className="text-sm font-medium">Batch Processing</p>
                <p className="text-xs text-muted-foreground">Process thousands of molecules</p>
              </div>
            </div>
            
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-primary mr-3" />
              <div>
                <p className="text-sm font-medium">High Accuracy</p>
                <p className="text-xs text-muted-foreground">Validated on pharmaceutical datasets</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardHeader;
