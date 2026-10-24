'use client';

import { useState, useMemo, useEffect } from 'react';
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
  Timestamp,
  query,
  where,
  getDocs,
  limit,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Search,
  Loader2,
  Calculator,
  Send,
  ArrowLeft,
  CircleDollarSign,
  TrendingDown,
  Receipt,
  AlertCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { calculateAmortization } from '@/lib/finance';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const topUpSchema = z.object({
  customerId: z.string().min(1),
  loanId: z.string().min(1, "Please select an active loan."),
  topUpAmount: z.coerce.number().positive(),
});

type TopUpFormValues = z.infer<typeof topUpSchema>;

export default function LoanTopUpApplyPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [activeLoans, setActiveLoans] = useState<any[]>([]);
  const [loadingLoans, setLoadingLoans] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData, isLoading: isUserDataLoading } = useDoc(userDocRef);
  const institutionId = userData?.institutionId;
  const institutionDocRef = useMemoFirebase(
    () => (institutionId ? doc(firestore, 'institutions', institutionId) : null),
    [firestore, institutionId]
  );
  
  const productsQuery = useMemoFirebase(
    () =>
      firestore && userData?.institutionId
        ? collection(firestore, 'institutions', userData.institutionId, 'loanProducts')
        : null,
    [firestore, userData]
  );
  const { data: loanProducts, isLoading: isProductsLoading } = useCollection(productsQuery);
  
  const feesQuery = useMemoFirebase(
    () => (firestore && institutionId ? collection(firestore, 'institutions', institutionId, 'fees') : null),
    [firestore, institutionId]
  );
  const { data: allFees, isLoading: isFeesLoading } = useCollection(feesQuery);


  const form = useForm<TopUpFormValues>({
    resolver: zodResolver(topUpSchema),
    defaultValues: {
      customerId: '',
      loanId: '',
      topUpAmount: 0,
    }
  });
  
  const selectedLoanId = useWatch({ control: form.control, name: 'loanId' });
  const topUpAmount = useWatch({ control: form.control, name: 'topUpAmount' });
  const selectedLoan = activeLoans.find(l => l.id === selectedLoanId);
  const selectedProduct = loanProducts?.find(p => p.id === selectedLoan?.loanProductId);

  const applicableFees = useMemo(() => {
      if (!selectedProduct || !allFees) return [];
      const linkedFeeIds = selectedProduct.linkedFees || [];
      return allFees.filter(fee => linkedFeeIds.includes(fee.id) && fee.trigger === 'On Top-Up');
  }, [selectedProduct, allFees]);

  const totalFees = useMemo(() => {
      return applicableFees.reduce((sum, fee) => {
          if (fee.calculationMethod === 'Flat Amount') {
              return sum + (fee.amount || 0);
          }
          if (fee.calculationMethod === 'Percentage') {
              const baseAmount = fee.percentageOf === 'Approved Amount' ? topUpAmount : 0; // Simplified for now
              return sum + (baseAmount * ((fee.percentage || 0) / 100));
          }
          return sum;
      }, 0);
  }, [applicableFees, topUpAmount]);
  

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
        setSearchError("Please enter an account number to search.");
        return;
    }
    if (!firestore || !institutionId) {
      setSearchError("System not ready. Please try again in a moment.");
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    const customersRef = collection(firestore, 'institutions', institutionId, 'customers');
    const lowercasedSearchTerm = searchTerm.trim().toLowerCase();

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
      
      if (resultsMap.size > 0) {
          handleSelectCustomer(Array.from(resultsMap.values())[0]);
      } else {
        setSearchError('No customer found matching the search criteria.');
      }
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
    
    setLoadingLoans(true);
    if (!userData?.institutionId) {
        setLoadingLoans(false);
        return;
    }
    
    const loanAppsRef = collection(firestore, 'institutions', userData.institutionId, 'loanApplications');
    const runningLoansRef = collection(firestore, 'institutions', userData.institutionId, 'runningLoans');

    const activeStatuses = ['Disbursed', 'Overdue'];
    const loanAppsQuery = query(loanAppsRef, where('customerId', '==', customer.id), where('status', 'in', activeStatuses));
    const runningLoansQuery = query(runningLoansRef, where('customerId', '==', customer.id), where('status', 'in', activeStatuses));
    
    const [loanAppsSnap, runningLoansSnap] = await Promise.all([getDocs(loanAppsQuery), getDocs(runningLoansQuery)]);
    
    const allActiveLoans = [
        ...loanAppsSnap.docs.map(d => ({id:d.id, ...d.data()})),
        ...runningLoansSnap.docs.map(d => ({id:d.id, ...d.data()}))
    ];
    setActiveLoans(allActiveLoans);
    setLoadingLoans(false);
  };

  const onSubmit = async (values: TopUpFormValues) => {
    if (!selectedLoan || !user?.uid || !institutionId || !institutionDocRef) return;
  
    setIsSubmitting(true);
    try {
      await runTransaction(firestore, async (transaction) => {
        const instDoc = await transaction.get(institutionDocRef);
        if (!instDoc.exists()) {
          throw "Institution not found!";
        }
        const currentCounter = instDoc.data().loanCounter || 0;
        const newCounter = currentCounter + 1;
        const newLoanId = String(newCounter).padStart(7, '0');
  
        const loanAppsRef = collection(firestore, 'institutions', institutionId, 'loanApplications');
        const newLoanDocRef = doc(loanAppsRef, newLoanId);
  
        const newLoanData = {
          ...selectedLoan, 
          id: newLoanId,
          amount: Number(selectedLoan.outstandingPrincipal) + Number(values.topUpAmount),
          outstandingPrincipal: Number(selectedLoan.outstandingPrincipal) + Number(values.topUpAmount),
          term: selectedLoan.term,
          purpose: `Top-Up on loan ${selectedLoan.id}`,
          dateApplied: Timestamp.now(),
          submittedBy: user.uid,
          isTopUp: true,
          isRescheduled: false,
          originalLoanId: selectedLoan.id,
          topUpDetails: {
            outstandingBalance: selectedLoan.outstandingPrincipal,
            topUpAmount: values.topUpAmount,
          },
          status: 'Pending Approval',
          appraisedBy: user.uid, // Top-ups can be auto-appraised by the creator
          appraisalNotes: "Loan Top-Up application automatically appraised.",
          approvedBy: null,
          approvalDate: null,
          disbursalDate: null,
        };
  
        transaction.set(newLoanDocRef, newLoanData);
        transaction.update(institutionDocRef, { loanCounter: newCounter });
      });
  
      toast({
        title: "Top-Up Application Submitted",
        description: "The new consolidated loan application has been submitted for approval.",
      });
  
      form.reset();
      setSelectedCustomer(null);
      setActiveLoans([]);
  
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: "Error", description: "Failed to submit top-up application."});
    } finally {
      setIsSubmitting(false);
    }
  };

  const newTotalPrincipal = selectedLoan ? Number(selectedLoan.outstandingPrincipal) + Number(topUpAmount || 0) : 0;
  const netDisbursement = Number(topUpAmount || 0) - totalFees;
  
  const isLoading = isUserLoading || isUserDataLoading || isFeesLoading || isProductsLoading;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex items-center justify-between">
            <div>
            <h1 className="text-3xl font-bold tracking-tight">Apply for Loan Top-Up</h1>
            <p className="text-muted-foreground mt-1">
                Refinance an active loan with additional funds.
            </p>
            </div>
             <Button asChild variant="outline">
                <Link href="/staff/loans/top-up"><ArrowLeft className="mr-2 h-4 w-4"/> Back</Link>
            </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Step 1: Select Loan</CardTitle>
            <CardDescription>
              Search for a customer by their account number and select their active loan.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="flex items-center gap-2 max-w-lg">
                <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input placeholder="Search by Account Number, Name, Phone, or ID..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} disabled={!!selectedCustomer}/>
                </div>
                <Button type="button" onClick={handleSearch} disabled={isSearching || !searchTerm || !!selectedCustomer || isLoading}>
                    {isSearching || isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
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
            {searchError && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Search Failed</AlertTitle>
                <AlertDescription>{searchError}</AlertDescription>
              </Alert>
            )}
             {selectedCustomer && (
                <div className="pt-4 max-w-lg">
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
            <>
            <Card>
                <CardHeader><CardTitle>Step 2: Enter Top-Up Amount</CardTitle></CardHeader>
                <CardContent className="space-y-4 max-w-lg">
                    <FormField control={form.control} name="topUpAmount" render={({ field }) => (
                        <FormItem><FormLabel>Additional Funds Requested</FormLabel><FormControl><Input type="number" placeholder="Additional funds" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Step 3: Review and Submit</CardTitle></CardHeader>
                <CardContent>
                     <Table>
                        <TableBody>
                            <TableRow>
                                <TableCell className="text-muted-foreground">Current Outstanding Principal</TableCell>
                                <TableCell className="text-right font-mono">MWK {selectedLoan.outstandingPrincipal.toLocaleString()}</TableCell>
                            </TableRow>
                             <TableRow>
                                <TableCell className="text-muted-foreground">Top-Up Amount Requested</TableCell>
                                <TableCell className="text-right font-mono">MWK {Number(topUpAmount || 0).toLocaleString()}</TableCell>
                            </TableRow>
                             <TableRow className="font-bold text-lg">
                                <TableCell>New Total Principal</TableCell>
                                <TableCell className="text-right font-mono">MWK {newTotalPrincipal.toLocaleString()}</TableCell>
                            </TableRow>
                        </TableBody>
                     </Table>

                     {applicableFees.length > 0 && (
                         <div className="mt-6">
                            <h4 className="font-semibold mb-2">Applicable Fees (Deducted from Disbursement)</h4>
                            <Table>
                                <TableBody>
                                    {applicableFees.map(fee => (
                                        <TableRow key={fee.id}>
                                            <TableCell>{fee.name}</TableCell>
                                            <TableCell className="text-right font-mono">- MWK {totalFees.toLocaleString()}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                         </div>
                     )}
                     
                      <div className="mt-6 p-4 bg-primary/10 rounded-md border border-primary/20">
                          <div className="flex justify-between items-center text-lg font-bold text-primary">
                              <span>Net Cash Disbursed to Customer</span>
                              <span className="font-mono">MWK {netDisbursement.toLocaleString()}</span>
                          </div>
                      </div>

                </CardContent>
                <CardFooter className="flex justify-end">
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />}
                        Submit for Approval
                    </Button>
                </CardFooter>
            </Card>
            </>
        )}
      </form>
    </Form>
  );
}
