
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FlaskConical, Layers } from 'lucide-react';

const RecentActivityList = () => {
  const activities = [
    {
      id: '1',
      type: 'single',
      title: 'Ibuprofen',
      timestamp: '5 minutes ago',
      status: 'completed'
    },
    {
      id: '2',
      type: 'batch',
      title: 'GPCR Ligands Batch',
      timestamp: '2 hours ago',
      status: 'completed'
    },
    {
      id: '3',
      type: 'single',
      title: 'Fluoxetine',
      timestamp: '1 day ago',
      status: 'completed'
    }
  ];
  
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
        return null;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="space-y-2">
          {activities.map((activity) => (
            <div 
              key={activity.id}
              className="flex items-center justify-between p-3 rounded-md hover:bg-muted transition-colors"
            >
              <div className="flex items-center">
                {activity.type === 'single' ? (
                  <FlaskConical className="h-5 w-5 mr-3 text-primary" />
                ) : (
                  <Layers className="h-5 w-5 mr-3 text-primary" />
                )}
                
                <div>
                  <p className="font-medium text-sm">{activity.title}</p>
                  <p className="text-xs text-muted-foreground">{activity.timestamp}</p>
                </div>
              </div>
              
              {getStatusBadge(activity.status)}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default RecentActivityList;
