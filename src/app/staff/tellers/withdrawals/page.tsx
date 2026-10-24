

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
  updateDoc,
  deleteDoc,
  getDoc,
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Search,
  Loader2,
  AlertCircle,
  ArrowUpCircle,
  Printer,
  ShieldAlert,
  HandCoins,
  Banknote,
  CalendarIcon,
  Info,
  CheckCircle2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useReactToPrint } from 'react-to-print';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useTeller } from '@/context/TellerContext';
import { calculateAmortization, calculateRepaymentSplit } from '@/lib/finance';
import { TransactionReceipt, type ReceiptData } from '@/components/staff/transaction-receipt';
import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';


const withdrawalSchema = z.object({
  customerId: z.string().min(1, 'A customer must be selected.'),
  accountId: z.string().min(1, 'Please select a savings account.'),
  amount: z.coerce.number().positive('Amount must be positive.'),
});

type WithdrawalFormValues = z.infer<typeof withdrawalSchema>;

export default function CashWithdrawalPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { dayStarted, openingFloat } = useTeller();

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);

  const [savingsAccounts, setSavingsAccounts] = useState<any[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const receiptRef = useRef(null);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);

   const institutionDocRef = useMemoFirebase(
    () => (userData?.institutionId ? doc(firestore, 'institutions', userData.institutionId) : null),
    [firestore, userData]
  );
  const { data: institutionData, isLoading: isInstitutionLoading } = useDoc(institutionDocRef);

  const tellerConfigQuery = useMemoFirebase(
    () => (firestore && user && userData?.institutionId ? query(collection(firestore, 'institutions', userData.institutionId, 'tellers'), where('userId', '==', user.uid), limit(1)) : null),
    [firestore, user, userData]
  );
  const { data: tellerConfigData, isLoading: isTellerConfigLoading } = useCollection(tellerConfigQuery);
  const tellerConfig = tellerConfigData?.[0];
  const isTeller = !!tellerConfig && (tellerConfig.role === 'Regular Cashier' || tellerConfig.role === 'Chief Cashier');

  const journalsQuery = useMemoFirebase(
    () => (firestore && user && userData?.institutionId ? query(collection(firestore, 'institutions', userData.institutionId, 'journals'), where('createdBy', '==', user.uid), where('status', '==', 'Posted')) : null),
    [firestore, user, userData]
  );
  const { data: journals, isLoading: isJournalsLoading } = useCollection(journalsQuery);
  
  const assignedPayoutsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !userData?.institutionId) return null;
    return query(
      collection(firestore, 'institutions', userData.institutionId, 'loanApplications'),
      where('status', '==', 'Ready for Payout'),
      where('assignedTellerId', '==', user.uid)
    );
  }, [firestore, user, userData]);
  const { data: assignedPayouts, isLoading: isPayoutsLoading } = useCollection(assignedPayoutsQuery);
  
  const customerIdsForPayouts = useMemo(() => {
    if (!assignedPayouts) return [];
    return [...new Set(assignedPayouts.map(p => p.customerId))];
  }, [assignedPayouts]);

  const payoutCustomersQuery = useMemoFirebase(() => {
    if (!firestore || !userData?.institutionId || customerIdsForPayouts.length === 0) return null;
    return query(collection(firestore, 'institutions', userData.institutionId, 'customers'), where('id', 'in', customerIdsForPayouts));
  }, [firestore, userData, customerIdsForPayouts]);
  const { data: payoutCustomers, isLoading: arePayoutCustomersLoading } = useCollection(payoutCustomersQuery);


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

  const form = useForm<WithdrawalFormValues>({
    resolver: zodResolver(withdrawalSchema),
    defaultValues: {
      amount: 0,
    }
  });
  
  const { control, watch } = form;
  const selectedAccountId = watch('accountId');
  const withdrawalAmount = watch('amount');
  const withdrawalFee = 100; // Mock fee only for savings
  
  const selectedAccount = savingsAccounts.find(acc => acc.id === selectedAccountId);
    
  const currentCustomerBalance = selectedAccount?.balance || 0;
    
  const totalDeduction = (withdrawalAmount || 0) + withdrawalFee;
  
  const hasSufficientCustomerFunds = useMemo(() => {
    return currentCustomerBalance >= totalDeduction;
  }, [currentCustomerBalance, totalDeduction]);
  
  const hasSufficientTellerFunds = useMemo(() => {
    return currentTillBalance >= (withdrawalAmount || 0);
  }, [currentTillBalance, withdrawalAmount]);

  const handleSearch = async () => {
    if (searchTerm.length < 3 || !firestore || !userData?.institutionId) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const customersRef = collection(firestore, 'institutions', userData.institutionId, 'customers');
    const lowercasedSearchTerm = searchTerm.toLowerCase();

    const nameQuery = query(customersRef, where('name_lowercase', '>=', lowercasedSearchTerm), where('name_lowercase', '<=', lowercasedSearchTerm + '\uf8ff'), limit(5));
    const idNumberQuery = query(customersRef, where('idNumber_lowercase', '==', lowercasedSearchTerm), limit(5));
    const phoneQuery = query(customersRef, where('phone_lowercase', '==', lowercasedSearchTerm), limit(5));
    const accountNumberQuery = query(customersRef, where('accountNumber_lowercase', '==', lowercasedSearchTerm), limit(5));

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

  async function onSavingsWithdrawalSubmit(values: WithdrawalFormValues) {
    if (!user || !userData?.institutionId || !hasSufficientCustomerFunds || !hasSufficientTellerFunds || !tellerConfig || !institutionDocRef) return;

    setIsSubmitting(true);
    try {
        let receiptData: ReceiptData | null = null;
        await runTransaction(firestore, async (transaction) => {
            const instDoc = await transaction.get(institutionDocRef);
            if (!instDoc.exists()) throw "Institution not found!";

            const transactionReceiptCounter = instDoc.data().transactionReceiptCounter || 0;
            const newTransactionNumber = transactionReceiptCounter + 1;
            const newTransactionId = `TRWID${String(newTransactionNumber).padStart(10, '0')}`;

            const journalsRef = collection(firestore, 'institutions', userData.institutionId, 'journals');
            const newJournalDocRef = doc(journalsRef, newTransactionId);
            
            const savingsAccount = savingsAccounts.find(sa => sa.id === values.accountId);
            const customerAccountGLId = savingsAccount?.savingsControlAccountId || 'MISSING_SAVINGS_GL';
            const description = `Cash Withdrawal for ${selectedCustomer?.name}. Acct: ${values.accountId}`;

            const transactions = [
                { accountId: customerAccountGLId, debit: values.amount, credit: 0 },
                { accountId: tellerConfig.tillAccountId, debit: 0, credit: values.amount },
            ];
            
            const newJournal = {
                id: newTransactionId,
                institutionId: userData.institutionId,
                branchId: tellerConfig.branchId,
                date: serverTimestamp(),
                description: description,
                transactions: transactions,
                status: 'Pending',
                createdBy: user.uid,
                createdAt: serverTimestamp(),
            };
            
            transaction.set(newJournalDocRef, newJournal);
            transaction.update(institutionDocRef, { transactionReceiptCounter: newTransactionNumber });

            receiptData = {
                type: 'withdrawal',
                customerName: selectedCustomer?.name,
                memberId: selectedCustomer?.accountNumber,
                customerPhone: selectedCustomer?.phone,
                date: new Date(),
                transactionId: newTransactionId,
                amount: values.amount,
                fee: withdrawalFee,
                totalDeduction: totalDeduction,
                tellerName: user.displayName,
                branchName: tellerConfig?.branchName,
                institutionId: userData.institutionId,
            };
        });

        toast({
            title: "Withdrawal Submitted",
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
      toast({ variant: "destructive", title: "Error", description: "Failed to submit withdrawal." });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLoanPayout(loan: any, customer: any) {
    if (!user || !userData?.institutionId || !tellerConfig || !institutionDocRef) return;
    setIsSubmitting(true);
    try {
        let receiptData: ReceiptData | null = null;
        await runTransaction(firestore, async (transaction) => {
            const instDoc = await transaction.get(institutionDocRef);
            if (!instDoc.exists()) throw "Institution not found!";

            // Move loan from 'loanApplications' to 'runningLoans'
            const loanAppRef = doc(firestore, 'institutions', userData.institutionId, 'loanApplications', loan.id);
            const runningLoanRef = doc(firestore, 'institutions', userData.institutionId, 'runningLoans', loan.id);
            
            transaction.set(runningLoanRef, { ...loan, status: 'Disbursed' });
            transaction.delete(loanAppRef);

            // Create Journal Entry
            const transactionReceiptCounter = instDoc.data().transactionReceiptCounter || 0;
            const newTransactionNumber = transactionReceiptCounter + 1;
            const newTransactionId = `TRLPAY${String(newTransactionNumber).padStart(9, '0')}`;
            const journalsRef = collection(firestore, 'institutions', userData.institutionId, 'journals');
            const newJournalDocRef = doc(journalsRef, newTransactionId);
            
            const description = `Loan Payout for ${customer?.name}. Loan ID: ${loan.id}`;
            const transactions = [
                { accountId: '2130', debit: loan.netDisbursementAmount, credit: 0 }, // 'Funds Payable' or a similar suspense account
                { accountId: tellerConfig.tillAccountId, debit: 0, credit: loan.netDisbursementAmount },
            ];
            
            const newJournal = {
                id: newTransactionId,
                institutionId: userData.institutionId,
                branchId: tellerConfig.branchId,
                date: serverTimestamp(),
                description: description,
                transactions: transactions,
                status: 'Posted', // Teller payouts are often auto-posted if cash is pushed
                createdBy: user.uid,
                createdAt: serverTimestamp(),
            };
            
            transaction.set(newJournalDocRef, newJournal);
            transaction.update(institutionDocRef, { transactionReceiptCounter: newTransactionNumber });

            receiptData = {
                type: 'payout',
                transactionId: newTransactionId,
                date: new Date(),
                customerName: customer?.name,
                memberId: customer?.accountNumber,
                customerPhone: customer?.phone,
                amount: loan.netDisbursementAmount,
                description: `Loan Payout (Loan ID: ${loan.id})`,
                tellerName: user.displayName,
                branchName: tellerConfig?.branchName,
                institutionId: userData.institutionId,
            };
        });

        toast({
            title: "Payout Completed",
            description: `Loan payout for ${customer?.name} has been successfully processed.`,
        });

        if (receiptData) {
            sessionStorage.setItem('lastReceiptData', JSON.stringify(receiptData));
            router.push(`/staff/tellers/receipt/${receiptData.transactionId}`);
        }

    } catch (e) {
        console.error(e);
        toast({ variant: "destructive", title: "Error", description: "Failed to process loan payout." });
    } finally {
        setIsSubmitting(false);
    }
  }
  
  const isLoading = isTellerConfigLoading || isJournalsLoading || isPayoutsLoading || arePayoutCustomersLoading;

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Withdrawals & Payouts</h1>
            <p className="text-muted-foreground mt-1">
              Process cash withdrawals and disburse approved loans.
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

            <Card>
                <CardHeader>
                    <CardTitle>Loan Payout Queue</CardTitle>
                    <CardDescription>Loans assigned to you for cash payout.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Customer</TableHead>
                                <TableHead>Disbursement Date</TableHead>
                                <TableHead>Net Payout Amount</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-10 w-full" /></TableCell></TableRow> :
                            assignedPayouts && assignedPayouts.length > 0 ? (
                                assignedPayouts.map(loan => {
                                    const customer = payoutCustomers?.find(c => c.id === loan.customerId);
                                    return (
                                        <TableRow key={loan.id}>
                                            <TableCell>
                                                <div className="font-medium">{customer?.name || 'Loading...'}</div>
                                                <div className="text-sm text-muted-foreground">{customer?.accountNumber}</div>
                                            </TableCell>
                                            <TableCell>
                                                {loan.disbursalDate ? format(loan.disbursalDate.toDate(), 'PPP') : 'N/A'}
                                            </TableCell>
                                            <TableCell>MWK {loan.netDisbursementAmount.toLocaleString()}</TableCell>
                                            <TableCell className="text-right">
                                                <Button size="sm" onClick={() => handleLoanPayout(loan, customer)} disabled={isSubmitting}>
                                                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Pay Out'}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                         <div className="flex flex-col items-center gap-2">
                                            <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
                                            <p className="text-muted-foreground">No loan payouts are currently assigned to you.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSavingsWithdrawalSubmit)} className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Savings Withdrawal</CardTitle>
                    <CardDescription>Search for a customer to perform a withdrawal from their savings account.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
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

                     {selectedCustomer && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <FormField control={form.control} name="accountId" render={({ field }) => (
                              <FormItem>
                                <FormLabel>Select Savings Account</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl><SelectTrigger><SelectValue placeholder={loadingAccounts ? "Loading..." : `Select a savings account`} /></SelectTrigger></FormControl>
                                  <SelectContent>
                                    {savingsAccounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name || `Account ${acc.id.substring(0,6)}`} (Balance: MWK {acc.balance?.toLocaleString() || 0})</SelectItem>)}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )} />
                            
                            <FormField control={form.control} name="amount" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Amount to Withdraw (MWK)</FormLabel>
                                    <FormControl><Input type="number" placeholder="Enter amount" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            {selectedAccountId && (
                                <div className="md:col-span-2">
                                    <FormLabel>Summary</FormLabel>
                                    <div className="p-4 border rounded-md mt-2 space-y-2 text-sm bg-muted/50">
                                        <div className="flex justify-between"><span>Withdrawal Amount:</span> <span>MWK {withdrawalAmount?.toLocaleString() || 0}</span></div>
                                        <div className="flex justify-between"><span>Withdrawal Fee:</span> <span>MWK {withdrawalFee.toLocaleString()}</span></div>
                                        <div className="flex justify-between font-bold border-t pt-2 mt-2"><span>Total Deduction:</span> <span>MWK {totalDeduction.toLocaleString()}</span></div>
                                    </div>
                                    {!hasSufficientCustomerFunds && withdrawalAmount > 0 && (
                                        <Alert variant="destructive" className="mt-4">
                                            <ShieldAlert className="h-4 w-4" />
                                            <AlertTitle>Insufficient Funds</AlertTitle>
                                            <AlertDescription>
                                                The total deduction exceeds the customer's available balance of MWK {currentCustomerBalance.toLocaleString()}.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                </div>
                            )}
                        </div>
                      )}
                      </CardContent>
                      <CardFooter className="flex-col items-stretch gap-4">
                          {!hasSufficientTellerFunds && withdrawalAmount > 0 && (
                            <Alert variant="destructive">
                                <ShieldAlert className="h-4 w-4" />
                                <AlertTitle>Insufficient Teller Funds</AlertTitle>
                                <AlertDescription>
                                    You do not have enough cash in your till (Balance: MWK {currentTillBalance.toLocaleString()}) to complete this withdrawal. Please request more funds.
                                </AlertDescription>
                            </Alert>
                          )}
                          <Button className="w-full" type="submit" disabled={isSubmitting || !hasSufficientCustomerFunds || !withdrawalAmount || !hasSufficientTellerFunds}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ArrowUpCircle className="mr-2 h-4 w-4" />}
                            Submit Withdrawal for Approval
                          </Button>
                      </CardFooter>
                    </Card>
                </form>
            </Form>
          </fieldset>
        )}
      </div>
      
      <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Find a Customer</DialogTitle>
                  <DialogDescription>Search for the customer to process a withdrawal.</DialogDescription>
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
