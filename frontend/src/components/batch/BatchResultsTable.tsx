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
  const [columnFilters, setColumnFilters] = useState<{ [key: string]: string }>({});
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

  const handleColumnFilterChange = (columnId: keyof MoleculeResult | 'name', value: string) => {
    setColumnFilters(prev => ({ ...prev, [columnId]: value }));
  };

  const filteredAndSortedResults = useMemo(() => {
    let filtered = results;

    // Apply column filters
    Object.entries(columnFilters).forEach(([key, value]) => {
      if (value) {
        const filterValue = value.toLowerCase();
        filtered = filtered.filter(result => {
          if (key === 'smiles') {
            return result.smiles.toLowerCase().includes(filterValue);
          }
          if (key === 'molecule_name') {
            return result.molecule_name?.toLowerCase().includes(filterValue) ?? false;
          }
          // Add other column filters here if needed
          return true;
        });
      }
    });

    // Apply class filter (dropdown)
    if (filterClass !== 'all') {
      filtered = filtered.filter(result => {
        return result.bbb_class === filterClass || (filterClass === 'error' && result.error);
      });
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;
      
      if (sortBy === 'name') {
        aValue = a.molecule_name || a.smiles;
        bValue = b.molecule_name || b.smiles;
        return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }

      // Ensure sortBy is a valid key of MoleculeResult for numeric/string comparison
      const sortKey = sortBy as keyof MoleculeResult;
      if (typeof a[sortKey] === 'number' && typeof b[sortKey] === 'number') {
        aValue = a[sortKey] as number;
        bValue = b[sortKey] as number;
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      } else if (typeof a[sortKey] === 'string' && typeof b[sortKey] === 'string') {
        aValue = a[sortKey] as string;
        bValue = b[sortKey] as string;
        return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      } else {
        // Fallback for mixed types or other types - can be refined
        const aStr = String(a[sortKey]);
        const bStr = String(b[sortKey]);
        return sortOrder === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      }
    });

    return filtered;
  }, [results, columnFilters, filterClass, sortBy, sortOrder]);

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
    // Standardize to 'permeable' and 'non_permeable' for badge display
    if (result.bbb_class === 'permeable') { // Assuming bbb_class is 'permeable' or 'non_permeable'
      return <Badge className="bg-green-600">Permeable</Badge>;
    } else if (result.bbb_class === 'non_permeable') {
      return <Badge className="bg-red-600">Non-Permeable</Badge>;
    } else { // Fallback for other potential values or moderate if defined
      return <Badge className="bg-yellow-600">Moderate</Badge>; // Or handle as error/unknown
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
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            
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
              </SelectContent>
            </Select>

          </div>
          <div ref={parentRef} className="overflow-auto h-[600px] border rounded-md" style={{ minWidth: '100%' }}>
            <Table className="min-w-full table-fixed">
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-[80px] px-2 py-3">No.</TableHead>
                  <TableHead 
                    className="w-[300px] px-2 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleSort('smiles')}
                  >
                    SMILES {sortBy === 'smiles' && (sortOrder === 'asc' ? <ArrowUpDown className="inline h-4 w-4" /> : <ArrowUpDown className="inline h-4 w-4" />)}
                  </TableHead>
                  <TableHead 
                    className="w-[200px] px-2 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleSort('name')}
                  >
                    Molecule Name {sortBy === 'name' && (sortOrder === 'asc' ? <ArrowUpDown className="inline h-4 w-4" /> : <ArrowUpDown className="inline h-4 w-4" />)}
                  </TableHead>
                  <TableHead 
                    className="w-[150px] px-2 py-3 text-right cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleSort('bbb_probability')}
                  >
                    BBB Prob. {sortBy === 'bbb_probability' && (sortOrder === 'asc' ? <ArrowUpDown className="inline h-4 w-4" /> : <ArrowUpDown className="inline h-4 w-4" />)}
                  </TableHead>
                  <TableHead className="w-[180px] px-2 py-3">Prediction Class</TableHead>
                  <TableHead 
                    className="w-[150px] px-2 py-3 text-right cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleSort('prediction_certainty')}
                  >
                    Confidence {sortBy === 'prediction_certainty' && (sortOrder === 'asc' ? <ArrowUpDown className="inline h-4 w-4" /> : <ArrowUpDown className="inline h-4 w-4" />)}
                  </TableHead>
                  <TableHead className="w-[150px] px-2 py-3 text-right">Applicability</TableHead>
                  <TableHead className="w-[120px] px-2 py-3 text-right">MW</TableHead>
                  <TableHead className="w-[120px] px-2 py-3 text-right">LogP</TableHead>
                  <TableHead className="w-[120px] px-2 py-3 text-right">TPSA</TableHead>
                  <TableHead className="w-[100px] px-2 py-3 text-center">Error</TableHead>
                </TableRow>
                {/* Row for column filter inputs */}
                <TableRow className="border-t">
                  <TableCell className="p-1"></TableCell> {/* Empty for No. column */}
                  <TableCell className="p-1">
                    <Input
                      placeholder="Filter SMILES..."
                      value={columnFilters['smiles'] || ''}
                      onChange={(e) => handleColumnFilterChange('smiles', e.target.value)}
                      className="h-8 text-xs"
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      placeholder="Filter Name..."
                      value={columnFilters['molecule_name'] || ''}
                      onChange={(e) => handleColumnFilterChange('molecule_name', e.target.value)}
                      className="h-8 text-xs"
                    />
                  </TableCell>
                  <TableCell className="p-1"></TableCell> {/* Empty for BBB Prob. */}
                  <TableCell className="p-1"></TableCell> {/* Empty for Prediction Class (handled by dropdown) */}
                  <TableCell className="p-1"></TableCell> {/* Empty for Confidence */}
                  <TableCell className="p-1"></TableCell> {/* Empty for Applicability */}
                  <TableCell className="p-1"></TableCell> {/* Empty for MW */}
                  <TableCell className="p-1"></TableCell> {/* Empty for LogP */}
                  <TableCell className="p-1"></TableCell> {/* Empty for TPSA */}
                  <TableCell className="p-1"></TableCell> {/* Empty for Error */}
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
                      <TableCell className="text-right">{typeof result.prediction_certainty === 'number' ? (result.prediction_certainty * 100).toFixed(1) + '%' : 'N/A'}</TableCell>
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
