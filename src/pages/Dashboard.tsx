
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import SinglePredictionForm from '@/components/dashboard/SinglePredictionForm';
import BatchUploadForm from '@/components/dashboard/BatchUploadForm';
import RecentActivityList from '@/components/dashboard/RecentActivityList';
import DashboardStats from '@/components/dashboard/DashboardStats';

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState<string>('single');

  return (
    <div className="container mx-auto px-4 py-8">
      <DashboardHeader />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2">
          <Tabs
            defaultValue="single"
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="single">Single Prediction</TabsTrigger>
              <TabsTrigger value="batch">Batch Processing</TabsTrigger>
            </TabsList>
            <TabsContent value="single" className="mt-6">
              <SinglePredictionForm />
            </TabsContent>
            <TabsContent value="batch" className="mt-6">
              <BatchUploadForm />
            </TabsContent>
          </Tabs>
        </div>
        
        <div className="space-y-6">
          <DashboardStats />
          <RecentActivityList />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
