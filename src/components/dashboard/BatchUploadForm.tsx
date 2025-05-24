
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Info } from 'lucide-react';

const BatchUploadForm = () => {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  
  const { register, handleSubmit } = useForm();
  
  const onSubmit = async (data: any) => {
    setIsUploading(true);
    
    // Mock upload
    setTimeout(() => {
      toast({
        title: 'Batch job submitted',
        description: 'Your batch prediction job has been queued',
      });
      setIsUploading(false);
    }, 2000);
  };
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="border-2 border-dashed rounded-md p-6 text-center">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Drag & drop a CSV file here, or click to select</p>
              <Input type="file" accept=".csv" className="mt-4" {...register('file')} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="jobName">Job Name (Optional)</Label>
              <Input
                id="jobName"
                placeholder="e.g., My Compounds Batch 1"
                {...register('jobName')}
              />
            </div>
            
            <Button type="submit" className="w-full" disabled={isUploading}>
              {isUploading ? 'Uploading...' : 'Upload and Process'}
            </Button>
          </form>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Batch Processing Instructions</h3>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Upload a CSV file with 'smiles' column and optional 'molecule_name' column
                </AlertDescription>
              </Alert>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BatchUploadForm;
