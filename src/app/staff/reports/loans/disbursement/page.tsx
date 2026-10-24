
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
import { Download, Landmark, FileWarning } from 'lucide-react';
import { format } from 'date-fns';
import { useUser, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, getDocs, doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';

export default function DisbursementReportPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const [disbursedLoans, setDisbursedLoans] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);
    const [loanProducts, setLoanProducts] = useState<any[]>([]);
    const [staff, setStaff] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const userDocRef = useMemoFirebase(
      () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
      [firestore, user]
    );
    const { data: userData } = useDoc(userDocRef);
    const institutionId = userData?.institutionId;

    useEffect(() => {
        async function fetchData() {
            if (!firestore || !institutionId) {
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            try {
                const disbursedStatuses = ['Disbursed', 'Repaid', 'Overdue'];
                const loanAppsQuery = query(
                    collection(firestore, 'institutions', institutionId, 'loanApplications'),
                    where('status', 'in', disbursedStatuses)
                );
                const runningLoansQuery = query(
                    collection(firestore, 'institutions', institutionId, 'runningLoans'),
                    where('status', 'in', disbursedStatuses)
                );
                const customersQuery = query(collection(firestore, 'institutions', institutionId, 'customers'));
                const productsQuery = query(collection(firestore, 'institutions', institutionId, 'loanProducts'));
                const staffQuery = query(collection(firestore, 'users'), where('institutionId', '==', institutionId));

                const [
                    loanAppsSnap,
                    runningLoansSnap,
                    customersSnap,
                    productsSnap,
                    staffSnap,
                ] = await Promise.all([
                    getDocs(loanAppsQuery),
                    getDocs(runningLoansQuery),
                    getDocs(customersQuery),
                    getDocs(productsQuery),
                    getDocs(staffQuery),
                ]);

                const allDisbursed = [
                    ...loanAppsSnap.docs.map(d => ({...d.data(), id: d.id})),
                    ...runningLoansSnap.docs.map(d => ({...d.data(), id: d.id})),
                ].sort((a,b) => b.disbursalDate.toDate() - a.disbursalDate.toDate());

                setDisbursedLoans(allDisbursed);
                setCustomers(customersSnap.docs.map(d => ({...d.data(), id: d.id})));
                setLoanProducts(productsSnap.docs.map(d => ({...d.data(), id: d.id})));
                setStaff(staffSnap.docs.map(d => ({...d.data(), uid: d.data().uid })));

            } catch (error) {
                console.error("Failed to fetch disbursement data:", error);
            } finally {
                setIsLoading(false);
            }
        }

        if (institutionId) {
          fetchData();
        } else {
            setIsLoading(false);
        }
    }, [firestore, institutionId]);
    
    const getCustomerName = (customerId: string) => customers.find(c => c.id === customerId)?.name || '...';
    const getProductName = (productId: string) => loanProducts.find(p => p.id === productId)?.name || '...';
    const getStaffName = (staffId: string) => staff.find(s => s.uid === staffId)?.name || '...';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Loan Disbursement Report</h1>
          <p className="text-muted-foreground mt-1">
            Details all disbursed loans, filterable by date, officer, and product.
          </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export to Excel
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Disbursement Log</CardTitle>
          <CardDescription>
            A detailed log of all loans paid out to customers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Disbursement Date</TableHead>
                <TableHead>Customer Name</TableHead>
                <TableHead>Loan Product</TableHead>
                <TableHead>Submitted By</TableHead>
                <TableHead className="text-right">Principal Amount (MWK)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                          <TableCell><Skeleton className="h-5 w-24"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-32"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-28"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-32"/></TableCell>
                          <TableCell className="text-right"><Skeleton className="h-5 w-24 ml-auto"/></TableCell>
                      </TableRow>
                  ))
              ) : disbursedLoans.length > 0 ? (
                disbursedLoans.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell>{loan.disbursalDate ? format(loan.disbursalDate.toDate(), 'PPP') : 'N/A'}</TableCell>
                    <TableCell className="font-medium">{getCustomerName(loan.customerId)}</TableCell>
                    <TableCell>{getProductName(loan.loanProductId)}</TableCell>
                    <TableCell>{getStaffName(loan.submittedBy)}</TableCell>
                    <TableCell className="text-right font-mono">{loan.amount.toLocaleString()}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                    <TableCell colSpan={5} className="h-48 text-center">
                        <div className="flex flex-col items-center gap-4">
                            <div className="p-4 bg-muted rounded-full">
                                <FileWarning className="h-10 w-10 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-semibold">No Disbursed Loans Found</h3>
                            <p className="text-muted-foreground">There is no disbursement data to display.</p>
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
