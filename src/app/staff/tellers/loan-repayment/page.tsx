
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
  ArrowDownCircle,
  Printer,
  ShieldAlert,
  HandCoins,
  Banknote,
  CalendarIcon,
  Info,
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

const repaymentSchema = z.object({
  customerId: z.string().min(1, 'A customer must be selected.'),
  accountId: z.string().min(1, 'Please select a loan account.'),
  amount: z.coerce.number().positive('Amount must be positive.'),
  paymentMethod: z.enum(['Cash', 'Bank']),
  bankName: z.string().optional(),
  depositSlipNumber: z.string().optional(),
  depositDate: z.date().optional(),
  institutionBankAccountId: z.string().optional(),
  // Overpayment fields
  overpaymentOption: z.enum(['ToSavings', 'ToLoan']).optional(),
  overpaymentSavingsAccountId: z.string().optional(),
  overpaymentLoanAccountId: z.string().optional(),
}).refine(data => {
    if (data.paymentMethod === 'Bank') {
      return !!data.bankName && !!data.depositSlipNumber && !!data.depositDate && !!data.institutionBankAccountId;
    }
    return true;
}, {
    message: "Bank details are required for this payment method.",
    path: ["bankName"],
});


type RepaymentFormValues = z.infer<typeof repaymentSchema>;

const malawiBanks = [
    "National Bank of Malawi",
    "Standard Bank",
    "First Capital Bank",
    "NBS Bank",
    "FDH Bank",
    "Ecobank",
    "MyBucks Banking Corporation",
    "CDH Investment Bank",
    "New Building Society",
];


export default function LoanRepaymentPage() {
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

  const [activeLoans, setActiveLoans] = useState<any[]>([]);
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
  
  const allTellersQuery = useMemoFirebase(
    () => (firestore && userData?.institutionId ? collection(firestore, 'institutions', userData.institutionId, 'tellers') : null),
    [firestore, userData]
  );
  const { data: allTellers, isLoading: isAllTellersLoading } = useCollection(allTellersQuery);


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

  const form = useForm<RepaymentFormValues>({
    resolver: zodResolver(repaymentSchema),
    defaultValues: {
      amount: 0,
      paymentMethod: 'Cash',
      depositDate: new Date(),
      bankName: '',
      depositSlipNumber: '',
      institutionBankAccountId: '',
    }
  });
  
  const { control, watch } = form;
  const paymentMethod = watch('paymentMethod');
  const selectedLoanId = watch('accountId');
  const paymentAmount = watch('amount');
  const overpaymentOption = watch('overpaymentOption');

  const selectedLoan = useMemo(() => activeLoans.find(loan => loan.id === selectedLoanId), [activeLoans, selectedLoanId]);
  
  const overpaymentAmount = useMemo(() => {
    if (!selectedLoan || !paymentAmount || paymentAmount <= selectedLoan.outstandingPrincipal) {
      return 0;
    }
    return paymentAmount - selectedLoan.outstandingPrincipal;
  }, [selectedLoan, paymentAmount]);

  const otherActiveLoans = useMemo(() => {
      return activeLoans.filter(loan => loan.id !== selectedLoanId);
  }, [activeLoans, selectedLoanId]);
  
  const coaQuery = useMemoFirebase(
    () =>
      firestore && userData?.institutionId
        ? collection(firestore, 'institutions', userData.institutionId, 'chartOfAccounts')
        : null,
    [firestore, userData]
  );
  const { data: accounts, isLoading: isCoaLoading } = useCollection(coaQuery);
  
  // Filter for verified Bank Accounts
  const bankAccounts = useMemo(() => accounts?.filter(a => a.isBankAccount) || [], [accounts]);
  
  const productsQuery = useMemoFirebase(
    () =>
      firestore && userData?.institutionId
        ? collection(firestore, 'institutions', userData.institutionId, 'loanProducts')
        : null,
    [firestore, userData]
  );
  const { data: loanProducts, isLoading: isProductsLoading } = useCollection(productsQuery);


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
      
      const loanAppsRef = collection(firestore, 'institutions', instId, 'loanApplications');
      const runningLoansRef = collection(firestore, 'institutions', instId, 'runningLoans');
      const savingsAccountsRef = collection(firestore, 'institutions', instId, 'customers', customer.id, 'savingsAccounts');
      
      const activeStatuses = ['Disbursed', 'Overdue'];
      const loanAppsQuery = query(loanAppsRef, where('customerId', '==', customer.id), where('status', 'in', activeStatuses));
      const runningLoansQuery = query(runningLoansRef, where('customerId', '==', customer.id), where('status', 'in', activeStatuses));
      const savingsQuery = query(savingsAccountsRef, where('status', '==', 'Active'));

      const [loanAppsSnap, runningLoansSnap, savingsSnap] = await Promise.all([getDocs(loanAppsQuery), getDocs(runningLoansQuery), getDocs(savingsQuery)]);

      const allLoans = [...loanAppsSnap.docs.map(d => ({id:d.id, ...d.data()})), ...runningLoansSnap.docs.map(d => ({id:d.id, ...d.data()}))];
      setActiveLoans(allLoans);
      setSavingsAccounts(savingsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
    setLoadingAccounts(false);
  };

  async function onSubmit(values: RepaymentFormValues) {
    if (!user || !userData?.institutionId || !institutionDocRef) return;
  
    const selectedLoan = activeLoans.find(loan => loan.id === values.accountId);
    if (!selectedLoan) {
      toast({ variant: 'destructive', title: "Error", description: "Selected loan not found." });
      return;
    }
    
    const product = loanProducts?.find(p => p.id === selectedLoan.loanProductId);
    if (!product) {
      toast({ variant: 'destructive', title: "Error", description: "Loan product for the selected loan not found." });
      return;
    }
  
    setIsSubmitting(true);
    try {
      let receiptData: ReceiptData | null = null;

      await runTransaction(firestore, async (transaction) => {
        const instDoc = await transaction.get(institutionDocRef);
        if (!instDoc.exists()) throw "Institution not found!";
        
        const systemDate = instDoc.data().systemDate?.toDate() || new Date();
  
        const transactionReceiptCounter = instDoc.data().transactionReceiptCounter || 0;
        const newTransactionNumber = transactionReceiptCounter + 1;
        const newTransactionId = `TRLR${String(newTransactionNumber).padStart(10, '0')}`;
  
        // Calculate Repayment Split
        const { schedule } = calculateAmortization({
          principal: selectedLoan.amount,
          annualInterestRate: product.annualInterestRate,
          term: selectedLoan.term,
          tenureUnit: selectedLoan.tenureUnit,
          interestRateType: product.interestRateType,
          startDate: selectedLoan.disbursalDate?.toDate(),
        });
  
        const { principalPaid, interestPaid } = calculateRepaymentSplit(
          values.amount,
          selectedLoan.outstandingPrincipal,
          schedule,
          systemDate
        );
        
        // --- Journal Entry ---
        const journalsRef = collection(firestore, 'institutions', userData.institutionId, 'journals');
        const newJournalDocRef = doc(journalsRef, newTransactionId);
        
        const debitAccountId = values.paymentMethod === 'Cash' 
          ? tellerConfig?.tillAccountId 
          : values.institutionBankAccountId;
        
        if (!debitAccountId) throw new Error("Could not determine debit account.");
  
        const description = `Loan Repayment from ${selectedCustomer?.name}. Loan ID: ${values.accountId}`;
  
        const journalTransactions = [
          { accountId: debitAccountId, debit: values.amount, credit: 0 },
          { accountId: product.loanPortfolioAccountId || "MISSING_LOAN_PORTFOLIO_GL", debit: 0, credit: principalPaid },
          { accountId: product.interestIncomeAccountId || "MISSING_INTEREST_INCOME_GL", debit: 0, credit: interestPaid },
        ];
  
        const newJournal = {
          id: newTransactionId,
          institutionId: userData.institutionId,
          branchId: tellerConfig.branchId,
          date: serverTimestamp(),
          description,
          transactions: journalTransactions,
          status: values.paymentMethod === 'Cash' ? 'Posted' : 'Pending',
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          loanId: values.accountId,
          repaymentAmount: values.amount,
        };
  
        transaction.set(newJournalDocRef, newJournal);
        
        if (values.paymentMethod === 'Cash') {
            // --- Update Loan Document ---
            const loanCollectionName = ['Disbursed', 'Overdue'].includes(selectedLoan.status) ? 'runningLoans' : 'loanApplications';
            const loanDocRef = doc(firestore, 'institutions', userData.institutionId, loanCollectionName, selectedLoan.id);
            
            const newOutstandingPrincipal = Math.max(0, selectedLoan.outstandingPrincipal - principalPaid);
            const newStatus = newOutstandingPrincipal <= 0 ? 'Repaid' : selectedLoan.status;
    
            transaction.update(loanDocRef, {
            outstandingPrincipal: newOutstandingPrincipal,
            status: newStatus,
            });
        }
  
        // Update counter
        transaction.update(institutionDocRef, { transactionReceiptCounter: newTransactionNumber });
  
        receiptData = {
          type: 'repayment',
          customerName: selectedCustomer?.name,
          date: new Date(),
          transactionId: newTransactionId,
          amount: values.amount,
          tellerName: user.displayName || 'N/A',
          institutionId: userData.institutionId,
          branchName: allTellers?.find(t => t.userId === user.uid)?.branchName || 'N/A',
        };
      });
  
      toast({
        title: "Repayment Submitted",
        description: `The repayment has been ${values.paymentMethod === 'Cash' ? 'posted' : 'sent for approval'}.`,
      });
  
      if (receiptData) {
        sessionStorage.setItem('lastReceiptData', JSON.stringify(receiptData));
        router.push(`/staff/tellers/receipt/${receiptData.transactionId}`);
      }

      form.reset();
      setSelectedCustomer(null);
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Error", description: "Failed to submit repayment." });
    } finally {
      setIsSubmitting(false);
    }
  }


  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Loan Repayment</h1>
            <p className="text-muted-foreground mt-1">
              Process a cash or bank repayment for an active loan.
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
                      <CardTitle>Step 2: Repayment Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                        <FormItem className="space-y-3"><FormLabel>Payment Method</FormLabel>
                          <FormControl>
                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-6">
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl><RadioGroupItem value="Cash" /></FormControl>
                                <FormLabel className="font-normal flex items-center gap-2"><HandCoins /> Cash Repayment</FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl><RadioGroupItem value="Bank" /></FormControl>
                                <FormLabel className="font-normal flex items-center gap-2"><Banknote /> Bank Deposit</FormLabel>
                              </FormItem>
                            </RadioGroup>
                          </FormControl>
                        </FormItem>
                      )} />

                      {paymentMethod === 'Bank' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 border rounded-md">
                                <FormField control={form.control} name="bankName" render={({ field }) => (
                                    <FormItem><FormLabel>Depositor's Bank</FormLabel>
                                     <Select onValueChange={field.onChange} value={field.value ?? ''}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a bank..." />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {malawiBanks.map(bank => <SelectItem key={bank} value={bank}>{bank}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="depositSlipNumber" render={({ field }) => (<FormItem><FormLabel>Ref / Slip Number</FormLabel><FormControl><Input placeholder="Transaction reference" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="depositDate" render={({ field }) => (
                                    <FormItem className="flex flex-col"><FormLabel>Deposit Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date()} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name="institutionBankAccountId" render={({ field }) => (
                                    <FormItem><FormLabel>Receiving GL Account</FormLabel><Select onValueChange={field.onChange} value={field.value ?? ''}><FormControl><SelectTrigger><SelectValue placeholder={isCoaLoading ? "Loading..." : "Select bank account..."} /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {bankAccounts.map(acc => (
                                                <SelectItem key={acc.id} value={acc.id}>
                                                    {acc.glCode} - {acc.accountName}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select><FormMessage /></FormItem>
                                )} />
                            </div>
                        )}
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <FormField control={form.control} name="accountId" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Select Loan Account</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder={loadingAccounts ? "Loading..." : "Select an active loan"} /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {activeLoans.map(loan => <SelectItem key={loan.id} value={loan.id}>Loan ID: {loan.id.substring(0,8)}... (Outstanding: MWK {loan.outstandingPrincipal.toLocaleString()})</SelectItem>)}
                                    </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            
                            <FormField control={form.control} name="amount" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Amount to Repay (MWK)</FormLabel>
                                    <FormControl><Input type="number" placeholder="Enter amount" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                      
                      {overpaymentAmount > 0 && (
                        <Card className="bg-amber-50 border-amber-200">
                          <CardHeader><CardTitle className="text-amber-900">Overpayment Detected</CardTitle></CardHeader>
                          <CardContent className="space-y-4">
                            <p>This payment exceeds the loan balance by <strong>MWK {overpaymentAmount.toLocaleString()}</strong>. Please choose how to allocate the excess funds.</p>
                             <FormField
                              control={form.control}
                              name="overpaymentOption"
                              render={({ field }) => (
                                <FormItem className="space-y-3"><FormLabel>Overpayment Allocation</FormLabel>
                                  <FormControl>
                                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                                      <FormItem className="flex items-center space-x-3 space-y-0">
                                        <FormControl><RadioGroupItem value="ToLoan" /></FormControl>
                                        <FormLabel className="font-normal">Apply to another active loan</FormLabel>
                                      </FormItem>
                                      <FormItem className="flex items-center space-x-3 space-y-0">
                                        <FormControl><RadioGroupItem value="ToSavings" /></FormControl>
                                        <FormLabel className="font-normal">Deposit to a savings account</FormLabel>
                                      </FormItem>
                                    </RadioGroup>
                                  </FormControl>
                                </FormItem>
                              )}
                            />

                            {overpaymentOption === 'ToLoan' && (
                              <FormField control={form.control} name="overpaymentLoanAccountId" render={({ field }) => (
                                <FormItem><FormLabel>Select Another Loan</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select a loan..." /></SelectTrigger></FormControl>
                                        <SelectContent>{otherActiveLoans.map(loan => <SelectItem key={loan.id} value={loan.id}>Loan ID: {loan.id.substring(0,8)}... (Outstanding: MWK {loan.amount.toLocaleString()})</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                              )} />
                            )}
                            {overpaymentOption === 'ToSavings' && (
                                <FormField control={form.control} name="overpaymentSavingsAccountId" render={({ field }) => (
                                <FormItem><FormLabel>Select Savings Account</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select a savings account..." /></SelectTrigger></FormControl>
                                        <SelectContent>{savingsAccounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name || `Account ${acc.id.substring(0,6)}`} (Balance: MWK {acc.balance?.toLocaleString() || 0})</SelectItem>)}</SelectContent>
                                    </Select>
                                </FormItem>
                              )} />
                            )}
                          </CardContent>
                        </Card>
                      )}
                      </CardContent>
                      <CardFooter className="flex justify-end">
                        <Button type="submit" disabled={isSubmitting}>
                          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ArrowDownCircle className="mr-2 h-4 w-4" />}
                          Submit Payment
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
                  <DialogDescription>Search for the customer making a repayment.</DialogDescription>
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
