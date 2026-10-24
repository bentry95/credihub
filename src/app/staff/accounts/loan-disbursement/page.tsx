
'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { doc, updateDoc, Timestamp, collection, query, where, runTransaction, serverTimestamp, arrayUnion, getDocs, getDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Send,
  Loader2,
  AlertCircle,
  Banknote,
  Landmark,
  FileText,
  CalendarIcon,
  ChevronsRight,
  FileWarning,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const disbursementSchema = z.object({
  disbursementMethod: z.string().min(1, 'Please select a disbursement method.'),
  fundingAccountId: z.string().optional(),
  disbursalDate: z.date({ required_error: 'Disbursement date is required.' }),
  reference: z.string().optional(),
  assignedTellerId: z.string().optional(),
});

function LoanDisbursementQueue() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [loans, setLoans] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [institutionId, setInstitutionId] = useState<string|null>(null);

  useEffect(() => {
    async function fetchUserData() {
      if (user && firestore) {
        const userDocRef = doc(firestore, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          setInstitutionId(userDocSnap.data().institutionId);
        }
      }
    }
    fetchUserData();
  }, [user, firestore]);

  useEffect(() => {
    async function fetchData() {
      if (!firestore || !institutionId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const loansQuery = query(
          collection(firestore, 'institutions', institutionId, 'loanApplications'),
          where('status', '==', 'Approved')
        );
        const customersQuery = collection(firestore, 'institutions', institutionId, 'customers');
        const usersQuery = query(collection(firestore, 'users'), where('institutionId', '==', institutionId));

        const [loansSnap, customersSnap, usersSnap] = await Promise.all([
          getDocs(loansQuery),
          getDocs(customersQuery),
          getDocs(usersQuery),
        ]);

        setLoans(loansSnap.docs.map(d => ({id: d.id, ...d.data()})));
        setCustomers(customersSnap.docs.map(d => ({id: d.id, ...d.data()})));
        setUsers(usersSnap.docs.map(d => ({id: d.id, ...d.data()})));
      } catch (error) {
        console.error("Error fetching disbursement queue data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [firestore, institutionId]);


  const getCustomerName = (customerId: string) => {
    return customers?.find(c => c.id === customerId)?.name || 'Unknown Customer';
  };
  
  const getApproverName = (approverId: string) => {
    return users?.find(u => u.uid === approverId)?.name || 'Unknown';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Loan Disbursement Queue</h1>
        <p className="text-muted-foreground mt-1">
          A list of all approved loans waiting to be funded and disbursed to customers.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Awaiting Disbursement</CardTitle>
          <CardDescription>
            The following loans have been approved and are ready for payment processing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer Name</TableHead>
                <TableHead>Approved Amount (MWK)</TableHead>
                <TableHead>Date Approved</TableHead>
                <TableHead>Approved By</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-9 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : loans && loans.length > 0 ? (
                loans.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell className="font-medium">{getCustomerName(loan.customerId)}</TableCell>
                    <TableCell>{loan.amount.toLocaleString()}</TableCell>
                    <TableCell>{loan.approvalDate ? format(loan.approvalDate.toDate(), 'PPP') : 'N/A'}</TableCell>
                    <TableCell>{getApproverName(loan.approvedBy)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm">
                        <Link href={`/staff/accounts/loan-disbursement?id=${loan.id}`}>
                          Disburse
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="p-4 bg-muted rounded-full">
                            <FileWarning className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold">Queue is Empty</h3>
                        <p className="text-muted-foreground">
                            There are no approved loans waiting for disbursement.
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
  );
}


function DisbursementPageContent({ loanId }: { loanId: string }) {
  const router = useRouter();
  const { toast } = useToast();

  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);
  
  const [loanData, setLoanData] = useState<any>(null);
  const [customerData, setCustomerData] = useState<any>(null);
  const [loanProduct, setLoanProduct] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [tellers, setTellers] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);

  const { user } = useUser();
  const firestore = useFirestore();
  const [institutionId, setInstitutionId] = useState<string|null>(null);

  useEffect(() => {
    async function fetchUserData() {
      if (user && firestore) {
        const userDocRef = doc(firestore, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          setInstitutionId(userDocSnap.data().institutionId);
        } else {
            setError("User institution not found.");
        }
      }
    }
    fetchUserData();
  }, [user, firestore]);
  
  useEffect(() => {
    if (!institutionId || !loanId || !firestore) return;

    const fetchLoanDetails = async () => {
      setIsDataLoading(true);
      setError(null);
      try {
        const loanDocRef = doc(firestore, 'institutions', institutionId, 'loanApplications', loanId);
        const loanSnap = await getDoc(loanDocRef);

        if (!loanSnap.exists()) {
          setError("Loan Not Found");
          setIsDataLoading(false);
          return;
        }
        const loan = { id: loanSnap.id, ...loanSnap.data() };
        setLoanData(loan);

        // Fetch related data
        const customerDocRef = doc(firestore, 'institutions', institutionId, 'customers', loan.customerId);
        const productDocRef = doc(firestore, 'institutions', institutionId, 'loanProducts', loan.loanProductId);
        const accountsQuery = query(collection(firestore, 'institutions', institutionId, 'chartOfAccounts'));
        const tellersQuery = query(collection(firestore, 'institutions', institutionId, 'tellers'));
        const staffQuery = query(collection(firestore, 'users'), where('institutionId', '==', institutionId));

        
        const [customerSnap, productSnap, accountsSnap, tellersSnap, staffSnap] = await Promise.all([
            getDoc(customerDocRef),
            getDoc(productDocRef),
            getDocs(accountsQuery),
            getDocs(tellersQuery),
            getDocs(staffQuery),
        ]);

        if (customerSnap.exists()) setCustomerData({ id: customerSnap.id, ...customerSnap.data() });
        if (productSnap.exists()) setLoanProduct({ id: productSnap.id, ...productSnap.data() });
        setAccounts(accountsSnap.docs.map(d => ({id: d.id, ...d.data()})));
        setTellers(tellersSnap.docs.map(d => ({id: d.id, ...d.data()})));
        setStaff(staffSnap.docs.map(d => ({id: d.id, ...d.data()})));

      } catch (e) {
          console.error("Error fetching loan details:", e);
          setError("Failed to load loan details.");
      } finally {
        setIsDataLoading(false);
      }
    };

    fetchLoanDetails();
  }, [institutionId, loanId, firestore]);
  
  // Updated filtering: Only show verified Bank Accounts for funding
  const bankAccounts = useMemo(() => accounts?.filter(a => a.isBankAccount) || [], [accounts]);

  const form = useForm<z.infer<typeof disbursementSchema>>({
    resolver: zodResolver(disbursementSchema),
    defaultValues: {
      disbursalDate: new Date(),
    },
  });
  
  const disbursementMethod = form.watch('disbursementMethod');

  const chiefCashier = useMemo(() => {
    if (!tellers || !loanData) return null;
    return tellers.find(t => t.role === 'Chief Cashier' && t.branchId === loanData.branchId);
  }, [tellers, loanData]);


  const getFundingSource = (method: string) => {
    if (method === 'Teller') {
        return chiefCashier?.tillAccountId || null;
    }
    return form.watch('fundingAccountId');
  }

  const handleSendBack = async () => {
    if (!institutionId || !user) return;
    const loanDocRef = doc(firestore, 'institutions', institutionId, 'loanApplications', loanId);
    setLoading('SendBack');
    try {
        await updateDoc(loanDocRef, {
            status: 'Pending Approval',
            approvedBy: null,
            approvalDate: null,
            auditHistory: arrayUnion({
                userId: user.uid,
                timestamp: Timestamp.now(),
                action: 'Sent Back to Approval',
                details: 'Loan sent back from Disbursement stage.'
            })
        });
        toast({ title: 'Loan Sent Back', description: 'The application has been returned to the "Pending Approval" stage.' });
        router.push('/staff/loans/all-applications');
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to send the loan back.' });
    } finally {
        setLoading(null);
    }
  }


  async function onSubmit(values: z.infer<typeof disbursementSchema>) {
    if (!firestore || !institutionId || !loanData || !user || !loanProduct) return;
    
    setLoading('Disburse');
    setError(null);

    const isTellerDisbursement = values.disbursementMethod === 'Teller';
    let fundingAccountId = values.fundingAccountId;
    let finalStatus = isTellerDisbursement ? 'Pending Payout' : 'Disbursed';

    if (isTellerDisbursement) {
        if (!chiefCashier) {
            setError('A Chief Cashier must be configured for this branch to use teller disbursement.');
            setLoading(null);
            return;
        }
        fundingAccountId = chiefCashier.tillAccountId;
    } else {
        if (!values.fundingAccountId) {
            form.setError('fundingAccountId', { type: 'manual', message: 'Please select the funding source.' });
            setLoading(null);
            return;
        }
    }

    try {
        await runTransaction(firestore, async (transaction) => {
            const originalDocRef = doc(firestore, 'institutions', institutionId, 'loanApplications', loanId);
            const originalLoanSnap = await transaction.get(originalDocRef);
            if (!originalLoanSnap.exists()) throw new Error("Loan application not found.");
            
            const loanDataFromDb = originalLoanSnap.data();
            const institutionDocRef = doc(firestore, 'institutions', institutionId);
            const instDoc = await transaction.get(institutionDocRef);
            if (!instDoc.exists()) throw new Error("Institution not found!");
            
            let currentJournalCounter = instDoc.data().journalBatchCounter || 0;

            const journalsRef = collection(firestore, 'institutions', institutionId, 'journals');
            
            // --- TOP-UP LOGIC: Settle old loan and adjust amounts ---
            if (loanDataFromDb.isTopUp) {
                const oldLoanRef = doc(firestore, 'institutions', institutionId, 'runningLoans', loanDataFromDb.originalLoanId);
                transaction.update(oldLoanRef, { status: 'Repaid', outstandingPrincipal: 0 });
            }
            
            const auditAction = finalStatus === 'Pending Payout' ? 'Queued for Payout' : 'Loan Disbursed';
            const auditDetails = finalStatus === 'Pending Payout' 
                ? `Loan prepared for teller payout. Amount: MWK ${loanDataFromDb.netDisbursementAmount.toLocaleString()}`
                : `Loan of MWK ${loanDataFromDb.amount.toLocaleString()} disbursed via ${values.disbursementMethod}.`;

            const updatedLoanData = {
                ...loanDataFromDb,
                status: finalStatus,
                disbursalDate: Timestamp.fromDate(values.disbursalDate),
                disbursementDetails: {
                    method: values.disbursementMethod,
                    fundingAccountId: fundingAccountId,
                    reference: values.reference || null,
                    disbursedBy: user.uid,
                },
                 auditHistory: arrayUnion({
                    userId: user.uid,
                    timestamp: Timestamp.now(),
                    action: auditAction,
                    details: auditDetails,
                })
            };
            
            // If it's a direct disbursement, move to runningLoans. 
            // If it's for teller payout, keep it in loanApplications.
            if (finalStatus === 'Disbursed') {
                const newLoanRef = doc(firestore, 'institutions', institutionId, 'runningLoans', loanId);
                transaction.set(newLoanRef, updatedLoanData);
                transaction.delete(originalDocRef);
            } else { // 'Pending Payout'
                transaction.update(originalDocRef, updatedLoanData);
            }


            // --- DISBURSEMENT JOURNAL ENTRY ---
            const portfolioJournalId = `bat${String(++currentJournalCounter).padStart(7, '0')}`;
            const portfolioJournalRef = doc(journalsRef, portfolioJournalId);
            
            const feeEntries = (loanDataFromDb.fees || []).map((fee: any) => {
                if (fee.collectionMethod === 'Deduct from Disbursement' && fee.amount > 0) {
                    return { accountId: fee.incomeAccountId, debit: 0, credit: fee.amount };
                }
                return null;
            }).filter(Boolean);

            const disbursementAmount = loanDataFromDb.isTopUp
                ? loanDataFromDb.topUpDetails.topUpAmount
                : loanDataFromDb.amount;

            if (!loanProduct.loanPortfolioAccountId) {
                throw new Error(`Loan Product "${loanProduct.name}" is not linked to a Loan Portfolio GL account.`);
            }

            const portfolioJournalTransactions = [
                { accountId: loanProduct.loanPortfolioAccountId, debit: disbursementAmount, credit: 0 },
                ...feeEntries,
                { accountId: fundingAccountId, debit: 0, credit: loanDataFromDb.netDisbursementAmount },
            ];

            const portfolioJournalEntry = {
                id: portfolioJournalId,
                institutionId: institutionId,
                branchId: loanDataFromDb.branchId,
                date: serverTimestamp(),
                description: `Loan Disbursement for ${loanId}`,
                transactions: portfolioJournalTransactions,
                status: 'Posted',
                createdBy: user.uid,
                createdAt: serverTimestamp(),
                loanId: loanId,
            };
            transaction.set(portfolioJournalRef, portfolioJournalEntry);
            
            transaction.update(institutionDocRef, { journalBatchCounter: currentJournalCounter });
        });

        toast({
            title: finalStatus === 'Pending Payout' ? "Queued for Payout" : "Loan Disbursed Successfully",
            description: finalStatus === 'Pending Payout' 
                ? `Loan for ${customerData?.name} is now waiting for teller assignment.`
                : `Loan for ${customerData?.name} has been funded and is now active.`,
        });

      router.push('/staff/accounts/loan-disbursement');
    } catch(e) {
      console.error("Disbursement failed:", e);
      setError("An error occurred during disbursement. Please try again.");
    } finally {
      setLoading(null);
    }
  }


  const isLoading = isDataLoading;
  
  const getStaffName = (userId: string) => staff?.find(s => s.uid === userId)?.name || 'Unknown Teller';

  const journalPreview = useMemo(() => {
    if (!loanData || !loanProduct || !accounts) return [];
    
    const fundingSourceId = getFundingSource(form.watch('disbursementMethod'));
    if (!fundingSourceId) return [];
    
    const fundingAccount = accounts.find(a => a.id === fundingSourceId);
    const loanPortfolioAccount = accounts.find(a => a.id === loanProduct.loanPortfolioAccountId);
    
    const journal = [];

    const disbursementAmount = loanData.isTopUp ? loanData.topUpDetails.topUpAmount : loanData.amount;
    
    journal.push({ accountName: loanPortfolioAccount?.accountName || 'Loan Portfolio', glCode: loanPortfolioAccount?.glCode, debit: disbursementAmount, credit: 0 });
    
    const feeEntries = (loanData.fees || []).filter((fee: any) => fee.collectionMethod === 'Deduct from Disbursement').map((fee: any) => {
        const feeAccount = accounts.find(a => a.id === fee.incomeAccountId);
        return { 
          accountName: feeAccount?.accountName || '[Fee Income]', 
          glCode: feeAccount?.glCode,
          debit: 0,
          credit: fee.amount
        };
    });
    
    journal.push(...feeEntries);
    journal.push({ accountName: fundingAccount?.accountName || '[Funding Source]', glCode: fundingAccount?.glCode, debit: 0, credit: loanData.netDisbursementAmount });

    return journal;

  }, [loanData, loanProduct, accounts, form.watch('disbursementMethod'), form.watch('fundingAccountId'), chiefCashier]);


  if (isLoading) {
    return <div className="space-y-6">
        <Skeleton className="h-10 w-1/4" />
        <Skeleton className="h-6 w-1/2" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 space-y-6">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-32 w-full" />
            </div>
            <Skeleton className="h-96 w-full" />
        </div>
    </div>;
  }

  if (error || !loanData) {
    return <Card className="text-center">
        <CardHeader>
            <CardTitle className="text-destructive">{error || "Loan Not Found"}</CardTitle>
            <CardDescription>The loan you are trying to disburse could not be found.</CardDescription>
        </CardHeader>
        <CardContent>
            <Button asChild><Link href="/staff/accounts/loan-disbursement">Back to Queue</Link></Button>
        </CardContent>
    </Card>;
  }

  const netPayout = loanData.isTopUp 
    ? (loanData.topUpDetails.topUpAmount || 0) - (loanData.fees?.reduce((acc: number, fee: any) => fee.collectionMethod === 'Deduct from Disbursement' ? acc + fee.amount : acc, 0) || 0)
    : (loanData.netDisbursementAmount || loanData.amount);

  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
            <Button variant="outline" asChild>
            <Link href="/staff/accounts/loan-disbursement"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Queue</Link>
            </Button>
            <Button variant="secondary" onClick={handleSendBack} disabled={!!loading}>
                {loading === 'SendBack' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ArrowLeft className="mr-2 h-4 w-4" />}
                Send Back to Approval Stage
            </Button>
        </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2 space-y-6">
             <Card>
                <CardHeader>
                    <CardTitle>Disbursement Summary</CardTitle>
                    <CardDescription>Confirm the details below before processing the payment.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><p className="text-muted-foreground">Customer</p><p className="font-semibold">{customerData?.name}</p></div>
                        <div><p className="text-muted-foreground">Loan Product</p><p className="font-semibold">{loanProduct?.name}</p></div>
                        {loanData.isTopUp ? (
                          <>
                            <div><p className="text-muted-foreground">Previous Outstanding Balance</p><p className="font-semibold">MWK {loanData.topUpDetails.outstandingBalance.toLocaleString()}</p></div>
                            <div><p className="text-muted-foreground">Top-Up Amount</p><p className="font-semibold">MWK {loanData.topUpDetails.topUpAmount.toLocaleString()}</p></div>
                             <div className="text-primary font-semibold"><p className="text-muted-foreground">New Total Principal</p><p>MWK {loanData.amount.toLocaleString()}</p></div>
                          </>
                        ) : (
                          <div><p className="text-muted-foreground">Approved Principal</p><p className="font-semibold">MWK {loanData.amount.toLocaleString()}</p></div>
                        )}
                        <div className="text-primary"><p className="text-muted-foreground">Net Cash Disbursed to Customer</p><p className="font-semibold">MWK {netPayout.toLocaleString()}</p></div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>GL Posting Preview</CardTitle>
                    <CardDescription>This journal entry will be automatically posted upon disbursement.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <Table>
                        <TableHeader><TableRow><TableHead>Account</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {journalPreview.map((entry: any, index: number) => (
                            <TableRow key={index}><TableCell><div className="font-medium">{entry.accountName}</div><div className="text-xs text-muted-foreground">{entry.glCode}</div></TableCell><TableCell className="text-right font-mono">{entry.debit > 0 ? entry.debit.toLocaleString() : '-'}</TableCell><TableCell className="text-right font-mono">{entry.credit > 0 ? entry.credit.toLocaleString() : '-'}</TableCell></TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle>Disbursement Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                  <FormField control={form.control} name="disbursementMethod" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Disbursement Method</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select a method..." /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {loanProduct?.disbursementMethods?.map((method: string) => (
                                    <SelectItem key={method} value={method}>{method}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}/>
                {disbursementMethod === 'Teller' && chiefCashier && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Funds will be sent to the Chief Cashier</AlertTitle>
                      <AlertDescription>
                        The funds will be posted to the till of {getStaffName(chiefCashier.userId)}.
                      </AlertDescription>
                    </Alert>
                )}
                {disbursementMethod !== 'Teller' && (
                    <FormField control={form.control} name="fundingAccountId" render={({ field }) => (
                        <FormItem>
                        <FormLabel>Funding Account (GL)</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder={"Select a funding account..."} /></SelectTrigger></FormControl>
                            <SelectContent>
                                {bankAccounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.glCode} - {acc.accountName}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}/>
                )}
                  <FormField control={form.control} name="disbursalDate" render={({ field }) => (
                    <FormItem className="flex flex-col"><FormLabel>Disbursement Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                )}/>
                  <FormField control={form.control} name="reference" render={({ field }) => (
                    <FormItem><FormLabel>Reference (Optional)</FormLabel><FormControl><Input placeholder="Cheque no. or transaction ID" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
            </CardContent>
            <CardFooter className="flex-col items-stretch p-6">
                {error && <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
                <Button type="submit" disabled={!!loading} size="lg">
                    {loading === 'Disburse' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}
                    Confirm Disbursement
                </Button>
            </CardFooter>
          </Card>
        </form>
      </Form>
    </div>
  );
}


export default function LoanDisbursementPage() {
    const searchParams = useSearchParams();
    const loanId = searchParams.get('id');

    return (
        <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            {loanId ? <DisbursementPageContent loanId={loanId} /> : <LoanDisbursementQueue />}
        </Suspense>
    )
}
