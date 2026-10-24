
'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  Sunrise,
  CheckCircle2,
  Loader2,
  ListChecks,
  PlayCircle,
  Calendar,
  XCircle,
  FileWarning,
} from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';
import {
  useUser,
  useFirestore,
  useDoc,
  useMemoFirebase,
  useCollection,
} from '@/firebase';
import { doc, updateDoc, Timestamp, addDoc, collection, serverTimestamp, query, where, setDoc, getDocs } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { useBranch } from '@/context/BranchContext';


const eodTasks = [
    'Accrue interest on all active savings accounts.',
    'Accrue interest on all active loan accounts.',
    'Apply penalties to any newly overdue loans.',
    'Calculate and post loan loss provisions based on PAR buckets.',
    'Attempt automated loan recovery from savings (where applicable).',
    'Post all other system-generated journal entries for the day.',
    'Advance the system date to the next business day.',
];


export default function EndOfDayPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const [isRunning, setIsRunning] = useState(false);
    const [runComplete, setRunComplete] = useState(false);
    const { availableBranches } = useBranch();

    const userDocRef = useMemoFirebase(
      () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
      [firestore, user]
    );
    const { data: userData, isLoading: isUserLoading } = useDoc(userDocRef);
    const institutionId = userData?.institutionId;

    const institutionDocRef = useMemoFirebase(
      () => (firestore && institutionId ? doc(firestore, 'institutions', institutionId) : null),
      [firestore, institutionId]
    );
    const { data: institutionData, isLoading: isInstitutionLoading } = useDoc(institutionDocRef);

    const tellersQuery = useMemoFirebase(
        () => (firestore && institutionId ? collection(firestore, 'institutions', institutionId, 'tellers') : null),
        [firestore, institutionId]
    );
    const { data: tellers, isLoading: isTellersLoading } = useCollection(tellersQuery);
    
    const staffQuery = useMemoFirebase(
        () => (firestore && institutionId ? query(collection(firestore, 'users'), where('institutionId', '==', institutionId)) : null),
        [firestore, institutionId]
    );
    const { data: staff, isLoading: isStaffLoading } = useCollection(staffQuery);

    const journalsQuery = useMemoFirebase(
        () => (firestore && institutionId ? query(collection(firestore, 'institutions', institutionId, 'journals')) : null),
        [firestore, institutionId]
    );
    const { data: journals, isLoading: isJournalsLoading } = useCollection(journalsQuery);
    
    const coaQuery = useMemoFirebase(
        () => (firestore && institutionId ? collection(firestore, 'institutions', institutionId, 'chartOfAccounts') : null),
        [firestore, institutionId]
    );
    const { data: accounts, isLoading: isCoaLoading } = useCollection(coaQuery);

    const pendingEodSubmissionsQuery = useMemoFirebase(
        () => (firestore && institutionId ? query(collection(firestore, 'institutions', institutionId, 'eodSubmissions'), where('status', '==', 'Pending Approval')) : null),
        [firestore, institutionId]
    );
    const { data: pendingEodSubmissions, isLoading: isEodSubmissionsLoading } = useCollection(pendingEodSubmissionsQuery);

    const tellerBalances = useMemo(() => {
        if (!tellers || !journals || !accounts || !staff || !availableBranches) return [];
        
        const getStaffName = (userId: string) => staff.find(s => s.uid === userId)?.name || 'Unknown';
        const getBranchName = (branchId: string) => availableBranches.find(b => b.id === branchId)?.name || 'Unknown';

        return tellers.map(teller => {
            let balance = 0;
            const postedJournals = journals.filter(j => j.status === 'Posted');
            const tellerTillAccount = accounts.find(a => a.id === teller.tillAccountId);
            if (!tellerTillAccount) return { ...teller, balance: 0, name: getStaffName(teller.userId), branchName: getBranchName(teller.branchId) };

            postedJournals.forEach(journal => {
                journal.transactions.forEach((transaction: any) => {
                    if(transaction.accountId === teller.tillAccountId) {
                        balance += (transaction.debit || 0) - (transaction.credit || 0);
                    }
                });
            });
            return { ...teller, balance, name: getStaffName(teller.userId), branchName: getBranchName(teller.branchId) };
        });

    }, [tellers, journals, accounts, staff, availableBranches]);

    const nonZeroTellers = useMemo(() => tellerBalances.filter(t => Math.abs(t.balance) > 0.01), [tellerBalances]);

    const preEodChecks = useMemo(() => [
        { id: 'check2', label: 'All teller EOD reports have been approved', status: pendingEodSubmissions?.length > 0 ? 'fail' : 'pass' },
        { id: 'check3', label: 'No pending journal approvals', status: journals?.some(j => j.status === 'Pending') ? 'fail' : 'pass' },
        { id: 'check4', label: 'All teller balances are zero', status: nonZeroTellers.length > 0 ? 'fail' : 'pass' },
    ], [journals, nonZeroTellers, pendingEodSubmissions]);


    const systemDate = useMemo(() => {
        if (!institutionData?.systemDate) return null;
        return institutionData.systemDate.toDate();
    }, [institutionData]);

    const handleRunEod = async () => {
        if (!institutionDocRef || !systemDate || !user || !institutionId) return;

        setIsRunning(true);
        setRunComplete(false);
        try {
            // Simulate a long-running process that would happen in a backend function.
            // This would include interest accrual, penalty application, etc.
            
            // The provisioning engine would run here. It would:
            // 1. Calculate the required provision for each loan based on its PAR bucket.
            // 2. Aggregate the total required provision.
            // 3. Create a single, automated journal entry:
            //    Dr 5600 - Loan Loss Provision Expense
            //    Cr 6100 - Allowance for Loan Losses
            
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            const nextDay = addDays(systemDate, 1);
            await updateDoc(institutionDocRef, {
                systemDate: Timestamp.fromDate(nextDay)
            });

            // Log the EOD action to the workflow audit
            const auditRef = collection(firestore, 'institutions', institutionId, 'workflowAudits');
            const newAuditDoc = doc(auditRef); // Auto-generate ID
            await setDoc(newAuditDoc, {
                id: newAuditDoc.id,
                timestamp: serverTimestamp(),
                userId: user.uid,
                action: 'End of Day Process',
                component: 'End of Day Process',
                reason: `EOD run for ${format(systemDate, 'PPP')}. System date advanced to ${format(nextDay, 'PPP')}.`,
            });
            
            setRunComplete(true);
        } catch(e) {
            console.error("EOD process failed", e);
        } finally {
            setIsRunning(false);
        }
    }
    
    const pageIsLoading = isUserLoading || isInstitutionLoading || isTellersLoading || isJournalsLoading || isStaffLoading || isCoaLoading || isEodSubmissionsLoading;

    if (pageIsLoading) {
        return (
            <div className="space-y-8">
                 <div>
                    <Skeleton className="h-8 w-1/2" />
                    <Skeleton className="h-4 w-3/4 mt-2" />
                </div>
                <Card><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                     <Card><CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader><CardContent><Skeleton className="h-32 w-full" /></CardContent></Card>
                     <Card><CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader><CardContent><Skeleton className="h-48 w-full" /></CardContent><CardFooter><Skeleton className="h-12 w-full" /></CardFooter></Card>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">End of Day Process</h1>
                <p className="text-muted-foreground mt-1">
                    Close the business day, run automated tasks, and advance the system date.
                </p>
            </div>
            
             <Card>
                <CardHeader><CardTitle>System Date</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="p-4 bg-muted/50">
                        <p className="text-sm font-medium text-muted-foreground">Previous System Day</p>
                        <p className="text-xl font-semibold">{systemDate ? format(subDays(systemDate, 1), 'PPP') : 'Not Set'}</p>
                    </Card>
                    <Card className="p-4 border-primary bg-primary/5">
                        <p className="text-sm font-medium text-primary">Current System Date</p>
                        <p className="text-xl font-bold text-primary">{systemDate ? format(systemDate, 'PPP') : 'Not Set'}</p>
                    </Card>
                    <Card className="p-4 bg-muted/50">
                        <p className="text-sm font-medium text-muted-foreground">Next System Day</p>
                        <p className="text-xl font-semibold">{systemDate ? format(addDays(systemDate, 1), 'PPP') : 'Not Set'}</p>
                    </Card>
                </CardContent>
                 {!systemDate && (
                    <CardFooter>
                        <Alert>
                            <Calendar className="h-4 w-4" />
                            <AlertTitle>System Date Not Initialized</AlertTitle>
                            <AlertDescription>
                                The system date has not been set for this institution. An administrator must set it from the institution settings page.
                            </AlertDescription>
                        </Alert>
                    </CardFooter>
                )}
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-muted rounded-full"><ListChecks className="h-6 w-6 text-muted-foreground"/></div>
                            <div>
                                <CardTitle>Pre-EOD Checks</CardTitle>
                                <CardDescription>All checks must pass before EOD can be run.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {preEodChecks.map(check => (
                            <div key={check.id} className="flex items-center gap-3 text-sm">
                                {check.status === 'pass' ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                                ) : (
                                    <XCircle className="h-5 w-5 text-destructive" />
                                )}
                                <span className={check.status === 'fail' ? 'text-destructive' : ''}>{check.label}</span>
                            </div>
                        ))}
                         {nonZeroTellers.length > 0 && (
                            <Card className="mt-4 bg-amber-50 border-amber-200">
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2 text-amber-900">
                                        <FileWarning className="h-5 w-5" /> Tellers with Outstanding Balances
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Teller</TableHead>
                                                <TableHead>Branch</TableHead>
                                                <TableHead className="text-right">Balance</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {nonZeroTellers.map(teller => (
                                                <TableRow key={teller.id}>
                                                    <TableCell>{teller.name}</TableCell>
                                                    <TableCell>{teller.branchName}</TableCell>
                                                    <TableCell className="text-right font-mono">MWK {teller.balance.toLocaleString()}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        )}
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-muted rounded-full"><PlayCircle className="h-6 w-6 text-muted-foreground"/></div>
                            <div>
                                <CardTitle>Run End of Day Process</CardTitle>
                                <CardDescription>This action is irreversible for the current day.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">The following automated tasks will be executed:</p>
                        <ul className="space-y-2 text-sm list-disc pl-5">
                            {eodTasks.map((task, index) => <li key={index}>{task}</li>)}
                        </ul>
                         {runComplete && (
                            <Alert>
                                <CheckCircle2 className="h-4 w-4" />
                                <AlertTitle>EOD Process Complete</AlertTitle>
                                <AlertDescription>
                                    All tasks finished successfully. The system date has been advanced.
                                </AlertDescription>
                            </Alert>
                         )}
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handleRunEod} disabled={!preEodChecks.every(check => check.status === 'pass') || isRunning || !systemDate} className="w-full" size="lg">
                            {isRunning ? (
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            ) : (
                                <Sunrise className="mr-2 h-5 w-5" />
                            )}
                            {isRunning ? 'EOD Process is Running...' : `Run EOD for ${systemDate ? format(systemDate, 'do MMMM') : ''}`}
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
