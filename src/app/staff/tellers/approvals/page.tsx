
'use client';

import { useState, useMemo, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, query, where, doc, updateDoc, getDocs, getDoc } from 'firebase/firestore';
import { Check, X, Loader2, CheckSquare, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';

export default function TellerApprovalsPage() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [selectedJournal, setSelectedJournal] = useState<any | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const [staff, setStaff] = useState<any[]>([]);
  const [pendingJournals, setPendingJournals] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [institutionId, setInstitutionId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserData() {
      if (user && firestore) {
        const userDocRef = doc(firestore, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          setInstitutionId(userDocSnap.data().institutionId);
        } else {
            setIsLoading(false);
        }
      } else if (!isAuthLoading) {
          setIsLoading(false);
      }
    }
    fetchUserData();
  }, [user, firestore, isAuthLoading]);

  useEffect(() => {
    async function fetchPageData() {
        if (!institutionId || !user) {
            if (!isAuthLoading) setIsLoading(false);
            return;
        };

        setIsLoading(true);

        try {
            const staffQuery = query(collection(firestore, 'users'), where('institutionId', '==', institutionId));
            const journalsQuery = query(
                collection(firestore, 'institutions', institutionId, 'journals'),
                where('status', '==', 'Pending'),
                where('createdBy', '!=', user.uid)
            );
            const coaQuery = query(collection(firestore, 'institutions', institutionId, 'chartOfAccounts'));

            const [staffSnap, journalsSnap, coaSnap] = await Promise.all([
                getDocs(staffQuery),
                getDocs(journalsQuery),
                getDocs(coaQuery),
            ]);

            setStaff(staffSnap.docs.map(d => ({...d.data(), id: d.id})));
            setPendingJournals(journalsSnap.docs.map(d => ({...d.data(), id: d.id})));
            setAccounts(coaSnap.docs.map(d => ({...d.data(), id: d.id})));

        } catch (e) {
            console.error("Error fetching approvals data:", e);
        } finally {
            setIsLoading(false);
        }
    }
    fetchPageData();
  }, [institutionId, user, firestore]);

  const getStaffName = (staffId: string) => {
    return staff?.find((s) => s.uid === staffId)?.name || 'Unknown';
  };
  
  const getAccountName = (accountId: string) => {
    return accounts?.find(a => a.id === accountId)?.accountName || accountId;
  }
  
  const handleViewDetails = (journal: any) => {
    setSelectedJournal(journal);
    setIsDetailsOpen(true);
  };
  
  const handleDecision = async (journal: any, decision: 'Posted' | 'Rejected') => {
    if (!firestore || !institutionId) return;
    
    setLoading(journal.id);
    try {
        const journalRef = doc(firestore, 'institutions', institutionId, 'journals', journal.id);
        
        await updateDoc(journalRef, { status: decision });
      
        toast({
            title: `Transaction ${decision}`,
            description: `The journal entry has been successfully ${decision.toLowerCase()}.`
        });
        setPendingJournals(prev => prev.filter(j => j.id !== journal.id));

    } catch(e) {
        console.error(e);
        toast({
            variant: 'destructive',
            title: 'Error',
            description: `Failed to update transaction status.`
        });
    } finally {
        setLoading(null);
    }
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Teller Transaction Approvals
            </h1>
            <p className="text-muted-foreground mt-1">
              Review and approve pending cash transactions from all tellers.
            </p>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Approval Queue</CardTitle>
            <CardDescription>
              The following transactions require your supervisory approval to be
              posted.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Amount (MWK)</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-5 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-48" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-20" />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Skeleton className="h-9 w-20" />
                          <Skeleton className="h-9 w-9" />
                          <Skeleton className="h-9 w-9" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : pendingJournals && pendingJournals.length > 0 ? (
                  pendingJournals.map((journal) => (
                    <TableRow key={journal.id}>
                      <TableCell>
                        {format(journal.date.toDate(), 'PPP')}
                      </TableCell>
                      <TableCell className="font-medium">
                        {journal.description}
                      </TableCell>
                      <TableCell>{getStaffName(journal.createdBy)}</TableCell>
                      <TableCell className="font-mono">
                        {journal.transactions
                          .reduce((sum: number, t: any) => sum + (t.debit || 0), 0)
                          .toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                          <Button variant="outline" size="sm" onClick={() => handleViewDetails(journal)}>
                              <Eye className="mr-2 h-4 w-4"/> Details
                          </Button>
                          <Button variant="outline" size="icon" onClick={() => handleDecision(journal, 'Posted')} disabled={loading === journal.id}>
                             {loading === journal.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4 text-green-600" />}
                          </Button>
                          <Button variant="destructive" size="icon" onClick={() => handleDecision(journal, 'Rejected')} disabled={loading === journal.id}>
                             {loading === journal.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <X className="h-4 w-4" />}
                          </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-48 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="p-4 bg-muted rounded-full">
                          <CheckSquare className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold">
                          Approval Queue is Empty
                        </h3>
                        <p className="text-muted-foreground">
                          There are no pending transactions that require your approval.
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

       <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Journal Entry Details</DialogTitle>
            <DialogDescription>
              Batch ID: {selectedJournal?.id}
            </DialogDescription>
          </DialogHeader>
          {selectedJournal && (
            <div className="py-4">
              <p className="mb-4 text-sm text-muted-foreground">{selectedJournal.description}</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>GL Account</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedJournal.transactions.map((tx: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div className="font-medium">{getAccountName(tx.accountId)}</div>
                        <div className="text-xs text-muted-foreground">{tx.accountId}</div>
                      </TableCell>
                      <TableCell className="text-right font-mono">{tx.debit > 0 ? tx.debit.toLocaleString() : '-'}</TableCell>
                      <TableCell className="text-right font-mono">{tx.credit > 0 ? tx.credit.toLocaleString() : '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
