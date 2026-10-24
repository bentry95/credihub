'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  useUser,
  useFirestore,
  useDoc,
  useMemoFirebase,
  useCollection,
} from '@/firebase';
import { collection, doc, query, where, getDocs, writeBatch, serverTimestamp, runTransaction, updateDoc, getDoc } from 'firebase/firestore';
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Loader2, AlertCircle, Undo, Send, FileWarning, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


const reversalSchema = z.object({
  reason: z.string().min(10, 'A clear reason for reversal is required.'),
});

export default function TransactionReversalPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [journalId, setJournalId] = useState('');
  const [foundJournal, setFoundJournal] = useState<any | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [reversalLoading, setReversalLoading] = useState(false);
  const [approvalLoading, setApprovalLoading] = useState<string|null>(null);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);
  const institutionId = userData?.institutionId;

  const form = useForm<z.infer<typeof reversalSchema>>({
    resolver: zodResolver(reversalSchema),
  });
  
  const reversalQuery = useMemoFirebase(
    () =>
      firestore && institutionId
        ? query(
            collection(
              firestore,
              'institutions',
              institutionId,
              'journals'
            ),
            where('status', '==', 'Reversal Pending')
          )
        : null,
    [firestore, institutionId]
  );
  const { data: pendingReversals, isLoading: isJournalsLoading } = useCollection(reversalQuery);
  
  const staffQuery = useMemoFirebase(
    () =>
      firestore && institutionId
        ? query(collection(firestore, 'users'), where('institutionId', '==', institutionId))
        : null,
    [firestore, institutionId]
  );
  const { data: staff, isLoading: isStaffLoading } = useCollection(staffQuery);

  const getStaffName = (staffId: string) => {
    if (!staff) return '...';
    return staff?.find((s) => s.uid === staffId)?.name || 'Unknown';
  };
  
  const handleSearch = async () => {
    if (!journalId || !firestore || !institutionId) return;

    setIsSearching(true);
    setSearchError(null);
    setFoundJournal(null);

    try {
      const journalDocRef = doc(firestore, 'institutions', institutionId, 'journals', journalId.trim());
      const docSnap = await getDoc(journalDocRef);

      if (!docSnap.exists()) {
        setSearchError('Batch ID not found.');
      } else {
        const journalDoc = docSnap.data();
        if (journalDoc.status !== 'Posted') {
          setSearchError(`This transaction cannot be reversed. Its status is "${journalDoc.status}".`);
        } else {
          setFoundJournal({ id: docSnap.id, ...journalDoc });
        }
      }
    } catch (e) {
      console.error(e);
      setSearchError('An error occurred while searching.');
    } finally {
      setIsSearching(false);
    }
  };

  async function onSubmit(values: z.infer<typeof reversalSchema>) {
    if (!firestore || !institutionId || !foundJournal || !user?.uid) return;
    
    setReversalLoading(true);
    try {
      const institutionDocRef = doc(firestore, 'institutions', institutionId);

      await runTransaction(firestore, async (transaction) => {
        const instDoc = await transaction.get(institutionDocRef);
        if (!instDoc.exists()) throw "Institution not found!";
        
        const journalBatchCounter = instDoc.data().journalBatchCounter || 0;
        const newBatchNumber = journalBatchCounter + 1;
        const newBatchId = `bat${String(newBatchNumber).padStart(7, '0')}`;
        
        // 1. Create the new reversal journal entry
        const journalsRef = collection(firestore, 'institutions', institutionId, 'journals');
        const newReversalDocRef = doc(journalsRef, newBatchId);
        const reversedTransactions = foundJournal.transactions.map((t: any) => ({
          accountId: t.accountId,
          debit: t.credit || 0,
          credit: t.debit || 0,
        }));

        const newReversalEntry = {
          id: newReversalDocRef.id,
          institutionId: institutionId,
          branchId: foundJournal.branchId,
          date: serverTimestamp(),
          description: `Reversal for Batch-${foundJournal.id}: ${values.reason}`,
          transactions: reversedTransactions,
          status: 'Reversal Pending',
          reversesJournalId: foundJournal.id,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
        };
        transaction.set(newReversalDocRef, newReversalEntry);

        // 2. Update the original journal's status
        const originalJournalRef = doc(journalsRef, foundJournal.id);
        transaction.update(originalJournalRef, { status: 'Reversal Pending' });

        // 3. Update the counter
        transaction.update(institutionDocRef, { journalBatchCounter: newBatchNumber });
      });


      toast({
        title: "Reversal Request Submitted",
        description: "The transaction reversal has been sent for approval.",
      });

      setFoundJournal(null);
      setJournalId('');
      form.reset();

    } catch (e) {
        console.error(e);
        toast({
            variant: "destructive",
            title: "Error",
            description: "Failed to submit reversal request. Please try again.",
        });
    } finally {
        setReversalLoading(false);
    }
  }
  
  const handleDecision = async (
    reversalEntry: any,
    decision: 'Approve' | 'Reject'
  ) => {
    if (!firestore || !institutionId) return;
    setApprovalLoading(reversalEntry.id);
    try {
      const batch = writeBatch(firestore);
      const reversalRef = doc(firestore, 'institutions', institutionId, 'journals', reversalEntry.id);

      if (decision === 'Approve') {
        batch.update(reversalRef, { status: 'Posted' });
        if (reversalEntry.reversesJournalId) {
          const originalRef = doc(firestore, 'institutions', institutionId, 'journals', reversalEntry.reversesJournalId);
          batch.update(originalRef, { status: 'Reversed' });
        }
      } else { // 'Reject'
        batch.update(reversalRef, { status: 'Rejected' });
        if (reversalEntry.reversesJournalId) {
          const originalRef = doc(firestore, 'institutions', institutionId, 'journals', reversalEntry.reversesJournalId);
          batch.update(originalRef, { status: 'Posted' });
        }
      }

      await batch.commit();
      toast({
        title: `Reversal ${decision}d`,
        description: `The transaction reversal has been successfully ${decision.toLowerCase()}ed.`,
      });
    } catch (e) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `Failed to ${decision.toLowerCase()} reversal.`,
      });
    } finally {
      setApprovalLoading(null);
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transaction Reversal</h1>
          <p className="text-muted-foreground mt-1">
            Request to reverse a posted financial transaction and approve requests.
          </p>
        </div>
      </div>
      
       <Tabs defaultValue="request" className="space-y-4">
           <TabsList>
               <TabsTrigger value="request">Request Reversal</TabsTrigger>
               <TabsTrigger value="approve">Approval Queue</TabsTrigger>
           </TabsList>
           <TabsContent value="request">
                <Card>
                    <CardHeader>
                    <CardTitle>Step 1: Find Journal Batch</CardTitle>
                    <CardDescription>
                        Enter the unique ID of the journal batch you wish to reverse.
                    </CardDescription>
                    </CardHeader>
                    <CardContent>
                    <div className="flex items-center gap-2 max-w-sm">
                        <div className="relative flex-grow">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                            placeholder="Enter Batch ID..."
                            className="pl-10"
                            value={journalId}
                            onChange={(e) => setJournalId(e.target.value)}
                            disabled={!!foundJournal}
                        />
                        </div>
                        <Button onClick={handleSearch} disabled={isSearching || !journalId || !!foundJournal}>
                        {isSearching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Search
                        </Button>
                    </div>
                    {searchError && <Alert variant="destructive" className="mt-4"><AlertCircle className="h-4 w-4" /><AlertTitle>Search Failed</AlertTitle><AlertDescription>{searchError}</AlertDescription></Alert>}
                    </CardContent>
                </Card>
      
                {isSearching && <Skeleton className="h-48 w-full" />}

                {foundJournal && (
                    <Card>
                    <CardHeader>
                        <CardTitle>Step 2: Verify & Request Reversal</CardTitle>
                        <CardDescription>Confirm the transaction details and provide a reason for the reversal.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <Card className="bg-muted/50">
                            <CardHeader><CardTitle className="text-lg">Original Transaction Details</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-3 gap-4 text-sm">
                                <div><p className="font-medium">Batch ID:</p><p className="text-muted-foreground">{foundJournal.id}</p></div>
                                <div><p className="font-medium">Date:</p><p className="text-muted-foreground">{format(foundJournal.date.toDate(), 'PPP')}</p></div>
                                <div><p className="font-medium">Amount:</p><p className="text-muted-foreground">MWK {foundJournal.transactions.reduce((sum: number, t: any) => sum + (t.debit || 0), 0).toLocaleString()}</p></div>
                                <div className="col-span-3"><p className="font-medium">Description:</p><p className="text-muted-foreground">{foundJournal.description}</p></div>
                                </div>
                                <Table>
                                    <TableHeader><TableRow><TableHead>Account</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {foundJournal.transactions.map((t: any, i: number) => (
                                            <TableRow key={i}>
                                                <TableCell>{t.accountId}</TableCell>
                                                <TableCell className="text-right">{t.debit > 0 ? t.debit.toLocaleString() : '-'}</TableCell>
                                                <TableCell className="text-right">{t.credit > 0 ? t.credit.toLocaleString() : '-'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                            </Card>
                            
                            <FormField control={form.control} name="reason" render={({ field }) => (
                                <FormItem><FormLabel>Reason for Reversal</FormLabel><FormControl><Textarea placeholder="e.g., Posted to the wrong account in error. Should have been account XXX." {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" type="button" onClick={() => { setFoundJournal(null); setSearchError(null); setJournalId(''); }}>Cancel</Button>
                                <Button type="submit" disabled={reversalLoading}>
                                    {reversalLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    <Send className="mr-2 h-4 w-4" />
                                    Submit for Approval
                                </Button>
                            </div>

                        </form>
                        </Form>
                    </CardContent>
                    </Card>
                )}
           </TabsContent>
           <TabsContent value="approve">
                <Card>
                    <CardHeader>
                    <CardTitle>Approval Queue</CardTitle>
                    <CardDescription>
                        The following transaction reversals require your supervisory
                        approval.
                    </CardDescription>
                    </CardHeader>
                    <CardContent>
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Requested By</TableHead>
                            <TableHead>Amount (MWK)</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {isJournalsLoading || isStaffLoading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                            <TableRow key={i}>
                                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                    <Skeleton className="h-9 w-9" />
                                    <Skeleton className="h-9 w-9" />
                                </div>
                                </TableCell>
                            </TableRow>
                            ))
                        ) : pendingReversals && pendingReversals.length > 0 ? (
                            pendingReversals.map((journal) => (
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
                                    .reduce(
                                    (sum: number, t: any) => sum + (t.debit || 0),
                                    0
                                    )
                                    .toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right space-x-2">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => handleDecision(journal, 'Approve')}
                                    disabled={approvalLoading === journal.id}
                                >
                                    {approvalLoading === journal.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                    <Check className="h-4 w-4 text-green-600" />
                                    )}
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="icon"
                                    onClick={() => handleDecision(journal, 'Reject')}
                                    disabled={approvalLoading === journal.id}
                                >
                                    {approvalLoading === journal.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                    <X className="h-4 w-4" />
                                    )}
                                </Button>
                                </TableCell>
                            </TableRow>
                            ))
                        ) : (
                            <TableRow>
                            <TableCell colSpan={5} className="h-48 text-center">
                                <div className="flex flex-col items-center gap-4">
                                <div className="p-4 bg-muted rounded-full">
                                    <Undo className="h-10 w-10 text-muted-foreground" />
                                </div>
                                <h3 className="text-lg font-semibold">
                                    No Reversals Pending
                                </h3>
                                <p className="text-muted-foreground">
                                    There are no reversal requests awaiting your approval.
                                </p>
                                </div>
                            </TableCell>
                            </TableRow>
                        )}
                        </TableBody>
                    </Table>
                    </CardContent>
                </Card>
           </TabsContent>
       </Tabs>
    </div>
  );
}