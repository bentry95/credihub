
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  useUser,
  useFirestore,
  useDoc,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, doc, query, where, limit, runTransaction, serverTimestamp, getDocs, getDoc } from 'firebase/firestore';
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
import { Send, Loader2, AlertCircle, HandCoins, ArrowUpCircle, Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTeller } from '@/context/TellerContext';
import { Skeleton } from '@/components/ui/skeleton';


const treasurySchema = z.object({
  amount: z.coerce.number().positive('Amount must be a positive number.'),
  notes: z.string().optional(),
});

type TreasuryFormValues = z.infer<typeof treasurySchema>;

export default function CashToTreasuryPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { dayStarted, openingFloat } = useTeller();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [tellerConfig, setTellerConfig] = useState<any | null>(null);
  const [allTellers, setAllTellers] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [journals, setJournals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const institutionDocRef = useMemoFirebase(
    () => (institutionId ? doc(firestore, 'institutions', institutionId) : null),
    [firestore, institutionId]
  );
  
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
      } else if (!isUserLoading) {
          setIsLoading(false);
      }
    }
    fetchUserData();
  }, [user, firestore, isUserLoading]);

  useEffect(() => {
    async function fetchPageData() {
        if (!institutionId || !user) return;
        setIsLoading(true);

        try {
            const tellersQuery = query(collection(firestore, 'institutions', institutionId, 'tellers'));
            const staffQuery = query(collection(firestore, 'users'), where('institutionId', '==', institutionId));
            const journalsQuery = query(collection(firestore, 'institutions', institutionId, 'journals'), where('createdBy', '==', user.uid), where('status', '==', 'Posted'));

            const [tellersSnap, staffSnap, journalsSnap] = await Promise.all([
                getDocs(tellersQuery),
                getDocs(staffQuery),
                getDocs(journalsQuery),
            ]);

            const allTellersData = tellersSnap.docs.map(d => ({ ...d.data(), id: d.id }));
            const currentTellerConfig = allTellersData.find(t => t.userId === user.uid);
            
            setAllTellers(allTellersData);
            setTellerConfig(currentTellerConfig || null);
            setStaff(staffSnap.docs.map(d => ({ ...d.data(), id: d.id })));
            setJournals(journalsSnap.docs.map(d => ({ ...d.data(), id: d.id })));

        } catch (e) {
            console.error("Error fetching page data:", e);
        } finally {
            setIsLoading(false);
        }
    }
    fetchPageData();
  }, [institutionId, user, firestore]);

  const currentTillBalance = useMemo(() => {
    if (!journals || !tellerConfig) return openingFloat;

    let balance = openingFloat;
    journals.forEach(journal => {
        journal.transactions.forEach((transaction: any) => {
            if(transaction.accountId === tellerConfig.tillAccountId) {
                balance += (transaction.debit || 0) - (transaction.credit || 0);
            }
        });
    });
    return balance;
  }, [journals, tellerConfig, openingFloat]);

  const form = useForm<TreasuryFormValues>({
    resolver: zodResolver(treasurySchema),
    defaultValues: {
      amount: 0,
      notes: '',
    },
  });

  const getStaffName = (userId: string) => staff?.find(s => s.uid === userId)?.name || 'Unknown Teller';
  
  const chiefCashier = useMemo(() => {
      if (!allTellers || !tellerConfig) return null;
      return allTellers.find(t => t.role === 'Chief Cashier' && t.branchId === tellerConfig.branchId);
  }, [allTellers, tellerConfig]);

  async function onSubmit(values: TreasuryFormValues) {
    if (!user || !institutionId || !tellerConfig || !institutionDocRef) {
        setError("Could not identify your teller configuration. Please log in again.");
        return;
    }
    
    if (!chiefCashier) {
        setError("Could not find a Chief Cashier in your branch to send funds to. Please contact your administrator.");
        return;
    }
    
    if (values.amount > currentTillBalance) {
        form.setError("amount", { type: "manual", message: "Transfer amount cannot exceed your current till balance." });
        return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await runTransaction(firestore, async (transaction) => {
        const instDoc = await transaction.get(institutionDocRef);
        if(!instDoc.exists()) throw "Institution not found";

        const journalBatchCounter = instDoc.data().journalBatchCounter || 0;
        const newBatchNumber = journalBatchCounter + 1;
        const newBatchId = `bat${String(newBatchNumber).padStart(7, '0')}`;

        const journalsRef = collection(firestore, 'institutions', institutionId, 'journals');
        const newJournalDocRef = doc(journalsRef, newBatchId);
        
        const newJournal = {
          id: newBatchId,
          institutionId: institutionId,
          branchId: tellerConfig.branchId,
          date: serverTimestamp(),
          description: `Cash to Treasury from ${user.displayName}. Notes: ${values.notes || 'N/A'}`,
          transactions: [
            { accountId: chiefCashier.tillAccountId, debit: values.amount, credit: 0 },
            { accountId: tellerConfig.tillAccountId, debit: 0, credit: values.amount },
          ],
          status: 'Pending',
          createdBy: user.uid,
          createdAt: serverTimestamp(),
        };

        transaction.set(newJournalDocRef, newJournal);
        transaction.update(institutionDocRef, { journalBatchCounter: newBatchNumber });
      });

      toast({
        title: "Transfer Submitted",
        description: "Your cash has been sent to the Chief Cashier for approval.",
      });

      form.reset();
    } catch (e) {
      console.error(e);
      setError("Failed to submit transfer. Please try again.");
      toast({ variant: "destructive", title: "Error", description: "Failed to submit transfer." });
    } finally {
      setIsSubmitting(false);
    }
  }

  const isTeller = !!tellerConfig;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cash to Treasury</h1>
          <p className="text-muted-foreground mt-1">
            Return excess cash from your till to the main vault (Chief Cashier).
          </p>
        </div>
      </div>
      
      {isLoading ? (
          <Skeleton className="h-48 w-full max-w-2xl mx-auto" />
      ) : !isTeller ? (
            <Card className="max-w-2xl mx-auto">
                 <CardHeader>
                    <CardTitle>Access Denied</CardTitle>
                    <CardDescription>
                        You do not have permission to perform this action.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Alert variant="destructive">
                        <HandCoins className="h-4 w-4" />
                        <AlertTitle>Not a Configured Teller</AlertTitle>
                        <AlertDescription>
                            Your user account is not configured as a teller. Please contact your administrator to set up your teller profile and link it to a GL account.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        ) : (
            <fieldset disabled={!dayStarted} className="space-y-6">
                 {!dayStarted && (
                <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Day Not Started</AlertTitle>
                    <AlertDescription>
                    Please start your day from the Teller Dashboard to begin processing transactions.
                    </AlertDescription>
                </Alert>
                )}
                <Card className="max-w-2xl mx-auto">
                    <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <CardHeader>
                        <CardTitle>New Treasury Transfer</CardTitle>
                        <CardDescription>
                            This request will be sent to the Chief Cashier in your branch for approval.
                        </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                        {error && (
                            <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Submission Failed</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                         <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200">
                             <CardContent className="pt-6">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="text-sm text-blue-800 dark:text-blue-200">Maximum Transferable Amount</p>
                                        <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">MWK {currentTillBalance.toLocaleString()}</p>
                                    </div>
                                    <Wallet className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                                </div>
                                {chiefCashier && (
                                     <div className="mt-4 text-xs text-blue-700 dark:text-blue-300">
                                         Funds will be sent to Chief Cashier: <strong>{getStaffName(chiefCashier.userId)}</strong>
                                     </div>
                                )}
                             </CardContent>
                         </Card>
                        <FormField
                            control={form.control}
                            name="amount"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Amount to Send (MWK)</FormLabel>
                                <FormControl>
                                    <Input type="number" placeholder="e.g., 200000" {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                            <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Notes (Optional)</FormLabel>
                                <FormControl>
                                    <Textarea placeholder="e.g., Returning excess cash at day end..." {...field} />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                        </CardContent>
                        <CardFooter className="flex justify-end">
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ArrowUpCircle className="mr-2 h-4 w-4" />}
                                Submit for Approval
                            </Button>
                        </CardFooter>
                    </form>
                    </Form>
                </Card>
            </fieldset>
        )}
    </div>
  );
}
