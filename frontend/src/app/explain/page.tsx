
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Send, Info } from 'lucide-react';
import apiClient from '@/lib/api';
import { ExplainRequest } from '@/lib/types';
import MoleculeRenderer from '@/components/MoleculeRenderer';

interface ExplainFormData {
  smiles: string;
  context: string;
}

export default function ExplainPage() {
  const { toast } = useToast();
  const [explanation, setExplanation] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const { register, handleSubmit, watch, formState: { errors } } = useForm<ExplainFormData>({
    defaultValues: {
      smiles: '',
      context: '',
    }
  });
  
  const smiles = watch('smiles');
  
  const onSubmit = async (data: ExplainFormData) => {
    setIsLoading(true);
    setError(null);
    setExplanation('');
    
    try {
      const request: ExplainRequest = {
        smiles: data.smiles,
        context: data.context || undefined,
      };
      
      const response = await apiClient.explainPrediction(request);
      
      if (!response.ok) {
        throw new Error('Failed to get explanation');
      }
      
      // Handle server-sent events
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        throw new Error('Failed to read response stream');
      }
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonData = JSON.parse(line.slice(6));
              
              if (jsonData.content) {
                setExplanation(prev => prev + jsonData.content);
              } else if (jsonData.error) {
                setError(jsonData.error);
              }
            } catch (e) {
              console.error('Failed to parse JSON:', e);
            }
          }
        }
      }
      
    } catch (err) {
      console.error('Error getting explanation:', err);
      setError('Failed to get explanation. Please try again.');
      toast({
        title: 'Error',
        description: 'Failed to get explanation',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Function to load sample explanation for demo purposes
  const loadSampleExplanation = async () => {
    setIsLoading(true);
    
    try {
      const sample = await apiClient.getSampleExplanation();
      setExplanation(sample.explanation);
    } catch (err) {
      console.error('Error loading sample explanation:', err);
      toast({
        title: 'Error',
        description: 'Failed to load sample explanation',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">AI Explanation</h1>
          <p className="text-muted-foreground">
            Get AI-powered explanations for BBB permeability predictions
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="smiles">Molecule SMILES</Label>
                <Input
                  id="smiles"
                  placeholder="Enter SMILES string (e.g., CCO)"
                  {...register('smiles', { required: true })}
                />
                {errors.smiles && (
                  <p className="text-sm text-destructive">SMILES is required</p>
                )}
              </div>
              
              <div className="h-40 border rounded-md overflow-hidden">
                <MoleculeRenderer smiles={smiles} />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="context">Additional Context (Optional)</Label>
                <Textarea
                  id="context"
                  placeholder="Enter any additional context or specific questions"
                  className="min-h-[100px]"
                  {...register('context')}
                />
              </div>
              
              <div className="flex justify-between items-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={loadSampleExplanation}
                >
                  <Info className="mr-2 h-4 w-4" />
                  Load Sample
                </Button>
                
                <Button type="submit" disabled={isLoading}>
                  <Send className="mr-2 h-4 w-4" />
                  {isLoading ? 'Generating...' : 'Generate Explanation'}
                </Button>
              </div>
            </form>
          </div>
          
          <div>
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Explanation</CardTitle>
              </CardHeader>
              <CardContent className="overflow-auto max-h-[600px]">
                {isLoading && !explanation && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Generating explanation...</p>
                  </div>
                )}
                
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                
                {explanation ? (
                  <div className="prose dark:prose-invert max-w-none">
                    {explanation.split('\n').map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                ) : !isLoading && !error ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">
                      Enter a SMILES string and click "Generate Explanation" to get an AI-powered
                      analysis of the molecule's BBB permeability factors.
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
