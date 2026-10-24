
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
import { Download, Banknote, FileWarning } from 'lucide-react';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, query, where, getDocs, doc, collectionGroup } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';

interface CustomerBalanceData {
  customerId: string;
  customerName: string;
  accountNumber: string;
  branchId: string;
  productName: string;
  balance: number;
}


export default function CustomerBalancesReportPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [balances, setBalances] = useState<CustomerBalanceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { data: userData } = useDoc(
    useMemoFirebase(() => (firestore && user ? doc(firestore, 'users', user.uid) : null), [firestore, user])
  );
  const institutionId = userData?.institutionId;
  
  const { data: institutionData, isLoading: isInstitutionLoading } = useDoc(
    useMemoFirebase(() => (institutionId ? doc(firestore, 'institutions', institutionId) : null), [institutionId])
  );

  useEffect(() => {
    if (!firestore || !institutionId) {
      if(!isInstitutionLoading) setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const customersRef = collection(firestore, 'institutions', institutionId, 'customers');
        const productsRef = collection(firestore, 'institutions', institutionId, 'savingsProducts');
        const savingsAccountsQuery = query(collectionGroup(firestore, 'savingsAccounts'));

        const [customersSnap, productsSnap, savingsAccountsSnap] = await Promise.all([
            getDocs(customersRef),
            getDocs(productsRef),
            getDocs(savingsAccountsQuery),
        ]);
        
        const customersMap = new Map(customersSnap.docs.map(d => [d.id, d.data()]));
        const productsMap = new Map(productsSnap.docs.map(d => [d.id, d.data()]));

        const balanceData: CustomerBalanceData[] = [];
        savingsAccountsSnap.forEach(doc => {
          const account = doc.data();
          const customerId = doc.ref.parent.parent?.id; // The customer ID is the parent of the savingsAccounts subcollection
          if (customerId) {
              const customer = customersMap.get(customerId);
              const product = productsMap.get(account.productId);
    
              if (customer && product) {
                balanceData.push({
                  customerId: customer.id,
                  customerName: customer.name,
                  accountNumber: customer.accountNumber,
                  branchId: customer.branchId,
                  productName: product.name,
                  balance: account.balance,
                });
              }
          }
        });
        
        setBalances(balanceData.sort((a,b) => b.balance - a.balance));

      } catch (error) {
        console.error("Failed to fetch customer balances data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [firestore, institutionId]);

  const getBranchName = (branchId: string) => {
    if (!institutionData) return `Branch ${branchId}`;
    if (branchId === '01') return institutionData.hqBranch?.name || 'Headquarters';
    const branch = institutionData.branches?.find((b: any) => b.code === branchId);
    return branch?.name || `Branch ${branchId}`;
  }

  const finalLoading = isLoading || isInstitutionLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customer Savings Balances</h1>
          <p className="text-muted-foreground mt-1">
            A report showing the savings balance for every customer.
          </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export to Excel
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Customer Balances</CardTitle>
          <CardDescription>
            A complete list of all customer savings accounts and their current balances.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer Name</TableHead>
                <TableHead>Account Number</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Savings Product</TableHead>
                <TableHead className="text-right">Balance (MWK)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {finalLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-28 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : balances.length > 0 ? (
                balances.map((item, index) => (
                  <TableRow key={`${item.customerId}-${index}`}>
                    <TableCell className="font-medium">{item.customerName}</TableCell>
                    <TableCell>{item.accountNumber}</TableCell>
                    <TableCell>{getBranchName(item.branchId)}</TableCell>
                    <TableCell>{item.productName}</TableCell>
                    <TableCell className="text-right font-mono">{item.balance.toLocaleString()}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-muted rounded-full">
                        <FileWarning className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold">No Data Found</h3>
                      <p className="text-muted-foreground">
                        There are no customer savings accounts to display.
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
