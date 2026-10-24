
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
import { Download, AlertTriangle, Package } from 'lucide-react';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';

export default function LowStockReportPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const { data: userData } = useDoc(
    useMemoFirebase(() => (firestore && user ? doc(firestore, 'users', user.uid) : null), [firestore, user])
  );
  const institutionId = userData?.institutionId;

  const itemsQuery = useMemoFirebase(() => (institutionId ? query(collection(firestore, 'institutions', institutionId, 'inventoryItems')) : null), [firestore, institutionId]);
  const { data: items, isLoading: isItemsLoading } = useCollection(itemsQuery);
  
  const warehousesQuery = useMemoFirebase(() => (institutionId ? collection(firestore, 'institutions', institutionId, 'warehouses') : null), [firestore, institutionId]);
  const { data: warehouses, isLoading: isWarehousesLoading } = useCollection(warehousesQuery);

  const getWarehouseName = (id: string) => warehouses?.find(w => w.id === id)?.name || 'N/A';

  const lowStockItems = useMemo(() => {
    if (!items) return [];
    return items.filter(item => item.quantity <= item.reorderLevel);
  }, [items]);

  const isLoading = isItemsLoading || isWarehousesLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Low Stock Report</h1>
          <p className="text-muted-foreground mt-1">
            A list of all items that are at or below their reorder level, requiring procurement action.
          </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export to Excel
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Items to Reorder</CardTitle>
          <CardDescription>
            These items need to be reordered to avoid stockouts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Name</TableHead>
                <TableHead>Item Code</TableHead>
                <TableHead>Warehouse</TableHead>
                <TableHead>Qty On Hand</TableHead>
                <TableHead>Reorder Level</TableHead>
                <TableHead>Suggested Reorder Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                          <TableCell><Skeleton className="h-5 w-32"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-20"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-24"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-16"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-20"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-24"/></TableCell>
                      </TableRow>
                  ))
              ) : lowStockItems.length > 0 ? (
                lowStockItems.map((item) => {
                    const suggestedQty = Math.max(0, item.reorderLevel - item.quantity);
                    return (
                        <TableRow key={item.id} className="bg-destructive/10">
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>{item.code}</TableCell>
                            <TableCell>{getWarehouseName(item.warehouseId)}</TableCell>
                            <TableCell className="font-semibold text-destructive">{item.quantity}</TableCell>
                            <TableCell>{item.reorderLevel}</TableCell>
                            <TableCell className="font-semibold">{suggestedQty}</TableCell>
                        </TableRow>
                    );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                     <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-muted rounded-full">
                        <Package className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold">
                        No Items Are Low on Stock
                      </h3>
                      <p className="text-muted-foreground">
                        All inventory levels are currently above their reorder points.
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
