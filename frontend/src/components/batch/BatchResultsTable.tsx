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
import { Search, Download, Filter, ArrowUpDown, ColumnsIcon } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SmilesStructure } from '@/components/batch/SmilesStructure';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ColumnDef,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel, // Added for column filtering
  useReactTable,
  flexRender,
  SortingState,
  ColumnFiltersState, // Added for column filtering state
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
  const [filterClass, setFilterClass] = useState<string>('all'); 
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]); 
  const [bbbProbabilityRange, setBbbProbabilityRange] = useState<[number, number]>([0, 1]); 

  const parentRef = useRef<HTMLDivElement>(null);
  const ROW_ESTIMATE_SIZE = 75; 

  // Column Definitions for TanStack Table
  const columns: ColumnDef<MoleculeResult>[] = useMemo(() => [
    {
      id: 'index',
      header: 'No.',
      cell: ({ row }) => row.index + 1,
      size: 60, 
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
      size: 120,
      filterFn: 'inNumberRange', // Use TanStack's built-in range filter
      enableColumnFilter: true,
    },
    {
      accessorKey: 'bbb_class',
      header: 'Prediction Class',
      cell: ({ row }) => getPredictionBadge(row.original),
      size: 150, 
    },
    {
      accessorKey: 'prediction_certainty', 
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
  ], []); 

  // Apply class filter (dropdown) before data goes to TanStack Table.
  // Text input filters (SMILES, Molecule Name) are handled by TanStack Table's columnFilters state.
  const preFilteredResults = useMemo(() => {
    let filtered = results;
    if (filterClass !== 'all') {
      filtered = filtered.filter(result => {
        if (filterClass === 'error') return !!result.error;
        if (filterClass === 'BBB+') return result.bbb_class === 'permeable' && !result.error;
        if (filterClass === 'BBB-') return result.bbb_class === 'non_permeable' && !result.error;
        return true; 
      });
    }
    return filtered;
  }, [results, filterClass]); 

  // TanStack Table instance
  const table = useReactTable<MoleculeResult>({
    data: preFilteredResults, 
    columns,
    state: {
      sorting,
      columnFilters, 
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters, 
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(), 
  });

  const tableRows = table.getRowModel().rows;

  // For CardTitle count, use the length of rows from TanStack table after all filters are applied.
  const displayRowCount = table.getRowModel().rows.length;

  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_ESTIMATE_SIZE,
    overscan: 5, 
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
      // Use row.original to get the raw data object for each row
      ...table.getRowModel().rows.map(row => [
        `"${row.original.smiles}"`,
        `"${row.original.molecule_name || ''}"`,
        row.original.bbb_probability?.toFixed(4) ?? 'N/A',
        `"${row.original.bbb_class || ''}"`,
        row.original.prediction_certainty?.toFixed(4) ?? 'N/A',
        row.original.applicability_score?.toFixed(4) ?? 'N/A',
        row.original.mw?.toFixed(2) ?? 'N/A',
        row.original.exact_mw?.toFixed(2) ?? 'N/A',
        `"${row.original.molecular_formula || ''}"`,
        row.original.logp?.toFixed(2) ?? 'N/A',
        row.original.tpsa?.toFixed(2) ?? 'N/A',
        row.original.h_donors ?? 'N/A',
        row.original.h_acceptors ?? 'N/A',
        row.original.rot_bonds ?? 'N/A',
        row.original.frac_csp3?.toFixed(3) ?? 'N/A',
        row.original.molar_refractivity?.toFixed(2) ?? 'N/A',
        row.original.log_s_esol?.toFixed(2) ?? 'N/A',
        `"${row.original.gi_absorption || ''}"`,
        row.original.lipinski_passes === null ? 'N/A' : (row.original.lipinski_passes ? 'Yes' : 'No'),
        row.original.pains_alerts ?? 'N/A',
        row.original.brenk_alerts ?? 'N/A',
        row.original.num_heavy_atoms ?? 'N/A',
        row.original.formal_charge ?? 'N/A',
        row.original.num_rings ?? 'N/A',
        `"${row.original.error || ''}"`
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
            <CardTitle>Results ({displayRowCount})</CardTitle>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <ColumnsIcon className="mr-2 h-4 w-4" />
                    Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px]">
                  <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {table
                    .getAllLeafColumns()
                    .filter(
                      (column) =>
                        typeof column.accessorFn !== 'undefined' && column.getCanHide()
                    )
                    .map((column) => {
                      return (
                        <DropdownMenuCheckboxItem
                          key={column.id}
                          className="capitalize"
                          checked={column.getIsVisible()}
                          onCheckedChange={(value) => column.toggleVisibility(!!value)}
                        >
                          {column.id.replace(/_/g, ' ')}
                        </DropdownMenuCheckboxItem>
                      );
                    })}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={exportToCSV} size="sm" disabled={isLoading || displayRowCount === 0}>
                <Download className="mr-2 h-4 w-4" />
                Export Filtered
              </Button>
            </div>
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
                <SelectItem value="BBB+">High Permeability</SelectItem> {/* Corresponds to 'permeable' class */}
                <SelectItem value="BBB-">Low Permeability</SelectItem> {/* Corresponds to 'non_permeable' class */}
                <SelectItem value="error">Errors Only</SelectItem>
              </SelectContent>
            </Select>

            {/* BBB Probability Range Slider Filter */}
            <div className="flex flex-col space-y-2 w-full md:w-auto md:min-w-[200px]">
              <label htmlFor="bbbProbabilitySlider" className="text-sm font-medium text-muted-foreground">
                BBB Probability Range: {bbbProbabilityRange[0].toFixed(2)} - {bbbProbabilityRange[1].toFixed(2)}
              </label>
              <Slider
                id="bbbProbabilitySlider"
                min={0}
                max={1}
                step={0.01}
                value={bbbProbabilityRange}
                onValueChange={(newRange) => {
                  setBbbProbabilityRange(newRange as [number, number]);
                  table.getColumn('bbb_probability')?.setFilterValue(newRange);
                }}
                className="w-full"
              />
            </div>
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
                      placeholder="Filter by SMILES..."
                      value={(table.getColumn('smiles')?.getFilterValue() as string) ?? ''}
                      onChange={(event) =>
                        table.getColumn('smiles')?.setFilterValue(event.target.value)
                      }
                      className="max-w-xs text-sm h-9"
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      placeholder="Filter by Name..."
                      value={(table.getColumn('molecule_name')?.getFilterValue() as string) ?? ''}
                      onChange={(event) =>
                        table.getColumn('molecule_name')?.setFilterValue(event.target.value)
                      }
                      className="max-w-xs text-sm h-9"
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
