

'use client';

import { useMemo, useState, useRef } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { DashboardPageHeader } from '@/components/staff/dashboard-page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, query, where, doc, orderBy } from 'firebase/firestore';
import {
  Building,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Users,
  Wallet,
  Printer,
} from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { type ReceiptData } from '@/components/staff/transaction-receipt';

export default function ChiefCashierDashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);

  // Fetch all tellers for the institution
  const tellersQuery = useMemoFirebase(
    () =>
      firestore && userData?.institutionId
        ? collection(
            firestore,
            'institutions',
            userData.institutionId,
            'tellers'
          )
        : null,
    [firestore, userData]
  );
  const { data: tellers, isLoading: isTellersLoading } = useCollection(tellersQuery);

  // Fetch all staff to map teller user IDs to names
  const staffQuery = useMemoFirebase(
    () =>
      firestore && userData?.institutionId
        ? query(collection(firestore, 'users'), where('institutionId', '==', userData.institutionId))
        : null,
    [firestore, userData]
  );
  const { data: staff, isLoading: isStaffLoading } = useCollection(staffQuery);

  const coaQuery = useMemoFirebase(
    () =>
      firestore && userData?.institutionId
        ? collection(firestore, 'institutions', userData.institutionId, 'chartOfAccounts')
        : null,
    [firestore, userData]
  );
  const { data: accounts, isLoading: isCoaLoading } = useCollection(coaQuery);

  const journalsQuery = useMemoFirebase(
    () =>
      firestore && userData?.institutionId
        ? query(collection(firestore, 'institutions', userData.institutionId, 'journals'), orderBy('createdAt', 'desc'))
        : null,
    [firestore, userData]
  );
  const { data: journals, isLoading: isJournalsLoading } = useCollection(journalsQuery);
  
  const chiefCashierConfig = tellers?.find(t => t.userId === user?.uid && t.role === 'Chief Cashier');
  const vaultAccountId = chiefCashierConfig?.tillAccountId;
  
  const vaultBalance = useMemo(() => {
    if (!journals || !accounts || !vaultAccountId) return 0;

    const vaultAccount = accounts.find(a => a.id === vaultAccountId);
    if (!vaultAccount) return 0;
    
    let balance = 0;
    const postedJournals = journals.filter(j => j.status === 'Posted');
    
    postedJournals.forEach(journal => {
        journal.transactions.forEach((transaction: any) => {
            if (transaction.accountId === vaultAccountId) {
                 if (vaultAccount.accountType === 'Asset') {
                    balance += (transaction.debit || 0) - (transaction.credit || 0);
                } else {
                    balance += (transaction.credit || 0) - (transaction.debit || 0);
                }
            }
        });
    });

    return balance;
  }, [journals, accounts, vaultAccountId]);

  const tellerTillAccountIds = useMemo(() => new Set(tellers?.map(t => t.tillAccountId) || []), [tellers]);

  const tellerTransactions = useMemo(() => {
    if (!journals || tellerTillAccountIds.size === 0) return [];
    
    return journals.filter(journal =>
        journal.transactions.some((t: any) => tellerTillAccountIds.has(t.accountId))
    ).slice(0, 10); // Show last 10 transactions

  }, [journals, tellerTillAccountIds]);


  const getStaffName = (userId: string) => staff?.find(s => s.uid === userId)?.name || '...';
  const getBadgeVariant = (status: string) => status === 'Active' ? 'default' : 'destructive';
  const getJournalStatusBadge = (status: string) => {
    switch (status) {
        case 'Posted': return 'default';
        case 'Pending': return 'secondary';
        case 'Rejected': return 'destructive';
        default: return 'outline';
    }
  }

  const handleReprint = (journal: any) => {
      const receiptData: ReceiptData = {
          transactionId: journal.id,
          date: journal.date.toDate(),
          // These fields are not directly available on the journal, so we pass placeholders.
          // A real implementation might require another fetch or a more detailed journal document.
          customerName: 'N/A',
          memberId: 'N/A',
          customerPhone: 'N/A',
          amount: journal.transactions.find((t: any) => t.debit > 0)?.debit || 0,
          description: journal.description,
          tellerName: getStaffName(journal.createdBy),
          branchName: chiefCashierConfig?.branchName || 'N/A',
          institutionId: userData?.institutionId,
          type: 'deposit', // Simplified type
      };
      sessionStorage.setItem('lastReceiptData', JSON.stringify(receiptData));
      router.push(`/staff/tellers/receipt/${journal.id}`);
  };
  
  const isReceiptableTransaction = (journalId: string) => {
    return ['TRDEP', 'TRWID', 'TRSID'].some(prefix => journalId.startsWith(prefix));
  }


  const pendingRequests = journals?.filter(j => j.status === 'Pending').length || 0;
  const activeTellers = tellers?.filter(t => t.status === 'Active').length || 0;
  const totalTellers = tellers?.length || 0;

  const isLoading = isTellersLoading || isStaffLoading || isCoaLoading || isJournalsLoading;

  return (
    <div className="space-y-8 pb-8">
      <DashboardPageHeader title="Chief Cashier" description="Supervise cash operations, approvals, and teller activity across your institution." />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="rounded-2xl border-border/70 shadow-sm transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Vault Balance</CardTitle>
            <Wallet className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-3/4" /> : (
              <div className="text-3xl font-bold">MWK {vaultBalance.toLocaleString()}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Your current till balance.
            </p>
          </CardContent>
        </Card>
         <Card className="rounded-2xl border-border/70 shadow-sm transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
            <Clock className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-1/4" /> : (
              <div className="text-3xl font-bold">{pendingRequests}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Transactions awaiting your approval.
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-border/70 shadow-sm transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Tellers</CardTitle>
            <Users className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             {isLoading ? <Skeleton className="h-8 w-1/4" /> : (
                <div className="text-3xl font-bold">{activeTellers} / {totalTellers}</div>
             )}
            <p className="text-xs text-muted-foreground">
              Number of tellers currently active.
            </p>
          </CardContent>
        </Card>
      </div>
       
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="rounded-2xl border-border/70 shadow-sm">
                <CardHeader>
                <CardTitle>Teller Status Overview</CardTitle>
                <CardDescription>
                    A real-time summary of all configured tellers and their cash positions.
                </CardDescription>
                </CardHeader>
                <CardContent>
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Teller Name</TableHead>
                        <TableHead>Day Status</TableHead>
                        <TableHead>Teller Status</TableHead>
                        <TableHead>Max Cash Holding</TableHead>
                        <TableHead className="text-right">Current Cash Position</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {isLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                            <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                            <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-5 w-28 ml-auto" /></TableCell>
                        </TableRow>
                        ))
                    ) : tellers && tellers.length > 0 ? (
                        tellers.map((teller) => (
                        <TableRow key={teller.id}>
                            <TableCell className="font-medium">{getStaffName(teller.userId)}</TableCell>
                            <TableCell>
                                <Badge variant="outline">Closed</Badge>
                            </TableCell>
                            <TableCell>
                            <Badge variant={getBadgeVariant(teller.status)}>{teller.status}</Badge>
                            </TableCell>
                            <TableCell>
                                {teller.role === 'Chief Cashier' ? 'N/A' : `MWK ${teller.maxCashLimit?.toLocaleString()}`}
                            </TableCell>
                            <TableCell className="text-right font-mono">MWK 0</TableCell>
                        </TableRow>
                        ))
                    ) : (
                        <TableRow>
                        <TableCell colSpan={5} className="h-48 text-center">
                            <div className="flex flex-col items-center gap-4">
                                <div className="p-4 bg-muted rounded-full">
                                    <ShieldCheck className="h-10 w-10 text-muted-foreground" />
                                </div>
                                <h3 className="text-lg font-semibold">No Tellers Configured</h3>
                                <p className="text-muted-foreground">
                                    Go to Teller Management to create your first teller.
                                </p>
                            </div>
                        </TableCell>
                        </TableRow>
                    )}
                    </TableBody>
                </Table>
                </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/70 shadow-sm">
                <CardHeader>
                    <CardTitle>Recent Teller Transactions</CardTitle>
                    <CardDescription>The latest 10 transactions involving any teller account.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Description</TableHead>
                                <TableHead>Teller</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({length: 5}).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton className="h-5 w-3/4"/></TableCell>
                                        <TableCell><Skeleton className="h-5 w-20"/></TableCell>
                                        <TableCell><Skeleton className="h-5 w-16"/></TableCell>
                                        <TableCell><Skeleton className="h-6 w-20"/></TableCell>
                                        <TableCell className="text-right"><Skeleton className="h-9 w-9 ml-auto" /></TableCell>
                                    </TableRow>
                                ))
                            ) : tellerTransactions.length > 0 ? (
                                tellerTransactions.map(journal => (
                                    <TableRow key={journal.id}>
                                        <TableCell className="text-xs">{journal.description}</TableCell>
                                        <TableCell>{getStaffName(journal.createdBy)}</TableCell>
                                        <TableCell className="font-mono">{(journal.transactions.find((t: any) => t.debit > 0)?.debit || 0).toLocaleString()}</TableCell>
                                        <TableCell><Badge variant={getJournalStatusBadge(journal.status)}>{journal.status}</Badge></TableCell>
                                        <TableCell className="text-right">
                                             {isReceiptableTransaction(journal.id) && (
                                                <Button variant="ghost" size="icon" onClick={() => handleReprint(journal)}><Printer className="h-4 w-4" /></Button>
                                             )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">No teller transactions found.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
