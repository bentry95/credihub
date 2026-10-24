
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
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
  addDoc,
  serverTimestamp,
  query,
  where,
  limit,
  getDocs,
  runTransaction,
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Search,
  Loader2,
  AlertCircle,
  ArrowDownCircle,
  Printer,
  ShieldAlert,
  HandCoins,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useReactToPrint } from 'react-to-print';
import { useTeller } from '@/context/TellerContext';
import { type ReceiptData } from '@/components/staff/transaction-receipt';
import { useRouter } from 'next/navigation';


const depositSchema = z.object({
  customerId: z.string().min(1, 'A customer must be selected.'),
  accountId: z.string().min(1, 'Please select a savings account.'),
  amount: z.coerce.number().positive('Amount must be positive.'),
});

type DepositFormValues = z.infer<typeof depositSchema>;

export default function CashDepositPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { dayStarted } = useTeller();

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);

  const [savingsAccounts, setSavingsAccounts] = useState<any[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);

   const institutionDocRef = useMemoFirebase(
    () => (userData?.institutionId ? doc(firestore, 'institutions', userData.institutionId) : null),
    [firestore, userData]
  );

  const tellerConfigQuery = useMemoFirebase(
    () => (firestore && user && userData?.institutionId ? query(collection(firestore, 'institutions', userData.institutionId, 'tellers'), where('userId', '==', user.uid), limit(1)) : null),
    [firestore, user, userData]
  );
  const { data: tellerConfigData, isLoading: isTellerConfigLoading } = useCollection(tellerConfigQuery);
  const tellerConfig = tellerConfigData?.[0];
  const isTeller = !!tellerConfig && (tellerConfig.role === 'Regular Cashier' || tellerConfig.role === 'Chief Cashier');

  const form = useForm<DepositFormValues>({
    resolver: zodResolver(depositSchema),
    defaultValues: {
      amount: 0,
    }
  });

  const handleSearch = async () => {
    if (searchTerm.length < 3 || !firestore || !userData?.institutionId) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const customersRef = collection(firestore, 'institutions', userData.institutionId, 'customers');
    const lowercasedSearchTerm = searchTerm.toLowerCase();

    const nameQuery = query(customersRef, where('name_lowercase', '>=', lowercasedSearchTerm), where('name_lowercase', '<=', lowercasedSearchTerm + '\uf8ff'), limit(5));
    const idNumberQuery = query(customersRef, where('idNumber', '==', searchTerm), limit(5));
    const phoneQuery = query(customersRef, where('phone', '==', searchTerm), limit(5));
    const accountNumberQuery = query(customersRef, where('accountNumber', '==', searchTerm), limit(5));

    const [nameSnap, idNumberSnap, phoneSnap, accountNumberSnap] = await Promise.all([
      getDocs(nameQuery),
      getDocs(idNumberQuery),
      getDocs(phoneQuery),
      getDocs(accountNumberQuery),
    ]);

    const resultsMap = new Map();
    nameSnap.forEach(doc => resultsMap.set(doc.id, { id: doc.id, ...doc.data() }));
    idNumberSnap.forEach(doc => resultsMap.set(doc.id, { id: doc.id, ...doc.data() }));
    phoneSnap.forEach(doc => resultsMap.set(doc.id, { id: doc.id, ...doc.data() }));
    accountNumberSnap.forEach(doc => resultsMap.set(doc.id, { id: doc.id, ...doc.data() }));
    
    setSearchResults(Array.from(resultsMap.values()));
    setIsSearching(false);
  };
  

  const handleSelectCustomer = async (customer: any) => {
    setSelectedCustomer(customer);
    form.setValue('customerId', customer.id);
    setSearchTerm('');
    setSearchResults([]);
    setIsSearchOpen(false);

    setLoadingAccounts(true);
    if (firestore && userData?.institutionId) {
      const instId = userData.institutionId;
      const savingsAccountsRef = collection(firestore, 'institutions', instId, 'customers', customer.id, 'savingsAccounts');
      
      const savingsQuery = query(savingsAccountsRef, where('status', '==', 'Active'));

      const savingsSnap = await getDocs(savingsQuery);

      setSavingsAccounts(savingsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
    setLoadingAccounts(false);
  };
  

  async function onSubmit(values: DepositFormValues) {
    if (!user || !userData?.institutionId || !tellerConfig || !institutionDocRef) return;

    setIsSubmitting(true);
    try {
      let receiptData: ReceiptData | null = null;

      await runTransaction(firestore, async (transaction) => {
          const instDoc = await transaction.get(institutionDocRef);
          if (!instDoc.exists()) throw "Institution not found!";

          const transactionReceiptCounter = instDoc.data().transactionReceiptCounter || 0;
          const newTransactionNumber = transactionReceiptCounter + 1;
          const newTransactionId = `TRDEP${String(newTransactionNumber).padStart(10, '0')}`;

          const journalsRef = collection(firestore, 'institutions', userData.institutionId, 'journals');
          const newJournalDocRef = doc(journalsRef, newTransactionId);
          
          let customerAccountGLId = '';
            const savingsProduct = savingsAccounts.find(sa => sa.id === values.accountId);
            customerAccountGLId = savingsProduct?.savingsControlAccountId || 'MISSING_SAVINGS_GL';

          const newJournal = {
            id: newTransactionId,
            institutionId: userData.institutionId,
            branchId: tellerConfig.branchId,
            date: serverTimestamp(),
            description: `Cash Deposit for ${selectedCustomer?.name}. Acct: ${values.accountId}`,
            transactions: [
              { accountId: tellerConfig.tillAccountId, debit: values.amount, credit: 0 },
              { accountId: customerAccountGLId, debit: 0, credit: values.amount },
            ],
            status: 'Pending',
            createdBy: user.uid,
            createdAt: serverTimestamp(),
          };
          
          transaction.set(newJournalDocRef, newJournal);
          transaction.update(institutionDocRef, { transactionReceiptCounter: newTransactionNumber });

          receiptData = {
            ...values,
            type: 'deposit',
            customerName: selectedCustomer?.name,
            memberId: selectedCustomer?.accountNumber,
            customerPhone: selectedCustomer?.phone,
            date: new Date(),
            transactionId: newTransactionId,
            tellerName: user.displayName,
            branchName: tellerConfig?.branchName,
            institutionId: userData.institutionId,
          };
      });

      toast({
        title: "Deposit Submitted",
        description: "The transaction has been sent for supervisory approval.",
      });

      if (receiptData) {
        sessionStorage.setItem('lastReceiptData', JSON.stringify(receiptData));
        router.push(`/staff/tellers/receipt/${receiptData.transactionId}`);
      }

      form.reset();
      setSelectedCustomer(null);
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Error", description: "Failed to submit deposit." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Cash Deposit</h1>
            <p className="text-muted-foreground mt-1">
              Process a cash deposit for a customer's savings account.
            </p>
          </div>
        </div>
        
        {!isTeller && !isTellerConfigLoading && (
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
                            Your user account is not configured as a teller. Please contact your administrator.
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        )}

        {isTeller && (
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
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Step 1: Select Customer</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedCustomer ? (
                      <div className="flex items-center gap-4 mt-4 rounded-md border p-4 bg-muted/50 max-w-lg">
                        <Avatar className="h-12 w-12"><AvatarImage src={selectedCustomer.photoUrl} /><AvatarFallback>{selectedCustomer.name.charAt(0)}</AvatarFallback></Avatar>
                        <div>
                          <p className="font-semibold">{selectedCustomer.name}</p>
                          <p className="text-sm text-muted-foreground">{selectedCustomer.accountNumber}</p>
                        </div>
                        <Button variant="link" onClick={() => { setSelectedCustomer(null); form.reset(); }} className="ml-auto">Change</Button>
                      </div>
                    ) : (
                      <Button type="button" onClick={() => setIsSearchOpen(true)}>
                        <Search className="mr-2 h-4 w-4"/> Search for Customer
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {selectedCustomer && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Step 2: Deposit Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <FormField control={form.control} name="accountId" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Select Savings Account</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl><SelectTrigger><SelectValue placeholder={loadingAccounts ? "Loading..." : `Select a savings account`} /></SelectTrigger></FormControl>
                                  <SelectContent>
                                    {savingsAccounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name || `Account ${acc.id.substring(0,6)}`}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <FormField control={form.control} name="amount" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Amount to Deposit (MWK)</FormLabel>
                                    <FormControl><Input type="number" placeholder="Enter amount" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                      </CardContent>
                      <CardFooter className="flex justify-end">
                        <Button type="submit" disabled={isSubmitting}>
                          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ArrowDownCircle className="mr-2 h-4 w-4" />}
                          Submit for Approval
                        </Button>
                      </CardFooter>
                    </Card>
                  )}
                </form>
            </Form>
          </fieldset>
        )}
      </div>
      
      <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Find a Customer</DialogTitle>
                  <DialogDescription>Search for the customer to process a deposit.</DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2">
                  <Input placeholder="Search by Name, ID, Phone, or Account No..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  <Button onClick={handleSearch} disabled={isSearching || searchTerm.length < 3}>
                      {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
              </div>
              <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
                {searchResults.length > 0 ? searchResults.map(c => (
                    <div key={c.id} onClick={() => handleSelectCustomer(c)} className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer">
                        <Avatar className="h-8 w-8"><AvatarImage src={c.photoUrl} /><AvatarFallback>{c.name.charAt(0)}</AvatarFallback></Avatar>
                        <div><p className="text-sm font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.accountNumber}</p></div>
                    </div>
                )) : searchTerm.length >= 3 && !isSearching && <p className="text-sm text-muted-foreground text-center py-4">No customers found.</p>}
              </div>
          </DialogContent>
      </Dialog>
    </>
  );
}
