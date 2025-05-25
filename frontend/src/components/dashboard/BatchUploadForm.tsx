'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Info } from 'lucide-react';
import apiClient from '@/lib/api';
import type { BatchUploadFormData } from '@/lib/types';

const BatchUploadForm = () => {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const { register, handleSubmit, reset } = useForm<{
    jobName: string;
    notifyEmail: string;
  }>();
  
  const onSubmit = async (data: { jobName: string; notifyEmail: string }) => {
    if (!selectedFile) {
      toast({
        title: 'No file selected',
        description: 'Please select a CSV file to upload',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    
    try {
      const formData: BatchUploadFormData = {
        file: selectedFile,
        jobName: data.jobName || undefined,
        notifyEmail: data.notifyEmail || undefined,
      };

      const result = await apiClient.uploadBatchFile(formData);
      
      toast({
        title: 'Batch job submitted successfully',
        description: `Job ID: ${result.job_id}`,
      });
      
      // Reset form
      reset();
      setSelectedFile(null);
      
    } catch (error: unknown) {
      console.error('Upload failed:', error);
      let description = 'Failed to submit batch job';
      if (error && typeof error === 'object' && 'response' in error && 
          error.response && typeof error.response === 'object' && 'data' in error.response &&
          error.response.data && typeof error.response.data === 'object' && 'detail' in error.response.data) {
        description = (error.response.data as { detail: string }).detail;
      }
      toast({
        title: 'Upload failed',
        description: description,
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="border-2 border-dashed rounded-md p-6 text-center">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Select a CSV file</p>
              <Input 
                type="file" 
                accept=".csv" 
                className="mt-4" 
                onChange={handleFileChange}
              />
              {selectedFile && (
                <p className="text-xs text-muted-foreground mt-2">
                  Selected: {selectedFile.name}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="jobName">Job Name (Optional)</Label>
              <Input
                id="jobName"
                placeholder="e.g., My Compounds Batch 1"
                {...register('jobName')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notifyEmail">Notification Email (Optional)</Label>
              <Input
                id="notifyEmail"
                type="email"
                placeholder="your@email.com"
                {...register('notifyEmail')}
              />
            </div>
            
            <Button type="submit" className="w-full" disabled={isUploading || !selectedFile}>
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
                  Upload a CSV file with &apos;smiles&apos; column and optional &apos;molecule_name&apos; column
                </AlertDescription>
              </Alert>
            </div>

            <div>
              <h4 className="font-medium mb-2">CSV Format Example:</h4>
              <div className="bg-muted p-3 rounded text-sm font-mono">
                smiles,molecule_name<br/>
                CCO,Ethanol<br/>
                CC(C)O,Isopropanol<br/>
                CCCCO,Butanol
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BatchUploadForm;
