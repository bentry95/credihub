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
import { collection, query, where, limit, getDocs, doc } from 'firebase/firestore';
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
} from 'lucide-react';
import { format } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const statementFiltersSchema = z.object({
  customerId: z.string().min(1, 'Please select a customer.'),
  accountType: z.enum(['Savings', 'Loan']),
  accountId: z.string().min(1, 'Please select an account.'),
  dateRange: z.object({
    from: z.date(),
    to: z.date(),
  }),
});

// Mock Data
const mockStatementData = {
    summary: {
        openingBalance: 50000,
        totalCredits: 125000,
        totalDebits: 80000,
        closingBalance: 95000
    },
    transactions: [
        { date: '2024-07-01', description: 'Opening Balance', debit: 0, credit: 0, balance: 50000 },
        { date: '2024-07-05', description: 'Salary Deposit', debit: 0, credit: 100000, balance: 150000 },
        { date: '2024-07-10', description: 'ATM Withdrawal', debit: 20000, credit: 0, balance: 130000 },
        { date: '2024-07-15', description: 'Loan Repayment', debit: 10000, credit: 0, balance: 120000 },
        { date: '2024-07-20', description: 'Mobile Money Transfer', debit: 50000, credit: 0, balance: 70000 },
        { date: '2024-07-25', description: 'Cash Deposit', debit: 0, credit: 25000, balance: 95000 },
    ]
}

export default function CustomerStatementsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
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

  const form = useForm<z.infer<typeof statementFiltersSchema>>({
    resolver: zodResolver(statementFiltersSchema),
  });

  useEffect(() => {
    if (searchTerm.length < 3 || !firestore || !userData?.institutionId) {
      setSearchResults([]);
      return;
    }
    const performSearch = async () => {
      setIsSearching(true);
      const customersRef = collection(
        firestore,
        'institutions',
        userData.institutionId,
        'customers'
      );
      const q = query(
        customersRef,
        where('name', '>=', searchTerm),
        where('name', '<=', searchTerm + '\uf8ff'),
        limit(5)
      );
      const snap = await getDocs(q);
      setSearchResults(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setIsSearching(false);
    };
    const debounce = setTimeout(performSearch, 300);
    return () => clearTimeout(debounce);
  }, [searchTerm, firestore, userData?.institutionId]);

  const handleSelectCustomer = (customer: any) => {
    setSelectedCustomer(customer);
    form.setValue('customerId', customer.id);
    setSearchTerm('');
    setSearchResults([]);
    setStatement(null);
  };
  
  function onGenerate(values: z.infer<typeof statementFiltersSchema>) {
      setIsGenerating(true);
      // Simulate API call
      setTimeout(() => {
        setStatement(mockStatementData);
        setIsGenerating(false);
      }, 1000);
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer</FormLabel>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input
                          placeholder="Search for a customer..."
                          className="pl-10"
                          onChange={(e) => setSearchTerm(e.target.value)}
                          value={searchTerm}
                          disabled={!!selectedCustomer}
                        />
                         {selectedCustomer && (
                            <Button variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-7" onClick={() => { setSelectedCustomer(null); form.reset(); }}>Clear</Button>
                         )}

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
                                      <AvatarFallback>
                                        {customer.name.charAt(0)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <div className="font-medium">
                                        {customer.name}
                                      </div>
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
                      {selectedCustomer && <p className="text-sm text-muted-foreground p-2">{selectedCustomer.name}</p>}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                    control={form.control}
                    name="accountType"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Account Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!selectedCustomer}>
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
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!form.watch('accountType')}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select account..." /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="SAV001">SAV001 - Regular Savings</SelectItem>
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
            </form>
          </Form>
        </CardContent>
      </Card>

      {isGenerating ? <Skeleton className="h-96 w-full" /> : statement && (
          <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Account Statement</CardTitle>
                    <CardDescription>
                        Statement for {selectedCustomer.name} from {format(form.getValues('dateRange.from'), 'PPP')} to {format(form.getValues('dateRange.to'), 'PPP')}.
                    </CardDescription>
                  </div>
                  <Button onClick={() => handlePrint()}><Printer className="mr-2 h-4 w-4"/> Print Statement</Button>
              </CardHeader>
              <CardContent ref={statementRef} className="p-6 print:p-2 bg-white text-black">
                 <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
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
    </div>
  );
}
