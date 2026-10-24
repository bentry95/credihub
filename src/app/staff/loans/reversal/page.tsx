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
  useCollection,
} from '@/firebase';
import { collection, doc, query, where, getDocs, updateDoc, limit, runTransaction } from 'firebase/firestore';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Loader2, AlertCircle, Undo, Send, FileWarning, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


const reversalSchema = z.object({
  customerId: z.string().min(1),
  loanId: z.string().min(1, 'Please select a loan to reverse.'),
  reason: z.string().min(10, 'A clear reason for reversal is required.'),
  notes: z.string().optional(),
});

export default function TransactionReversalPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [activeLoans, setActiveLoans] = useState<any[]>([]);
  const [loadingLoans, setLoadingLoans] = useState(false);
  const [reversalLoading, setReversalLoading] = useState(false);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);
  const institutionId = userData?.institutionId;
  
  const staffQuery = useMemoFirebase(
    () =>
      firestore && institutionId
        ? query(collection(firestore, 'users'), where('institutionId', '==', institutionId))
        : null,
    [firestore, institutionId]
  );
  const { data: staff, isLoading: isStaffLoading } = useCollection(staffQuery);

  const form = useForm<z.infer<typeof reversalSchema>>({
    resolver: zodResolver(reversalSchema),
  });
  
  const selectedLoanId = form.watch('loanId');
  const selectedLoan = activeLoans.find(l => l.id === selectedLoanId);

  const getStaffName = (staffId: string) => {
    if (!staff) return '...';
    return staff.find(s => s.uid === staffId)?.name || 'Unknown User';
  }
  
  const handleSearch = async () => {
    if (searchTerm.length < 3 || !firestore || !institutionId) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    setSearchError(null);
    const customersRef = collection(firestore, 'institutions', institutionId, 'customers');
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
        
        if (resultsMap.size === 0) {
            setSearchError("No customer found matching the criteria.");
        }
        setSearchResults(Array.from(resultsMap.values()));
    } catch(e) {
        console.error(e);
        setSearchError("An error occurred while searching.");
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
    if (!institutionId) return;
    const loanAppsRef = collection(firestore, 'institutions', institutionId, 'loanApplications');
    const runningLoansRef = collection(firestore, 'institutions', institutionId, 'runningLoans');
    const loanQuery = query(loanAppsRef, where('customerId', '==', customer.id), where('status', '==', 'Disbursed'));
    const runningLoanQuery = query(runningLoansRef, where('customerId', '==', customer.id), where('status', 'in', ['Disbursed', 'Overdue']));
    
    const [loanAppsSnap, runningLoansSnap] = await Promise.all([getDocs(loanQuery), getDocs(runningLoansQuery)]);
    
    const allLoans = [
        ...loanAppsSnap.docs.map(d => ({...d.data(), id: d.id, sourceCollection: 'loanApplications' })),
        ...runningLoansSnap.docs.map(d => ({...d.data(), id: d.id, sourceCollection: 'runningLoans' }))
    ];
    setActiveLoans(allLoans);
    setLoadingLoans(false);
  };
  
  async function onSubmit(values: z.infer<typeof reversalSchema>) {
    if (!firestore || !institutionId || !user?.uid) return;
    
    setReversalLoading(true);
    const selectedLoan = activeLoans.find(l => l.id === values.loanId);
    if (!selectedLoan) {
      toast({ variant: 'destructive', title: 'Error', description: 'Selected loan not found.' });
      setReversalLoading(false);
      return;
    }

    try {
        const loanDocRef = doc(firestore, 'institutions', institutionId, selectedLoan.sourceCollection, values.loanId);
        
        if(selectedLoan.sourceCollection === 'runningLoans') {
            await runTransaction(firestore, async (transaction) => {
                const loanAppDocRef = doc(firestore, 'institutions', institutionId, 'loanApplications', values.loanId);
                transaction.set(loanAppDocRef, selectedLoan);
                transaction.delete(loanDocRef);
            });
        }
        
        const finalLoanRef = doc(firestore, 'institutions', institutionId, 'loanApplications', values.loanId);
        await updateDoc(finalLoanRef, {
            status: 'Reversal Pending',
            reversalReason: values.reason,
            reversalNotes: values.notes || null,
            reversalRequestedBy: user.uid,
        });

      toast({
        title: "Reversal Request Submitted",
        description: "The loan reversal has been sent for approval.",
      });

      setSelectedCustomer(null);
      setActiveLoans([]);
      form.reset();

    } catch (e: any) {
        console.error(e);
        toast({ variant: "destructive", title: "Error", description: "Failed to submit reversal request." });
    } finally {
        setReversalLoading(false);
    }
  }


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Loan Reversal Request</h1>
          <p className="text-muted-foreground mt-1">
            Request to reverse a disbursed loan transaction.
          </p>
        </div>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Step 1: Find Loan to Reverse</CardTitle>
              <CardDescription>
                Search for a customer and select the disbursed loan you wish to reverse.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 max-w-sm relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Search by name, ID, phone..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  disabled={!!selectedCustomer}
                />
                <Button type="button" onClick={handleSearch} disabled={isSearching || !searchTerm || !!selectedCustomer}>
                  {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Search'}
                </Button>
                {searchResults.length > 0 && (
                  <Card className="absolute top-full mt-2 w-full z-10">
                    <CardContent className="p-2">
                      {isSearching ? (
                        <div className="p-4 text-center">Loading...</div>
                      ) : (
                        searchResults.map((customer) => (
                          <div
                            key={customer.id}
                            className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer"
                            onClick={() => handleSelectCustomer(customer)}
                          >
                            <Avatar><AvatarImage src={customer.photoUrl} /><AvatarFallback>{customer.name.charAt(0)}</AvatarFallback></Avatar>
                            <div><div className="font-medium">{customer.name}</div><div className="text-sm text-muted-foreground">{customer.accountNumber}</div></div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
              {searchError && <Alert variant="destructive" className="mt-4"><AlertCircle className="h-4 w-4" /><AlertTitle>Search Failed</AlertTitle><AlertDescription>{searchError}</AlertDescription></Alert>}
              
              {selectedCustomer && (
                  <div className="pt-4 max-w-sm">
                    <FormField control={form.control} name="loanId" render={({ field }) => (
                        <FormItem><FormLabel>Select Loan for {selectedCustomer.name}</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder={loadingLoans ? "Loading loans..." : "Select a disbursed loan..."} /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {activeLoans.map(loan => <SelectItem key={loan.id} value={loan.id}>Loan ID: {loan.id.substring(0,8)}... - Amount: MWK {loan.amount.toLocaleString()}</SelectItem>)}
                                    {activeLoans.length === 0 && !loadingLoans && <SelectItem value="none" disabled>No active, disbursed loans found</SelectItem>}
                                </SelectContent>
                            </Select>
                        <FormMessage /></FormItem>
                    )} />
                </div>
              )}
            </CardContent>
          </Card>
          
           {selectedLoan && (
                <Card>
                    <CardHeader><CardTitle>Loan Summary</CardTitle></CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div><p className="text-muted-foreground">Customer</p><p className="font-semibold">{selectedCustomer.name}</p></div>
                            <div><p className="text-muted-foreground">Loan Amount</p><p className="font-semibold">MWK {selectedLoan.amount.toLocaleString()}</p></div>
                            <div><p className="text-muted-foreground">Outstanding</p><p className="font-semibold">MWK {selectedLoan.outstandingPrincipal.toLocaleString()}</p></div>
                            <div><p className="text-muted-foreground">Date Applied</p><p className="font-semibold">{selectedLoan.dateApplied ? format(selectedLoan.dateApplied.toDate(), 'PPP') : 'N/A'}</p></div>
                            <div><p className="text-muted-foreground">Date Disbursed</p><p className="font-semibold">{selectedLoan.disbursalDate ? format(selectedLoan.disbursalDate.toDate(), 'PPP') : 'N/A'}</p></div>
                            <div><p className="text-muted-foreground">Disbursed By</p><p className="font-semibold">{getStaffName(selectedLoan.disbursementDetails?.disbursedBy)}</p></div>
                        </div>
                    </CardContent>
                </Card>
            )}

          {form.getValues('loanId') && (
            <Card>
              <CardHeader>
                  <CardTitle>Step 2: Justification</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField control={form.control} name="reason" render={({ field }) => (
                  <FormItem><FormLabel>Reason for Reversal</FormLabel><FormControl><Textarea placeholder="e.g., Disbursed to the wrong account in error..." {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem><FormLabel>Detailed Notes (Optional)</FormLabel><FormControl><Textarea placeholder="Provide any additional details or context." {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </CardContent>
              <CardFooter className="justify-end">
                <Button type="submit" disabled={reversalLoading}>
                  {reversalLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Send className="mr-2 h-4 w-4" />
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
