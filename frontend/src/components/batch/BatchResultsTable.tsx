import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Search, Download, Filter, ArrowUpDown } from 'lucide-react';
import type { MoleculeResult } from '@/lib/types';

interface BatchResultsTableProps {
  results: MoleculeResult[];
  jobName?: string;
  isLoading?: boolean;
}

const BatchResultsTable = ({ results, jobName, isLoading }: BatchResultsTableProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [sortBy, setSortBy] = useState<keyof MoleculeResult | 'name'>('bbb_probability');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleSort = (column: keyof MoleculeResult | 'name') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const filteredAndSortedResults = useMemo(() => {
    const filtered = results.filter(result => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || 
        result.smiles.toLowerCase().includes(searchLower) ||
        (result.molecule_name && result.molecule_name.toLowerCase().includes(searchLower));
      
      const matchesFilter = filterClass === 'all' || 
        result.prediction_class === filterClass ||
        (filterClass === 'error' && result.error);
      
      return matchesSearch && matchesFilter;
    });

    filtered.sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;
      
      if (sortBy === 'name') {
        aValue = a.molecule_name || a.smiles;
        bValue = b.molecule_name || b.smiles;
        return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }

      aValue = typeof a[sortBy] === 'number' ? (a[sortBy] as number) : 0;
      bValue = typeof b[sortBy] === 'number' ? (b[sortBy] as number) : 0;
      
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
    const headers = [
      'SMILES', 'Molecule Name', 'BBB Probability', 'Prediction Class', 'Confidence Score',
      'Molecular Weight', 'LogP', 'TPSA', 'H-Bond Donors', 'H-Bond Acceptors',
      'Rotatable Bonds', 'PAINS Alerts', 'Brenk Alerts', 'Formal Charge', 'Refractivity',
      'Num Rings', 'Exact MW', 'Error'
    ];
    const csvContent = [
      headers.join(','),
      ...filteredAndSortedResults.map(result => [
        `"${result.smiles}"`,
        `"${result.molecule_name || ''}"`,
        result.bbb_probability?.toFixed(4) || '0.0000',
        `"${result.prediction_class || ''}"`,
        result.confidence_score?.toFixed(4) || '0.0000',
        result.molecular_weight?.toFixed(2) || '0.00',
        result.logp?.toFixed(2) || '0.00',
        result.tpsa?.toFixed(2) || '0.00',
        result.h_bond_donors ?? 0,
        result.h_bond_acceptors ?? 0,
        result.rotatable_bonds ?? 0,
        result.pains_alerts ?? 0,
        result.brenk_alerts ?? 0,
        result.formal_charge ?? 0,
        result.refractivity?.toFixed(2) || '0.00',
        result.num_rings ?? 0,
        result.exact_mw?.toFixed(2) || '0.00',
        `"${result.error || ''}"`
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
              const [col, order] = value.split('-');
              setSortBy(col as keyof MoleculeResult | 'name');
              setSortOrder(order as 'asc' | 'desc');
            }}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bbb_probability-desc">Probability (High to Low)</SelectItem>
                <SelectItem value="bbb_probability-asc">Probability (Low to High)</SelectItem>
                <SelectItem value="confidence_score-desc">Confidence (High to Low)</SelectItem>
                <SelectItem value="confidence_score-asc">Confidence (Low to High)</SelectItem>
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
                  <TableHead className="w-[150px]">
                    <Button variant="ghost" onClick={() => handleSort('smiles')}>
                      SMILES
                      {sortBy === 'smiles' && <ArrowUpDown className="ml-2 h-4 w-4" />}
                    </Button>
                  </TableHead>
                  <TableHead className="w-[150px]">
                    <Button variant="ghost" onClick={() => handleSort('name')}>
                      Molecule Name
                      {sortBy === 'name' && <ArrowUpDown className="ml-2 h-4 w-4" />}
                    </Button>
                  </TableHead>
                  <TableHead className="w-[120px] text-right">
                    <Button variant="ghost" onClick={() => handleSort('bbb_probability')}>
                      BBB Prob.
                      {sortBy === 'bbb_probability' && <ArrowUpDown className="ml-2 h-4 w-4" />}
                    </Button>
                  </TableHead>
                  <TableHead className="w-[150px]">Prediction</TableHead>
                  <TableHead className="w-[120px] text-right">
                    <Button variant="ghost" onClick={() => handleSort('confidence_score')}>
                      Confidence
                      {sortBy === 'confidence_score' && <ArrowUpDown className="ml-2 h-4 w-4" />}
                    </Button>
                  </TableHead>
                  <TableHead className="w-[100px] text-right">
                    <Button variant="ghost" onClick={() => handleSort('molecular_weight')}>
                      MW
                      {sortBy === 'molecular_weight' && <ArrowUpDown className="ml-2 h-4 w-4" />}
                    </Button>
                  </TableHead>
                  <TableHead className="w-[100px] text-right">
                    <Button variant="ghost" onClick={() => handleSort('logp')}>
                      LogP
                      {sortBy === 'logp' && <ArrowUpDown className="ml-2 h-4 w-4" />}
                    </Button>
                  </TableHead>
                  <TableHead className="w-[100px] text-right">
                    <Button variant="ghost" onClick={() => handleSort('pains_alerts')}>
                      PAINS
                      {sortBy === 'pains_alerts' && <ArrowUpDown className="ml-2 h-4 w-4" />}
                    </Button>
                  </TableHead>
                  <TableHead className="w-[100px] text-right">
                    <Button variant="ghost" onClick={() => handleSort('brenk_alerts')}>
                      Brenk
                      {sortBy === 'brenk_alerts' && <ArrowUpDown className="ml-2 h-4 w-4" />}
                    </Button>
                  </TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedResults.length > 0 ? (
                  filteredAndSortedResults.map((result, index) => (
                    <TableRow key={`${result.smiles}-${index}`}>
                      <TableCell className="font-mono text-xs break-all">{result.smiles}</TableCell>
                      <TableCell>{result.molecule_name || 'N/A'}</TableCell>
                      <TableCell className="text-right">{result.bbb_probability?.toFixed(3)}</TableCell>
                      <TableCell>{getPredictionBadge(result)}</TableCell>
                      <TableCell className="text-right">{result.confidence_score?.toFixed(1)}%</TableCell>
                      <TableCell className="text-right">{result.molecular_weight?.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{result.logp?.toFixed(2)}</TableCell>
                      <TableCell 
                        className={`text-right ${result.pains_alerts > 0 ? 'text-red-600 font-semibold' : ''}`}>
                        {result.pains_alerts}
                      </TableCell>
                      <TableCell 
                        className={`text-right ${result.brenk_alerts > 0 ? 'text-red-600 font-semibold' : ''}`}>
                        {result.brenk_alerts}
                      </TableCell>
                      <TableCell>
                        {result.error ? (
                          <Badge variant="destructive" title={result.error}>Error</Badge>
                        ) : (
                          <Badge variant="secondary">Success</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center">
                      No results found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BatchResultsTable;
