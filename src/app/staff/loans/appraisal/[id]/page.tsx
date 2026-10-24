

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
import { doc, updateDoc, arrayUnion, Timestamp, getDoc } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
  CardDescription,
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
import { Loader2, CheckCircle, XCircle, BarChart, Info, Scale, ArrowLeft, ShieldCheck, Users, Paperclip, ExternalLink, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { findCustomerWithNationalId } from '@/lib/customer-identification';
import Link from 'next/link';
import Image from 'next/image';

const appraisalSchema = z.object({
    appraisedAmount: z.coerce.number().positive(),
    appraisedTerm: z.coerce.number().int().positive(),
    appraisalNotes: z.string().min(2, "Appraisal notes must be at least 2 characters long."),
});

function AppraisalPageContent() {
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
  const [loanProduct, setLoanProduct] = useState<any>(null);
  const [submittedBy, setSubmittedBy] = useState<any>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [currentUserData, setCurrentUserData] = useState<any>(null);

  const [institutionId, setInstitutionId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserAndInstitution() {
      if (user && firestore) {
        const userDocRef = doc(firestore, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setInstitutionId(userData.institutionId);
          setCurrentUserData(userData);
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
        const submittedByDocRef = doc(firestore, 'users', loanData.submittedBy);

        const [customerSnap, productSnap, submittedBySnap] = await Promise.all([
          getDoc(customerDocRef),
          getDoc(productDocRef),
          getDoc(submittedByDocRef),
        ]);

        if (customerSnap.exists()) setCustomer({ id: customerSnap.id, ...customerSnap.data() });
        if (productSnap.exists()) setLoanProduct({ id: productSnap.id, ...productSnap.data() });
        if (submittedBySnap.exists()) setSubmittedBy({ id: submittedBySnap.id, ...submittedBySnap.data() });

      } catch (e) {
        console.error("Error fetching related loan data:", e);
        setError("Failed to load all loan details.");
      } finally {
        setIsDataLoading(false);
      }
    };

    fetchLoanData();
  }, [institutionId, loanId, firestore]);


  const form = useForm<z.infer<typeof appraisalSchema>>({
    resolver: zodResolver(appraisalSchema),
  });
  
  useEffect(() => {
    if(loan) {
        form.reset({
            appraisedAmount: loan.amount,
            appraisedTerm: loan.term,
            appraisalNotes: loan.appraisalNotes || '',
        })
    }
  }, [loan, form]);


  const handleSendBack = async () => {
    if (!loan || !user || !institutionId) return;
    setLoading('SendBack');
    const loanDocRef = doc(firestore, 'institutions', institutionId, 'loanApplications', loanId);
    try {
        const customerSnapshot = await getDoc(doc(firestore, 'institutions', institutionId, 'customers', loan.customerId));
        if (customerSnapshot.exists() && await findCustomerWithNationalId(firestore, institutionId, customerSnapshot.data().idNumber, loan.customerId)) {
            throw new Error('This loan cannot be edited while the customer has a duplicate national ID. Resolve it in KYC Alerts first.');
        }
        await updateDoc(loanDocRef, {
            status: 'Application',
            appraisedBy: null,
            auditHistory: arrayUnion({
                userId: user.uid,
                timestamp: new Date(),
                action: 'Sent Back to Application',
                details: 'Loan sent back from Appraisal stage.'
            })
        });
        toast({ title: 'Loan Sent Back', description: 'The application has been returned to the "Application" stage.' });
        router.push('/staff/loans/all-applications');
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: e instanceof Error ? e.message : 'Failed to send the loan back.' });
    } finally {
        setLoading(null);
    }
  }


  async function handleDecision(decision: 'Recommend' | 'Reject') {
    if (!loan || !user || !institutionId) return;

    await form.trigger();
    if (!form.formState.isValid) {
        toast({
            variant: "destructive",
            title: "Validation Error",
            description: "Please fill in all required fields before making a decision.",
        });
        return;
    }
    
    const values = form.getValues();
    setLoading(decision);
    const loanDocRef = doc(firestore, 'institutions', institutionId, 'loanApplications', loanId);

    try {
        const customerSnapshot = await getDoc(doc(firestore, 'institutions', institutionId, 'customers', loan.customerId));
        if (customerSnapshot.exists() && await findCustomerWithNationalId(firestore, institutionId, customerSnapshot.data().idNumber, loan.customerId)) {
            throw new Error('This loan cannot be edited while the customer has a duplicate national ID. Resolve it in KYC Alerts first.');
        }
        const newStatus = decision === 'Recommend' ? 'Pending Approval' : 'Rejected';
        await updateDoc(loanDocRef, {
            status: newStatus,
            amount: values.appraisedAmount,
            term: values.appraisedTerm,
            appraisalNotes: values.appraisalNotes,
            appraisalDate: new Date(),
            auditHistory: arrayUnion({
                userId: user.uid,
                timestamp: new Date(),
                action: `Appraisal ${decision}`,
                details: `Loan appraised and ${decision.toLowerCase()}ed with amount MWK ${values.appraisedAmount} for ${values.appraisedTerm} months.`
            })
        });

        toast({
            title: `Loan ${newStatus}`,
            description: `The loan for ${customer?.name} has been ${newStatus.toLowerCase()}.`,
        });
        router.push('/staff/loans/appraisal');
    } catch(e) {
        console.error(e);
        toast({
            variant: "destructive",
            title: "Error",
            description: e instanceof Error ? e.message : "Failed to update loan status. Please try again.",
        });
    } finally {
        setLoading(null);
    }
  }

  const isLoading = isDataLoading;
  
  const appraisalLimit = currentUserData?.appraisalLimit ?? 0;
  const exceedsLimit = loan && appraisalLimit > 0 && loan.amount > appraisalLimit;

  if (isLoading) {
    return (
        <div className="space-y-6">
            <Skeleton className="h-10 w-1/3" />
            <Skeleton className="h-6 w-1/2" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <Skeleton className="h-48 w-full" />
                    <Skeleton className="h-32 w-full" />
                </div>
                <Skeleton className="h-96 w-full" />
            </div>
        </div>
    );
  }

  if (error || !loan) {
      return (
        <Card className="text-center max-w-lg mx-auto">
            <CardHeader>
                <CardTitle className="text-destructive">{error || "Loan Not Found"}</CardTitle>
                <CardDescription>The requested loan application could not be found.</CardDescription>
            </CardHeader>
            <CardContent>
               <Button variant="outline" asChild className="mt-4">
                    <Link href="/staff/loans/appraisal"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Queue</Link>
                </Button>
            </CardContent>
        </Card>
      )
  }

  return (
    <Form {...form}>
        <form className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">Loan Appraisal: {customer?.name}</h1>
                  <p className="text-muted-foreground mt-1">
                    Review the application details and make a recommendation.
                  </p>
                </div>
                <Button variant="outline" asChild>
                    <Link href="/staff/loans/appraisal"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Queue</Link>
                </Button>
            </div>
            
            {exceedsLimit && (
                <Alert variant="destructive">
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Appraisal Limit Exceeded</AlertTitle>
                    <AlertDescription>
                        This loan amount of <strong>MWK {loan.amount.toLocaleString()}</strong> exceeds your appraisal limit of <strong>MWK {appraisalLimit.toLocaleString()}</strong>. You may review the details but cannot recommend it for approval.
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-2 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader><CardTitle className="text-lg">Loan Request</CardTitle></CardHeader>
                            <CardContent className="text-sm space-y-2">
                                <div className="flex justify-between"><span className="text-muted-foreground">Amount:</span> <span className="font-medium">MWK {loan?.amount.toLocaleString()}</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Term:</span> <span className="font-medium">{loan?.term} months</span></div>
                                <div className="flex justify-between"><span className="text-muted-foreground">Purpose:</span> <span className="font-medium">{loan?.purpose}</span></div>
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader><CardTitle className="text-lg">Eligibility & Compliance</CardTitle></CardHeader>
                            <CardContent className="text-sm space-y-2">
                                <div className="flex justify-between items-center"><span className="text-muted-foreground flex items-center gap-2"><Scale className="h-4 w-4" /> Amount within limit:</span> {loan?.amount <= (loanProduct?.maxAmount ?? Infinity) ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-destructive" />}</div>
                                <div className="flex justify-between items-center"><span className="text-muted-foreground flex items-center gap-2"><BarChart className="h-4 w-4" /> Term within limit:</span> {loan?.term <= (loanProduct?.maxTerm ?? Infinity) ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-destructive" />}</div>
                            </CardContent>
                        </Card>
                    </div>
                     <Card>
                        <CardHeader><CardTitle className="text-lg">Customer Financials</CardTitle></CardHeader>
                        <CardContent className="text-sm space-y-2">
                             <div className="flex justify-between"><span className="text-muted-foreground">Monthly Income:</span> <span className="font-medium">MWK {customer?.primaryIncome?.toLocaleString()}</span></div>
                        </CardContent>
                    </Card>

                    {loan.collateral && loan.collateral.length > 0 && (
                        <Card>
                            <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-muted-foreground"/> Collateral</CardTitle></CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Description</TableHead><TableHead>Value</TableHead><TableHead>Photo</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {loan.collateral.map((item: any, index: number) => (
                                            <TableRow key={index}>
                                                <TableCell>{item.type}</TableCell>
                                                <TableCell>{item.description}</TableCell>
                                                <TableCell>MWK {item.estimatedValue.toLocaleString()}</TableCell>
                                                <TableCell>
                                                    {item.photo && <Link href={item.photo} target="_blank" className="text-primary hover:underline"><Image src={item.photo} alt={item.type} width={40} height={40} className="rounded-md object-cover"/></Link>}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}

                    {loan.guarantors && loan.guarantors.length > 0 && (
                        <Card>
                            <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-muted-foreground"/> Guarantors</CardTitle></CardHeader>
                             <CardContent>
                                <Table>
                                    <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>ID Number</TableHead><TableHead>Phone</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {loan.guarantors.map((item: any, index: number) => (
                                            <TableRow key={index}><TableCell>{item.name}</TableCell><TableCell>{item.idNumber}</TableCell><TableCell>{item.phone}</TableCell></TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}

                    {loan.documents && loan.documents.length > 0 && (
                        <Card>
                            <CardHeader><CardTitle className="flex items-center gap-2"><Paperclip className="h-5 w-5 text-muted-foreground"/> Supporting Documents</CardTitle></CardHeader>
                             <CardContent>
                                <Table>
                                    <TableHeader><TableRow><TableHead>Document Type</TableHead><TableHead>File Name</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {loan.documents.map((item: any, index: number) => (
                                            <TableRow key={index}>
                                                <TableCell>{item.type}</TableCell>
                                                <TableCell>{item.fileName}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="outline" size="sm" asChild><Link href={item.file} target="_blank">View <ExternalLink className="ml-2 h-4 w-4"/></Link></Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}

                </div>
                <Card className="lg:col-span-1 bg-muted/50">
                    <CardHeader><CardTitle className="text-lg">Your Recommendation</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <FormField control={form.control} name="appraisedAmount" render={({ field }) => (
                            <FormItem><FormLabel>Recommended Amount</FormLabel><FormControl><Input type="number" {...field}/></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="appraisedTerm" render={({ field }) => (
                            <FormItem><FormLabel>Recommended Term (Months)</FormLabel><FormControl><Input type="number" {...field}/></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="appraisalNotes" render={({ field }) => (
                            <FormItem><FormLabel>Appraisal Notes (Mandatory)</FormLabel><FormControl><Textarea placeholder="Justification for the decision..." {...field}/></FormControl><FormMessage /></FormItem>
                        )} />
                    </CardContent>
                    <CardFooter className="flex flex-col gap-2">
                         <Button onClick={() => handleDecision('Recommend')} disabled={!!loading || exceedsLimit} className="w-full">
                            {loading === 'Recommend' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4"/>}
                            Recommend for Approval
                        </Button>
                        <Button variant="destructive" onClick={() => handleDecision('Reject')} disabled={!!loading} className="w-full">
                            {loading === 'Reject' && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            <XCircle className="mr-2 h-4 w-4"/> Reject Application
                        </Button>
                        <Button variant="outline" onClick={handleSendBack} disabled={!!loading} className="w-full mt-4">
                            {loading === 'SendBack' && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Send Back to Application Stage
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </form>
    </Form>
  );
}

export default function LoanAppraisalPage() {
    return (
        <Suspense fallback={<div className="space-y-4">
              <Skeleton className="h-10 w-1/4" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-96 w-full" />
          </div>}>
            <AppraisalPageContent />
        </Suspense>
    )
}
