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
import {
  ColumnDef,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  flexRender,
  SortingState,
} from '@tanstack/react-table';
import type { MoleculeResult } from '@/lib/types';

// Helper function for rendering prediction badges (defined outside component for stability)
const getPredictionBadge = (result: MoleculeResult) => {
  if (result.error) {
    return <Badge variant="destructive">Error</Badge>;
  }
  
  const probability = result.bbb_probability;
  if (result.bbb_class === 'permeable') {
    if (typeof probability === 'number' && probability >= 0.7) {
      return <Badge className="bg-green-600">High Permeability</Badge>;
    } else if (typeof probability === 'number' && probability < 0.3) {
      return <Badge className="bg-red-600">Low Permeability</Badge>;
    } else {
      return <Badge className="bg-yellow-600">Moderate Permeability</Badge>; 
    }
  } else if (result.bbb_class === 'non_permeable') {
     if (typeof probability === 'number' && probability < 0.3) {
      return <Badge className="bg-red-600">Low Permeability</Badge>;
    } else if (typeof probability === 'number' && probability >= 0.7) {
       return <Badge className="bg-green-600">High Permeability</Badge>;
    } else {
      return <Badge className="bg-yellow-600">Moderate Permeability</Badge>;
    }
  } else {
    return <Badge className="bg-yellow-600">Moderate</Badge>;
  }
};

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
  const [sorting, setSorting] = useState<SortingState>([]);

  const parentRef = useRef<HTMLDivElement>(null);
  const ROW_ESTIMATE_SIZE = 75; // Estimated height for a row in pixels

  // Column Definitions for TanStack Table (Memoized for stability)
  // getPredictionBadge is now defined outside, so columns memoization is stable with []
  const columns: ColumnDef<MoleculeResult>[] = useMemo(() => [
    {
      id: 'index',
      header: 'No.',
      cell: ({ row }) => row.index + 1,
      size: 60, // Adjusted size
      enableSorting: false,
    },
    {
      accessorKey: 'smiles',
      header: 'SMILES',
      cell: info => <SmilesStructure smiles={info.getValue<string>()} />,
      size: 300,
    },
    {
      accessorKey: 'molecule_name',
      header: 'Molecule Name',
      cell: info => <span className="truncate" style={{ maxWidth: '180px'}} title={info.getValue<string>() || ''}>{info.getValue<string>() || 'N/A'}</span>,
      size: 200,
    },
    {
      accessorKey: 'bbb_probability',
      header: 'BBB Prob.',
      cell: info => {
        const val = info.getValue<number | null>();
        return val?.toFixed(3) ?? 'N/A';
      },
      size: 120, // Adjusted size
    },
    {
      accessorKey: 'bbb_class',
      header: 'Prediction Class',
      cell: ({ row }) => getPredictionBadge(row.original),
      size: 150, // Adjusted size
    },
    {
      accessorKey: 'prediction_certainty', // Keep for data model
      header: 'Confidence',
      cell: info => {
        const val = info.getValue<number | null>();
        return typeof val === 'number' ? (val * 100).toFixed(1) + '%' : 'N/A';
      },
      size: 120,
    },
    {
      accessorKey: 'applicability_score',
      header: 'Applicability',
      cell: info => {
        const val = info.getValue<number | null>();
        return val?.toFixed(3) ?? 'N/A';
      },
      size: 120,
    },
    {
      accessorKey: 'error',
      header: 'Status',
      cell: ({ row }) => row.original.error ? <Badge variant="destructive" title={row.original.error}>Error</Badge> : <Badge variant="secondary">Success</Badge>,
      size: 100,
      enableSorting: false,
    }
    // TODO: Add other columns (MW, LogP, TPSA, etc.) with appropriate headers and cell renderers
  ], []); // Empty dependency array as getPredictionBadge is stable (defined outside)

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

  // Keep existing filtering logic for now, TanStack will take over sorting on the filtered set
  const justFilteredResults = useMemo(() => {
    let filtered = results;

    // Apply column filters (text inputs)
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
          return true;
        });
      }
    });

    // Apply class filter (dropdown)
    if (filterClass !== 'all') {
      filtered = filtered.filter(result => {
        if (filterClass === 'error') return !!result.error;
        if (filterClass === 'BBB+') return result.bbb_class === 'permeable' && !result.error;
        if (filterClass === 'BBB-') return result.bbb_class === 'non_permeable' && !result.error;
        return true; 
      });
    }
    // Sorting is now handled by TanStack Table, so we only return the filtered results here.
    return filtered;
  }, [results, columnFilters, filterClass]);

  // TanStack Table instance
  const table = useReactTable<MoleculeResult>({
    data: justFilteredResults, // Use filtered results; TanStack will handle sorting on this set
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const tableRows = table.getRowModel().rows;

  // This const is now just for the CardTitle, TanStack drives the table rows
  const filteredAndSortedResults = justFilteredResults; // Or table.getRowModel().rows.map(r => r.original) for display count
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
    


  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_ESTIMATE_SIZE,
    overscan: 5, // Render 5 items above and below the visible area
  });

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
          <div className="flex flex-col md:flex-row gap-4 mb-6"> {/* Filter controls div */}
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="w-48">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Results</SelectItem>
                <SelectItem value="BBB+">High Permeability</SelectItem> {/* Corresponds to 'permeable' class */}
                <SelectItem value="BBB-">Low Permeability</SelectItem> {/* Corresponds to 'non_permeable' class */}
                <SelectItem value="error">Errors Only</SelectItem>
              </SelectContent>
            </Select>

            <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
              const [col, order] = value.split('-');
              // This state is now de-synced from TanStack's sorting. Will be fixed later.
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
          </div> {/* End of filter controls div */}

          {/* Scrollable Table Area */}
          <div ref={parentRef} className="overflow-auto h-[600px] border rounded-md" style={{ minWidth: '100%' }}>
            <Table className="min-w-full table-fixed">
              <TableHeader className="sticky top-0 bg-background z-10">
                {table.getHeaderGroups().map(headerGroup => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <TableHead 
                        key={header.id}
                        style={{ width: header.getSize() }}
                        className={`px-2 py-3 ${header.column.getCanSort() ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                        {{
                          asc: <ArrowUpDown className="inline h-4 w-4 ml-2" />, 
                          desc: <ArrowUpDown className="inline h-4 w-4 ml-2" />,
                        }[header.column.getIsSorted() as string] ?? null}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
                {/* Row for column filter inputs - This needs to be integrated with TanStack's column filtering system */}
                <TableRow className="border-t">
                  <TableCell className="p-1"></TableCell> {/* For Index column */}
                  <TableCell className="p-1">
                    <Input
                      placeholder="Filter SMILES..."
                      value={(columnFilters['smiles'] || '') as string}
                      onChange={(e) => handleColumnFilterChange('smiles', e.target.value)}
                      className="h-8 text-xs"
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      placeholder="Filter Name..."
                      value={(columnFilters['molecule_name'] || '') as string}
                      onChange={(e) => handleColumnFilterChange('molecule_name', e.target.value)}
                      className="h-8 text-xs"
                    />
                  </TableCell>
                  {/* Empty cells for other columns, matching the current column definition count (8 columns total) */}
                  <TableCell className="p-1"></TableCell> {/* BBB Prob. */}
                  <TableCell className="p-1"></TableCell> {/* Prediction Class */}
                  <TableCell className="p-1"></TableCell> {/* Confidence */}
                  <TableCell className="p-1"></TableCell> {/* Applicability */}
                  <TableCell className="p-1"></TableCell> {/* Status */}
                </TableRow>
              </TableHeader>
              <TableBody style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const row = tableRows[virtualRow.index];
                  if (!row) return null;

                  return (
                    <TableRow
                      key={row.id}
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      className={row.original.error ? 'bg-red-50 dark:bg-red-900/30' : ''}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      {row.getVisibleCells().map(cell => (
                        <TableCell 
                          key={cell.id} 
                          style={{ width: cell.column.getSize() }}
                          className={`${cell.column.id === 'bbb_probability' || cell.column.id === 'prediction_certainty' || cell.column.id === 'applicability_score' ? 'text-right' : ''} ${cell.column.id === 'smiles' ? 'font-mono text-xs' : ''}`}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
                {tableRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
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
