
'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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
import { FilePlus2, FileCheck, Loader2, FileWarning, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, doc, query, where, updateDoc, getDocs, collectionGroup } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { loanStatusBadgeVariant } from '@/lib/utils';
import { useBranch } from '@/context/BranchContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const loanStatuses = [
    "Application", "Appraisal", "Pending Approval", "Approved", "Rejected", 
    "Disbursed", "Repaid", "Overdue", "Reversal Pending", "Reversed", 
    "Write-Off Pending", "Written-Off"
];


export default function AllApplicationsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { selectedBranch } = useBranch();
  const [selectedLoan, setSelectedLoan] = useState<any | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [statusFilter, setStatusFilter] = useState('all');

  const [allLoans, setAllLoans] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
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
        const loanAppsQuery = query(collection(firestore, 'institutions', institutionId, 'loanApplications'));
        const runningLoansQuery = query(collection(firestore, 'institutions', institutionId, 'runningLoans'));
        const customersQuery = query(collection(firestore, 'institutions', institutionId, 'customers'));
        const staffQuery = query(collection(firestore, 'users'), where('institutionId', '==', institutionId));

        const [loanAppsSnap, runningLoansSnap, customersSnap, staffSnap] = await Promise.all([
          getDocs(loanAppsQuery),
          getDocs(runningLoansQuery),
          getDocs(customersQuery),
          getDocs(staffQuery),
        ]);
        
        const loanApps = loanAppsSnap.docs.map(d => ({...d.data(), id: d.id}));
        const runningLoans = runningLoansSnap.docs.map(d => ({...d.data(), id: d.id}));

        setAllLoans([...loanApps, ...runningLoans]);
        setCustomers(customersSnap.docs.map(d => ({...d.data(), id: d.id})));
        setStaff(staffSnap.docs.map(d => ({...d.data(), uid: d.data().uid })));
      } catch (error) {
        console.error("Failed to fetch initial data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    if (institutionId) {
      fetchData();
    }
  }, [firestore, institutionId]);


  const filteredLoans = useMemo(() => {
    if (isLoading) return [];
    
    const statusOrder: { [key: string]: number } = {
        'Overdue': 1,
        'Pending Approval': 2,
        'Appraisal': 3,
        'Application': 4,
        'Disbursed': 5,
        'Approved': 6,
        'Reversal Pending': 7,
        'Write-Off Pending': 8,
        'Rejected': 9,
        'Reversed': 10,
        'Written-Off': 11,
        'Repaid': 12,
    };

    return allLoans
      .filter(loan => {
          const branchMatch = selectedBranch === 'all' || loan.branchId === selectedBranch;
          const statusMatch = statusFilter === 'all' || loan.status === statusFilter;
          return branchMatch && statusMatch;
      })
      .sort((a, b) => {
          const statusA = statusOrder[a.status] || 99;
          const statusB = statusOrder[b.status] || 99;
          
          if(statusA !== statusB) {
              return statusA - statusB;
          }
          
          if (!a.dateApplied || !b.dateApplied) return 0;
          return b.dateApplied.toDate() - a.dateApplied.toDate()
      });
  }, [allLoans, selectedBranch, statusFilter, isLoading]);
  
  const isFiltered = statusFilter !== 'all' || selectedBranch !== 'all';

  const paginatedLoans = useMemo(() => {
    if (isFiltered) return filteredLoans;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredLoans.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredLoans, currentPage, itemsPerPage, isFiltered]);

  const totalPages = Math.ceil(filteredLoans.length / itemsPerPage);

  const getCustomerName = (customerId: string) => customers?.find(c => c.id === customerId)?.name || '...';
  const getStaffName = (staffId: string) => staff?.find(s => s.uid === staffId)?.name || 'System';

  const handleStartAppraisal = (loan: any) => {
    setSelectedLoan(loan);
    setIsConfirmOpen(true);
  };

  const confirmStartAppraisal = async () => {
    if (!selectedLoan || !user || !firestore || !institutionId) return;

    setLoading(selectedLoan.id);
    try {
      const loanDocRef = doc(firestore, 'institutions', institutionId, 'loanApplications', selectedLoan.id);
      await updateDoc(loanDocRef, {
        status: 'Appraisal',
        appraisedBy: user.uid,
      });
      toast({
        title: 'Appraisal Started',
        description: `You have started the appraisal for loan application ${selectedLoan.id}.`,
      });
      setAllLoans(prev => prev.map(l => l.id === selectedLoan.id ? {...l, status: 'Appraisal', appraisedBy: user.uid} : l));

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

  const getActionForLoan = (loan: any) => {
      switch (loan.status) {
          case 'Application':
              return (
                  <Button onClick={() => handleStartAppraisal(loan)} size="sm" disabled={!!loading}>
                  {loading === loan.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                      'Start Appraisal'
                  )}
                  </Button>
              );
          case 'Appraisal':
              return (
                  <Button variant="outline" size="sm" asChild>
                      <Link href={`/staff/loans/appraisal/${loan.id}`}>Appraise</Link>
                  </Button>
              );
          case 'Pending Approval':
              return (
                  <Button variant="outline" size="sm" asChild>
                      <Link href={`/staff/loans/approvals/${loan.id}`}>Approve</Link>
                  </Button>
              );
          case 'Approved':
              return (
                  <Button variant="outline" size="sm" asChild>
                      <Link href={`/staff/accounts/loan-disbursement?id=${loan.id}`}>Disburse</Link>
                  </Button>
              );
          default:
              return (
                  <Button variant="ghost" size="sm" asChild>
                      <Link href={`/staff/loans/loan-details/${loan.id}`}>
                        <Eye className="mr-2 h-4 w-4" /> View
                      </Link>
                  </Button>
              );
      }
  }

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
            This table shows all loans, filterable by their current status.
          </CardDescription>
          <div className="pt-4 flex items-center gap-4">
            <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); setCurrentPage(1); }}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {loanStatuses.map(status => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer Name</TableHead>
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
              ) : paginatedLoans && paginatedLoans.length > 0 ? (
                paginatedLoans.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell className="font-medium">{getCustomerName(loan.customerId)}</TableCell>
                    <TableCell>{loan.amount.toLocaleString()}</TableCell>
                    <TableCell>{loan.dateApplied ? format(loan.dateApplied.toDate(), 'PPP') : 'N/A'}</TableCell>
                    <TableCell>{getStaffName(loan.submittedBy)}</TableCell>
                    <TableCell>
                        <Badge variant={loanStatusBadgeVariant(loan.status)}>{loan.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {getActionForLoan(loan)}
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
                            {isFiltered ? "No loans matching your filter criteria were found." : "There are no loans in the system yet."}
                        </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
         {!isFiltered && paginatedLoans && paginatedLoans.length > 0 && (
            <CardFooter className="flex items-center justify-between border-t py-4">
                <div className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages || 1}
                </div>
                 <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                    >
                        <ChevronLeft className="h-4 mr-1" /> Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                    >
                        Next <ChevronRight className="h-4 ml-1" />
                    </Button>
                </div>
            </CardFooter>
         )}
      </Card>
      
      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Start Appraisal?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will assign the loan application for customer {selectedLoan && getCustomerName(selectedLoan.customerId)} to you and move it to the appraisal stage. Are you sure you want to continue?
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
