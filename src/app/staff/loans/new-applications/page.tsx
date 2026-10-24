'use client';

import { useState } from 'react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FilePlus2, FileCheck, Loader2, FileWarning } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, doc, query, where, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export default function AllApplicationsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedLoan, setSelectedLoan] = useState<any | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);

  const loansQuery = useMemoFirebase(
    () =>
      firestore && userData?.institutionId
        ? query(
            collection(firestore, 'institutions', userData.institutionId, 'loans')
          )
        : null,
    [firestore, userData]
  );
  const { data: loans, isLoading: isLoansLoading } = useCollection(loansQuery);

  const customersQuery = useMemoFirebase(
    () =>
      firestore && userData?.institutionId
        ? collection(firestore, 'institutions', userData.institutionId, 'customers')
        : null,
    [firestore, userData]
  );
  const { data: customers, isLoading: isCustomersLoading } = useCollection(customersQuery);
  
  const staffQuery = useMemoFirebase(
    () =>
      firestore && userData?.institutionId
        ? query(collection(firestore, 'users'), where('institutionId', '==', userData.institutionId))
        : null,
    [firestore, userData]
  );
  const { data: staff, isLoading: isStaffLoading } = useCollection(staffQuery);

  const getCustomerName = (customerId: string) => customers?.find(c => c.id === customerId)?.name || '...';
  const getStaffName = (staffId: string) => staff?.find(s => s.id === staffId)?.name || 'System';

  const handleStartAppraisal = (loan: any) => {
    setSelectedLoan(loan);
    setIsConfirmOpen(true);
  };

  const confirmStartAppraisal = async () => {
    if (!selectedLoan || !user || !firestore || !userData?.institutionId) return;

    setLoading(selectedLoan.id);
    try {
      const loanDocRef = doc(firestore, 'institutions', userData.institutionId, 'loans', selectedLoan.id);
      await updateDoc(loanDocRef, {
        status: 'Appraisal',
        appraisedBy: user.uid,
      });
      toast({
        title: 'Appraisal Started',
        description: `You have started the appraisal for ${getCustomerName(selectedLoan.customerId)}.`,
      });
    } catch (e) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to start appraisal. Please try again.',
      });
    } finally {
      setLoading(null);
      setIsConfirmOpen(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Application': return 'secondary';
      case 'Appraisal': return 'outline';
      case 'Pending Approval': return 'outline';
      case 'Approved': return 'default';
      case 'Disbursed': return 'default';
      case 'Repaid': return 'default';
      case 'Overdue': return 'destructive';
      case 'Rejected': return 'destructive';
      default: return 'secondary';
    }
  }

  const isLoading = isLoansLoading || isCustomersLoading || isStaffLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">All Loan Applications</h1>
          <p className="text-muted-foreground mt-1">
            A master list of all loan applications in the system.
          </p>
        </div>
        <Button asChild>
            <Link href="/staff/loans/origination">
                <FilePlus2 className="mr-2 h-4 w-4" /> Start New Application
            </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Loan Book</CardTitle>
          <CardDescription>
            This table shows all loans, regardless of their current status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Amount (MWK)</TableHead>
                <TableHead>Date Applied</TableHead>
                <TableHead>Submitted By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-9 w-32 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : loans && loans.length > 0 ? (
                loans.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell className="font-medium">{getCustomerName(loan.customerId)}</TableCell>
                    <TableCell>{loan.amount.toLocaleString()}</TableCell>
                    <TableCell>{format(loan.dateApplied.toDate(), 'PPP')}</TableCell>
                    <TableCell>{getStaffName(loan.submittedBy)}</TableCell>
                    <TableCell>
                        <Badge variant={getStatusBadge(loan.status)}>{loan.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {loan.status === 'Application' ? (
                        <Button onClick={() => handleStartAppraisal(loan)} size="sm" disabled={!!loading}>
                          {loading === loan.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                              'Start Appraisal'
                          )}
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" asChild>
                            <Link href="#">View</Link>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="p-4 bg-muted rounded-full">
                            <FileWarning className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold">No Loans Found</h3>
                        <p className="text-muted-foreground">
                            There are no loan applications in the system yet.
                        </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Start Appraisal?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will assign the loan application for {selectedLoan && getCustomerName(selectedLoan.customerId)} to you and move it to the appraisal stage. Are you sure you want to continue?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmStartAppraisal} disabled={!!loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Yes, Start Appraisal
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}