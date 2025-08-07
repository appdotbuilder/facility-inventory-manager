import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/utils/trpc';
import type { AssetWithCategory, Category, CreateAssetInput, UpdateAssetInput } from '../../../server/src/schema';

export function AssetManagement() {
  const [assets, setAssets] = useState<AssetWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetWithCategory | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState<CreateAssetInput>({
    name: '',
    description: null,
    category_id: 0,
    serial_number: null,
    purchase_date: null,
    purchase_price: null,
    current_value: null,
    status: 'available',
    location: null
  });

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [assetsData, categoriesData] = await Promise.all([
        trpc.getAssets.query(),
        trpc.getCategories.query()
      ]);
      setAssets(assetsData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingAsset) {
        const updateData: UpdateAssetInput = {
          id: editingAsset.id,
          name: formData.name || undefined,
          description: formData.description,
          category_id: formData.category_id || undefined,
          serial_number: formData.serial_number,
          purchase_date: formData.purchase_date,
          purchase_price: formData.purchase_price,
          current_value: formData.current_value,
          status: formData.status,
          location: formData.location
        };
        await trpc.updateAsset.mutate(updateData);
      } else {
        await trpc.createAsset.mutate(formData);
      }
      await loadData();
      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Failed to save asset:', error);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await trpc.deleteAsset.mutate({ id });
      await loadData();
    } catch (error) {
      console.error('Failed to delete asset:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: null,
      category_id: 0,
      serial_number: null,
      purchase_date: null,
      purchase_price: null,
      current_value: null,
      status: 'available',
      location: null
    });
    setEditingAsset(null);
  };

  const openEditDialog = (asset: AssetWithCategory) => {
    setEditingAsset(asset);
    setFormData({
      name: asset.name,
      description: asset.description,
      category_id: asset.category_id,
      serial_number: asset.serial_number,
      purchase_date: asset.purchase_date,
      purchase_price: asset.purchase_price,
      current_value: asset.current_value,
      status: asset.status,
      location: asset.location
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  // Filter assets
  const filteredAssets = assets.filter((asset: AssetWithCategory) => {
    const matchesStatus = filterStatus === 'all' || asset.status === filterStatus;
    const matchesCategory = filterCategory === 'all' || asset.category_id.toString() === filterCategory;
    const matchesSearch = !searchTerm || 
      asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (asset.serial_number && asset.serial_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (asset.location && asset.location.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesStatus && matchesCategory && matchesSearch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'lent': return 'bg-blue-100 text-blue-800';
      case 'maintenance': return 'bg-yellow-100 text-yellow-800';
      case 'damaged': return 'bg-red-100 text-red-800';
      case 'retired': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Asset Management</h2>
          <p className="text-gray-600 mt-1">Manage your facility assets and inventory</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} className="bg-blue-600 hover:bg-blue-700">
              ➕ Add Asset
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingAsset ? 'Edit Asset' : 'Create New Asset'}
              </DialogTitle>
              <DialogDescription>
                {editingAsset ? 'Update the asset information.' : 'Fill in the details for the new asset.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="name">Asset Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev: CreateAssetInput) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Enter asset name"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="category">Category *</Label>
                  <Select value={formData.category_id.toString()} onValueChange={(value: string) =>
                    setFormData((prev: CreateAssetInput) => ({ ...prev, category_id: parseInt(value) }))
                  }>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category: Category) => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value: any) =>
                    setFormData((prev: CreateAssetInput) => ({ ...prev, status: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="lent">Lent</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="damaged">Damaged</SelectItem>
                      <SelectItem value="retired">Retired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="serial_number">Serial Number</Label>
                  <Input
                    id="serial_number"
                    value={formData.serial_number || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev: CreateAssetInput) => ({ ...prev, serial_number: e.target.value || null }))
                    }
                    placeholder="Enter serial number"
                  />
                </div>

                <div>
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={formData.location || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev: CreateAssetInput) => ({ ...prev, location: e.target.value || null }))
                    }
                    placeholder="Enter location"
                  />
                </div>

                <div>
                  <Label htmlFor="purchase_date">Purchase Date</Label>
                  <Input
                    id="purchase_date"
                    type="date"
                    value={formData.purchase_date ? new Date(formData.purchase_date).toISOString().split('T')[0] : ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev: CreateAssetInput) => ({ ...prev, purchase_date: e.target.value ? new Date(e.target.value) : null }))
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="purchase_price">Purchase Price</Label>
                  <Input
                    id="purchase_price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.purchase_price || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev: CreateAssetInput) => ({ ...prev, purchase_price: e.target.value ? parseFloat(e.target.value) : null }))
                    }
                    placeholder="0.00"
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="current_value">Current Value</Label>
                  <Input
                    id="current_value"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.current_value || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setFormData((prev: CreateAssetInput) => ({ ...prev, current_value: e.target.value ? parseFloat(e.target.value) : null }))
                    }
                    placeholder="0.00"
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description || ''}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setFormData((prev: CreateAssetInput) => ({ ...prev, description: e.target.value || null }))
                    }
                    placeholder="Enter asset description"
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                  {editingAsset ? 'Update Asset' : 'Create Asset'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Search</Label>
              <Input
                placeholder="Search by name, serial, location..."
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
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="lent">Lent</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="damaged">Damaged</SelectItem>
                  <SelectItem value="retired">Retired</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Category</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category: Category) => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm('');
                  setFilterStatus('all');
                  setFilterCategory('all');
                }}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assets Table */}
      <Card>
        <CardHeader>
          <CardTitle>Assets ({filteredAssets.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading assets...</div>
          ) : filteredAssets.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No assets found. {assets.length === 0 ? 'Create your first asset!' : 'Try adjusting your filters.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Serial Number</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssets.map((asset: AssetWithCategory) => (
                    <TableRow key={asset.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{asset.name}</div>
                          {asset.description && (
                            <div className="text-sm text-gray-600 truncate max-w-xs">
                              {asset.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {asset.category.name}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {asset.serial_number || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(asset.status)}>
                          {asset.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{asset.location || '-'}</TableCell>
                      <TableCell>
                        {asset.current_value ? `$${asset.current_value.toFixed(2)}` : 
                         asset.purchase_price ? `$${asset.purchase_price.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(asset)}
                          >
                            Edit
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700">
                                Delete
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Asset</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{asset.name}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(asset.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
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