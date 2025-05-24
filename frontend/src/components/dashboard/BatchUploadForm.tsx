
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileType, Info } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import apiClient from '@/lib/api';
import type { BatchUploadFormData } from '@/lib/types';

const BatchUploadForm = () => {
  const router = useRouter();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<BatchUploadFormData>();
  
  const { getRootProps, getInputProps } = useDropzone({
    accept: {
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setSelectedFile(acceptedFiles[0]);
        setValue('file', acceptedFiles[0]);
      }
    },
  });
  
  const onSubmit = async (data: BatchUploadFormData) => {
    if (!data.file) {
      toast({
        title: 'No file selected',
        description: 'Please select a CSV file to upload',
        variant: 'destructive',
      });
      return;
    }
    
    setIsUploading(true);
    
    try {
      const result = await apiClient.uploadBatchFile(data);
      
      toast({
        title: 'Batch job submitted',
        description: 'Your batch prediction job has been queued',
      });
      
      // Redirect to batch job page
      router.push(`/batch/${result.job_id}`);
    } catch (error) {
      console.error('Batch upload error:', error);
      toast({
        title: 'Upload failed',
        description: 'Unable to process the batch job. Please check your file format.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div {...getRootProps()} className="border-2 border-dashed rounded-md p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors">
              <input {...getInputProps()} />
              <div className="space-y-2">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-sm font-medium">Drag & drop a CSV file here, or click to select</p>
                <p className="text-xs text-muted-foreground">
                  CSV must contain 'smiles' column, optional 'molecule_name'
                </p>
              </div>
            </div>
            
            {selectedFile && (
              <div className="flex items-center justify-between p-3 rounded-md bg-muted">
                <div className="flex items-center">
                  <FileType className="h-5 w-5 mr-2" />
                  <div>
                    <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedFile(null);
                    setValue('file', undefined);
                  }}
                >
                  Remove
                </Button>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="jobName">Job Name (Optional)</Label>
              <Input
                id="jobName"
                placeholder="e.g., My Compounds Batch 1"
                {...register('jobName')}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="notifyEmail">Email Notification (Optional)</Label>
              <Input
                id="notifyEmail"
                type="email"
                placeholder="email@example.com"
                {...register('notifyEmail')}
              />
            </div>
            
            <Button type="submit" className="w-full" disabled={!selectedFile || isUploading}>
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
              
              <div className="space-y-4">
                <p className="text-sm">
                  Upload a CSV file containing SMILES strings to process multiple molecules at once.
                </p>
                
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    The CSV file must contain a column named 'smiles'. An optional 'molecule_name' column can also be included.
                  </AlertDescription>
                </Alert>
              </div>
            </div>
            
            <Separator />
            
            <div>
              <h4 className="font-medium mb-2">Example CSV Format</h4>
              <div className="bg-muted p-3 rounded-md font-mono text-xs overflow-x-auto">
                <pre>smiles,molecule_name
CCO,Ethanol
CC(=O)O,Acetic Acid
c1ccccc1,Benzene
CC(C)CC1=CC=C(C=C1)C(C)C(=O)O,Ibuprofen</pre>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Limits & Performance</h4>
              <ul className="text-sm space-y-1">
                <li>• Maximum file size: 50MB</li>
                <li>• Maximum molecules per batch: 10,000</li>
                <li>• Processing rate: ~600 molecules/minute</li>
                <li>• Results available for download for 30 days</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BatchUploadForm;
