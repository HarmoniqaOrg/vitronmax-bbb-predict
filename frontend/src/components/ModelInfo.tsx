import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

export function ModelInfo() {
  return (
    <Card className="w-full my-4">
      <CardHeader>
        <CardTitle>BBB Prediction Model Performance</CardTitle>
        <CardDescription>
          Random Forest with Morgan molecular fingerprints. Validated on 7807 external molecules.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 mb-4">
          <div className="flex flex-col items-center p-2 border rounded-lg">
            <span className="text-xs font-medium text-muted-foreground">AUC-ROC</span>
            <Badge variant="secondary" className="mt-1 text-sm">0.932</Badge>
          </div>
          <div className="flex flex-col items-center p-2 border rounded-lg">
            <span className="text-xs font-medium text-muted-foreground">AUC-PR</span>
            <Badge variant="secondary" className="mt-1 text-sm">0.959</Badge>
          </div>
          <div className="flex flex-col items-center p-2 border rounded-lg">
            <span className="text-xs font-medium text-muted-foreground">Accuracy</span>
            <Badge variant="secondary" className="mt-1 text-sm">0.85</Badge>
          </div>
          <div className="flex flex-col items-center p-2 border rounded-lg">
            <span className="text-xs font-medium text-muted-foreground">F1 (BBB+)</span>
            <Badge variant="secondary" className="mt-1 text-sm">0.89</Badge>
          </div>
          <div className="flex flex-col items-center p-2 border rounded-lg">
            <span className="text-xs font-medium text-muted-foreground">F1 (BBB-)</span>
            <Badge variant="secondary" className="mt-1 text-sm">0.78</Badge>
          </div>
        </div>
        <p className="text-sm text-center text-muted-foreground">
          Optimal classification threshold: 0.531. For full details, see the 
          <a href="https://github.com/HarmoniqaOrg/vitronmax-bbb-predict/blob/main/docs/model_validation.md" 
             className="ml-1 underline hover:text-primary" target="_blank" rel="noopener noreferrer">
            complete validation documentation
          </a>.
        </p>
      </CardContent>
    </Card>
  );
}
