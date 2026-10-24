'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Download, Receipt } from 'lucide-react';
import { format } from 'date-fns';
import { useUser, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';

interface RepaymentData {
  id: string;
  collectionDate: Date;
  customerName: string;
  loanProduct: string;
  principal: number;
  interest: number;
  fees: number;
  penalties: number;
  total: number;
}

export default function LoanRepaymentReportPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const [repayments, setRepayments] = useState<RepaymentData[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const userDocRef = useMemoFirebase(
      () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
      [firestore, user]
    );
    const { data: userData } = useDoc(userDocRef);
    const institutionId = userData?.institutionId;

    useEffect(() => {
        if (!firestore || !institutionId) {
            setIsLoading(false);
            return;
        };

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const journalsQuery = query(collection(firestore, 'institutions', institutionId, 'journals'), where('status', '==', 'Posted'));
                const productsQuery = query(collection(firestore, 'institutions', institutionId, 'loanProducts'));
                const customersQuery = query(collection(firestore, 'institutions', institutionId, 'customers'));
                const loanAppsQuery = query(collection(firestore, 'institutions', institutionId, 'loanApplications'));
                const runningLoansQuery = query(collection(firestore, 'institutions', institutionId, 'runningLoans'));

                const [
                    journalsSnap,
                    productsSnap,
                    customersSnap,
                    loanAppsSnap,
                    runningLoansSnap
                ] = await Promise.all([
                    getDocs(journalsQuery),
                    getDocs(productsQuery),
                    getDocs(customersQuery),
                    getDocs(loanAppsQuery),
                    getDocs(runningLoansQuery)
                ]);

                const products = productsSnap.docs.map(d => ({...d.data(), id: d.id}));
                const customers = customersSnap.docs.map(d => ({...d.data(), id: d.id}));
                const allLoans = [
                    ...loanAppsSnap.docs.map(d => ({...d.data(), id: d.id})),
                    ...runningLoansSnap.docs.map(d => ({...d.data(), id: d.id}))
                ];
                
                const loanPortfolioAccountIds = new Set(products.map(p => p.loanPortfolioAccountId));
                const repaymentJournals = journalsSnap.docs
                    .map(d => ({...d.data(), id: d.id}))
                    .filter(j => j.transactions.some((t: any) => loanPortfolioAccountIds.has(t.accountId) && t.credit > 0));

                const processedRepayments = repaymentJournals.map(journal => {
                    const repaymentTx = journal.transactions.find((t: any) => loanPortfolioAccountIds.has(t.accountId));
                    const loan = allLoans.find(l => journal.loanId && l.id === journal.loanId);
                    const customer = customers.find(c => c.id === loan?.customerId);
                    const product = products.find(p => p.id === loan?.loanProductId);
                    
                    return {
                        id: journal.id,
                        collectionDate: journal.date.toDate(),
                        customerName: customer?.name || 'Unknown',
                        loanProduct: product?.name || 'Unknown',
                        principal: repaymentTx?.credit || 0,
                        interest: 0, 
                        fees: 0,
                        penalties: 0,
                        total: repaymentTx?.credit || 0,
                    };
                }).sort((a,b) => b.collectionDate.getTime() - a.collectionDate.getTime());

                setRepayments(processedRepayments);
            } catch (error) {
                console.error("Failed to fetch repayment data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [firestore, institutionId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Loan Repayment Report</h1>
          <p className="text-muted-foreground mt-1">
            Tracks expected vs. actual repayments to monitor collections performance.
          </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export to Excel
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Repayments Received</CardTitle>
          <CardDescription>
            A log of all loan repayments collected within the selected period.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Collection Date</TableHead>
                <TableHead>Customer Name</TableHead>
                <TableHead>Loan Product</TableHead>
                <TableHead>Principal Paid</TableHead>
                <TableHead>Interest Paid</TableHead>
                <TableHead>Fees Paid</TableHead>
                <TableHead>Penalties Paid</TableHead>
                <TableHead className="text-right">Total Paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                          <TableCell><Skeleton className="h-5 w-24"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-32"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-28"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-20"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-20"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-20"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-20"/></TableCell>
                          <TableCell className="text-right"><Skeleton className="h-5 w-24 ml-auto"/></TableCell>
                      </TableRow>
                  ))
              ) : repayments.length > 0 ? (
                repayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{format(payment.collectionDate, 'PPP')}</TableCell>
                    <TableCell className="font-medium">{payment.customerName}</TableCell>
                    <TableCell>{payment.loanProduct}</TableCell>
                    <TableCell>{payment.principal.toLocaleString()}</TableCell>
                    <TableCell>{payment.interest.toLocaleString()}</TableCell>
                    <TableCell>{payment.fees.toLocaleString()}</TableCell>
                    <TableCell>{payment.penalties.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono">{payment.total.toLocaleString()}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-muted rounded-full">
                        <Receipt className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold">No Repayments Found</h3>
                      <p className="text-muted-foreground">There is no repayment data to display for this period.</p>
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