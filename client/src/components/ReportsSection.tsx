import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { trpc } from '@/utils/trpc';
import type { ReportData, GenerateReportInput } from '../../../server/src/schema';

export function ReportsSection() {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportType, setReportType] = useState<string>('inventory');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const generateReport = useCallback(async (type: string) => {
    try {
      setIsGenerating(true);
      setReportData(null);

      let reportResponse: ReportData;

      switch (type) {
        case 'inventory':
          reportResponse = await trpc.generateInventoryReport.mutate({
            report_type: 'inventory' as const
          });
          break;
        case 'lending':
          reportResponse = await trpc.generateLendingReport.mutate({
            report_type: 'lending' as const,
            start_date: startDate ? new Date(startDate) : undefined,
            end_date: endDate ? new Date(endDate) : undefined
          });
          break;
        case 'returns':
          reportResponse = await trpc.generateReturnsReport.mutate({
            report_type: 'returns' as const,
            start_date: startDate ? new Date(startDate) : undefined,
            end_date: endDate ? new Date(endDate) : undefined
          });
          break;
        case 'overdue':
          reportResponse = await trpc.generateOverdueReport.mutate();
          break;
        case 'category_summary':
          reportResponse = await trpc.generateCategorySummaryReport.mutate();
          break;
        default:
          throw new Error('Invalid report type');
      }

      setReportData(reportResponse);
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [startDate, endDate]);

  const exportToCSV = () => {
    if (!reportData || !reportData.data.length) return;

    const headers = Object.keys(reportData.data[0]);
    const csvContent = [
      headers.join(','),
      ...reportData.data.map((row: Record<string, unknown>) =>
        headers.map((header: string) => {
          const value = row[header];
          // Handle values that might contain commas
          const stringValue = String(value ?? '');
          return stringValue.includes(',') ? `"${stringValue}"` : stringValue;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${reportData.report_type}_report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const renderReportData = () => {
    if (!reportData || !reportData.data.length) return null;

    const data = reportData.data;
    const headers = Object.keys(data[0]);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold capitalize">{reportData.report_type.replace('_', ' ')} Report</h4>
            <p className="text-sm text-gray-600">
              Generated on {reportData.generated_at.toLocaleString()} • {data.length} records
            </p>
          </div>
          <Button onClick={exportToCSV} variant="outline" size="sm">
            📊 Export CSV
          </Button>
        </div>

        <div className="overflow-x-auto border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                {headers.map((header: string) => (
                  <TableHead key={header} className="capitalize">
                    {header.replace(/_/g, ' ')}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.slice(0, 100).map((row: Record<string, unknown>, index: number) => (
                <TableRow key={index}>
                  {headers.map((header: string) => (
                    <TableCell key={header}>
                      {renderCellValue(row[header], header)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {data.length > 100 && (
          <p className="text-sm text-gray-600 text-center">
            Showing first 100 records of {data.length}. Export to CSV to see all data.
          </p>
        )}
      </div>
    );
  };

  const renderCellValue = (value: unknown, header: string) => {
    if (value === null || value === undefined) return '-';

    // Handle dates
    if (header.includes('date') && typeof value === 'string') {
      return new Date(value).toLocaleDateString();
    }

    // Handle currency
    if (header.includes('price') || header.includes('value')) {
      const numValue = Number(value);
      return !isNaN(numValue) ? `$${numValue.toFixed(2)}` : String(value);
    }

    // Handle status with badges
    if (header === 'status') {
      const statusColors: Record<string, string> = {
        available: 'bg-green-100 text-green-800',
        lent: 'bg-blue-100 text-blue-800',
        maintenance: 'bg-yellow-100 text-yellow-800',
        damaged: 'bg-red-100 text-red-800',
        retired: 'bg-gray-100 text-gray-800',
        active: 'bg-blue-100 text-blue-800',
        overdue: 'bg-red-100 text-red-800',
        returned: 'bg-green-100 text-green-800'
      };

      return (
        <Badge className={statusColors[String(value)] || 'bg-gray-100 text-gray-800'}>
          {String(value)}
        </Badge>
      );
    }

    return String(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">📈 Reports & Analytics</h2>
          <p className="text-gray-600 mt-1">Generate comprehensive reports for inventory and lending activities</p>
        </div>
      </div>

      {/* Report Generation Controls */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Reports */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Reports</CardTitle>
            <CardDescription>Generate standard reports instantly</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={() => generateReport('inventory')}
              disabled={isGenerating}
              className="w-full justify-start"
              variant="outline"
            >
              📦 Inventory Report
              <span className="ml-auto text-xs text-gray-500">All assets overview</span>
            </Button>
            <Button
              onClick={() => generateReport('overdue')}
              disabled={isGenerating}
              className="w-full justify-start"
              variant="outline"
            >
              ⚠️ Overdue Items
              <span className="ml-auto text-xs text-gray-500">Past due assets</span>
            </Button>
            <Button
              onClick={() => generateReport('category_summary')}
              disabled={isGenerating}
              className="w-full justify-start"
              variant="outline"
            >
              📂 Category Summary
              <span className="ml-auto text-xs text-gray-500">Assets by category</span>
            </Button>
          </CardContent>
        </Card>

        {/* Custom Reports */}
        <Card>
          <CardHeader>
            <CardTitle>Custom Reports</CardTitle>
            <CardDescription>Generate reports with date filters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Report Type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lending">Lending Activity</SelectItem>
                  <SelectItem value="returns">Return Activity</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <Button
              onClick={() => generateReport(reportType)}
              disabled={isGenerating}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {isGenerating ? 'Generating...' : 'Generate Report'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Report Display */}
      {isGenerating && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p>Generating report...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {reportData && (
        <Card>
          <CardHeader>
            <CardTitle>Report Results</CardTitle>
          </CardHeader>
          <CardContent>
            {renderReportData()}
          </CardContent>
        </Card>
      )}

      {!reportData && !isGenerating && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-gray-500">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-lg font-medium mb-2">Generate Your First Report</h3>
              <p>Select a report type above to view comprehensive data about your inventory and lending activities.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Report Types Info */}
      <Card>
        <CardHeader>
          <CardTitle>Available Report Types</CardTitle>
          <CardDescription>Understanding what each report provides</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <h4 className="font-medium">📦 Inventory Report</h4>
              <p className="text-sm text-gray-600">Complete list of all assets with their current status, values, and locations.</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">🤝 Lending Activity</h4>
              <p className="text-sm text-gray-600">Historical lending data within specified date range, including borrower details.</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">📥 Return Activity</h4>
              <p className="text-sm text-gray-600">Asset return transactions with condition reports and processing details.</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">⚠️ Overdue Items</h4>
              <p className="text-sm text-gray-600">Currently overdue assets with borrower contact information for follow-up.</p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">📂 Category Summary</h4>
              <p className="text-sm text-gray-600">Asset distribution and utilization statistics grouped by categories.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}