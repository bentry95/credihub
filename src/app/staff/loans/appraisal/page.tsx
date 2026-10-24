
'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  useUser,
  useFirestore,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, query, where, getDocs, doc } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ClipboardCheck, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import { useBranch } from '@/context/BranchContext';

export default function LoanAppraisalQueuePage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { selectedBranch } = useBranch();
  
  const [loansForAppraisal, setLoansForAppraisal] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { data: userData, isLoading: isUserDataLoading } = useDoc(
    useMemoFirebase(() => (firestore && user ? doc(firestore, 'users', user.uid) : null), [firestore, user])
  );
  const institutionId = userData?.institutionId;
  const appraisalLimit = userData?.appraisalLimit ?? 0;
  
  useEffect(() => {
    async function fetchData() {
        if (!firestore || !institutionId || !user) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);

        try {
            const loanAppsRef = collection(firestore, 'institutions', institutionId, 'loanApplications');
            const q = query(
                loanAppsRef, 
                where('status', '==', 'Appraisal'), 
                where('appraisedBy', '==', user.uid)
            );
            
            const loanQuerySnapshot = await getDocs(q);
            const fetchedLoans = loanQuerySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (fetchedLoans.length > 0) {
                const customerIds = [...new Set(fetchedLoans.map(loan => loan.customerId))];
                const customersQuery = query(collection(firestore, 'institutions', institutionId, 'customers'), where('id', 'in', customerIds));
                const customersSnap = await getDocs(customersQuery);
                const customersData = customersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setCustomers(customersData);
            } else {
                setCustomers([]);
            }
            
            setLoansForAppraisal(fetchedLoans);

        } catch (e) {
            console.error("Error fetching data: ", e);
            setLoansForAppraisal([]);
            setCustomers([]);
        } finally {
            setIsLoading(false);
        }
    }

    if (!isUserDataLoading && user && institutionId) {
        fetchData();
    }
  }, [firestore, institutionId, user, isUserDataLoading]);


  const getCustomerName = (customerId: string) => {
    return customers?.find(c => c.id === customerId)?.name || '...';
  }

  const filteredLoans = useMemo(() => {
    return loansForAppraisal.filter(loan => {
        if (loan.amount > appraisalLimit) return false;
        if (selectedBranch === 'all') return true;
        return loan.branchId === selectedBranch;
    });
  }, [loansForAppraisal, selectedBranch, appraisalLimit]);

  const loansAboveLimit = useMemo(() => {
    return loansForAppraisal.filter(loan => loan.amount > appraisalLimit).length;
  }, [loansForAppraisal, appraisalLimit]);

  const finalLoading = isLoading || isUserDataLoading || isUserLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Loan Appraisal</h1>
          <p className="text-muted-foreground mt-1">
            Review, assess, and recommend loan applications assigned to you.
          </p>
        </div>
      </div>
      {loansAboveLimit > 0 && (
          <Alert variant="default" className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200">
              <ShieldAlert className="h-4 w-4 text-yellow-600" />
              <AlertTitle className="text-yellow-800 dark:text-yellow-200">Permission Limit</AlertTitle>
              <AlertDescription className="text-yellow-700 dark:text-yellow-300">
                  There are {loansAboveLimit} loan(s) in the appraisal queue that exceed your appraisal limit of MWK {appraisalLimit.toLocaleString()} and are not shown.
              </AlertDescription>
          </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>My Appraisal Queue</CardTitle>
          <CardDescription>
            These are the loan applications currently assigned to you for appraisal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Requested Amount</TableHead>
                <TableHead>Term</TableHead>
                <TableHead>Date Applied</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {finalLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-9 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredLoans.length > 0 ? (
                filteredLoans.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell className="font-medium">{getCustomerName(loan.customerId)}</TableCell>
                    <TableCell>MWK {loan.amount.toLocaleString()}</TableCell>
                    <TableCell>{loan.term} months</TableCell>
                    <TableCell>{format(loan.dateApplied.toDate(), 'PPP')}</TableCell>
                    <TableCell className="text-right">
                       <Button asChild size="sm">
                        <Link href={`/staff/loans/appraisal/${loan.id}`}>
                          Appraise
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="p-4 bg-muted rounded-full">
                            <ClipboardCheck className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold">Appraisal Queue is Empty</h3>
                        <p className="text-muted-foreground">
                           You have no loan applications to appraise. Check the "New Applications" queue.
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
