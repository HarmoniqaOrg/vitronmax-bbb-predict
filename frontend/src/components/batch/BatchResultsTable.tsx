import { useState, useMemo, useRef } from 'react';
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
import { SmilesStructure } from '@/components/batch/SmilesStructure';
import { useVirtualizer } from '@tanstack/react-virtual';
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

  const parentRef = useRef<HTMLDivElement>(null);
  const ROW_ESTIMATE_SIZE = 75; // Estimated height for a row in pixels

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
        result.bbb_class === filterClass ||
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

  const rowVirtualizer = useVirtualizer({
    count: filteredAndSortedResults.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_ESTIMATE_SIZE,
    overscan: 5, // Render 5 items above and below the visible area
  });

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
      'SMILES', 'Molecule Name', 'BBB Probability', 'Prediction Class', 'Confidence Score', 'Applicability Score',
      'Molecular Weight', 'Exact MW', 'Molecular Formula', 'LogP', 'TPSA', 'H-Bond Donors', 'H-Bond Acceptors',
      'Rotatable Bonds', 'Fraction CSP3', 'Molar Refractivity', 'ESOL LogS', 'GI Absorption', 'Lipinski Rule',
      'PAINS Alerts', 'Brenk Alerts', 'Num Heavy Atoms', 'Formal Charge', 'Num Rings', 'Error'
    ];
    const csvContent = [
      headers.join(','),
      ...filteredAndSortedResults.map(result => [
        `"${result.smiles}"`,
        `"${result.molecule_name || ''}"`,
        result.bbb_probability?.toFixed(4) ?? 'N/A',
        `"${result.bbb_class || ''}"`,
        result.prediction_certainty?.toFixed(4) ?? 'N/A',
        result.applicability_score?.toFixed(4) ?? 'N/A',
        result.mw?.toFixed(2) ?? 'N/A',
        result.exact_mw?.toFixed(2) ?? 'N/A',
        `"${result.molecular_formula || ''}"`,
        result.logp?.toFixed(2) ?? 'N/A',
        result.tpsa?.toFixed(2) ?? 'N/A',
        result.h_donors ?? 'N/A',
        result.h_acceptors ?? 'N/A',
        result.rot_bonds ?? 'N/A',
        result.frac_csp3?.toFixed(3) ?? 'N/A',
        result.molar_refractivity?.toFixed(2) ?? 'N/A',
        result.log_s_esol?.toFixed(2) ?? 'N/A',
        `"${result.gi_absorption || ''}"`,
        result.lipinski_passes === null ? 'N/A' : (result.lipinski_passes ? 'Yes' : 'No'),
        result.pains_alerts ?? 'N/A',
        result.brenk_alerts ?? 'N/A',
        result.num_heavy_atoms ?? 'N/A',
        result.formal_charge ?? 'N/A',
        result.num_rings ?? 'N/A',
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
        <CardContent ref={parentRef} style={{ height: '600px', overflowY: 'auto' }}>
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
                <SelectItem value="prediction_certainty-desc">Confidence (High to Low)</SelectItem>
                <SelectItem value="prediction_certainty-asc">Confidence (Low to High)</SelectItem>
                <SelectItem value="applicability_score-desc">App. Score (High to Low)</SelectItem>
                <SelectItem value="applicability_score-asc">App. Score (Low to High)</SelectItem>
                <SelectItem value="mw-desc">MW (High to Low)</SelectItem>
                <SelectItem value="mw-asc">MW (Low to High)</SelectItem>
                <SelectItem value="exact_mw-desc">Exact MW (High to Low)</SelectItem>
                <SelectItem value="exact_mw-asc">Exact MW (Low to High)</SelectItem>
                <SelectItem value="molecular_formula-asc">Mol. Formula (A to Z)</SelectItem>
                <SelectItem value="molecular_formula-desc">Mol. Formula (Z to A)</SelectItem>
                <SelectItem value="logp-desc">LogP (High to Low)</SelectItem>
                <SelectItem value="logp-asc">LogP (Low to High)</SelectItem>
                <SelectItem value="tpsa-desc">TPSA (High to Low)</SelectItem>
                <SelectItem value="tpsa-asc">TPSA (Low to High)</SelectItem>
                <SelectItem value="log_s_esol-desc">ESOL LogS (High to Low)</SelectItem>
                <SelectItem value="log_s_esol-asc">ESOL LogS (Low to High)</SelectItem>
                <SelectItem value="molar_refractivity-desc">Molar Refr. (High to Low)</SelectItem>
                <SelectItem value="molar_refractivity-asc">Molar Refr. (Low to High)</SelectItem>
                <SelectItem value="h_donors-desc">H-Donors (High to Low)</SelectItem>
                <SelectItem value="h_donors-asc">H-Donors (Low to High)</SelectItem>
                <SelectItem value="h_acceptors-desc">H-Acceptors (High to Low)</SelectItem>
                <SelectItem value="h_acceptors-asc">H-Acceptors (Low to High)</SelectItem>
                <SelectItem value="rot_bonds-desc">Rot. Bonds (High to Low)</SelectItem>
                <SelectItem value="rot_bonds-asc">Rot. Bonds (Low to High)</SelectItem>
                <SelectItem value="num_rings-desc">Num Rings (High to Low)</SelectItem>
                <SelectItem value="num_rings-asc">Num Rings (Low to High)</SelectItem>
                <SelectItem value="frac_csp3-desc">Frac Csp3 (High to Low)</SelectItem>
                <SelectItem value="frac_csp3-asc">Frac Csp3 (Low to High)</SelectItem>
                <SelectItem value="num_heavy_atoms-desc">Heavy Atoms (High to Low)</SelectItem>
                <SelectItem value="num_heavy_atoms-asc">Heavy Atoms (Low to High)</SelectItem>
                <SelectItem value="formal_charge-desc">Formal Chg. (High to Low)</SelectItem>
                <SelectItem value="formal_charge-asc">Formal Chg. (Low to High)</SelectItem>
                <SelectItem value="gi_absorption-asc">GI Absorp. (A to Z)</SelectItem>
                <SelectItem value="gi_absorption-desc">GI Absorp. (Z to A)</SelectItem>
                <SelectItem value="lipinski_passes-desc">Lipinski (Yes First)</SelectItem>
                <SelectItem value="lipinski_passes-asc">Lipinski (No First)</SelectItem>
                <SelectItem value="pains_alerts-desc">PAINS (High to Low)</SelectItem>
                <SelectItem value="pains_alerts-asc">PAINS (Low to High)</SelectItem>
                <SelectItem value="brenk_alerts-desc">Brenk (High to Low)</SelectItem>
                <SelectItem value="brenk_alerts-asc">Brenk (Low to High)</SelectItem>
                <SelectItem value="name-asc">Name (A to Z)</SelectItem>
                <SelectItem value="name-desc">Name (Z to A)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Results Table */}
          <div className="border rounded-md">
            <Table>
              <TableHeader style={{ position: 'sticky', top: 0, zIndex: 1, background: 'hsl(var(--card))' }}>
                <TableRow>
                  <TableHead className="w-[150px]"><Button variant="ghost" onClick={() => handleSort('smiles')}>SMILES{sortBy === 'smiles' && <ArrowUpDown className="ml-2 h-4 w-4" />}</Button></TableHead>
                  <TableHead className="w-[180px]">Structure</TableHead>
                  <TableHead className="w-[150px]"><Button variant="ghost" onClick={() => handleSort('name')}>Molecule Name{sortBy === 'name' && <ArrowUpDown className="ml-2 h-4 w-4" />}</Button></TableHead>
                  <TableHead className="w-[100px] text-right"><Button variant="ghost" onClick={() => handleSort('bbb_probability')}>BBB Prob.{sortBy === 'bbb_probability' && <ArrowUpDown className="ml-2 h-4 w-4" />}</Button></TableHead>
                  <TableHead className="w-[130px]">Prediction</TableHead>
                  <TableHead className="w-[120px]"><Button variant="ghost" onClick={() => handleSort('bbb_class')}>Pred. Class{sortBy === 'bbb_class' && <ArrowUpDown className="ml-2 h-4 w-4" />}</Button></TableHead>
                  <TableHead className="w-[100px] text-right"><Button variant="ghost" onClick={() => handleSort('prediction_certainty')}>Confidence{sortBy === 'prediction_certainty' && <ArrowUpDown className="ml-2 h-4 w-4" />}</Button></TableHead>
                  <TableHead className="w-[100px] text-right"><Button variant="ghost" onClick={() => handleSort('applicability_score')}>App. Score{sortBy === 'applicability_score' && <ArrowUpDown className="ml-2 h-4 w-4" />}</Button></TableHead>
                  <TableHead className="w-[90px] text-right"><Button variant="ghost" onClick={() => handleSort('mw')}>MW{sortBy === 'mw' && <ArrowUpDown className="ml-2 h-4 w-4" />}</Button></TableHead>
                  <TableHead className="w-[100px] text-right"><Button variant="ghost" onClick={() => handleSort('exact_mw')}>Exact MW{sortBy === 'exact_mw' && <ArrowUpDown className="ml-2 h-4 w-4" />}</Button></TableHead>
                  <TableHead className="w-[130px]"><Button variant="ghost" onClick={() => handleSort('molecular_formula')}>Mol. Formula{sortBy === 'molecular_formula' && <ArrowUpDown className="ml-2 h-4 w-4" />}</Button></TableHead>
                  <TableHead className="w-[90px] text-right"><Button variant="ghost" onClick={() => handleSort('logp')}>LogP{sortBy === 'logp' && <ArrowUpDown className="ml-2 h-4 w-4" />}</Button></TableHead>
                  <TableHead className="w-[90px] text-right"><Button variant="ghost" onClick={() => handleSort('tpsa')}>TPSA{sortBy === 'tpsa' && <ArrowUpDown className="ml-2 h-4 w-4" />}</Button></TableHead>
                  <TableHead className="w-[100px] text-right"><Button variant="ghost" onClick={() => handleSort('log_s_esol')}>ESOL LogS{sortBy === 'log_s_esol' && <ArrowUpDown className="ml-2 h-4 w-4" />}</Button></TableHead>
                  <TableHead className="w-[110px] text-right"><Button variant="ghost" onClick={() => handleSort('molar_refractivity')}>Molar Refr.{sortBy === 'molar_refractivity' && <ArrowUpDown className="ml-2 h-4 w-4" />}</Button></TableHead>
                  <TableHead className="w-[90px] text-right"><Button variant="ghost" onClick={() => handleSort('h_donors')}>H-Donors{sortBy === 'h_donors' && <ArrowUpDown className="ml-2 h-4 w-4" />}</Button></TableHead>
                  <TableHead className="w-[100px] text-right"><Button variant="ghost" onClick={() => handleSort('h_acceptors')}>H-Acceptors{sortBy === 'h_acceptors' && <ArrowUpDown className="ml-2 h-4 w-4" />}</Button></TableHead>
                  <TableHead className="w-[100px] text-right"><Button variant="ghost" onClick={() => handleSort('rot_bonds')}>Rot. Bonds{sortBy === 'rot_bonds' && <ArrowUpDown className="ml-2 h-4 w-4" />}</Button></TableHead>
                  <TableHead className="w-[100px] text-right"><Button variant="ghost" onClick={() => handleSort('num_rings')}>Num Rings{sortBy === 'num_rings' && <ArrowUpDown className="ml-2 h-4 w-4" />}</Button></TableHead>
                  <TableHead className="w-[100px] text-right"><Button variant="ghost" onClick={() => handleSort('frac_csp3')}>Frac Csp3{sortBy === 'frac_csp3' && <ArrowUpDown className="ml-2 h-4 w-4" />}</Button></TableHead>
                  <TableHead className="w-[110px] text-right"><Button variant="ghost" onClick={() => handleSort('num_heavy_atoms')}>Heavy Atoms{sortBy === 'num_heavy_atoms' && <ArrowUpDown className="ml-2 h-4 w-4" />}</Button></TableHead>
                  <TableHead className="w-[110px] text-right"><Button variant="ghost" onClick={() => handleSort('formal_charge')}>Formal Chg.{sortBy === 'formal_charge' && <ArrowUpDown className="ml-2 h-4 w-4" />}</Button></TableHead>
                  <TableHead className="w-[100px]"><Button variant="ghost" onClick={() => handleSort('gi_absorption')}>GI Absorp.{sortBy === 'gi_absorption' && <ArrowUpDown className="ml-2 h-4 w-4" />}</Button></TableHead>
                  <TableHead className="w-[90px]"><Button variant="ghost" onClick={() => handleSort('lipinski_passes')}>Lipinski{sortBy === 'lipinski_passes' && <ArrowUpDown className="ml-2 h-4 w-4" />}</Button></TableHead>
                  <TableHead className="w-[90px] text-right"><Button variant="ghost" onClick={() => handleSort('pains_alerts')}>PAINS{sortBy === 'pains_alerts' && <ArrowUpDown className="ml-2 h-4 w-4" />}</Button></TableHead>
                  <TableHead className="w-[90px] text-right"><Button variant="ghost" onClick={() => handleSort('brenk_alerts')}>Brenk{sortBy === 'brenk_alerts' && <ArrowUpDown className="ml-2 h-4 w-4" />}</Button></TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const result = filteredAndSortedResults[virtualRow.index];
                  return (
                    <TableRow 
                      key={virtualRow.key} 
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement} // Important for dynamic row heights if ever needed
                      className={result.error ? 'bg-red-50 dark:bg-red-900/30' : ''}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <TableCell className="font-mono text-xs break-all">{result.smiles}</TableCell>
                      <TableCell><SmilesStructure key={result.smiles + '-' + virtualRow.index} smiles={result.smiles} /></TableCell>
                      <TableCell>{result.molecule_name || 'N/A'}</TableCell>
                      <TableCell className="text-right">{result.bbb_probability?.toFixed(3) ?? 'N/A'}</TableCell>
                      <TableCell>{getPredictionBadge(result)}</TableCell>
                      <TableCell>{result.bbb_class || 'N/A'}</TableCell>
                      <TableCell className="text-right">{result.prediction_certainty?.toFixed(1) ?? 'N/A'}%</TableCell>
                      <TableCell className="text-right">{result.applicability_score?.toFixed(3) ?? 'N/A'}</TableCell>
                      <TableCell className="text-right">{result.mw?.toFixed(2) ?? 'N/A'}</TableCell>
                      <TableCell className="text-right">{result.exact_mw?.toFixed(2) ?? 'N/A'}</TableCell>
                      <TableCell className="text-xs break-all">{result.molecular_formula || 'N/A'}</TableCell>
                      <TableCell className="text-right">{result.logp?.toFixed(2) ?? 'N/A'}</TableCell>
                      <TableCell className="text-right">{result.tpsa?.toFixed(2) ?? 'N/A'}</TableCell>
                      <TableCell className="text-right">{result.log_s_esol?.toFixed(2) ?? 'N/A'}</TableCell>
                      <TableCell className="text-right">{result.molar_refractivity?.toFixed(2) ?? 'N/A'}</TableCell>
                      <TableCell className="text-right">{result.h_donors ?? 'N/A'}</TableCell>
                      <TableCell className="text-right">{result.h_acceptors ?? 'N/A'}</TableCell>
                      <TableCell className="text-right">{result.rot_bonds ?? 'N/A'}</TableCell>
                      <TableCell className="text-right">{result.num_rings ?? 'N/A'}</TableCell>
                      <TableCell className="text-right">{result.frac_csp3?.toFixed(3) ?? 'N/A'}</TableCell>
                      <TableCell className="text-right">{result.num_heavy_atoms ?? 'N/A'}</TableCell>
                      <TableCell className="text-right">{result.formal_charge ?? 'N/A'}</TableCell>
                      <TableCell>{result.gi_absorption || 'N/A'}</TableCell>
                      <TableCell>{result.lipinski_passes === null ? 'N/A' : (result.lipinski_passes ? 'Yes' : 'No')}</TableCell>
                      <TableCell className={`text-right ${result.pains_alerts > 0 ? 'text-red-600 font-semibold' : ''}`}>{result.pains_alerts ?? 'N/A'}</TableCell>
                      <TableCell className={`text-right ${result.brenk_alerts > 0 ? 'text-red-600 font-semibold' : ''}`}>{result.brenk_alerts ?? 'N/A'}</TableCell>
                      <TableCell>
                        {result.error ? (
                          <Badge variant="destructive" title={result.error}>Error</Badge>
                        ) : (
                          <Badge variant="secondary">Success</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {rowVirtualizer.getVirtualItems().length === 0 && filteredAndSortedResults.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={27} className="h-24 text-center">
                      No results found.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BatchResultsTable;
