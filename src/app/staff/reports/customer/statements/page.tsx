'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useReactToPrint } from 'react-to-print';
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
import { collection, doc, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter
} from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Search,
  Calendar as CalendarIcon,
  Printer,
  FileDown,
  Loader2,
  Wallet,
  ArrowDown,
  ArrowUp,
  Landmark,
  Copy,
  FileText,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { format, startOfDay, endOfDay } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import Papa from 'papaparse';
import { calculateAmortization } from '@/lib/finance';


const statementFiltersSchema = z.object({
  customerId: z.string().min(1, 'Please select a customer.'),
  accountType: z.enum(['Savings', 'Loan']),
  accountId: z.string().min(1, 'Please select an account.'),
  dateRange: z.object({
    from: z.date({ required_error: 'Start date is required.' }),
    to: z.date({ required_error: 'End date is required.' }),
  }),
});


export default function CustomerStatementsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);

  const [customerAccounts, setCustomerAccounts] = useState<{savings: any[], loans: any[]}>({ savings: [], loans: [] });
  const [accountsLoading, setAccountsLoading] = useState(false);

  const [statement, setStatement] = useState<any | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const statementRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
      contentRef: statementRef,
  });

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);
  
  const institutionId = userData?.institutionId;

  const journalsQuery = useMemoFirebase(
    () =>
      firestore && institutionId
        ? query(collection(firestore, 'institutions', institutionId, 'journals'), where('status', '==', 'Posted'))
        : null,
    [firestore, institutionId]
  );
  const { data: journals, isLoading: isJournalsLoading } = useCollection(journalsQuery);
  
  const { data: loanProducts, isLoading: isProductsLoading } = useCollection(useMemoFirebase(() => (firestore && institutionId ? collection(firestore, 'institutions', institutionId, 'loanProducts') : null), [firestore, institutionId]));


  const form = useForm<z.infer<typeof statementFiltersSchema>>({
    resolver: zodResolver(statementFiltersSchema),
    defaultValues: {
        dateRange: {
            from: startOfDay(new Date()),
            to: endOfDay(new Date()),
        }
    }
  });

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
        getDocs(accountNumberQuery)
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
    setIsSearchOpen(false);
    setStatement(null);

    setAccountsLoading(true);
    if (firestore && institutionId) {
        const loanAppsRef = collection(firestore, 'institutions', institutionId, 'loanApplications');
        const runningLoansRef = collection(firestore, 'institutions', institutionId, 'runningLoans');
        const savingsRef = collection(firestore, 'institutions', institutionId, 'customers', customer.id, 'savingsAccounts');

        const loanAppsQuery = query(loanAppsRef, where('customerId', '==', customer.id));
        const runningLoansQuery = query(runningLoansRef, where('customerId', '==', customer.id));
        const savingsQuery = query(savingsRef);

        const [loanAppsSnap, runningLoansSnap, savingsSnap] = await Promise.all([
            getDocs(loanAppsQuery),
            getDocs(runningLoansQuery),
            getDocs(savingsQuery)
        ]);

        const allLoans = [...loanAppsSnap.docs.map(d => ({id:d.id, ...d.data()})), ...runningLoansSnap.docs.map(d => ({id:d.id, ...d.data()}))];
        const allSavings = savingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setCustomerAccounts({ loans: allLoans, savings: allSavings });
    }
    setAccountsLoading(false);
  };

  function onGenerate(values: z.infer<typeof statementFiltersSchema>) {
    setIsGenerating(true);
    setStatement(null);

    if (values.accountType === 'Savings') {
        // Savings statement logic is complex due to data model, showing empty for now.
        setStatement({ accountName: 'Savings Account', transactions: [], summary: { openingBalance: 0, totalDebits: 0, totalCredits: 0, closingBalance: 0 } });
        setIsGenerating(false);
        return;
    }

    if (values.accountType === 'Loan') {
        const loan = customerAccounts.loans.find(l => l.id === values.accountId);
        const product = loanProducts?.find(p => p.id === loan?.loanProductId);
        if (!loan || !product || !journals) {
            setIsGenerating(false);
            return;
        }

        const startDate = startOfDay(values.dateRange.from);
        const endDate = endOfDay(values.dateRange.to);

        const { schedule } = calculateAmortization({
            principal: loan.amount,
            annualInterestRate: product.annualInterestRate,
            term: loan.term,
            tenureUnit: loan.tenureUnit,
            interestRateType: product.interestRateType,
            startDate: loan.disbursalDate?.toDate(),
        });
        
        const repaymentJournals = journals.filter(j => j.loanId === loan.id);
        
        let openingBalance = loan.amount;
        repaymentJournals.filter(j => j.date.toDate() < startDate).forEach(j => {
            const repaymentAmount = j.repaymentAmount || 0;
            openingBalance -= repaymentAmount;
        });

        const periodTransactions = repaymentJournals
            .filter(j => {
                const journalDate = j.date.toDate();
                return journalDate >= startDate && journalDate <= endDate;
            })
            .map(j => ({
                date: j.date.toDate(),
                description: j.description,
                debit: j.repaymentAmount || 0,
                credit: 0, 
            }));
        
        const disbursementTx = {
            date: loan.disbursalDate.toDate(),
            description: 'Loan Disbursement',
            debit: 0,
            credit: loan.amount,
        };
        
        const allTx = [disbursementTx, ...periodTransactions].sort((a,b) => a.date.getTime() - b.date.getTime());

        let runningBalance = openingBalance;
        let totalDebits = 0;
        let totalCredits = 0;

        const statementTransactions = allTx.map(tx => {
            if(tx.date < startDate) return null; // Filter out transactions before start date for statement display

            totalDebits += tx.debit;
            totalCredits += tx.credit;

            runningBalance += tx.credit - tx.debit;
            return { ...tx, balance: runningBalance };
        }).filter(Boolean);


        const finalStatement = {
            accountName: product.name,
            summary: { openingBalance, totalDebits, totalCredits, closingBalance: runningBalance },
            transactions: [
                { date: startDate, description: 'Opening Balance', debit: 0, credit: 0, balance: openingBalance },
                ...statementTransactions
            ]
        };

        setStatement(finalStatement);
    }
    
    setIsGenerating(false);
  }

  const { toast } = useToast();
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
        title: "Copied to clipboard",
        description: `Batch ID ${text} has been copied.`,
    });
  }
  
  const getProductName = (type: 'Loan' | 'Savings', productId: string) => {
      if (type === 'Loan') {
          return loanProducts?.find(p => p.id === productId)?.name || productId;
      }
      return productId;
  }
  
  const handleExport = () => {
    if (!statement) return;

    const dataToExport = statement.transactions.map((tx: any) => ({
      'Date': format(new Date(tx.date), 'yyyy-MM-dd'),
      'Description': tx.description,
      'Debit': tx.debit,
      'Credit': tx.credit,
      'Balance': tx.balance,
    }));

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Statement_${selectedCustomer.accountNumber}_${form.getValues('accountId')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Customer Statements</CardTitle>
          <CardDescription>
            Generate savings or loan account statements for a specific customer
            and period.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onGenerate)} className="space-y-6">
                {!selectedCustomer ? (
                    <div className="space-y-2">
                        <FormLabel>Find Customer</FormLabel>
                        <Button type="button" onClick={() => setIsSearchOpen(true)}>
                            <Search className="mr-2 h-4 w-4"/> Search for Customer
                        </Button>
                    </div>
                ) : (
                <>
                 <div className="flex items-center gap-4 mt-4 rounded-md border p-4 bg-muted/50 max-w-lg">
                    <Avatar className="h-12 w-12"><AvatarImage src={selectedCustomer.photoUrl} /><AvatarFallback>{selectedCustomer.name.charAt(0)}</AvatarFallback></Avatar>
                    <div>
                        <p className="font-semibold">{selectedCustomer.name}</p>
                        <p className="text-sm text-muted-foreground">{selectedCustomer.accountNumber}</p>
                    </div>
                    <Button variant="link" onClick={() => { setSelectedCustomer(null); form.reset(); setCustomerAccounts({savings:[], loans:[]}); }} className="ml-auto">Change</Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                    <FormField
                      control={form.control}
                      name="accountType"
                      render={({ field }) => (
                      <FormItem>
                          <FormLabel>Account Type</FormLabel>
                          <Select onValueChange={(value) => { field.onChange(value); form.setValue('accountId', ''); }} value={field.value}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger></FormControl>
                              <SelectContent>
                                  <SelectItem value="Savings">Savings Account</SelectItem>
                                  <SelectItem value="Loan">Loan Account</SelectItem>
                              </SelectContent>
                          </Select>
                          <FormMessage />
                      </FormItem>
                      )}
                    />
                    <FormField
                        control={form.control}
                        name="accountId"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Select Account</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value} disabled={!form.watch('accountType') || accountsLoading}>
                                <FormControl><SelectTrigger><SelectValue placeholder={accountsLoading ? "Loading..." : "Select account..."} /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {form.watch('accountType') === 'Savings' && customerAccounts.savings.map(acc => <SelectItem key={acc.id} value={acc.id}>{getProductName('Savings', acc.productId)} (Balance: MWK {acc.balance.toLocaleString()})</SelectItem>)}
                                    {form.watch('accountType') === 'Loan' && customerAccounts.loans.map(loan => <SelectItem key={loan.id} value={loan.id}>{getProductName('Loan', loan.loanProductId)} - MWK {loan.amount.toLocaleString()}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                      control={form.control}
                      name="dateRange"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Date range</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={'outline'}
                                  className={cn(
                                    'pl-3 text-left font-normal',
                                    !field.value && 'text-muted-foreground'
                                  )}
                                >
                                  {field.value?.from ? (
                                    field.value.to ? (
                                      <>
                                        {format(field.value.from, 'LLL dd, y')} -{' '}
                                        {format(field.value.to, 'LLL dd, y')}
                                      </>
                                    ) : (
                                      format(field.value.from, 'LLL dd, y')
                                    )
                                  ) : (
                                    <span>Pick a date range</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={field.value?.from}
                                selected={field.value}
                                onSelect={field.onChange}
                                numberOfMonths={2}
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={isGenerating}>
                        {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Generate Statement
                    </Button>
                  </div>
                </>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>

      {isGenerating ? <Skeleton className="h-96 w-full" /> : statement && (
          <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Account Statement for {statement.accountName}</CardTitle>
                    <CardDescription>
                        Statement for {selectedCustomer.name} from {format(form.getValues('dateRange.from'), 'PPP')} to {format(form.getValues('dateRange.to'), 'PPP')}.
                    </CardDescription>
                  </div>
                   <div className="flex items-center gap-2">
                    <Button onClick={handleExport} variant="outline"><FileDown className="mr-2 h-4 w-4"/> Export</Button>
                    <Button onClick={() => handlePrint()}><Printer className="mr-2 h-4 w-4"/> Print</Button>
                   </div>
              </CardHeader>
              <CardContent ref={statementRef} className="p-6 print:p-2 bg-white text-black">
                 <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6 print:hidden">
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Opening Balance</CardTitle><Landmark className="h-4 w-4 text-muted-foreground"/></CardHeader>
                        <CardContent><div className="text-2xl font-bold">MWK {statement.summary.openingBalance.toLocaleString()}</div></CardContent>
                     </Card>
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Credits/Deposits</CardTitle><ArrowDown className="h-4 w-4 text-green-500"/></CardHeader>
                        <CardContent><div className="text-2xl font-bold">MWK {statement.summary.totalCredits.toLocaleString()}</div></CardContent>
                     </Card>
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Debits/Withdrawals</CardTitle><ArrowUp className="h-4 w-4 text-red-500"/></CardHeader>
                        <CardContent><div className="text-2xl font-bold">MWK {statement.summary.totalDebits.toLocaleString()}</div></CardContent>
                     </Card>
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Closing Balance</CardTitle><Wallet className="h-4 w-4 text-muted-foreground"/></CardHeader>
                        <CardContent><div className="text-2xl font-bold">MWK {statement.summary.closingBalance.toLocaleString()}</div></CardContent>
                     </Card>
                 </div>
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Debit</TableHead>
                            <TableHead className="text-right">Credit</TableHead>
                            <TableHead className="text-right">Balance</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {statement.transactions.map((tx: any, index: number) => (
                            <TableRow key={index}>
                                <TableCell>{format(new Date(tx.date), 'PPP')}</TableCell>
                                <TableCell>{tx.description}</TableCell>
                                <TableCell className="text-right font-mono">{tx.debit > 0 ? tx.debit.toLocaleString() : '-'}</TableCell>
                                <TableCell className="text-right font-mono">{tx.credit > 0 ? tx.credit.toLocaleString() : '-'}</TableCell>
                                <TableCell className="text-right font-mono">{tx.balance.toLocaleString()}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    <TableFooter>
                        <TableRow>
                            <TableCell colSpan={2} className="font-bold">Totals</TableCell>
                            <TableCell className="text-right font-bold font-mono">{statement.summary.totalDebits.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-bold font-mono">{statement.summary.totalCredits.toLocaleString()}</TableCell>
                            <TableCell></TableCell>
                        </TableRow>
                    </TableFooter>
                 </Table>
              </CardContent>
          </Card>
      )}

      <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Find a Customer</DialogTitle>
                  <DialogDescription>Search for the customer to generate a statement.</DialogDescription>
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
    </div>
  );
}
