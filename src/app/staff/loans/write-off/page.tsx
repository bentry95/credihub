
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  useUser,
  useFirestore,
  useDoc,
  useMemoFirebase,
} from '@/firebase';
import {
  collection,
  doc,
  query,
  where,
  getDocs,
  limit,
  updateDoc,
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
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Loader2, Send, FileX } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

const writeOffSchema = z.object({
  loanId: z.string().min(1, 'Please select a loan to write-off.'),
  reason: z.string().min(1, 'Please select a reason.'),
  notes: z.string().min(10, 'Detailed notes are required.'),
});

export default function LoanWriteOffPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [delinquentLoans, setDelinquentLoans] = useState<any[]>([]);
  const [loadingLoans, setLoadingLoans] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);
  const institutionId = userData?.institutionId;

  const form = useForm<z.infer<typeof writeOffSchema>>({
    resolver: zodResolver(writeOffSchema),
  });

  useEffect(() => {
    if (searchTerm.length < 3 || !firestore || !institutionId) {
      setSearchResults([]);
      return;
    }
    const performSearch = async () => {
      setIsSearching(true);
      const customersRef = collection(firestore, 'institutions', institutionId, 'customers');
      const nameQuery = query(customersRef, where('name', '>=', searchTerm), where('name', '<=', searchTerm + '\uf8ff'), limit(5));
      const snap = await getDocs(nameQuery);
      setSearchResults(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setIsSearching(false);
    };
    const debounce = setTimeout(performSearch, 300);
    return () => clearTimeout(debounce);
  }, [searchTerm, firestore, institutionId]);

  const handleSelectCustomer = async (customer: any) => {
    setSelectedCustomer(customer);
    setSearchTerm('');
    setSearchResults([]);
    
    setLoadingLoans(true);
    if (!institutionId) {
        setLoadingLoans(false);
        return;
    }
    const loanAppsRef = collection(firestore, 'institutions', institutionId, 'loanApplications');
    const runningLoansRef = collection(firestore, 'institutions', institutionId, 'runningLoans');
    
    const overdueStatus = ['Overdue'];
    const loanAppsQuery = query(loanAppsRef, where('customerId', '==', customer.id), where('status', 'in', overdueStatus));
    const runningLoansQuery = query(runningLoansRef, where('customerId', '==', customer.id), where('status', 'in', overdueStatus));

    const [loanAppsSnap, runningLoansSnap] = await Promise.all([
        getDocs(loanAppsQuery),
        getDocs(runningLoansQuery),
    ]);

    const allLoans = [
        ...loanAppsSnap.docs.map(d => ({...d.data(), id: d.id, collectionPath: 'loanApplications'})),
        ...runningLoansSnap.docs.map(d => ({...d.data(), id: d.id, collectionPath: 'runningLoans'}))
    ];
    setDelinquentLoans(allLoans);
    setLoadingLoans(false);
  };
  
  async function onSubmit(values: z.infer<typeof writeOffSchema>) {
    if (!user || !institutionId) return;

    const selectedLoan = delinquentLoans.find(loan => loan.id === values.loanId);
    if (!selectedLoan) {
        toast({ variant: 'destructive', title: "Error", description: "Selected loan not found." });
        return;
    }

    setIsSubmitting(true);
    try {
        const originalLoanRef = doc(firestore, 'institutions', institutionId, selectedLoan.collectionPath, values.loanId);
        
        if (selectedLoan.collectionPath === 'runningLoans') {
            await runTransaction(firestore, async (transaction) => {
                const loanAppDocRef = doc(firestore, 'institutions', institutionId, 'loanApplications', values.loanId);
                transaction.set(loanAppDocRef, selectedLoan);
                transaction.delete(originalLoanRef);
            });
        }
        
        const finalLoanRef = doc(firestore, 'institutions', institutionId, 'loanApplications', values.loanId);
        await updateDoc(finalLoanRef, {
            status: 'Write-Off Pending',
            writeOffReason: values.reason,
            writeOffNotes: values.notes,
            writeOffRequestedBy: user.uid,
        });

        toast({
            title: "Write-Off Request Submitted",
            description: "The request has been sent for supervisory approval.",
        });

        form.reset();
        setSelectedCustomer(null);
        setDelinquentLoans([]);
        router.push('/staff/loans/all-applications');
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: "Error", description: "Failed to submit write-off request." });
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Loan Write-Off</h1>
          <p className="text-muted-foreground mt-1">
            Initiate a request to write-off an uncollectible loan.
          </p>
        </div>
      </div>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Step 1: Select Delinquent Loan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="relative max-w-lg">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                            placeholder="Search for a customer..."
                            className="pl-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            disabled={!!selectedCustomer}
                        />
                        {searchResults.length > 0 && (
                            <Card className="absolute top-full mt-2 w-full z-10"><CardContent className="p-2">
                                {isSearching ? <div className="p-2">Searching...</div> : searchResults.map(c => (
                                <div key={c.id} onClick={() => handleSelectCustomer(c)} className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer">
                                    <Avatar className="h-8 w-8"><AvatarImage src={c.photoUrl} /><AvatarFallback>{c.name.charAt(0)}</AvatarFallback></Avatar>
                                    <div><p className="text-sm font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.accountNumber}</p></div>
                                </div>
                                ))}
                            </CardContent></Card>
                        )}
                    </div>
                     {selectedCustomer && (
                        <div className="pt-4">
                            <FormField control={form.control} name="loanId" render={({ field }) => (
                                <FormItem><FormLabel>Select Overdue Loan for {selectedCustomer.name}</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder={loadingLoans ? "Loading loans..." : "Select an overdue loan"} /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {delinquentLoans.length > 0 ? delinquentLoans.map(loan => <SelectItem key={loan.id} value={loan.id}>Loan ID: {loan.id.substring(0,8)}... - Outstanding: MWK {loan.outstandingPrincipal.toLocaleString()}</SelectItem>) : <SelectItem value="none" disabled>No overdue loans found</SelectItem>}
                                        </SelectContent>
                                    </Select>
                                <FormMessage /></FormItem>
                            )} />
                        </div>
                    )}
                </CardContent>
            </Card>

            {form.watch('loanId') && (
                 <Card>
                    <CardHeader>
                        <CardTitle>Step 2: Justification</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FormField control={form.control} name="reason" render={({ field }) => (
                            <FormItem><FormLabel>Reason for Write-Off</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a reason..." /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="Deceased">Borrower Deceased</SelectItem>
                                        <SelectItem value="Unrecoverable">Debt is Unrecoverable</SelectItem>
                                        <SelectItem value="Fraud">Confirmed Fraud</SelectItem>
                                        <SelectItem value="Other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            <FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="notes" render={({ field }) => (
                            <FormItem><FormLabel>Detailed Notes</FormLabel><FormControl><Textarea placeholder="Provide a clear and detailed explanation for the write-off request, including collection efforts made..." {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                    </CardContent>
                    <CardFooter className="flex justify-end">
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4" />}
                            Submit for Approval
                        </Button>
                    </CardFooter>
                </Card>
            )}
        </form>
      </Form>
    </div>
  );
}
