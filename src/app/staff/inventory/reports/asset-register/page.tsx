
'use client';

import { useState, useMemo, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Download, ClipboardList, FileWarning, Image as ImageIcon } from 'lucide-react';
import { format } from 'date-fns';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, query, where, getDocs, doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

interface AssetRegisterItem {
  id: string;
  name: string;
  code: string;
  categoryName: string;
  costPrice: number;
  purchaseDate: Date;
  status: 'Available' | 'Issued';
  issuedTo?: string;
  issueDate?: Date;
}

export default function AssetRegisterPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [searchTerm, setSearchTerm] = useState('');
  const [assetData, setAssetData] = useState<AssetRegisterItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { data: userData } = useDoc(
    useMemoFirebase(() => (firestore && user ? doc(firestore, 'users', user.uid) : null), [firestore, user])
  );
  const institutionId = userData?.institutionId;

  const { data: assetItems, isLoading: isItemsLoading } = useCollection(
    useMemoFirebase(() => (institutionId ? query(collection(firestore, 'institutions', institutionId, 'inventoryItems'), where('itemType', '==', 'Asset')) : null), [firestore, institutionId])
  );

  const { data: issuedAssets, isLoading: isIssuedLoading } = useCollection(
    useMemoFirebase(() => (institutionId ? collection(firestore, 'institutions', institutionId, 'staffAssets') : null), [firestore, institutionId])
  );
  
  const { data: categories, isLoading: isCategoriesLoading } = useCollection(
    useMemoFirebase(() => (institutionId ? collection(firestore, 'institutions', institutionId, 'inventoryCategories') : null), [firestore, institutionId])
  );

  useEffect(() => {
    if (isItemsLoading || isIssuedLoading || isCategoriesLoading) return;
    
    const getCategoryName = (id: string) => categories?.find(c => c.id === id)?.name || 'Unknown';

    const processedData: AssetRegisterItem[] = (assetItems || []).map(item => {
      const issuedRecord = (issuedAssets || []).find(issued => issued.inventoryItemId === item.id && issued.status === 'Issued');
      
      return {
        id: item.id,
        name: item.name,
        code: item.code,
        categoryName: getCategoryName(item.categoryId),
        costPrice: item.costPrice || 0,
        purchaseDate: item.createdAt.toDate(),
        status: issuedRecord ? 'Issued' : 'Available',
        issuedTo: issuedRecord ? issuedRecord.customerName : undefined,
        issueDate: issuedRecord ? issuedRecord.dateIssued.toDate() : undefined,
      };
    });

    setAssetData(processedData);
    setIsLoading(false);

  }, [assetItems, issuedAssets, categories, isItemsLoading, isIssuedLoading, isCategoriesLoading]);


  const filteredAssets = useMemo(() => {
    if (!searchTerm) return assetData;
    const lowercasedFilter = searchTerm.toLowerCase();
    return assetData.filter(item =>
        item.name.toLowerCase().includes(lowercasedFilter) ||
        item.code.toLowerCase().includes(lowercasedFilter) ||
        item.categoryName.toLowerCase().includes(lowercasedFilter) ||
        item.issuedTo?.toLowerCase().includes(lowercasedFilter)
    );
  }, [assetData, searchTerm]);
  
  const getStatusBadgeVariant = (status: 'Available' | 'Issued') => {
    return status === 'Available' ? 'secondary' : 'default';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fixed Asset Register</h1>
          <p className="text-muted-foreground mt-1">
            A complete register of all fixed assets owned by the institution.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Asset List</CardTitle>
          <CardDescription>
            Search and view all assets, their cost, and current assignment status.
          </CardDescription>
          <div className="flex items-center justify-between pt-4">
             <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                    placeholder="Search by name, code, user..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export to Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset Name</TableHead>
                <TableHead>Asset Code</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Cost Price (MWK)</TableHead>
                <TableHead>Purchase Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issued To</TableHead>
                <TableHead>Issue Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                          <TableCell><Skeleton className="h-5 w-32"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-20"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-24"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-24"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-24"/></TableCell>
                          <TableCell><Skeleton className="h-6 w-20"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-32"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-24"/></TableCell>
                      </TableRow>
                  ))
              ) : filteredAssets.length > 0 ? (
                filteredAssets.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.code}</TableCell>
                    <TableCell>{item.categoryName}</TableCell>
                    <TableCell className="font-mono">{item.costPrice.toLocaleString()}</TableCell>
                    <TableCell>{format(item.purchaseDate, 'PPP')}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(item.status)}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.issuedTo || 'N/A'}</TableCell>
                    <TableCell>{item.issueDate ? format(item.issueDate, 'PPP') : 'N/A'}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="h-48 text-center">
                     <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-muted rounded-full">
                        <ClipboardList className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold">
                        No Assets Found
                      </h3>
                      <p className="text-muted-foreground">
                        Create an inventory item with the type 'Asset' to get started.
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
