
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Send, Info } from 'lucide-react';

interface ExplainFormData {
  smiles: string;
  context: string;
}

const Explain = () => {
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
      // Mock explanation for demo purposes
      setTimeout(() => {
        setExplanation(`
Based on the SMILES string "${data.smiles}", here's an analysis of the BBB permeability:

The molecule shows moderate potential for blood-brain barrier penetration. Key factors affecting permeability include:

1. **Molecular Weight**: The compound's molecular weight appears to be within the favorable range for BBB penetration.

2. **Lipophilicity**: The balance of polar and non-polar regions suggests moderate lipophilicity, which is important for crossing the BBB.

3. **Hydrogen Bonding**: The number and positioning of hydrogen bond donors and acceptors play a crucial role in permeability.

4. **Structural Features**: Aromatic rings and functional groups present in the molecule contribute to its overall permeability profile.

${data.context ? `\nAdditional context provided: ${data.context}` : ''}

This analysis is based on machine learning models trained on BBB permeability data and molecular descriptors.
        `);
        setIsLoading(false);
      }, 2000);
      
    } catch (err) {
      console.error('Error getting explanation:', err);
      setError('Failed to get explanation. Please try again.');
      toast({
        title: 'Error',
        description: 'Failed to get explanation',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };
  
  const loadSampleExplanation = () => {
    setExplanation(`
Sample explanation for Ibuprofen (CC(C)CC1=CC=C(C=C1)C(C)C(=O)O):

Ibuprofen shows high probability for blood-brain barrier penetration with the following characteristics:

1. **Molecular Weight**: 206.28 Da - within optimal range for BBB penetration
2. **LogP**: 3.97 - favorable lipophilicity for membrane crossing
3. **Polar Surface Area**: 37.3 Ų - below the 90 Ų threshold
4. **Hydrogen Bonds**: 1 donor, 2 acceptors - optimal for BBB penetration

The aromatic ring system and branched aliphatic chain contribute to its favorable permeability profile.
    `);
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
              
              <div className="h-40 border rounded-md overflow-hidden flex items-center justify-center bg-muted">
                <p className="text-muted-foreground">Molecule visualization would appear here</p>
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
};

export default Explain;
