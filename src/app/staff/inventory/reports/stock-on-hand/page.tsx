
'use client';

import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select';
import { Download, List, Search, Package } from 'lucide-react';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';


export default function StockOnHandReportPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');

  const { data: userData } = useDoc(
    useMemoFirebase(() => (firestore && user ? doc(firestore, 'users', user.uid) : null), [firestore, user])
  );
  const institutionId = userData?.institutionId;

  const itemsQuery = useMemoFirebase(() => (institutionId ? collection(firestore, 'institutions', institutionId, 'inventoryItems') : null), [firestore, institutionId]);
  const { data: items, isLoading: isItemsLoading } = useCollection(itemsQuery);

  const warehousesQuery = useMemoFirebase(() => (institutionId ? collection(firestore, 'institutions', institutionId, 'warehouses') : null), [firestore, institutionId]);
  const { data: warehouses, isLoading: isWarehousesLoading } = useCollection(warehousesQuery);
  
  const categoriesQuery = useMemoFirebase(() => (institutionId ? collection(firestore, 'institutions', institutionId, 'inventoryCategories') : null), [firestore, institutionId]);
  const { data: categories, isLoading: isCategoriesLoading } = useCollection(categoriesQuery);

  const getWarehouseName = (id: string) => warehouses?.find(w => w.id === id)?.name || 'N/A';
  const getCategoryName = (id: string) => categories?.find(c => c.id === id)?.name || 'N/A';


  const filteredItems = useMemo(() => {
    if (!items) return [];

    return items.filter(item => {
        const warehouseMatch = selectedWarehouseId === 'all' || item.warehouseId === selectedWarehouseId;
        const categoryMatch = selectedCategoryId === 'all' || item.categoryId === selectedCategoryId;
        const searchMatch = searchTerm === '' || 
                            item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            item.code.toLowerCase().includes(searchTerm.toLowerCase());
        
        return warehouseMatch && categoryMatch && searchMatch;
    });
  }, [items, selectedWarehouseId, selectedCategoryId, searchTerm]);
  
  const isLoading = isItemsLoading || isWarehousesLoading || isCategoriesLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stock on Hand Report</h1>
          <p className="text-muted-foreground mt-1">
            A real-time snapshot of current inventory levels.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Current Inventory</CardTitle>
          <CardDescription>
            Filter by warehouse, category, or search for a specific item.
          </CardDescription>
          <div className="flex flex-wrap items-center gap-4 pt-4">
             <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                    placeholder="Search by name or code..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
             <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by warehouse..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Warehouses</SelectItem>
                    {warehouses?.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
            </Select>
            <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by category..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
            </Select>
            <Button variant="outline" className="ml-auto">
                <Download className="mr-2 h-4 w-4" />
                Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Code</TableHead>
                <TableHead>Item Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Qty On Hand</TableHead>
                <TableHead>Unit Cost</TableHead>
                <TableHead>Total Value</TableHead>
                <TableHead>Reorder Level</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                          <TableCell><Skeleton className="h-5 w-20"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-40"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-24"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-16"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-24"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-28"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-20"/></TableCell>
                          <TableCell><Skeleton className="h-6 w-16"/></TableCell>
                      </TableRow>
                  ))
              ) : filteredItems.length > 0 ? (
                filteredItems.map((item) => {
                    const totalValue = (item.quantity || 0) * (item.costPrice || 0);
                    const isLowStock = item.quantity <= item.reorderLevel;
                    return (
                        <TableRow key={item.id} className={isLowStock ? 'bg-destructive/10' : ''}>
                            <TableCell>{item.code}</TableCell>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>{getCategoryName(item.categoryId)}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell className="font-mono">{item.costPrice.toLocaleString()}</TableCell>
                            <TableCell className="font-mono font-semibold">{totalValue.toLocaleString()}</TableCell>
                            <TableCell>{item.reorderLevel}</TableCell>
                            <TableCell>
                                {isLowStock ? <Badge variant="destructive">Low Stock</Badge> : <Badge variant="secondary">OK</Badge>}
                            </TableCell>
                        </TableRow>
                    );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="h-48 text-center">
                     <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-muted rounded-full">
                        <Package className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold">
                        No Items Found
                      </h3>
                      <p className="text-muted-foreground">
                        Your inventory is empty or does not match the filters.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
