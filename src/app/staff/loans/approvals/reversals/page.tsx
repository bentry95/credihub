
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

export default function ReversalApprovalsPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData, isLoading: isUserLoading } = useDoc(userDocRef);
  const institutionId = userData?.institutionId;

  const reversalsForApprovalQuery = useMemoFirebase(
    () =>
      firestore && institutionId
        ? query(
            collection(firestore, 'institutions', institutionId, 'loanApplications'),
            where('status', '==', 'Reversal Pending')
          )
        : null,
    [firestore, institutionId]
  );
  const { data: reversalsForApproval, isLoading: isReversalsLoading } = useCollection(reversalsForApprovalQuery);
  
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
  
  const staffQuery = useMemoFirebase(
    () =>
      firestore && institutionId
        ? query(collection(firestore, 'users'), where('institutionId', '==', institutionId))
        : null,
    [firestore, institutionId]
  );
  const { data: staff, isLoading: isStaffLoading } = useCollection(staffQuery);

  const getCustomerName = (customerId: string) => customers?.find(c => c.id === customerId)?.name || '...';
  const getStaffName = (staffId: string) => staff?.find(s => s.uid === staffId)?.name || '...';

  const isLoading = isReversalsLoading || isCustomersLoading || isStaffLoading || isUserLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Loan Reversal Approvals</h1>
          <p className="text-muted-foreground mt-1">
            Review and provide final approval for loan reversal requests.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Reversal Approval Queue</CardTitle>
          <CardDescription>
              These loan disbursements have been flagged for reversal and require your approval to proceed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Loan Amount</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Requested By</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center"><Skeleton className="h-24 w-full"/></TableCell></TableRow>
              ) : reversalsForApproval && reversalsForApproval.length > 0 ? (
                reversalsForApproval.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell className="font-medium">{getCustomerName(loan.customerId)}</TableCell>
                    <TableCell>MWK {loan.amount.toLocaleString()}</TableCell>
                    <TableCell>{loan.reversalReason}</TableCell>
                    <TableCell>{getStaffName(loan.reversalRequestedBy)}</TableCell>
                    <TableCell className="text-right">
                        <Button asChild size="sm">
                            <Link href={`/staff/loans/approvals/${loan.id}`}>
                                <Gavel className="mr-2 h-4 w-4" /> Review
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
                            <Check className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold">No Reversals Pending</h3>
                        <p className="text-muted-foreground">
                            There are no pending loan reversals to approve.
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
