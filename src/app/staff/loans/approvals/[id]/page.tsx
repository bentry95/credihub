

'use client';

import { useState, useMemo, Suspense, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useParams, useRouter } from 'next/navigation';
import {
  useUser,
  useFirestore,
} from '@/firebase';
import { collection, doc, query, where, updateDoc, Timestamp, arrayUnion, getDoc, getDocs, runTransaction, serverTimestamp, collectionGroup, limit } from 'firebase/firestore';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Check, X, Info, Receipt, CalendarDays, Percent, ArrowLeft, CalendarIcon, User, Phone, MapPin, Briefcase, Wallet, Mail, Heart, CreditCard, Users2, Home } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { calculateAmortization } from '@/lib/finance';
import { format, differenceInYears } from 'date-fns';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';


const approvalSchema = z.object({
  firstRepaymentDate: z.date({
    required_error: "First repayment date is required.",
  }),
});


function LoanApprovalPageContent() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const params = useParams();
  const router = useRouter();
  const loanId = params.id as string;
  
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [loan, setLoan] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [savingsAccounts, setSavingsAccounts] = useState<any[]>([]);
  const [loanProduct, setLoanProduct] = useState<any>(null);
  const [loanOfficer, setLoanOfficer] = useState<any>(null);
  const [fees, setFees] = useState<any[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);

  const [institutionId, setInstitutionId] = useState<string | null>(null);
  
  const [allUsers, setAllUsers] = useState<any[]>([]);


  useEffect(() => {
    async function fetchUserAndInstitution() {
      if (user && firestore) {
        const userDocRef = doc(firestore, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          setInstitutionId(userDoc.data().institutionId);
        }
      }
    }
    fetchUserAndInstitution();
  }, [user, firestore]);

  useEffect(() => {
    if (!institutionId || !loanId || !firestore) return;

    const fetchLoanData = async () => {
      setIsDataLoading(true);
      setError(null);

      const loanDocRef = doc(firestore, 'institutions', institutionId, 'loanApplications', loanId);
      const loanSnap = await getDoc(loanDocRef);

      if (!loanSnap.exists()) {
        setError("Loan Not Found");
        setIsDataLoading(false);
        return;
      }
      const loanData = { id: loanSnap.id, ...loanSnap.data() };
      setLoan(loanData);
      
      try {
        const customerDocRef = doc(firestore, 'institutions', institutionId, 'customers', loanData.customerId);
        const productDocRef = doc(firestore, 'institutions', institutionId, 'loanProducts', loanData.loanProductId);
        
        const officerUserId = loanData.appraisedBy || loanData.reversalRequestedBy || loanData.writeOffRequestedBy;
        
        const usersQuery = query(collection(firestore, 'users'), where('institutionId', '==', institutionId));
        const feesQuery = query(collection(firestore, 'institutions', institutionId, 'fees'));
        const savingsQuery = query(collection(firestore, `institutions/${institutionId}/customers/${loanData.customerId}/savingsAccounts`), where('status', '==', 'Active'), limit(1));

        const [customerSnap, productSnap, usersSnap, feesSnap, savingsSnap] = await Promise.all([
            getDoc(customerDocRef),
            getDoc(productDocRef),
            getDocs(usersQuery),
            getDocs(feesQuery),
            getDocs(savingsQuery),
        ]);

        if (customerSnap.exists()) setCustomer({ id: customerSnap.id, ...customerSnap.data() });
        if (productSnap.exists()) setLoanProduct({ id: productSnap.id, ...productSnap.data() });
        if (usersSnap.docs.length > 0) {
            const allStaff = usersSnap.docs.map(d => ({id: d.id, ...d.data()}));
            setAllUsers(allStaff);
            if(officerUserId) {
                setLoanOfficer(allStaff.find(s => s.uid === officerUserId));
            }
        }
        setFees(feesSnap.docs.map(d => ({id: d.id, ...d.data()})));
        setSavingsAccounts(savingsSnap.docs.map(d => ({id: d.id, ...d.data()})))

      } catch (e) {
        console.error("Error fetching related loan data:", e);
        setError("Failed to load all loan details.");
      } finally {
        setIsDataLoading(false);
      }
    };

    fetchLoanData();
  }, [institutionId, loanId, firestore]);


  const form = useForm<z.infer<typeof approvalSchema>>({
    resolver: zodResolver(approvalSchema),
    defaultValues: {
      firstRepaymentDate: undefined,
    }
  });
  
  const getFeeAmount = (fee: any, principal: number) => {
    if (fee.calculationMethod === 'Flat Amount') return fee.amount;
    if (fee.calculationMethod === 'Percentage' && fee.percentage && fee.percentageOf) {
      if (fee.percentageOf === 'Approved Amount' || fee.percentageOf === 'Disbursed Amount') {
        return principal * (fee.percentage / 100);
      }
    }
    return 0;
  }

  const applicableFees = useMemo(() => {
    if (!loanProduct || !fees) return [];
    const linkedFeeIds = loanProduct.linkedFees || [];
    const feeTrigger = loan?.isTopUp ? 'On Top-Up' : 'On Disbursement';
    return fees.filter(fee => linkedFeeIds.includes(fee.id) && fee.trigger === feeTrigger);
  }, [loanProduct, fees, loan]);


  const feesDeducted = applicableFees.filter(f => f.collectionMethod === 'Deduct from Disbursement');
  const feesCapitalized = applicableFees.filter(f => f.collectionMethod === 'Add to Principal');
  const feesPaidSeparately = applicableFees.filter(f => f.collectionMethod === 'Paid Separately');

  const totalDeductedFees = feesDeducted.reduce((sum, fee) => sum + getFeeAmount(fee, loan?.amount || 0), 0);
  const totalCapitalizedFees = feesCapitalized.reduce((sum, fee) => sum + getFeeAmount(fee, loan?.amount || 0), 0);
  
  const finalPrincipal = (loan?.amount || 0) + totalCapitalizedFees;
  const netDisbursement = loan?.isTopUp
    ? (loan.topUpDetails.topUpAmount || 0) - totalDeductedFees
    : (loan?.amount || 0) - totalDeductedFees;


  const { schedule, totalInterest, totalPayment, monthlyInstallment } = useMemo(() => {
    if (!loanProduct || !loan || !form.getValues('firstRepaymentDate')) {
      return { schedule: [], totalInterest: 0, totalPayment: 0, monthlyInstallment: 0 };
    }
    return calculateAmortization({
      principal: finalPrincipal, 
      term: loan.term,
      tenureUnit: loan.tenureUnit || 'Months',
      interestRateType: loanProduct.interestRateType,
      startDate: form.getValues('firstRepaymentDate'),
      annualInterestRate: loanProduct.annualInterestRate
    });
  }, [loan, loanProduct, finalPrincipal, form.watch('firstRepaymentDate')]);


  async function handleDecision(decision: 'Approved' | 'Rejected' | 'Reversed' | 'Written-Off' | 'Rescheduled') {
    if (!loan || !user || !institutionId || !loanProduct) return;
    
    let loanDocRef;
    if (loan.status === 'Reversal Pending') {
      const runningLoanRef = doc(firestore, 'institutions', institutionId, 'runningLoans', loan.id);
      const runningLoanSnap = await getDoc(runningLoanRef);
      if (runningLoanSnap.exists()) {
        loanDocRef = runningLoanRef;
      } else {
        loanDocRef = doc(firestore, 'institutions', institutionId, 'loanApplications', loan.id);
      }
    } else {
        loanDocRef = doc(firestore, 'institutions', institutionId, 'loanApplications', loanId);
    }


    if (decision === 'Approved') {
        const isValid = await form.trigger();
        if (!isValid) return;
    }
    
    const { firstRepaymentDate } = form.getValues();

    setLoading(decision);
    try {
        const institutionDocRef = doc(firestore, 'institutions', institutionId);
        
        await runTransaction(firestore, async(transaction) => {
            const instDoc = await transaction.get(institutionDocRef);
            if (!instDoc.exists()) throw "Institution not found";
            
            const journalBatchCounter = instDoc.data().journalBatchCounter || 0;
            let currentJournalCounter = journalBatchCounter;
            const journalsRef = collection(firestore, 'institutions', institutionId, 'journals');
            
            if (decision === 'Rescheduled') {
                const { newTerm, newInterestRate } = loan.rescheduleDetails;
                transaction.update(loanDocRef, {
                    status: 'Disbursed', // A rescheduled loan is considered active/disbursed
                    term: newTerm,
                    annualInterestRate: newInterestRate,
                    isRescheduled: false, // Clear the flag
                    rescheduleDetails: null, // Clear the temp details
                    auditHistory: arrayUnion({
                        userId: user.uid,
                        timestamp: new Date(),
                        action: `Reschedule Approved`,
                        details: `Loan terms updated to ${newTerm} months at ${newInterestRate}% p.a.`
                    })
                });
                return;
            }
            
            if (decision === 'Reversed') {
                const disbursementJournalQuery = query(journalsRef, where('loanId', '==', loan.id), limit(1));
                const disbursementJournals = await getDocs(disbursementJournalQuery);
                
                if (disbursementJournals.empty) throw new Error("Original disbursement transaction not found for this loan.");

                const disbursementJournal = disbursementJournals.docs[0].data();
                const disbursementJournalId = disbursementJournals.docs[0].id;
                
                const reversalTransactions = disbursementJournal.transactions.map((t: any) => ({
                    accountId: t.accountId,
                    debit: t.credit || 0,
                    credit: t.debit || 0,
                }));
                
                const reversalBatchId = `bat${String(++currentJournalCounter).padStart(7, '0')}`;
                const reversalJournalRef = doc(journalsRef, reversalBatchId);
                
                transaction.set(reversalJournalRef, {
                    id: reversalBatchId,
                    institutionId,
                    branchId: loan.branchId,
                    date: serverTimestamp(),
                    description: `REVERSAL for Batch-${disbursementJournalId}`,
                    transactions: reversalTransactions,
                    status: 'Posted',
                    reversesJournalId: disbursementJournalId,
                    createdBy: user.uid,
                    createdAt: serverTimestamp(),
                });
            }
            
            else if (decision === 'Written-Off') {
                const writeOffBatchId = `bat${String(++currentJournalCounter).padStart(7, '0')}`;
                const writeOffJournalRef = doc(journalsRef, writeOffBatchId);
                transaction.set(writeOffJournalRef, {
                    id: writeOffBatchId,
                    institutionId,
                    branchId: loan.branchId,
                    date: serverTimestamp(),
                    description: `Write-off for Loan ${loan.id}`,
                    transactions: [
                        { accountId: '6100', debit: loan.outstandingPrincipal, credit: 0 },
                        { accountId: loanProduct.loanPortfolioAccountId, debit: 0, credit: loan.outstandingPrincipal },
                    ],
                    status: 'Posted',
                    createdBy: user.uid,
                    createdAt: serverTimestamp(),
                });
            }

            const applicableFeesDetails = applicableFees.map(fee => ({
                feeId: fee.id,
                name: fee.name,
                amount: getFeeAmount(fee, loan.amount),
                collectionMethod: fee.collectionMethod,
                incomeAccountId: fee.incomeAccountId
            }));
            
            transaction.update(loanDocRef, {
                status: decision,
                outstandingPrincipal: decision === 'Reversed' || decision === 'Written-Off' ? 0 : loan.outstandingPrincipal,
                approvedBy: user.uid,
                approvalDate: new Date(),
                ...(decision === 'Approved' && { 
                    firstRepaymentDate: Timestamp.fromDate(firstRepaymentDate),
                    amount: finalPrincipal,
                    outstandingPrincipal: finalPrincipal,
                    netDisbursementAmount: netDisbursement,
                    fees: applicableFeesDetails,
                }),
                auditHistory: arrayUnion({
                    userId: user.uid,
                    timestamp: new Date(),
                    action: `Loan ${decision}`,
                    details: `Loan was ${decision.toLowerCase()} by ${user.displayName}.`
                })
            });

             if (decision === 'Reversed' || decision === 'Written-Off') {
                transaction.update(institutionDocRef, { journalBatchCounter: currentJournalCounter });
            }
        });
        
        toast({
            title: `Loan ${decision}`,
            description: `The loan has been successfully ${decision.toLowerCase()}.`,
        });
        router.push('/staff/loans/approvals');
    } catch(e) {
        toast({
            variant: "destructive",
            title: "Error",
            description: (e as Error).message || "Failed to process the decision. Please try again.",
        });
        console.error(e);
    } finally {
        setLoading(null);
    }
  }

  const handleSendBack = async () => {
    if (!loan || !user || !institutionId) return;
    setLoading('SendBack');
    const loanDocRef = doc(firestore, 'institutions', institutionId, 'loanApplications', loanId);

    try {
        await updateDoc(loanDocRef, {
            status: 'Appraisal',
            approvedBy: null,
            approvalDate: null,
            auditHistory: arrayUnion({
                userId: user.uid,
                timestamp: new Date(),
                action: 'Sent Back to Appraisal',
                details: 'Loan sent back from Approval stage.'
            })
        });
        toast({ title: 'Loan Sent Back', description: 'The application has been returned to the "Appraisal" stage.' });
        router.push('/staff/loans/all-applications');
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to send the loan back.' });
    } finally {
        setLoading(null);
    }
  }
  
  const getUserName = (userId: string) => allUsers.find(u => u.uid === userId)?.name || '...';
  
  if (isDataLoading) {
    return <div className="space-y-6"><Skeleton className="h-12 w-1/4" /><Skeleton className="h-96 w-full" /></div>
  }
  
  if (error || !loan) {
      return (
        <Card className="text-center max-w-lg mx-auto">
            <CardHeader>
                <CardTitle className="text-destructive">{error || "Loan Not Found"}</CardTitle>
                <CardDescription>The requested loan application could not be found.</CardDescription>
            </CardHeader>
            <CardContent>
               <Button variant="outline" asChild className="mt-4"><Link href="/staff/loans/approvals"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Queue</Link></Button>
            </CardContent>
        </Card>
      )
  }
  
  const getAge = (dob: any) => {
    if (!dob) return 'N/A';
    return differenceInYears(new Date(), dob.toDate()).toString();
  }

  const renderApprovalContent = () => (
    <>
    <Form {...form}>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Final Loan Approval</h1>
          <p className="text-muted-foreground mt-1">
            For {customer?.name} - Appraised by {loanOfficer?.name}
          </p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" asChild>
                <Link href="/staff/loans/approvals"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Queue</Link>
            </Button>
            <Button variant="destructive" onClick={() => handleDecision('Rejected')} disabled={!!loading}>
                {loading === 'Rejected' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <X className="mr-2 h-4 w-4"/>} Reject
            </Button>
            <Button onClick={() => handleDecision('Approved')} disabled={!!loading}>
                {loading === 'Approved' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4"/>} Approve Loan
            </Button>
        </div>
      </div>
      <Accordion type="multiple" defaultValue={['item-1', 'item-customer']} className="w-full">
            <AccordionItem value="item-customer">
              <AccordionTrigger>Customer Details</AccordionTrigger>
              <AccordionContent>
                 <Card className="border-none shadow-none">
                    <CardContent className="pt-6 grid grid-cols-1 gap-6">
                        <div className="flex items-center gap-6">
                            <Avatar className="h-28 w-28">
                                <AvatarImage src={customer?.photoUrl} />
                                <AvatarFallback className="text-3xl">{customer?.name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="space-y-1">
                                <h3 className="text-2xl font-bold">{customer?.name}</h3>
                                <p className="text-muted-foreground">{customer?.accountNumber}</p>
                                <p className="text-sm"><Phone className="inline-block mr-2 h-4 w-4 text-muted-foreground" />{customer?.phone}</p>
                                <p className="text-sm"><Mail className="inline-block mr-2 h-4 w-4 text-muted-foreground" />{customer?.email || 'N/A'}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
                            <div className="font-medium text-muted-foreground col-span-full border-b pb-2">Personal & KYC Information</div>
                            <div><p className="font-medium text-muted-foreground">Gender</p><p>{customer?.gender}</p></div>
                            <div><p className="font-medium text-muted-foreground">Age</p><p>{getAge(customer?.dateOfBirth)} years</p></div>
                            <div><p className="font-medium text-muted-foreground">Marital Status</p><p>{customer?.maritalStatus}</p></div>
                            <div><p className="font-medium text-muted-foreground">Nationality</p><p>{customer?.nationality}</p></div>
                            <div><p className="font-medium text-muted-foreground">ID Type</p><p>{customer?.idType}</p></div>
                            <div><p className="font-medium text-muted-foreground">ID Number</p><p>{customer?.idNumber}</p></div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                            <div className="font-medium text-muted-foreground col-span-full border-b pb-2">Address Details</div>
                             <div>
                                <h4 className="font-medium mb-2 text-sm">Current Residence</h4>
                                <div className="space-y-1">
                                    <div><p className="text-muted-foreground">District</p><p>{customer?.currentResidence?.district}</p></div>
                                    <div><p className="text-muted-foreground">Area</p><p>{customer?.currentResidence?.area}</p></div>
                                    <div><p className="text-muted-foreground">Physical Address</p><p>{customer?.currentResidence?.physicalAddress}</p></div>
                                </div>
                            </div>
                             <div>
                                <h4 className="font-medium mb-2 text-sm">Home Village</h4>
                                <div className="space-y-1">
                                    <div><p className="text-muted-foreground">District</p><p>{customer?.homeVillage?.district}</p></div>
                                    <div><p className="text-muted-foreground">T/A</p><p>{customer?.homeVillage?.traditionalAuthority}</p></div>
                                    <div><p className="text-muted-foreground">Village</p><p>{customer?.homeVillage?.village}</p></div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
                            <div className="font-medium text-muted-foreground col-span-full border-b pb-2">Financial Profile</div>
                            <div><p className="font-medium text-muted-foreground">Occupation</p><p>{customer?.occupationCategory}</p></div>
                            <div><p className="font-medium text-muted-foreground">Employer</p><p>{customer?.employerName || 'N/A'}</p></div>
                            <div><p className="font-medium text-muted-foreground">Monthly Income</p><p>MWK {customer?.primaryIncome?.toLocaleString()}</p></div>
                        </div>

                         {(customer?.nextOfKin?.length > 0 || customer?.workmates?.length > 0 || customer?.spouseDetails?.name) && (
                            <div className="space-y-4">
                                <h4 className="font-semibold border-b pb-2">References</h4>
                                {customer.spouseDetails?.name && (
                                    <div>
                                        <h5 className="font-medium mb-2">Spouse Details</h5>
                                        <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Workplace</TableHead></TableRow></TableHeader>
                                            <TableBody><TableRow><TableCell>{customer.spouseDetails.name}</TableCell><TableCell>{customer.spouseDetails.phone}</TableCell><TableCell>{customer.spouseDetails.workplace}</TableCell></TableRow></TableBody>
                                        </Table>
                                    </div>
                                )}
                                {customer.nextOfKin?.length > 0 && (
                                    <div>
                                        <h5 className="font-medium mb-2">Next of Kin</h5>
                                        <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Relationship</TableHead><TableHead>Phone</TableHead><TableHead>Residence</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {customer.nextOfKin.map((kin: any, index: number) => <TableRow key={index}><TableCell>{kin.fullName}</TableCell><TableCell>{kin.relationship}</TableCell><TableCell>{kin.phone}</TableCell><TableCell>{kin.residence}</TableCell></TableRow>)}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                                {customer.workmates?.length > 0 && (
                                    <div>
                                        <h5 className="font-medium mb-2">Workmates</h5>
                                        <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Position</TableHead><TableHead>Contacts</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {customer.workmates.map((mate: any, index: number) => <TableRow key={index}><TableCell>{mate.fullName}</TableCell><TableCell>{mate.position}</TableCell><TableCell>{mate.contacts}</TableCell></TableRow>)}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </div>
                        )}
                        
                    </CardContent>
                </Card>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-1">
                <AccordionTrigger>Loan Summary</AccordionTrigger>
                <AccordionContent>
                    <div className="p-4">
                        {loan.isTopUp ? (
                             <Card className="bg-muted/50"><CardHeader><CardTitle className="text-lg">Top-Up Details</CardTitle></CardHeader><CardContent className="text-sm space-y-2">
                               <div className="flex justify-between"><span className="text-muted-foreground">Previous Outstanding Balance:</span><span className="font-medium font-mono">MWK {loan.topUpDetails.outstandingBalance.toLocaleString()}</span></div>
                               <div className="flex justify-between"><span className="text-muted-foreground">Top-Up Amount Requested:</span><span className="font-medium font-mono">MWK {loan.topUpDetails.topUpAmount.toLocaleString()}</span></div>
                               <div className="flex justify-between font-semibold border-t pt-2 mt-2"><span>New Total Principal:</span><span className="font-mono">MWK {loan.amount.toLocaleString()}</span></div>
                             </CardContent></Card>
                        ) : (
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="flex justify-between"><span className="text-muted-foreground">Amount Requested:</span><span className="font-medium">MWK {loan.originalAmount ? loan.originalAmount.toLocaleString() : loan.amount.toLocaleString()}</span></div>
                                <div className="flex justify-between font-semibold text-primary"><span>Amount Recommended:</span><span>MWK {loan.amount.toLocaleString()}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Term:</span><span className="font-medium">{loan.term} {loan.tenureUnit || 'Months'}</span></div>
                            </div>
                        )}
                        <Card className="mt-4"><CardHeader><CardTitle className="text-base">Loan Officer's Notes</CardTitle></CardHeader><CardContent><Alert variant="default"><Info className="h-4 w-4" /><AlertDescription>{loan.appraisalNotes}</AlertDescription></Alert></CardContent></Card>
                    </div>
                </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
                <AccordionTrigger>Charges &amp; Net Disbursement</AccordionTrigger>
                <AccordionContent>
                   <div className="p-4 text-sm space-y-4">
                    {feesDeducted.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-semibold">Deducted from Disbursement:</h4>
                        {feesDeducted.map(fee => (
                          <div key={fee.id} className="flex justify-between pl-4"><span className="text-muted-foreground">{fee.name}</span><span className="font-mono">- MWK {getFeeAmount(fee, loan.amount).toLocaleString()}</span></div>
                        ))}
                      </div>
                    )}
                    {feesCapitalized.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-semibold">Added to Principal (Capitalized):</h4>
                        {feesCapitalized.map(fee => (
                          <div key={fee.id} className="flex justify-between pl-4"><span className="text-muted-foreground">{fee.name}</span><span className="font-mono">+ MWK {getFeeAmount(fee, loan.amount).toLocaleString()}</span></div>
                        ))}
                      </div>
                    )}
                    {feesPaidSeparately.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-semibold">To Be Paid Separately:</h4>
                        {feesPaidSeparately.map(fee => (
                          <div key={fee.id} className="flex justify-between pl-4"><span className="text-muted-foreground">{fee.name}</span><span className="font-mono">MWK {getFeeAmount(fee, loan.amount).toLocaleString()}</span></div>
                        ))}
                      </div>
                    )}

                    <div className="border-t pt-4 space-y-2">
                       <div className="flex justify-between text-base"><span>Final Principal Amount:</span><span className="font-semibold font-mono">MWK {finalPrincipal.toLocaleString()}</span></div>
                       <div className="flex justify-between text-lg text-primary"><span>Net Amount to Customer:</span><span className="font-bold font-mono">MWK {netDisbursement.toLocaleString()}</span></div>
                    </div>
                   </div>
                </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
                <AccordionTrigger>Amortization Schedule</AccordionTrigger>
                <AccordionContent>
                    <div className="p-4 space-y-4">
                        <FormField
                            control={form.control}
                            name="firstRepaymentDate"
                            render={({ field }) => (
                                <FormItem className="flex flex-col max-w-xs">
                                <FormLabel>First Repayment Date</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button
                                        variant={"outline"}
                                        className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                                        >
                                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                    </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="p-2 bg-muted rounded-md"><div className="text-xs text-muted-foreground">Monthly Installment</div><div className="font-bold">MWK {monthlyInstallment.toLocaleString(undefined, {minimumFractionDigits: 2})}</div></div>
                            <div className="p-2 bg-muted rounded-md"><div className="text-xs text-muted-foreground">Total Interest</div><div className="font-bold">MWK {totalInterest.toLocaleString(undefined, {minimumFractionDigits: 2})}</div></div>
                            <div className="p-2 bg-muted rounded-md"><div className="text-xs text-muted-foreground">Total Repayable</div><div className="font-bold">MWK {totalPayment.toLocaleString(undefined, {minimumFractionDigits: 2})}</div></div>
                        </div>
                    </div>
                   <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Payment Date</TableHead>
                                <TableHead className="text-right">Principal</TableHead>
                                <TableHead className="text-right">Interest</TableHead>
                                <TableHead className="text-right">Monthly Repayment</TableHead>
                                <TableHead className="text-right">Loan Balance</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            <TableRow className="bg-muted/50 font-medium">
                                <TableCell>Loan Start</TableCell>
                                <TableCell colSpan={3}></TableCell>
                                <TableCell className="text-right">{finalPrincipal.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                            </TableRow>
                            {schedule.map(row => (
                                <TableRow key={row.period}>
                                    <TableCell>{format(row.paymentDate, 'dd-MMM-yy')}</TableCell>
                                    <TableCell className="text-right">{row.principal.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                    <TableCell className="text-right">{row.interest.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                    <TableCell className="text-right">{row.totalPayment.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                    <TableCell className="text-right">{row.closingBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </AccordionContent>
            </AccordionItem>
      </Accordion>
      <div className="mt-6">
        <Button variant="outline" onClick={handleSendBack} disabled={!!loading}>
            {loading === 'SendBack' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ArrowLeft className="mr-2 h-4 w-4" />}
            Send Back to Appraisal
        </Button>
      </div>
      </Form>
    </>
  );

  const renderReversalContent = () => (
     <>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Approve Loan Reversal</h1>
          <p className="text-muted-foreground mt-1">For {customer?.name}</p>
        </div>
         <div className="flex gap-2">
            <Button variant="outline" asChild>
                <Link href="/staff/loans/approvals/reversals"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Queue</Link>
            </Button>
            <Button variant="destructive" onClick={() => handleDecision('Rejected')} disabled={!!loading}>
                {loading === 'Rejected' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <X className="mr-2 h-4 w-4"/>} Reject
            </Button>
            <Button onClick={() => handleDecision('Reversed')} disabled={!!loading}>
                {loading === 'Reversed' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4"/>} Approve Reversal
            </Button>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>Reversal Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
           <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="font-medium text-muted-foreground">Loan Amount</p><p>MWK {loan.amount.toLocaleString()}</p></div>
                <div><p className="font-medium text-muted-foreground">Outstanding</p><p>MWK {loan.outstandingPrincipal.toLocaleString()}</p></div>
                <div><p className="font-medium text-muted-foreground">Date Applied</p><p>{loan.dateApplied ? format(loan.dateApplied.toDate(), 'PPP') : 'N/A'}</p></div>
                <div><p className="font-medium text-muted-foreground">Date Disbursed</p><p>{loan.disbursalDate ? format(loan.disbursalDate.toDate(), 'PPP') : 'N/A'}</p></div>
                <div><p className="font-medium text-muted-foreground">Appraised By</p><p>{getUserName(loan.appraisedBy)}</p></div>
                <div><p className="font-medium text-muted-foreground">Approved By</p><p>{getUserName(loan.approvedBy)}</p></div>
                <div className="col-span-2"><p className="font-medium text-muted-foreground">Reversal Requested By</p><p>{getUserName(loan.reversalRequestedBy)}</p></div>
                <div className="col-span-2"><p className="font-medium text-muted-foreground">Reason</p><p>{loan.reversalReason}</p></div>
            </div>
          <CardHeader className="px-0"><CardTitle className="text-base">Officer's Notes</CardTitle></CardHeader>
          <Alert variant="default"><Info className="h-4 w-4" /><AlertDescription>{loan.reversalNotes}</AlertDescription></Alert>
        </CardContent>
      </Card>
    </>
  );

  const renderWriteOffContent = () => (
     <>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Approve Loan Write-Off</h1>
          <p className="text-muted-foreground mt-1">For {customer?.name}</p>
        </div>
         <div className="flex gap-2">
            <Button variant="outline" asChild>
                <Link href="/staff/loans/approvals"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Queue</Link>
            </Button>
            <Button variant="destructive" onClick={() => handleDecision('Rejected')} disabled={!!loading}>
                {loading === 'Rejected' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <X className="mr-2 h-4 w-4"/>} Reject
            </Button>
            <Button onClick={() => handleDecision('Written-Off')} disabled={!!loading}>
                {loading === 'Written-Off' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4"/>} Approve Write-Off
            </Button>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>Write-Off Details</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-3">
          <div className="flex justify-between"><span className="text-muted-foreground">Outstanding Amount:</span><span className="font-medium">MWK {loan.outstandingPrincipal.toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Requested By:</span><span className="font-medium">{loanOfficer?.name || '...'}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Reason:</span><span className="font-medium">{loan.writeOffReason}</span></div>
          <CardHeader className="px-0"><CardTitle className="text-base">Officer's Notes</CardTitle></CardHeader>
          <Alert variant="default"><Info className="h-4 w-4" /><AlertDescription>{loan.writeOffNotes}</AlertDescription></Alert>
        </CardContent>
      </Card>
    </>
  );

  const renderRescheduleContent = () => (
    <>
     <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
       <div>
         <h1 className="text-3xl font-bold tracking-tight">Approve Loan Reschedule</h1>
         <p className="text-muted-foreground mt-1">For {customer?.name}</p>
       </div>
        <div className="flex gap-2">
           <Button variant="outline" asChild>
               <Link href="/staff/loans/approvals/reschedules"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Queue</Link>
           </Button>
           <Button variant="destructive" onClick={() => handleDecision('Rejected')} disabled={!!loading}>
               {loading === 'Rejected' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <X className="mr-2 h-4 w-4"/>} Reject
           </Button>
           <Button onClick={() => handleDecision('Rescheduled')} disabled={!!loading}>
               {loading === 'Rescheduled' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4"/>} Approve Reschedule
           </Button>
       </div>
     </div>
     <Card>
       <CardHeader><CardTitle>Reschedule Details</CardTitle></CardHeader>
       <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
               <div><p className="font-medium text-muted-foreground">Original Loan ID</p><p>{loan.originalLoanId}</p></div>
               <div><p className="font-medium text-muted-foreground">Outstanding Principal</p><p>MWK {loan.amount.toLocaleString()}</p></div>
               <div><p className="font-medium text-muted-foreground">New Term</p><p>{loan.rescheduleDetails.newTerm} months</p></div>
               <div><p className="font-medium text-muted-foreground">New Interest Rate</p><p>{loan.rescheduleDetails.newInterestRate}%</p></div>
               <div className="col-span-2"><p className="font-medium text-muted-foreground">Requested By</p><p>{getUserName(loan.rescheduledBy)}</p></div>
           </div>
         <CardHeader className="px-0"><CardTitle className="text-base">Officer's Notes</CardTitle></CardHeader>
         <Alert variant="default"><Info className="h-4 w-4" /><AlertDescription>{loan.justification}</AlertDescription></Alert>
       </CardContent>
     </Card>
   </>
 );

  if (loan?.isRescheduled) {
    return renderRescheduleContent();
  }

  switch (loan.status) {
    case 'Pending Approval': return renderApprovalContent();
    case 'Reversal Pending': return renderReversalContent();
    case 'Write-Off Pending': return renderWriteOffContent();
    default: return (
        <Card className="text-center">
            <CardHeader>
                <CardTitle>Invalid Loan Status</CardTitle>
                <CardDescription>This loan is not in a state that requires approval.</CardDescription>
            </CardHeader>
            <CardContent>
                <p>Current Status: <span className="font-semibold">{loan.status}</span></p>
                <Button asChild variant="outline" className="mt-4"><Link href="/staff/loans/approvals"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Queue</Link></Button>
            </CardContent>
        </Card>
    )
  }
}

export default function LoanApprovalWrapperPage() {
    return (
        <Suspense fallback={<Skeleton className="h-screen w-full" />}>
            <LoanApprovalPageContent />
        </Suspense>
    )
}
    

    