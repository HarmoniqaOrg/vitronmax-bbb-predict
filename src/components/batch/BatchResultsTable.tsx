
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Download, Filter } from 'lucide-react';

interface MoleculeResult {
  smiles: string;
  molecule_name?: string;
  bbb_probability: number;
  prediction_class: string;
  confidence_score: number;
  fingerprint_hash?: string;
  error?: string;
}

interface BatchResultsTableProps {
  results: MoleculeResult[];
  jobName?: string;
  isLoading?: boolean;
}

const BatchResultsTable = ({ results, jobName, isLoading }: BatchResultsTableProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('probability');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const filteredAndSortedResults = useMemo(() => {
    let filtered = results.filter(result => {
      const matchesSearch = !searchTerm || 
        result.smiles.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (result.molecule_name && result.molecule_name.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesFilter = filterClass === 'all' || 
        result.prediction_class === filterClass ||
        (filterClass === 'error' && result.error);
      
      return matchesSearch && matchesFilter;
    });

    filtered.sort((a, b) => {
      let aValue: number;
      let bValue: number;
      
      switch (sortBy) {
        case 'probability':
          aValue = a.bbb_probability || 0;
          bValue = b.bbb_probability || 0;
          break;
        case 'confidence':
          aValue = a.confidence_score || 0;
          bValue = b.confidence_score || 0;
          break;
        case 'name':
          return sortOrder === 'asc' 
            ? (a.molecule_name || a.smiles).localeCompare(b.molecule_name || b.smiles)
            : (b.molecule_name || b.smiles).localeCompare(a.molecule_name || a.smiles);
        default:
          aValue = a.bbb_probability || 0;
          bValue = b.bbb_probability || 0;
      }
      
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });

    return filtered;
  }, [results, searchTerm, filterClass, sortBy, sortOrder]);

  const getPredictionBadge = (result: MoleculeResult) => {
    if (result.error) {
      return <Badge variant="destructive">Error</Badge>;
    }
    
    const probability = result.bbb_probability;
    if (probability >= 0.7) {
      return <Badge className="bg-green-600">High Permeability</Badge>;
    } else if (probability >= 0.3) {
      return <Badge className="bg-yellow-600">Moderate</Badge>;
    } else {
      return <Badge className="bg-red-600">Low Permeability</Badge>;
    }
  };

  const exportToCSV = () => {
    const headers = ['SMILES', 'Molecule Name', 'BBB Probability', 'Prediction Class', 'Confidence Score'];
    const csvContent = [
      headers.join(','),
      ...filteredAndSortedResults.map(result => [
        `"${result.smiles}"`,
        `"${result.molecule_name || ''}"`,
        result.bbb_probability?.toFixed(4) || '',
        `"${result.prediction_class}"`,
        result.confidence_score?.toFixed(4) || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${jobName || 'batch-results'}-filtered.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const successCount = results.filter(r => !r.error).length;
  const errorCount = results.filter(r => r.error).length;
  const highPermeability = results.filter(r => !r.error && r.bbb_probability >= 0.7).length;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <p>Loading results...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold">{results.length}</p>
              <p className="text-sm text-muted-foreground">Total Molecules</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{successCount}</p>
              <p className="text-sm text-muted-foreground">Successful</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{errorCount}</p>
              <p className="text-sm text-muted-foreground">Errors</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{highPermeability}</p>
              <p className="text-sm text-muted-foreground">High Permeability</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Controls */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle>Results ({filteredAndSortedResults.length})</CardTitle>
            <Button onClick={exportToCSV} size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export Filtered
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by SMILES or molecule name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="w-48">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Results</SelectItem>
                <SelectItem value="BBB+">High Permeability</SelectItem>
                <SelectItem value="BBB-">Low Permeability</SelectItem>
                <SelectItem value="error">Errors Only</SelectItem>
              </SelectContent>
            </Select>

            <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
              const [field, order] = value.split('-');
              setSortBy(field);
              setSortOrder(order as 'asc' | 'desc');
            }}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="probability-desc">Probability (High to Low)</SelectItem>
                <SelectItem value="probability-asc">Probability (Low to High)</SelectItem>
                <SelectItem value="confidence-desc">Confidence (High to Low)</SelectItem>
                <SelectItem value="confidence-asc">Confidence (Low to High)</SelectItem>
                <SelectItem value="name-asc">Name (A to Z)</SelectItem>
                <SelectItem value="name-desc">Name (Z to A)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Results Table */}
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Molecule</TableHead>
                  <TableHead>SMILES</TableHead>
                  <TableHead>BBB Probability</TableHead>
                  <TableHead>Prediction</TableHead>
                  <TableHead>Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedResults.map((result, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {result.molecule_name || `Molecule ${index + 1}`}
                        </p>
                        {result.error && (
                          <p className="text-xs text-destructive mt-1">{result.error}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {result.smiles.length > 50 
                          ? `${result.smiles.substring(0, 50)}...` 
                          : result.smiles}
                      </code>
                    </TableCell>
                    <TableCell>
                      {!result.error ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {(result.bbb_probability * 100).toFixed(1)}%
                            </span>
                          </div>
                          <Progress 
                            value={result.bbb_probability * 100} 
                            className="h-1.5 w-16"
                          />
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {getPredictionBadge(result)}
                    </TableCell>
                    <TableCell>
                      {!result.error ? (
                        <span className="font-medium">
                          {(result.confidence_score * 100).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredAndSortedResults.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No results match your current filters.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BatchResultsTable;
