
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Search,
  Loader2,
  AlertCircle,
  Receipt,
  Printer,
  CalendarIcon,
  Banknote,
  HandCoins,
  Building,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useReactToPrint } from 'react-to-print';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { TransactionReceipt, type ReceiptData } from '@/components/staff/transaction-receipt';
import { useRouter } from 'next/navigation';

const directReceiptSchema = z.object({
  customerId: z.string().min(1, 'A customer must be selected.'),
  bankName: z.string().min(1, 'Bank name is required.'),
  depositSlipNumber: z.string().min(1, 'Deposit reference is required.'),
  depositDate: z.date({ required_error: 'Deposit date is required.' }),
  amount: z.coerce.number().positive('Amount must be positive.'),
  allocationType: z.enum(['Loan Repayment', 'Savings Deposit', 'Share Purchase', 'Other']),
  destinationAccountId: z.string().min(1, 'Please select the destination customer account.'),
  institutionBankAccountId: z.string().min(1, 'Please select the GL bank account that received the funds.'),
  description: z.string().optional(),
   // Overpayment fields
  overpaymentOption: z.enum(['ToSavings', 'ToLoan']).optional(),
  overpaymentSavingsAccountId: z.string().optional(),
  overpaymentLoanAccountId: z.string().optional(),
});

type DirectReceiptFormValues = z.infer<typeof directReceiptSchema>;

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


export default function DirectReceiptPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);

  const [activeLoans, setActiveLoans] = useState<any[]>([]);
  const [savingsAccounts, setSavingsAccounts] = useState<any[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
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
  
  const allTellersQuery = useMemoFirebase(
    () => (firestore && userData?.institutionId ? collection(firestore, 'institutions', userData.institutionId, 'tellers') : null),
    [firestore, userData]
  );
  const { data: allTellers } = useCollection(allTellersQuery);


  const form = useForm<DirectReceiptFormValues>({
    resolver: zodResolver(directReceiptSchema),
    defaultValues: {
        customerId: '',
        bankName: '',
        depositSlipNumber: '',
        depositDate: new Date(),
        amount: 0,
        allocationType: undefined,
        destinationAccountId: '',
        institutionBankAccountId: '',
        description: '',
    }
  });

  const { control, watch } = form;
  const allocationType = watch('allocationType');
  const selectedLoanId = watch('destinationAccountId');
  const paymentAmount = watch('amount');
  const overpaymentOption = watch('overpaymentOption');
  
  const selectedLoan = useMemo(() => activeLoans.find(loan => loan.id === selectedLoanId), [activeLoans, selectedLoanId]);
  
  const overpaymentAmount = useMemo(() => {
    if (!selectedLoan || !paymentAmount || paymentAmount <= selectedLoan.amount || allocationType !== 'Loan Repayment') {
      return 0;
    }
    return paymentAmount - selectedLoan.amount;
  }, [selectedLoan, paymentAmount, allocationType]);

  const otherActiveLoans = useMemo(() => {
      return activeLoans.filter(loan => loan.id !== selectedLoanId);
  }, [activeLoans, selectedLoanId]);


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

    try {
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
    } catch (error) {
      console.error("Search failed:", error);
      setSearchError('An error occurred during the search.');
    } finally {
      setIsSearching(false);
    }
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
  
  const handlePrint = useReactToPrint({
      contentRef: receiptRef,
  });

  async function onSubmit(values: DirectReceiptFormValues) {
    if (!user || !userData?.institutionId || !institutionDocRef) return;

    setIsSubmitting(true);
    try {
        await runTransaction(firestore, async (transaction) => {
            const instDoc = await transaction.get(institutionDocRef);
            if (!instDoc.exists()) throw "Institution not found!";
            
            const transactionReceiptCounter = instDoc.data().transactionReceiptCounter || 0;
            const newTransactionNumber = transactionReceiptCounter + 1;
            const newTransactionId = `TRSID${String(newTransactionNumber).padStart(10, '0')}`;
            
            let customerAccountGLId = 'TEMP_SUSPENSE_ACCOUNT'; // Default to suspense

            const journalsRef = collection(firestore, 'institutions', userData.institutionId, 'journals');
            const instBankAccountName = bankAccounts.find(a => a.id === values.institutionBankAccountId)?.accountName;

            const description = `Direct Receipt from ${selectedCustomer?.name} via ${values.bankName}. Ref: ${values.depositSlipNumber}`;
            const journalTransactions = [{ accountId: values.institutionBankAccountId, debit: values.amount, credit: 0 }];

            // Handle the primary loan repayment
            if (values.allocationType === 'Loan Repayment') {
                const loan = activeLoans.find(l => l.id === values.destinationAccountId);
                if (loan) {
                    const productsRef = collection(firestore, 'institutions', userData.institutionId, 'loanProducts');
                    const productDoc = await getDocs(query(productsRef, where('id', '==', loan.loanProductId), limit(1)));
                    if (!productDoc.empty) {
                        const loanPortfolioAccountId = productDoc.docs[0].data().loanPortfolioAccountId;
                        const repaymentForPrimaryLoan = Math.min(values.amount, loan.amount);
                        journalTransactions.push({ accountId: loanPortfolioAccountId, debit: 0, credit: repaymentForPrimaryLoan });
                    }
                }
            } else if (values.allocationType === 'Savings Deposit') {
                 const savingsAcct = savingsAccounts.find(sa => sa.id === values.destinationAccountId);
                 if (savingsAcct) {
                    const productsRef = collection(firestore, 'institutions', userData.institutionId, 'savingsProducts');
                    const productDoc = await getDocs(query(productsRef, where('id', '==', savingsAcct.productId), limit(1)));
                    if(!productDoc.empty) {
                        const savingsControlAccountId = productDoc.docs[0].data().savingsControlAccountId;
                        journalTransactions.push({ accountId: savingsControlAccountId, debit: 0, credit: values.amount });
                    }
                 }
            }
            
            // Handle overpayment
            if (overpaymentAmount > 0) {
              if (values.overpaymentOption === 'ToSavings' && values.overpaymentSavingsAccountId) {
                  const savingsAccount = savingsAccounts.find(sa => sa.id === values.overpaymentSavingsAccountId);
                  if(savingsAccount) {
                    const productsRef = collection(firestore, 'institutions', userData.institutionId, 'savingsProducts');
                    const productDoc = await getDocs(query(productsRef, where('id', '==', savingsAccount.productId), limit(1)));
                     if(!productDoc.empty) {
                        const savingsControlAccountId = productDoc.docs[0].data().savingsControlAccountId;
                        journalTransactions.push({ accountId: savingsControlAccountId, debit: 0, credit: overpaymentAmount });
                    }
                  }
              } else if (values.overpaymentOption === 'ToLoan' && values.overpaymentLoanAccountId) {
                  const otherLoan = activeLoans.find(l => l.id === values.overpaymentLoanAccountId);
                  if (otherLoan) {
                    const productsRef = collection(firestore, 'institutions', userData.institutionId, 'loanProducts');
                    const productDoc = await getDocs(query(productsRef, where('id', '==', otherLoan.loanProductId), limit(1)));
                     if(!productDoc.empty) {
                        const loanPortfolioAccountId = productDoc.docs[0].data().loanPortfolioAccountId;
                        journalTransactions.push({ accountId: loanPortfolioAccountId, debit: 0, credit: overpaymentAmount });
                     }
                  }
              }
            }

            const newJournal = {
                id: newTransactionId,
                institutionId: userData.institutionId,
                date: serverTimestamp(),
                description,
                transactions: journalTransactions,
                status: 'Pending',
                createdBy: user.uid,
                createdAt: serverTimestamp(),
                loanId: values.allocationType === 'Loan Repayment' ? values.destinationAccountId : null,
                repaymentAmount: values.allocationType === 'Loan Repayment' ? values.amount : null,
            };
      
            const newDocRef = doc(journalsRef, newTransactionId);
            transaction.set(newDocRef, newJournal);
            transaction.update(institutionDocRef, { transactionReceiptCounter: newTransactionNumber });

            setReceiptData({
                type: 'direct-deposit',
                customerName: selectedCustomer?.name,
                customerPhone: selectedCustomer?.phone,
                memberId: selectedCustomer?.accountNumber,
                transactionId: newTransactionId,
                institutionBankAccountName: instBankAccountName,
                date: new Date(),
                amount: values.amount,
                bankName: values.bankName,
                depositSlipNumber: values.depositSlipNumber,
                depositDate: values.depositDate,
                tellerName: user.displayName || 'N/A',
                branchName: tellerConfig?.branchId ? allTellers?.find(t => t.userId === user.uid)?.branchName : 'N/A',
                institutionId: userData.institutionId,
            });
        });
      
      toast({
        title: "Direct Receipt Submitted",
        description: "The transaction has been sent for supervisory approval.",
      });

      form.reset({
          bankName: '',
          depositSlipNumber: '',
          depositDate: new Date(),
          amount: 0,
          allocationType: undefined,
          destinationAccountId: '',
          institutionBankAccountId: '',
          description: '',
      });
      setSelectedCustomer(null);
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Error", description: "Failed to submit direct receipt." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Direct Bank Receipt</h1>
            <p className="text-muted-foreground mt-1">
              Record a payment made directly into the institution's bank account.
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
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Card>
                <CardHeader><CardTitle>Step 1: Select Customer</CardTitle></CardHeader>
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
                  <CardHeader><CardTitle>Step 2: Transaction Details</CardTitle></CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <FormField control={form.control} name="bankName" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Depositor's Bank</FormLabel>
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
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="depositSlipNumber" render={({ field }) => (<FormItem><FormLabel>Ref / Slip Number</FormLabel><FormControl><Input placeholder="Transaction reference" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="depositDate" render={({ field }) => (
                            <FormItem className="flex flex-col"><FormLabel>Deposit Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date()} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Amount</FormLabel><FormControl><Input type="number" placeholder="Amount deposited" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <FormField control={form.control} name="allocationType" render={({ field }) => (
                            <FormItem><FormLabel>Allocate Funds To</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select purpose..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="Loan Repayment">Loan Repayment</SelectItem><SelectItem value="Savings Deposit">Savings Deposit</SelectItem><SelectItem value="Share Purchase">Share Purchase</SelectItem><SelectItem value="Other">Other</SelectItem></Select><FormMessage /></FormItem>
                        )} />
                         <FormField control={form.control} name="destinationAccountId" render={({ field }) => (
                            <FormItem><FormLabel>Destination Account</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value} disabled={!allocationType}><FormControl><SelectTrigger><SelectValue placeholder={loadingAccounts ? "Loading..." : "Select account..."} /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {allocationType === 'Savings Deposit' && savingsAccounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name || `Account ${acc.id.substring(0,6)}`}</SelectItem>)}
                                    {allocationType === 'Loan Repayment' && activeLoans.map(loan => <SelectItem key={loan.id} value={loan.id}>Loan ID: {loan.id.substring(0,8)}... (Outstanding: MWK {loan.amount.toLocaleString()})</SelectItem>)}
                                </SelectContent>
                            </Select><FormMessage /></FormItem>
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
                     {overpaymentAmount > 0 && allocationType === 'Loan Repayment' && (
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
                    <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Purpose / Description (Optional)</FormLabel><FormControl><Textarea placeholder="Add any relevant notes..." {...field} /></FormControl><FormMessage /></FormItem>)} />
                  </CardContent>
                  <CardFooter className="flex justify-end">
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Receipt className="mr-2 h-4 w-4" />}
                      Submit for Approval
                    </Button>
                  </CardFooter>
                </Card>
              )}
            </form>
          </Form>
        )}
      </div>
      
      <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Find a Customer</DialogTitle>
                  <DialogDescription>Search for the customer who made the deposit.</DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2">
                  <Input placeholder="Search by name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
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
      <Dialog open={!!receiptData} onOpenChange={() => setReceiptData(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Transaction Receipt</DialogTitle>
            </DialogHeader>
            <TransactionReceipt ref={receiptRef} receiptData={receiptData} />
            <DialogFooter>
                <Button variant="outline" onClick={() => setReceiptData(null)}>Close</Button>
                <Button onClick={handlePrint}><Printer className="mr-2 h-4 w-4"/> Print</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
