
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Fingerprint, FileText, MessageSquare } from 'lucide-react';
import apiClient from '@/lib/api';
import type { SinglePredictionFormData, MoleculeResult } from '@/lib/types';
import MoleculeRenderer from '@/components/MoleculeRenderer';
import PredictionResult from '@/components/dashboard/PredictionResult';

const SinglePredictionForm = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<MoleculeResult | null>(null);
  
  const { register, handleSubmit, watch, formState: { errors } } = useForm<SinglePredictionFormData>({
    defaultValues: {
      smiles: '',
      molecule_name: '',
    }
  });
  
  const smiles = watch('smiles');
  
  const onSubmit = async (data: SinglePredictionFormData) => {
    setIsLoading(true);
    
    try {
      const result = await apiClient.predictMolecule(data);
      setResult(result);
      
      toast({
        title: 'Prediction complete',
        description: `BBB probability: ${(result.bbb_probability * 100).toFixed(1)}%`,
      });
    } catch (error) {
      console.error('Prediction error:', error);
      toast({
        title: 'Prediction failed',
        description: 'Unable to process the molecule. Please check the SMILES string.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleGenerateReport = async () => {
    if (!result) return;
    
    try {
      const blob = await apiClient.generateReportFromSmiles({
        smiles: result.smiles,
        molecule_name: result.molecule_name,
      });
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bbb_report_${result.molecule_name || 'molecule'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: 'Report generated',
        description: 'Your PDF report has been downloaded',
      });
    } catch (error) {
      console.error('Report generation error:', error);
      toast({
        title: 'Report generation failed',
        description: 'Unable to generate the PDF report',
        variant: 'destructive',
      });
    }
  };
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="smiles">SMILES String</Label>
              <Input
                id="smiles"
                placeholder="Enter SMILES (e.g., CCO for ethanol)"
                {...register('smiles', { required: true })}
              />
              {errors.smiles && (
                <p className="text-sm text-destructive">SMILES string is required</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="molecule_name">Molecule Name (Optional)</Label>
              <Input
                id="molecule_name"
                placeholder="e.g., Ibuprofen"
                {...register('molecule_name')}
              />
            </div>
            
            <div className="h-40 border rounded-md overflow-hidden">
              <MoleculeRenderer smiles={smiles} />
            </div>
            
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Predicting...' : 'Predict BBB Permeability'}
            </Button>
          </form>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="pt-6">
          {result ? (
            <div className="space-y-6">
              <PredictionResult result={result} />
              
              <Separator />
              
              <div className="flex flex-col gap-3">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={handleGenerateReport}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Generate PDF Report
                </Button>
                
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  asChild
                >
                  <a href={`/explain?smiles=${encodeURIComponent(result.smiles)}`}>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Get AI Explanation
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Fingerprint className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium mb-2">No Prediction Yet</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Enter a SMILES string and click "Predict" to analyze BBB permeability
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SinglePredictionForm;
