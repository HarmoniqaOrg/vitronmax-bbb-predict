import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { ExternalLink, ShieldCheck } from 'lucide-react';

export function ModelInfo() {
  const metrics = [
    { label: 'AUC-ROC', value: '0.932' },
    { label: 'AUC-PR', value: '0.959' },
    { label: 'Accuracy', value: '0.85' },
    { label: 'F1 (BBB+)', value: '0.89' },
    { label: 'F1 (BBB-)', value: '0.78' },
  ];

  return (
    <Card className="w-full my-8 border hover:shadow-md transition-all">
      <CardHeader className="pb-4 items-center text-center">
        <div className="mb-4">
          <ShieldCheck className="h-10 w-10 text-primary" />
        </div>
        <CardTitle className="text-2xl font-semibold">Model Performance & Validation</CardTitle>
        <CardDescription className="text-md">
          Our Blood-Brain Barrier (BBB) permeability prediction model utilizes a Random Forest algorithm
          with Morgan molecular fingerprints. It has been rigorously validated on an external dataset of 7807 molecules.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Key performance metrics on the external test set:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-6">
          {metrics.map((metric) => (
            <div 
              key={metric.label} 
              className="flex flex-col items-center justify-center p-4 bg-muted/50 border border-border/50 rounded-lg hover:shadow-md transition-shadow"
            >
              <span className="text-sm font-medium text-muted-foreground mb-1">{metric.label}</span>
              <Badge variant="outline" className="text-lg font-semibold px-3 py-1">{metric.value}</Badge>
            </div>
          ))}
        </div>
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">
            Optimal classification threshold: 0.531.
          </p>
          <a 
            href="https://github.com/HarmoniqaOrg/vitronmax-bbb-predict/blob/main/docs/model-validation.md" 
            className="inline-flex items-center text-sm font-medium text-primary hover:underline"
            target="_blank" 
            rel="noopener noreferrer"
          >
            View Complete Validation Documentation
            <ExternalLink className="ml-1.5 h-4 w-4" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
