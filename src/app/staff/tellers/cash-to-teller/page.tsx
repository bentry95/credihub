
'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  query,
  where,
} from 'firebase/firestore';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowRightLeft, Loader2, AlertCircle, Send, HandCoins, ArrowDownCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const transferSchema = z.object({
  recipientTellerId: z.string().min(1, 'Please select a recipient.'),
  amount: z.coerce.number().positive('Amount must be a positive number.'),
  notes: z.string().optional(),
});

type TransferFormValues = z.infer<typeof transferSchema>;

export default function CashToTellerPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);
  const institutionId = userData?.institutionId;

  const tellersQuery = useMemoFirebase(
    () => (firestore && institutionId ? collection(firestore, 'institutions', institutionId, 'tellers') : null),
    [firestore, institutionId]
  );
  const { data: allTellers, isLoading: isTellersLoading } = useCollection(tellersQuery);
  
  const staffQuery = useMemoFirebase(
    () => (firestore && institutionId ? query(collection(firestore, 'users'), where('institutionId', '==', institutionId)) : null),
    [firestore, institutionId]
  );
  const { data: staff, isLoading: isStaffLoading } = useCollection(staffQuery);

  const institutionDocRef = useMemoFirebase(
    () => (institutionId ? doc(firestore, 'institutions', institutionId) : null),
    [firestore, institutionId]
  );

  const form = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      recipientTellerId: '',
      amount: 0,
      notes: '',
    },
  });
  
  const chiefCashierConfig = allTellers?.find(t => t.userId === user?.uid && t.role === 'Chief Cashier');
  const isChiefCashier = !!chiefCashierConfig;

  const recipientTellers = allTellers?.filter(t => t.userId !== user?.uid);

  const getStaffName = (userId: string) => staff?.find(s => s.uid === userId)?.name || 'Unknown Teller';

  async function onSubmit(values: TransferFormValues) {
    if (!user || !institutionId || !chiefCashierConfig || !institutionDocRef) {
      setError("Your Chief Cashier configuration could not be found.");
      return;
    }
    
    const recipientTeller = allTellers?.find(t => t.id === values.recipientTellerId);
    if (!recipientTeller) {
      setError("Recipient teller configuration not found.");
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
          branchId: chiefCashierConfig.branchId,
          date: serverTimestamp(),
          description: `Cash Transfer to Teller. From: ${user.displayName}. To: ${getStaffName(recipientTeller.userId)}. Notes: ${values.notes || 'N/A'}`,
          transactions: [
            { accountId: recipientTeller.tillAccountId, debit: values.amount, credit: 0 },
            { accountId: chiefCashierConfig.tillAccountId, debit: 0, credit: values.amount },
          ],
          // CRITICAL FIX: Auto-post if Chief Cashier
          status: 'Posted',
          createdBy: user.uid,
          createdAt: serverTimestamp(),
        };
        
        transaction.set(newJournalDocRef, newJournal);
        transaction.update(institutionDocRef, { journalBatchCounter: newBatchNumber });
      });

      toast({
        title: "Cash Transferred",
        description: `Successfully transferred cash to ${getStaffName(recipientTeller.userId)}.`,
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
  
  if (!isChiefCashier && !isTellersLoading) {
      return (
          <Card className="max-w-2xl mx-auto">
                <CardHeader>
                  <CardTitle>Access Denied</CardTitle>
              </CardHeader>
              <CardContent>
                  <Alert variant="destructive">
                      <HandCoins className="h-4 w-4" />
                      <AlertTitle>Not a Chief Cashier</AlertTitle>
                      <AlertDescription>
                          Only users with the 'Chief Cashier' role can perform this action.
                      </AlertDescription>
                  </Alert>
              </CardContent>
          </Card>
      );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Push Cash to Teller</h1>
          <p className="text-muted-foreground mt-1">
            Transfer funds from the main vault to a specific teller's till.
          </p>
        </div>
      </div>
      
      <Card className="max-w-2xl mx-auto">
          <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
              <CardHeader>
              <CardTitle>New Transfer</CardTitle>
              <CardDescription>
                  This transaction will be posted immediately.
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
              <FormField
                  control={form.control}
                  name="recipientTellerId"
                  render={({ field }) => (
                      <FormItem>
                      <FormLabel>Recipient Teller</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                          <SelectTrigger>
                              <SelectValue placeholder={isTellersLoading || isStaffLoading ? 'Loading...' : 'Select a recipient...'} />
                          </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                          {recipientTellers?.map(teller => (
                              <SelectItem key={teller.id} value={teller.id}>
                                  {getStaffName(teller.userId)}
                              </SelectItem>
                          ))}
                          </SelectContent>
                      </Select>
                      <FormMessage />
                      </FormItem>
                  )}
                  />
                  <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                      <FormItem>
                      <FormLabel>Amount to Transfer (MWK)</FormLabel>
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
                          <Textarea placeholder="e.g., Cash float for morning session..." {...field} />
                      </FormControl>
                      <FormMessage />
                      </FormItem>
                  )}
                  />
              </CardContent>
              <CardFooter className="flex justify-end">
                  <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ArrowDownCircle className="mr-2 h-4 w-4" />}
                      Transfer Cash
                  </Button>
              </CardFooter>
          </form>
          </Form>
      </Card>
    </div>
  );
}
