'use client';

import { useState, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  useUser,
  useFirestore,
  useMemoFirebase,
  useDoc,
  useCollection,
} from '@/firebase';
import {
  collection,
  doc,
  query,
  where,
  getDocs,
  limit,
  updateDoc,
  arrayUnion,
  Timestamp,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Search,
  Loader2,
  Send,
  ArrowLeft,
  Calculator,
  Receipt,
  TrendingDown,
  CircleDollarSign,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { calculateAmortization } from '@/lib/finance';
import { Skeleton } from '@/components/ui/skeleton';

const rescheduleSchema = z.object({
  customerId: z.string().min(1, 'A customer must be selected.'),
  loanId: z.string().min(1, "Please select an active loan."),
  newInterestRate: z.coerce.number().positive(),
  newTerm: z.coerce.number().int().positive(),
  justification: z.string().min(10, 'A clear justification is required.'),
});

type RescheduleFormValues = z.infer<typeof rescheduleSchema>;

export default function RescheduleApplyPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [activeLoans, setActiveLoans] = useState<any[]>([]);
  const [loadingLoans, setLoadingLoans] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);
  const institutionId = userData?.institutionId;
  
   const productsQuery = useMemoFirebase(
    () =>
      firestore && userData?.institutionId
        ? collection(firestore, 'institutions', userData.institutionId, 'loanProducts')
        : null,
    [firestore, userData]
  );
  const { data: loanProducts, isLoading: isProductsLoading } = useCollection(productsQuery);

  const form = useForm<RescheduleFormValues>({
    resolver: zodResolver(rescheduleSchema),
  });
  
  const { control, watch } = form;
  const selectedLoanId = watch('loanId');
  const newTerm = watch('newTerm');
  const newInterestRate = watch('newInterestRate');

  const selectedLoan = activeLoans.find(l => l.id === selectedLoanId);
  const selectedProduct = loanProducts?.find(p => p.id === selectedLoan?.loanProductId);

  const currentAmortization = useMemo(() => {
    if (!selectedLoan || !selectedProduct) return { monthlyInstallment: 0 };
    return calculateAmortization({
        principal: selectedLoan.amount,
        annualInterestRate: selectedLoan.annualInterestRate || selectedProduct.annualInterestRate,
        term: selectedLoan.term,
        tenureUnit: selectedLoan.tenureUnit || 'Months',
        interestRateType: selectedProduct.interestRateType,
        startDate: selectedLoan.disbursalDate?.toDate(),
    });
  }, [selectedLoan, selectedProduct]);

  const newAmortization = useMemo(() => {
    if (!selectedLoan || !selectedProduct || !newTerm || !newInterestRate) {
        return { monthlyInstallment: 0, totalPayment: 0, totalInterest: 0, schedule: [] };
    }
    return calculateAmortization({
        principal: selectedLoan.outstandingPrincipal,
        annualInterestRate: newInterestRate,
        term: newTerm,
        tenureUnit: 'Months', // Reschedule is always in months
        interestRateType: selectedProduct.interestRateType,
        startDate: new Date(),
    });
  }, [selectedLoan, selectedProduct, newTerm, newInterestRate]);

  const handleSearch = async () => {
    if (searchTerm.length < 3 || !firestore || !institutionId) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const customersRef = collection(firestore, 'institutions', institutionId, 'customers');
    const lowercasedSearchTerm = searchTerm.toLowerCase();

    const nameQuery = query(customersRef, where('name_lowercase', '>=', lowercasedSearchTerm), where('name_lowercase', '<=', lowercasedSearchTerm + '\uf8ff'), limit(5));
    const accountNumberQuery = query(customersRef, where('accountNumber_lowercase', '==', lowercasedSearchTerm), limit(5));

    const [nameSnap, accountNumberSnap] = await Promise.all([
      getDocs(nameQuery),
      getDocs(accountNumberQuery),
    ]);

    const resultsMap = new Map();
    nameSnap.forEach(doc => resultsMap.set(doc.id, { id: doc.id, ...doc.data() }));
    accountNumberSnap.forEach(doc => resultsMap.set(doc.id, { id: doc.id, ...doc.data() }));
    
    setSearchResults(Array.from(resultsMap.values()));
    setIsSearching(false);
  };

  const handleSelectCustomer = async (customer: any) => {
    setSelectedCustomer(customer);
    form.setValue('customerId', customer.id);
    setSearchTerm('');
    setSearchResults([]);
    
    setLoadingLoans(true);
    if (!userData?.institutionId) {
        setLoadingLoans(false);
        return;
    }

    const loanAppsRef = collection(firestore, 'institutions', userData.institutionId, 'loanApplications');
    const runningLoansRef = collection(firestore, 'institutions', userData.institutionId, 'runningLoans');
    
    const activeStatuses = ['Disbursed', 'Overdue'];
    const q1 = query(loanAppsRef, where('customerId', '==', customer.id), where('status', 'in', activeStatuses));
    const q2 = query(runningLoansRef, where('customerId', '==', customer.id), where('status', 'in', activeStatuses));

    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    const allActiveLoans = [
        ...snap1.docs.map(d => ({id:d.id, ...d.data(), sourceCollection: 'loanApplications'})),
        ...snap2.docs.map(d => ({id:d.id, ...d.data(), sourceCollection: 'runningLoans'}))
    ];

    setActiveLoans(allActiveLoans);
    setLoadingLoans(false);
  };

  const onSubmit = async (values: RescheduleFormValues) => {
    if (!selectedLoan || !user?.uid || !institutionId) return;
  
    setIsSubmitting(true);
    try {
      const loanDocRef = doc(firestore, 'institutions', institutionId, selectedLoan.sourceCollection, selectedLoan.id);

      await updateDoc(loanDocRef, {
          status: 'Pending Approval',
          rescheduleDetails: {
              newTerm: values.newTerm,
              newInterestRate: values.newInterestRate,
          },
          rescheduledBy: user.uid,
          isRescheduled: true,
          justification: values.justification,
          auditHistory: arrayUnion({
            userId: user.uid,
            timestamp: Timestamp.now(),
            action: 'Reschedule Requested',
            details: `Requested to change term to ${values.newTerm} months and rate to ${values.newInterestRate}%. Reason: ${values.justification}`
          })
      });
  
      toast({
        title: "Reschedule Submitted",
        description: "The loan reschedule request has been submitted for approval.",
      });
  
      form.reset();
      setSelectedCustomer(null);
      setActiveLoans([]);
      router.push('/staff/loans/reschedule');
  
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: "Error", description: "Failed to submit reschedule application."});
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex items-center justify-between">
            <div>
            <h1 className="text-3xl font-bold tracking-tight">Apply for Loan Reschedule</h1>
            <p className="text-muted-foreground mt-1">
                Find a customer to begin modifying an active loan.
            </p>
            </div>
             <Button asChild variant="outline">
                <Link href="/staff/loans/reschedule"><ArrowLeft className="mr-2 h-4 w-4"/> Back</Link>
            </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Step 1: Select Loan</CardTitle>
            <CardDescription>
              Search for a customer and select one of their active loans to reschedule.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="flex items-center gap-2 max-w-lg">
                <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input placeholder="Search for a customer by name, account no, etc..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} disabled={!!selectedCustomer}/>
                </div>
                <Button type="button" onClick={handleSearch} disabled={isSearching || !searchTerm || !!selectedCustomer}>
                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
                </Button>
                 {searchResults.length > 0 && (
                    <Card className="absolute top-full mt-2 w-full z-10 max-w-lg">
                        <CardContent className="p-2">
                        {isSearching ? <div className="p-2">Searching...</div> : searchResults.map(c => (
                            <div key={c.id} onClick={() => handleSelectCustomer(c)} className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer">
                                <Avatar className="h-8 w-8"><AvatarImage src={c.photoUrl} /><AvatarFallback>{c.name.charAt(0)}</AvatarFallback></Avatar>
                                <div><p className="text-sm font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.accountNumber}</p></div>
                            </div>
                        ))}
                        </CardContent>
                    </Card>
                )}
            </div>
             {selectedCustomer && (
                <div className="pt-4">
                    <FormField control={form.control} name="loanId" render={({ field }) => (
                        <FormItem><FormLabel>Select Active Loan for {selectedCustomer.name}</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder={loadingLoans ? "Loading loans..." : "Select an active loan"} /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {activeLoans.map(loan => <SelectItem key={loan.id} value={loan.id}>Loan ID: {loan.id.substring(0,8)}... - Outstanding: MWK {loan.outstandingPrincipal.toLocaleString()}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        <FormMessage /></FormItem>
                    )} />
                </div>
            )}
          </CardContent>
        </Card>
        
        {selectedLoan && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Current Loan Stance</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                        <div className="p-4 bg-muted rounded-md"><p className="text-sm text-muted-foreground">Outstanding Principal</p><p className="text-lg font-bold">MWK {selectedLoan.outstandingPrincipal.toLocaleString()}</p></div>
                        <div className="p-4 bg-muted rounded-md"><p className="text-sm text-muted-foreground">Current Term</p><p className="text-lg font-bold">{selectedLoan.term} Months</p></div>
                        <div className="p-4 bg-muted rounded-md"><p className="text-sm text-muted-foreground">Current Interest Rate</p><p className="text-lg font-bold">{(selectedLoan.annualInterestRate || selectedProduct?.annualInterestRate || 0)}%</p></div>
                        <div className="p-4 bg-muted rounded-md"><p className="text-sm text-muted-foreground">Current Installment</p><p className="text-lg font-bold">MWK {currentAmortization.monthlyInstallment.toLocaleString('en-US', {minimumFractionDigits: 2})}</p></div>
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader>
                        <CardTitle>Step 2: Define New Terms</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="newInterestRate" render={({ field }) => (
                                <FormItem><FormLabel>New Annual Interest Rate (%)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                            <FormField control={form.control} name="newTerm" render={({ field }) => (
                                <FormItem><FormLabel>New Term (in months)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                            )}/>
                        </div>
                        <FormField control={form.control} name="justification" render={({ field }) => (
                            <FormItem><FormLabel>Reason for Reschedule</FormLabel><FormControl><Textarea placeholder="Explain why this loan is being rescheduled..." {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Step 3: Review Proposed Changes</CardTitle>
                        <CardDescription>This is an estimate based on the new terms provided.</CardDescription>
                    </CardHeader>
                     <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">New Installment</CardTitle><Receipt className="h-4 w-4 text-muted-foreground"/></CardHeader>
                                <CardContent><p className="text-2xl font-bold">MWK {newAmortization.monthlyInstallment > 0 ? newAmortization.monthlyInstallment.toLocaleString('en-US', {minimumFractionDigits: 2}) : '-'}</p></CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">New Total Interest</CardTitle><TrendingDown className="h-4 w-4 text-muted-foreground"/></CardHeader>
                                <CardContent><p className="text-2xl font-bold">MWK {newAmortization.totalInterest > 0 ? newAmortization.totalInterest.toLocaleString('en-US', {minimumFractionDigits: 2}) : '-'}</p></CardContent>
                            </Card>
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-end">
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />}
                            Submit for Approval
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        )}
      </form>
    </Form>
  );
}
