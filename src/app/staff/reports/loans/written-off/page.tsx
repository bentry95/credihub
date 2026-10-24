'use client';

import { useState, useEffect } from 'react';
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
import { Download, FileX } from 'lucide-react';
import { format } from 'date-fns';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';


export default function WrittenOffLoansReportPage() {
    const { user } = useUser();
    const firestore = useFirestore();

    const userDocRef = useMemoFirebase(
      () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
      [firestore, user]
    );
    const { data: userData, isLoading: isUserLoading } = useDoc(userDocRef);
    const institutionId = userData?.institutionId;
    
    const writtenOffLoansQuery = useMemoFirebase(
        () => (firestore && institutionId ? query(collection(firestore, 'institutions', institutionId, 'loanApplications'), where('status', '==', 'Written-Off')) : null),
        [firestore, institutionId]
    );
    const { data: writtenOffLoans, isLoading: isLoansLoading } = useCollection(writtenOffLoansQuery);

    const customersQuery = useMemoFirebase(
        () => (firestore && institutionId ? collection(firestore, 'institutions', institutionId, 'customers') : null),
        [firestore, institutionId]
    );
    const { data: customers, isLoading: isCustomersLoading } = useCollection(customersQuery);

    const productsQuery = useMemoFirebase(
        () => (firestore && institutionId ? collection(firestore, 'institutions', institutionId, 'loanProducts') : null),
        [firestore, institutionId]
    );
    const { data: loanProducts, isLoading: isProductsLoading } = useCollection(productsQuery);

    const getCustomerName = (customerId: string) => customers?.find(c => c.id === customerId)?.name || '...';
    const getProductName = (productId: string) => loanProducts?.find(p => p.id === productId)?.name || '...';
    
    const getWriteOffDate = (loan: any) => {
        if (!loan?.auditHistory) return 'N/A';
        const writeOffEvent = loan.auditHistory.find((event: any) => event.action === 'Loan Written-Off');
        return writeOffEvent?.timestamp ? format(writeOffEvent.timestamp.toDate(), 'PPP') : 'N/A';
    }
    
    const isLoading = isLoansLoading || isCustomersLoading || isProductsLoading || isUserLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Written-off Loans Report</h1>
          <p className="text-muted-foreground mt-1">
            A list of all loans that have been declared uncollectible and written off.
          </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export to Excel
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Written-off Loans</CardTitle>
          <CardDescription>
            A log of all loans that have been removed from the active portfolio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Write-off Date</TableHead>
                <TableHead>Customer Name</TableHead>
                <TableHead>Loan Product</TableHead>
                <TableHead>Principal at Write-off</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                  Array.from({length: 3}).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-24"/></TableCell>
                        <TableCell><Skeleton className="h-5 w-32"/></TableCell>
                        <TableCell><Skeleton className="h-5 w-28"/></TableCell>
                        <TableCell><Skeleton className="h-5 w-24"/></TableCell>
                        <TableCell><Skeleton className="h-5 w-28"/></TableCell>
                      </TableRow>
                  ))
              ) : writtenOffLoans && writtenOffLoans.length > 0 ? (
                writtenOffLoans.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell>{getWriteOffDate(loan)}</TableCell>
                    <TableCell className="font-medium">{getCustomerName(loan.customerId)}</TableCell>
                    <TableCell>{getProductName(loan.loanProductId)}</TableCell>
                    <TableCell>MWK {loan.outstandingPrincipal?.toLocaleString() || loan.amount.toLocaleString()}</TableCell>
                    <TableCell>{loan.writeOffReason}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-muted rounded-full">
                        <FileX className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold">No Written-Off Loans</h3>
                      <p className="text-muted-foreground">There are no written-off loans to display.</p>
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