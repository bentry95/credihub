'use client';

import React, { useState, useMemo, useRef } from 'react';
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
import { collection, doc, query, where, orderBy } from 'firebase/firestore';
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
import {
  Calendar as CalendarIcon,
  Printer,
  Loader2,
  Wallet,
  ArrowDown,
  ArrowUp,
  Landmark,
  Copy,
} from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

const statementFiltersSchema = z.object({
  accountId: z.string().min(1, 'Please select a GL account.'),
  dateRange: z.object({
    from: z.date({ required_error: 'Start date is required.' }),
    to: z.date({ required_error: 'End date is required.' }),
  }),
});

export default function AccountStatementsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [statement, setStatement] = useState<any | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

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

  const coaQuery = useMemoFirebase(
    () =>
      firestore && institutionId
        ? collection(firestore, 'institutions', institutionId, 'chartOfAccounts')
        : null,
    [firestore, institutionId]
  );
  const { data: accounts, isLoading: isCoaLoading } = useCollection(coaQuery);

  const journalsQuery = useMemoFirebase(
    () =>
      firestore && institutionId
        ? query(collection(firestore, 'institutions', institutionId, 'journals'), where('status', '==', 'Posted'))
        : null,
    [firestore, institutionId]
  );
  const { data: journals, isLoading: isJournalsLoading } = useCollection(journalsQuery);


  const form = useForm<z.infer<typeof statementFiltersSchema>>({
    resolver: zodResolver(statementFiltersSchema),
  });

  function onGenerate(values: z.infer<typeof statementFiltersSchema>) {
      setIsGenerating(true);
      
      const account = accounts?.find(a => a.id === values.accountId);
      if (!account || !journals) {
          setIsGenerating(false);
          return;
      }
      
      const startDate = startOfDay(values.dateRange.from);
      const endDate = endOfDay(values.dateRange.to);

      // 1. Calculate Opening Balance
      let openingBalance = 0;
      journals.filter(j => j.date.toDate() < startDate).forEach(j => {
          j.transactions.forEach((t: any) => {
              if (t.accountId === values.accountId) {
                  if (account.accountType === 'Asset' || account.accountType === 'Expense') {
                      openingBalance += (t.debit || 0) - (t.credit || 0);
                  } else {
                      openingBalance += (t.credit || 0) - (t.debit || 0);
                  }
              }
          });
      });

      // 2. Filter transactions for the selected period
      const periodTransactions = journals
        .filter(j => {
            const journalDate = j.date.toDate();
            return journalDate >= startDate && journalDate <= endDate;
        })
        .flatMap(j => j.transactions.filter((t:any) => t.accountId === values.accountId).map((t:any) => ({
            date: j.date.toDate(),
            journalId: j.id,
            description: j.description,
            debit: t.debit || 0,
            credit: t.credit || 0,
        })))
        .sort((a,b) => a.date - b.date);

      // 3. Generate statement with running balance
      let runningBalance = openingBalance;
      let totalDebits = 0;
      let totalCredits = 0;

      const statementTransactions = periodTransactions.map(tx => {
          totalDebits += tx.debit;
          totalCredits += tx.credit;
          if (account.accountType === 'Asset' || account.accountType === 'Expense') {
            runningBalance += tx.debit - tx.credit;
          } else {
            runningBalance += tx.credit - tx.debit;
          }
          return { ...tx, balance: runningBalance };
      });
      
      const finalStatement = {
          summary: {
              openingBalance,
              totalDebits,
              totalCredits,
              closingBalance: runningBalance,
          },
          transactions: [
              { date: startDate, journalId: '-', description: 'Opening Balance', debit: 0, credit: 0, balance: openingBalance },
              ...statementTransactions
          ]
      };

      setStatement(finalStatement);
      setIsGenerating(false);
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
        title: "Copied to clipboard",
        description: `Batch ID ${text} has been copied.`,
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>GL Account Statements</CardTitle>
          <CardDescription>
            Generate statements for any General Ledger account within a specific period.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onGenerate)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <FormField
                    control={form.control}
                    name="accountId"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>GL Account</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder={isCoaLoading ? "Loading..." : "Select a GL account..."} />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {accounts?.map(acc => (
                                    <SelectItem key={acc.id} value={acc.id}>
                                        {acc.glCode} - {acc.accountName}
                                    </SelectItem>
                                ))}
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
                <Button type="submit" disabled={isGenerating || isJournalsLoading}>
                    {(isGenerating || isJournalsLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    {isJournalsLoading ? 'Loading Journals...' : 'Generate Statement'}
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
                    <CardTitle>GL Account Statement</CardTitle>
                    <CardDescription>
                        Statement for account {form.getValues('accountId')} from {format(form.getValues('dateRange.from'), 'PPP')} to {format(form.getValues('dateRange.to'), 'PPP')}.
                    </CardDescription>
                  </div>
                  <Button onClick={() => handlePrint()} variant="outline"><Printer className="mr-2 h-4 w-4"/> Print Statement</Button>
              </CardHeader>
              <CardContent ref={statementRef} className="p-6 print:p-2 bg-white text-black">
                 <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6 print:hidden">
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Opening Balance</CardTitle><Landmark className="h-4 w-4 text-muted-foreground"/></CardHeader>
                        <CardContent><div className="text-2xl font-bold">MWK {statement.summary.openingBalance.toLocaleString()}</div></CardContent>
                     </Card>
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Debits</CardTitle><ArrowDown className="h-4 w-4 text-red-500"/></CardHeader>
                        <CardContent><div className="text-2xl font-bold">MWK {statement.summary.totalDebits.toLocaleString()}</div></CardContent>
                     </Card>
                      <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Credits</CardTitle><ArrowUp className="h-4 w-4 text-green-500"/></CardHeader>
                        <CardContent><div className="text-2xl font-bold">MWK {statement.summary.totalCredits.toLocaleString()}</div></CardContent>
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
                            <TableHead>Batch ID</TableHead>
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
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        {tx.journalId !== '-' && <span className="font-mono text-xs">{tx.journalId.substring(0, 8)}...</span>}
                                        {tx.journalId !== '-' && 
                                            <Button variant="ghost" size="icon" className="h-6 w-6 print:hidden" onClick={() => copyToClipboard(tx.journalId)}>
                                                <Copy className="h-3 w-3" />
                                            </Button>
                                        }
                                    </div>
                                </TableCell>
                                <TableCell>{tx.description}</TableCell>
                                <TableCell className="text-right font-mono">{tx.debit > 0 ? tx.debit.toLocaleString() : '-'}</TableCell>
                                <TableCell className="text-right font-mono">{tx.credit > 0 ? tx.credit.toLocaleString() : '-'}</TableCell>
                                <TableCell className="text-right font-mono">{tx.balance.toLocaleString()}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    <TableFooter>
                        <TableRow>
                            <TableCell colSpan={3} className="font-bold">Totals</TableCell>
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
