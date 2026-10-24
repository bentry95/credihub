'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, query, where, limit, getDocs, doc } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Search,
  LogOut,
  Loader2,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Wallet,
  Landmark,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const exitFormSchema = z.object({
  reason: z.string().min(1, 'Reason for exit is required.'),
  comments: z.string().optional(),
});

export default function CustomerExitPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [customerBalances, setCustomerBalances] = useState<{loanBalance: number, savingsBalance: number} | null>(null);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);
  
  const form = useForm<z.infer<typeof exitFormSchema>>({
    resolver: zodResolver(exitFormSchema),
  });

  useEffect(() => {
    if (searchTerm.length < 3 || !firestore || !userData?.institutionId) {
      setSearchResults([]);
      return;
    }
    const performSearch = async () => {
      setIsSearching(true);
      const customersRef = collection(firestore, 'institutions', userData.institutionId, 'customers');
      const nameQuery = query(customersRef, where('name_lowercase', '>=', searchTerm.toLowerCase()), where('name_lowercase', '<=', searchTerm.toLowerCase() + '\uf8ff'), limit(5));
      const snap = await getDocs(nameQuery);
      setSearchResults(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsSearching(false);
    };
    const debounce = setTimeout(performSearch, 300);
    return () => clearTimeout(debounce);
  }, [searchTerm, firestore, userData?.institutionId]);

  const handleSelectCustomer = async (customer: any) => {
    setSelectedCustomer(customer);
    setSearchTerm('');
    setSearchResults([]);
    setIsLoadingBalances(true);

    if (!firestore || !userData?.institutionId) {
        setIsLoadingBalances(false);
        return;
    }

    const instId = userData.institutionId;

    try {
        const loanAppsQuery = query(collection(firestore, 'institutions', instId, 'loanApplications'), where('customerId', '==', customer.id), where('status', 'in', ['Disbursed', 'Overdue']));
        const runningLoansQuery = query(collection(firestore, 'institutions', instId, 'runningLoans'), where('customerId', '==', customer.id), where('status', 'in', ['Disbursed', 'Overdue']));
        const savingsQuery = query(collection(firestore, 'institutions', instId, 'customers', customer.id, 'savingsAccounts'));

        const [loanAppsSnap, runningLoansSnap, savingsSnap] = await Promise.all([
            getDocs(loanAppsQuery),
            getDocs(runningLoansQuery),
            getDocs(savingsQuery),
        ]);

        const loanBalance = [...loanAppsSnap.docs, ...runningLoansSnap.docs].reduce((sum, doc) => sum + (doc.data().outstandingPrincipal || 0), 0);
        const savingsBalance = savingsSnap.docs.reduce((sum, doc) => sum + (doc.data().balance || 0), 0);

        setCustomerBalances({ loanBalance, savingsBalance });

    } catch (e) {
        console.error("Error fetching balances:", e);
        setCustomerBalances({ loanBalance: 0, savingsBalance: 0 }); // Set to 0 on error
    } finally {
        setIsLoadingBalances(false);
    }
  };
  
  async function onSubmit(values: z.infer<typeof exitFormSchema>) {
    setLoading(true);
    // Simulate API call to submit for approval
    setTimeout(() => {
      toast({
        title: "Exit Request Submitted",
        description: `The exit request for ${selectedCustomer.name} has been sent for final approval.`,
      });
      setLoading(false);
      setSelectedCustomer(null);
      setCustomerBalances(null);
      form.reset();
    }, 1500);
  }

  const isEligibleForExit = customerBalances ? customerBalances.loanBalance === 0 : false;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Customer Exit Workflow</CardTitle>
          <CardDescription>
            Search for a customer to begin the account closure process.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Search for a customer by name..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
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
                        <Avatar>
                          <AvatarImage src={customer.photoUrl} />
                          <AvatarFallback>{customer.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{customer.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {customer.accountNumber}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>

      {!selectedCustomer && (
        <div className="flex h-64 items-center justify-center">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <div className="mx-auto bg-muted rounded-full p-4 w-fit">
                        <Search className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <CardTitle className="mt-4">Search for a Customer</CardTitle>
                    <CardDescription>
                        Use the search bar above to find a customer and begin the exit process.
                    </CardDescription>
                </CardHeader>
            </Card>
        </div>
      )}

      {selectedCustomer && (
          <Card>
              <CardHeader>
                  <CardTitle>Pre-Exit Financial Check</CardTitle>
                  <CardDescription>Reviewing balances for {selectedCustomer.name}.</CardDescription>
              </CardHeader>
              <CardContent>
                  {isLoadingBalances ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Skeleton className="h-24 w-full" />
                          <Skeleton className="h-24 w-full" />
                      </div>
                  ) : customerBalances && (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Outstanding Loan Balance</CardTitle>
                                <Landmark className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">MWK {customerBalances.loanBalance.toLocaleString()}</div>
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Savings & Shares</CardTitle>
                                <Wallet className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">MWK {customerBalances.savingsBalance.toLocaleString()}</div>
                            </CardContent>
                        </Card>
                     </div>
                  )}

                  {!isLoadingBalances && customerBalances && (
                     <div className="mt-6">
                        {!isEligibleForExit ? (
                             <Alert variant="destructive">
                                <ShieldAlert className="h-4 w-4" />
                                <AlertTitle>Exit Blocked</AlertTitle>
                                <AlertDescription>
                                    This customer cannot be exited because they have an outstanding loan balance. All loans must be fully paid before an account can be closed.
                                </AlertDescription>
                            </Alert>
                        ) : (
                             <Alert>
                                <ShieldCheck className="h-4 w-4" />
                                <AlertTitle>Eligible for Exit</AlertTitle>
                                <AlertDescription>
                                    This customer has no outstanding loans and can proceed with the exit process.
                                </AlertDescription>
                            </Alert>
                        )}
                     </div>
                  )}
              </CardContent>
          </Card>
      )}

      {selectedCustomer && isEligibleForExit && (
        <Card>
            <CardHeader>
                <CardTitle>Initiate Exit Request</CardTitle>
                <CardDescription>Complete the form below to submit the exit request for approval.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                         <Alert variant="default" className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                            <Wallet className="h-4 w-4 text-blue-600" />
                            <AlertTitle className="text-blue-800 dark:text-blue-200">Final Settlement</AlertTitle>
                            <AlertDescription className="text-blue-700 dark:text-blue-300">
                                Upon approval, a total of <strong>MWK {customerBalances?.savingsBalance.toLocaleString()}</strong> from savings and shares will be scheduled for payout.
                            </AlertDescription>
                        </Alert>
                        <FormField
                            control={form.control}
                            name="reason"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Reason for Exit</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a reason..." />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="Relocated">Relocated</SelectItem>
                                        <SelectItem value="Deceased">Deceased</SelectItem>
                                        <SelectItem value="Dissatisfied">Dissatisfied with Service</SelectItem>
                                        <SelectItem value="Joined another institution">Joined another institution</SelectItem>
                                        <SelectItem value="Other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="comments"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Internal Comments (Optional)</FormLabel>
                                <FormControl>
                                    <Textarea
                                    placeholder="Add any relevant notes for internal records..."
                                    {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="flex justify-end">
                            <Button type="submit" disabled={loading}>
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
                                Submit for Final Approval
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
      )}

    </div>
  );
}