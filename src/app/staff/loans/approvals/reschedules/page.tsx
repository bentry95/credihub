
'use client';

import { useMemo } from 'react';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Gavel, Check } from 'lucide-react';
import Link from 'next/link';

export default function RescheduleApprovalsPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData, isLoading: isUserLoading } = useDoc(userDocRef);
  const institutionId = userData?.institutionId;

  const reschedulesForApprovalQuery = useMemoFirebase(
    () =>
      firestore && institutionId
        ? query(
            collection(firestore, 'institutions', institutionId, 'loanApplications'),
            where('status', '==', 'Pending Approval'),
            where('isRescheduled', '==', true)
          )
        : null,
    [firestore, institutionId]
  );
  const { data: reschedulesForApproval, isLoading: isReschedulesLoading } = useCollection(reschedulesForApprovalQuery);
  
  const customersQuery = useMemoFirebase(
    () =>
      firestore && institutionId
        ? query(
          collection(firestore, 'institutions', institutionId, 'customers'),
        )
        : null,
    [firestore, institutionId]
  );
  const { data: customers, isLoading: isCustomersLoading } = useCollection(customersQuery);

  const getCustomerName = (customerId: string) => customers?.find(c => c.id === customerId)?.name || '...';
  
  const isLoading = isReschedulesLoading || isCustomersLoading || isUserLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Loan Reschedule Approvals</h1>
          <p className="text-muted-foreground mt-1">
            Review and provide final approval for loan reschedule requests.
          </p>
        </div>
      </div>
        <Card>
            <CardHeader>
                <CardTitle>Reschedule Approval Queue</CardTitle>
                <CardDescription>
                Review and approve pending loan reschedule applications.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Original Loan ID</TableHead>
                    <TableHead>Original Balance</TableHead>
                    <TableHead>New Term</TableHead>
                    <TableHead>New Interest Rate</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                    Array.from({ length: 2 }).map((_, i) => (
                        <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-9 w-32 ml-auto" /></TableCell>
                        </TableRow>
                    ))
                    ) : reschedulesForApproval && reschedulesForApproval.length > 0 ? (
                    reschedulesForApproval.map((loan) => (
                        <TableRow key={loan.id}>
                        <TableCell className="font-medium">{getCustomerName(loan.customerId)}</TableCell>
                        <TableCell>{loan.originalLoanId}</TableCell>
                        <TableCell>MWK {loan.amount?.toLocaleString()}</TableCell>
                        <TableCell>{loan.term} months</TableCell>
                        <TableCell>{loan.annualInterestRate}%</TableCell>
                        <TableCell className="text-right">
                            <Button asChild size="sm">
                            <Link href={`/staff/loans/approvals/${loan.id}`}>
                                <Gavel className="mr-2 h-4 w-4" /> Review & Decide
                            </Link>
                            </Button>
                        </TableCell>
                        </TableRow>
                    ))
                    ) : (
                    <TableRow>
                        <TableCell colSpan={6} className="h-48 text-center">
                        <div className="flex flex-col items-center gap-4">
                            <div className="p-4 bg-muted rounded-full">
                            <Check className="h-10 w-10 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-semibold">No Reschedules Pending</h3>
                            <p className="text-muted-foreground">There are no reschedule requests awaiting approval.</p>
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
