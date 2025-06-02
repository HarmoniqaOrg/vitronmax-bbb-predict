import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios'; // Keep for existing mutation if it doesn't use apiClient
import apiClient from '@/lib/api'; // Import apiClient
import { MoleculeResult, PdbOutput } from '@/lib/types'; // Import MoleculeResult and PdbOutput
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Fingerprint, FileText, MessageSquare } from 'lucide-react';
import PredictionResult from './PredictionResult';
import MoleculeViewer from './MoleculeViewer';

interface SinglePredictionFormData {
  smiles: string;
  molecule_name?: string;
}

type SinglePredictionResult = MoleculeResult;

const SinglePredictionForm = () => {
  const { toast } = useToast();
  const [result, setResult] = useState<SinglePredictionResult | null>(null);
  const [pdbData, setPdbData] = useState<string | null>(null); // State for PDB data
  const [isConvertingToPdb, setIsConvertingToPdb] = useState<boolean>(false);
  
  const { register, handleSubmit, watch, formState: { errors } } = useForm<SinglePredictionFormData>({
    defaultValues: {
      smiles: 'CC(=O)OC1=CC=CC=C1C(=O)O', // Default to working Aspirin SMILES
      molecule_name: 'Aspirin', // Default name for Aspirin
    }
  });
  
  const [debouncedSmiles, setDebouncedSmiles] = useState<string>(''); // State for debounced SMILES

  const smiles = watch('smiles');

  // Debounce SMILES input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSmiles(smiles);
    }, 500); // 500ms delay

    return () => {
      clearTimeout(handler);
    };
  }, [smiles]);

  // Effect to convert debounced SMILES to PDB
  useEffect(() => {
    if (debouncedSmiles) {
      const fetchPdb = async () => {
        setIsConvertingToPdb(true);
        setPdbData(null); // Clear previous PDB data
        try {
          console.log(`[SinglePredictionForm] Converting SMILES to PDB: ${debouncedSmiles}`);
          const response = await apiClient.convertSmilesToPdb(debouncedSmiles);
          setPdbData(response.pdb_string);
          console.log('[SinglePredictionForm] PDB data received:', response.pdb_string.substring(0,100) + '...'); // Log first 100 chars
        } catch (error) {
          console.error('[SinglePredictionForm] Error converting SMILES to PDB:', error);
          setPdbData(null); // Ensure PDB data is null on error
          // Optionally, show a toast message for PDB conversion failure
          toast({
            title: 'Molecule Display Error',
            description: 'Could not generate 3D structure for the entered SMILES.',
            variant: 'destructive',
          });
        }
        setIsConvertingToPdb(false);
      };
      fetchPdb();
    } else {
      setPdbData(null); // Clear PDB if SMILES is empty
    }
  }, [debouncedSmiles, toast]);

  const predictMolecule = async (data: SinglePredictionFormData): Promise<SinglePredictionResult> => {
    const apiUrl = `${import.meta.env.VITE_API_URL}/predict`;
    // Ensure the response is cast or expected as SinglePredictionResult (which is MoleculeResult)
    const response = await axios.post<SinglePredictionResult>(apiUrl, data);
    return response.data;
  };

  const mutation = useMutation<SinglePredictionResult, Error, SinglePredictionFormData>({
    mutationFn: predictMolecule,
    onSuccess: (data) => {
      setResult(data);
      toast({
        title: 'Prediction complete',
        description: `BBB probability: ${(data.bbb_probability * 100).toFixed(1)}%`,
      });
    },
    onError: (error) => {
      console.error('Prediction error:', error);
      toast({
        title: 'Prediction failed',
        description: (axios.isAxiosError(error) && error.response?.data?.detail)
          ? error.response.data.detail
          : 'Unable to process the molecule. Please check the SMILES string or API server.',
        variant: 'destructive',
      });
    },
  });

  // Log mutation status and result changes
  useEffect(() => {
    console.log('[SinglePredictionForm] Mutation or Result changed:', { 
      isPending: mutation.isPending,
      isSuccess: mutation.isSuccess,
      isError: mutation.isError,
      currentResult: result 
    });
  }, [mutation.isPending, mutation.isSuccess, mutation.isError, result]);

  const onSubmit = (data: SinglePredictionFormData) => {
    console.log('[SinglePredictionForm] onSubmit called with data:', data);
    mutation.mutate(data);
  };
  
  const handleGenerateReport = () => {
    toast({
      title: 'Report generated',
      description: 'Your PDF report would be downloaded in a real implementation',
    });
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
                placeholder="Enter SMILES string" // Updated placeholder as it's now pre-filled
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
            
            <div 
              className="border rounded-md overflow-hidden flex items-center justify-center bg-muted h-64 w-full relative"
            >
              {isConvertingToPdb && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-10 z-10">
                  <p className="text-sm text-muted-foreground">Loading 3D structure...</p> 
                  {/* You can add a spinner icon here */}
                </div>
              )}
              <MoleculeViewer pdbData={pdbData} />
            </div>
            
            <Button type="submit" className="w-full" disabled={mutation.isPending || isConvertingToPdb}>
              {mutation.isPending ? 'Predicting...' : 'Predict BBB Permeability'}
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
                  onClick={() => window.open(`/explain?smiles=${encodeURIComponent(result.smiles)}`, '_blank')}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Get AI Explanation
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
