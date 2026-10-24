'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Download,
  TrendingUp,
  TrendingDown,
  Scale,
  Calendar as CalendarIcon,
  FileWarning,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, query, where, doc, getDocs, Timestamp } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';

interface SavingsTransaction {
  id: string;
  date: Date;
  customerName: string;
  productName: string;
  type: 'Deposit' | 'Withdrawal';
  amount: number;
}

export default function DepositSummaryReportPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [date, setDate] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const [transactions, setTransactions] = useState<SavingsTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const userDocRef = useMemoFirebase(
    () => (user && user.uid ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);
  const institutionId = userData?.institutionId;

  useEffect(() => {
    if (!firestore || !institutionId || !date?.from || !date?.to) {
      if(firestore && institutionId) setIsLoading(false);
      return;
    };

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const productsQuery = query(collection(firestore, 'institutions', institutionId, 'savingsProducts'));
        const journalsQuery = query(
          collection(firestore, 'institutions', institutionId, 'journals'),
          where('status', '==', 'Posted'),
          where('date', '>=', Timestamp.fromDate(date.from!)),
          where('date', '<=', Timestamp.fromDate(date.to!))
        );
        
        const [productsSnap, journalsSnap] = await Promise.all([
            getDocs(productsQuery),
            getDocs(journalsQuery)
        ]);

        const products = productsSnap.docs.map(d => ({...d.data(), id: d.id}));
        const savingsControlAccountIds = new Set(products.map(p => p.savingsControlAccountId));
        
        const savingsTransactions: SavingsTransaction[] = [];

        journalsSnap.docs.forEach(journalDoc => {
          const journal = journalDoc.data();
          
          journal.transactions.forEach((tx: any) => {
            if (savingsControlAccountIds.has(tx.accountId)) {
              const customerNameMatch = journal.description.match(/for (.*?)\./);
              const customerName = customerNameMatch ? customerNameMatch[1] : 'Unknown Customer';

              savingsTransactions.push({
                id: journal.id,
                date: journal.date.toDate(),
                customerName: customerName,
                productName: 'Savings Deposit/Withdrawal',
                type: tx.credit > 0 ? 'Deposit' : 'Withdrawal',
                amount: tx.credit > 0 ? tx.credit : tx.debit,
              });
            }
          });
        });

        setTransactions(savingsTransactions.sort((a, b) => b.date.getTime() - a.date.getTime()));

      } catch (error) {
        console.error("Failed to fetch savings summary data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();

  }, [firestore, institutionId, date]);
  
  const summary = useMemo(() => {
    const totalDeposits = transactions.filter(t => t.type === 'Deposit').reduce((sum, t) => sum + t.amount, 0);
    const totalWithdrawals = transactions.filter(t => t.type === 'Withdrawal').reduce((sum, t) => sum + t.amount, 0);
    return {
      totalDeposits,
      totalWithdrawals,
      netMovement: totalDeposits - totalWithdrawals,
    };
  }, [transactions]);

  return (
    <div className="space-y-6">
       <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Savings Deposit Summary</h1>
          <p className="text-muted-foreground mt-1">
            Tracks total deposits, withdrawals, and net savings balances over a period.
          </p>
        </div>
        <div className="flex items-center gap-2">
            <Popover>
                <PopoverTrigger asChild>
                <Button
                    id="date"
                    variant={"outline"}
                    className={cn("w-[280px] justify-start text-left font-normal", !date && "text-muted-foreground")}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date?.from ? (
                    date.to ? (
                        <>
                        {format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}
                        </>
                    ) : (
                        format(date.from, "LLL dd, y")
                    )
                    ) : (
                    <span>Pick a date range</span>
                    )}
                </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={date?.from}
                    selected={date}
                    onSelect={setDate}
                    numberOfMonths={2}
                />
                </PopoverContent>
            </Popover>
            <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export to Excel
            </Button>
        </div>
      </div>

       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Deposits</CardTitle>
            <TrendingUp className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-3/4"/> : <div className="text-3xl font-bold">MWK {summary.totalDeposits.toLocaleString()}</div>}
             <p className="text-xs text-muted-foreground">For the selected period.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Withdrawals</CardTitle>
            <TrendingDown className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent>
             {isLoading ? <Skeleton className="h-8 w-3/4"/> : <div className="text-3xl font-bold">MWK {summary.totalWithdrawals.toLocaleString()}</div>}
             <p className="text-xs text-muted-foreground">For the selected period.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Net Savings Movement</CardTitle>
            <Scale className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-3/4"/> : <div className="text-3xl font-bold">MWK {summary.netMovement.toLocaleString()}</div>}
             <p className="text-xs text-muted-foreground">For the selected period.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction Log</CardTitle>
          <CardDescription>
            A detailed log of all savings-related transactions in the selected period.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount (MWK)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-5 w-28 ml-auto" /></TableCell>
                    </TableRow>
                  ))
              ) : transactions.length > 0 ? (
                transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>{format(tx.date, 'PPP')}</TableCell>
                    <TableCell className="font-medium">{tx.customerName}</TableCell>
                    <TableCell>
                        <Badge variant={tx.type === 'Deposit' ? 'default' : 'secondary'}>{tx.type}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{tx.amount.toLocaleString()}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-muted rounded-full">
                        <FileWarning className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold">No Savings Transactions Found</h3>
                      <p className="text-muted-foreground">There is no savings transaction data to display for this period.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}