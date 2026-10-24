
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
import { Button } from '@/components/ui/button';
import { Download, Briefcase, FileWarning } from 'lucide-react';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, query, where, getDocs, doc, collectionGroup } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';

interface ProductPerformanceData {
  id: string;
  name: string;
  accountCount: number;
  totalBalance: number;
  averageBalance: number;
}

export default function SavingsProductPerformancePage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [performanceData, setPerformanceData] = useState<ProductPerformanceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { data: userData } = useDoc(
    useMemoFirebase(() => (firestore && user ? doc(firestore, 'users', user.uid) : null), [firestore, user])
  );
  const institutionId = userData?.institutionId;

  const productsQuery = useMemoFirebase(
    () =>
      firestore && institutionId
        ? collection(firestore, 'institutions', institutionId, 'savingsProducts')
        : null,
    [firestore, institutionId]
  );
  const { data: products, isLoading: isProductsLoading } = useCollection(productsQuery);
  
  const savingsAccountsQuery = useMemoFirebase(
    () =>
      firestore && institutionId
        ? query(collectionGroup(firestore, 'savingsAccounts'), where('institutionId', '==', institutionId))
        : null,
    [firestore, institutionId]
  );
  const { data: savingsAccounts, isLoading: isAccountsLoading } = useCollection(savingsAccountsQuery);
  
  useEffect(() => {
    if (!products || !savingsAccounts) {
        if (!isProductsLoading && !isAccountsLoading) {
            setIsLoading(false);
        }
        return;
    };
    
    const performanceMap: Record<string, ProductPerformanceData> = {};

    products.forEach(product => {
        performanceMap[product.id] = {
            id: product.id,
            name: product.name,
            accountCount: 0,
            totalBalance: 0,
            averageBalance: 0,
        };
    });

    savingsAccounts.forEach(account => {
        if (performanceMap[account.productId]) {
            performanceMap[account.productId].accountCount++;
            performanceMap[account.productId].totalBalance += account.balance || 0;
        }
    });

    Object.values(performanceMap).forEach(productData => {
        if (productData.accountCount > 0) {
            productData.averageBalance = productData.totalBalance / productData.accountCount;
        }
    });

    setPerformanceData(Object.values(performanceMap));
    setIsLoading(false);

  }, [products, savingsAccounts, isProductsLoading, isAccountsLoading]);


  const finalIsLoading = isLoading || isProductsLoading || isAccountsLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Savings Product Performance</h1>
          <p className="text-muted-foreground mt-1">
            An overview of how each savings product is performing.
          </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export to Excel
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Performance by Product</CardTitle>
          <CardDescription>
            A summary of account numbers and balances for each savings product.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Name</TableHead>
                <TableHead>Number of Accounts</TableHead>
                <TableHead>Total Balance (MWK)</TableHead>
                <TableHead>Average Balance (MWK)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {finalIsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  </TableRow>
                ))
              ) : performanceData.length > 0 ? (
                performanceData.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.accountCount}</TableCell>
                    <TableCell className="font-mono">{product.totalBalance.toLocaleString()}</TableCell>
                    <TableCell className="font-mono">{product.averageBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-48 text-center">
                     <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-muted rounded-full">
                        <FileWarning className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold">No Data Found</h3>
                      <p className="text-muted-foreground">
                        There are no savings products or accounts to report on.
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
