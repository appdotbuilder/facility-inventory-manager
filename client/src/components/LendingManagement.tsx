import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/utils/trpc';
import type { LendingWithDetails, AssetWithCategory, CreateLendingInput, ReturnAssetInput } from '../../../server/src/schema';

interface LendingManagementProps {
  mode: 'lending' | 'returns';
}

export function LendingManagement({ mode }: LendingManagementProps) {
  const [lendings, setLendings] = useState<LendingWithDetails[]>([]);
  const [availableAssets, setAvailableAssets] = useState<AssetWithCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [returningLending, setReturningLending] = useState<LendingWithDetails | null>(null);

  const [formData, setFormData] = useState<CreateLendingInput>({
    asset_id: 0,
    borrower_name: '',
    borrower_email: null,
    borrower_phone: null,
    department: null,
    expected_return_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default to 1 week from now
    notes: null,
    lent_by_user_id: 1 // TODO: Get from current user context
  });

  const [returnData, setReturnData] = useState<ReturnAssetInput>({
    lending_id: 0,
    returned_by_user_id: 1, // TODO: Get from current user context
    return_notes: null,
    asset_condition: 'good'
  });

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      if (mode === 'lending') {
        const [lendingsData, assetsData] = await Promise.all([
          trpc.getActiveLendings.query(),
          trpc.getAssetsByStatus.query({ status: 'available' })
        ]);
        setLendings(lendingsData);
        setAvailableAssets(assetsData);
      } else {
        const lendingsData = await trpc.getActiveLendings.query();
        setLendings(lendingsData);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateLending = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await trpc.createLending.mutate(formData);
      await loadData();
      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Failed to create lending:', error);
    }
  };

  const handleReturnAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await trpc.returnAsset.mutate(returnData);
      await loadData();
      resetReturnForm();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Failed to return asset:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      asset_id: 0,
      borrower_name: '',
      borrower_email: null,
      borrower_phone: null,
      department: null,
      expected_return_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      notes: null,
      lent_by_user_id: 1
    });
  };

  const resetReturnForm = () => {
    setReturnData({
      lending_id: 0,
      returned_by_user_id: 1,
      return_notes: null,
      asset_condition: 'good'
    });
    setReturningLending(null);
  };

  const openCreateLendingDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openReturnDialog = (lending: LendingWithDetails) => {
    setReturningLending(lending);
    setReturnData({
      lending_id: lending.id,
      returned_by_user_id: 1,
      return_notes: null,
      asset_condition: 'good'
    });
    setIsDialogOpen(true);
  };

  // Filter lendings
  const filteredLendings = lendings.filter((lending: LendingWithDetails) => {
    const matchesSearch = !searchTerm || 
      lending.borrower_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (lending.borrower_email && lending.borrower_email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (lending.department && lending.department.toLowerCase().includes(searchTerm.toLowerCase())) ||
      lending.asset.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || lending.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'returned': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const isOverdue = (expectedReturnDate: Date) => {
    return new Date() > expectedReturnDate;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">
            {mode === 'lending' ? '🤝 Lending Management' : '📥 Asset Returns'}
          </h2>
          <p className="text-gray-600 mt-1">
            {mode === 'lending' 
              ? 'Track and manage asset lending to borrowers'
              : 'Process asset returns and update their status'
            }
          </p>
        </div>
        {mode === 'lending' && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateLendingDialog} className="bg-green-600 hover:bg-green-700">
                ➕ Lend Asset
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Lend Asset</DialogTitle>
                <DialogDescription>
                  Record a new asset lending transaction.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateLending} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="asset_id">Asset *</Label>
                    <Select value={formData.asset_id.toString()} onValueChange={(value: string) =>
                      setFormData((prev: CreateLendingInput) => ({ ...prev, asset_id: parseInt(value) }))
                    }>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an available asset" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableAssets.map((asset: AssetWithCategory) => (
                          <SelectItem key={asset.id} value={asset.id.toString()}>
                            {asset.name} ({asset.category.name}) {asset.serial_number && `- ${asset.serial_number}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="borrower_name">Borrower Name *</Label>
                    <Input
                      id="borrower_name"
                      value={formData.borrower_name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData((prev: CreateLendingInput) => ({ ...prev, borrower_name: e.target.value }))
                      }
                      placeholder="Enter borrower's name"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="borrower_email">Borrower Email</Label>
                    <Input
                      id="borrower_email"
                      type="email"
                      value={formData.borrower_email || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData((prev: CreateLendingInput) => ({ ...prev, borrower_email: e.target.value || null }))
                      }
                      placeholder="borrower@example.com"
                    />
                  </div>

                  <div>
                    <Label htmlFor="borrower_phone">Phone Number</Label>
                    <Input
                      id="borrower_phone"
                      value={formData.borrower_phone || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData((prev: CreateLendingInput) => ({ ...prev, borrower_phone: e.target.value || null }))
                      }
                      placeholder="Phone number"
                    />
                  </div>

                  <div>
                    <Label htmlFor="department">Department</Label>
                    <Input
                      id="department"
                      value={formData.department || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData((prev: CreateLendingInput) => ({ ...prev, department: e.target.value || null }))
                      }
                      placeholder="Department/Division"
                    />
                  </div>

                  <div className="col-span-2">
                    <Label htmlFor="expected_return_date">Expected Return Date *</Label>
                    <Input
                      id="expected_return_date"
                      type="date"
                      value={new Date(formData.expected_return_date).toISOString().split('T')[0]}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData((prev: CreateLendingInput) => ({ ...prev, expected_return_date: new Date(e.target.value) }))
                      }
                      required
                    />
                  </div>

                  <div className="col-span-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes || ''}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setFormData((prev: CreateLendingInput) => ({ ...prev, notes: e.target.value || null }))
                      }
                      placeholder="Additional notes or conditions"
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-green-600 hover:bg-green-700">
                    Create Lending
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Return Asset Dialog */}
      <Dialog open={isDialogOpen && mode === 'returns'} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return Asset</DialogTitle>
            <DialogDescription>
              Process the return of "{returningLending?.asset.name}" from {returningLending?.borrower_name}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleReturnAsset} className="space-y-4">
            <div>
              <Label htmlFor="asset_condition">Asset Condition</Label>
              <Select value={returnData.asset_condition || 'good'} onValueChange={(value: any) =>
                setReturnData((prev: ReturnAssetInput) => ({ ...prev, asset_condition: value }))
              }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="good">Good Condition</SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                  <SelectItem value="needs_maintenance">Needs Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="return_notes">Return Notes</Label>
              <Textarea
                id="return_notes"
                value={returnData.return_notes || ''}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setReturnData((prev: ReturnAssetInput) => ({ ...prev, return_notes: e.target.value || null }))
                }
                placeholder="Notes about the return condition, any issues, etc."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                Process Return
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Search</Label>
              <Input
                placeholder="Search by borrower, asset, department..."
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="returned">Returned</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm('');
                  setFilterStatus('all');
                }}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lendings Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {mode === 'lending' ? `Active Lendings (${filteredLendings.length})` : `Assets to Return (${filteredLendings.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : filteredLendings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {lendings.length === 0 ? (
                <>
                  <p className="text-lg mb-2">
                    {mode === 'lending' ? '🤝 No active lendings' : '📥 No assets to return'}
                  </p>
                  <p>
                    {mode === 'lending' 
                      ? 'Create your first lending record!' 
                      : 'All assets have been returned!'
                    }
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg mb-2">🔍 No results found</p>
                  <p>Try adjusting your search terms or filters.</p>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Borrower</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Lent Date</TableHead>
                    <TableHead>Expected Return</TableHead>
                    <TableHead>Status</TableHead>
                    {mode === 'returns' && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLendings.map((lending: LendingWithDetails) => (
                    <TableRow key={lending.id} className={isOverdue(lending.expected_return_date) && lending.status === 'active' ? 'bg-red-50' : ''}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{lending.asset.name}</div>
                          <div className="text-sm text-gray-600">
                            {lending.asset.category.name}
                            {lending.asset.serial_number && ` • ${lending.asset.serial_number}`}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{lending.borrower_name}</div>
                          {lending.department && (
                            <div className="text-sm text-gray-600">{lending.department}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {lending.borrower_email && (
                            <div className="truncate max-w-xs">{lending.borrower_email}</div>
                          )}
                          {lending.borrower_phone && (
                            <div>{lending.borrower_phone}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{lending.lent_date.toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className={isOverdue(lending.expected_return_date) && lending.status === 'active' ? 'text-red-600 font-medium' : ''}>
                          {lending.expected_return_date.toLocaleDateString()}
                          {isOverdue(lending.expected_return_date) && lending.status === 'active' && (
                            <div className="text-xs">⚠️ OVERDUE</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(isOverdue(lending.expected_return_date) && lending.status === 'active' ? 'overdue' : lending.status)}>
                          {isOverdue(lending.expected_return_date) && lending.status === 'active' ? 'overdue' : lending.status}
                        </Badge>
                      </TableCell>
                      {mode === 'returns' && (
                        <TableCell>
                          {lending.status === 'active' && (
                            <Button
                              size="sm"
                              onClick={() => openReturnDialog(lending)}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              Process Return
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}