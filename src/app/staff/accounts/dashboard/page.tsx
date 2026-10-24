
'use client';
import { useMemo } from 'react';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Wallet,
  Landmark,
  Scale,
  TrendingUp,
} from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { Bar, XAxis, YAxis, CartesianGrid, BarChart } from 'recharts';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, query, where, doc, orderBy, limit, Timestamp } from 'firebase/firestore';
import { startOfYear, subMonths, format } from 'date-fns';

const chartConfig = {
  income: {
    label: 'Income',
    color: 'hsl(var(--chart-1))',
  },
  expenses: {
    label: 'Expenses',
    color: 'hsl(var(--chart-2))',
  },
};

const formatCurrency = (value: number) => {
    if (value >= 1_000_000_000) {
        return `MWK ${(value / 1_000_000_000).toFixed(1)}B`;
    }
    if (value >= 1_000_000) {
        return `MWK ${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1_000) {
        return `MWK ${(value / 1_000)}k`;
    }
    return `MWK ${value}`;
};

export default function AccountsDashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(
    () => (firestore && user?.uid ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);

  const journalsQuery = useMemoFirebase(
    () =>
      firestore && userData?.institutionId
        ? query(
            collection(
              firestore,
              'institutions',
              userData.institutionId,
              'journals'
            ),
            orderBy('date', 'desc')
          )
        : null,
    [firestore, userData]
  );
  const { data: journals, isLoading: journalsLoading } = useCollection(journalsQuery);
  
  const coaQuery = useMemoFirebase(
    () =>
      firestore && userData?.institutionId
        ? collection(firestore, 'institutions', userData.institutionId, 'chartOfAccounts')
        : null,
    [firestore, userData]
  );
  const { data: accounts, isLoading: isCoaLoading } = useCollection(coaQuery);

  const recentJournals = journals?.filter(j => j.status === 'Posted').slice(0, 5) || [];

  const { totalAssets, totalLiabilities, totalEquity, netProfitLoss, monthlyChartData } = useMemo(() => {
    if (!journals || !accounts) return { totalAssets: 0, totalLiabilities: 0, totalEquity: 0, netProfitLoss: 0, monthlyChartData: [] };

    const accountBalances = new Map<string, number>();

    const postedJournals = journals.filter(j => j.status === 'Posted');

    postedJournals.forEach(journal => {
        journal.transactions.forEach((transaction: any) => {
            const account = accounts.find(a => a.id === transaction.accountId);
            if (!account) return;

            const currentBalance = accountBalances.get(transaction.accountId) || 0;
            let newBalance = currentBalance;

            if (account.accountType === 'Asset' || account.accountType === 'Expense') {
                newBalance += (transaction.debit || 0) - (transaction.credit || 0);
            } else { // Liability, Equity, Income
                newBalance += (transaction.credit || 0) - (transaction.debit || 0);
            }
            accountBalances.set(transaction.accountId, newBalance);
        });
    });

    let assets = 0, liabilities = 0, equity = 0;
    accounts.forEach(account => {
        const balance = accountBalances.get(account.id) || 0;
        if (account.accountType === 'Asset') assets += balance;
        if (account.accountType === 'Liability') liabilities += balance;
        if (account.accountType === 'Equity') equity += balance;
    });
    
    const currentYearStart = startOfYear(new Date());
    let ytdIncome = 0;
    let ytdExpenses = 0;
    
    const monthlyTotals = Array.from({ length: 6 }).map((_, i) => {
        const monthDate = subMonths(new Date(), 5 - i);
        return {
            month: format(monthDate, 'MMM'),
            income: 0,
            expenses: 0,
        };
    });

    const incomeAccountIds = accounts.filter(a => a.accountType === 'Income').map(a => a.id);
    const expenseAccountIds = accounts.filter(a => a.accountType === 'Expense').map(a => a.id);

    postedJournals.forEach(journal => {
        const journalDate = journal.date.toDate();
        const monthStr = format(journalDate, 'MMM');
        const monthIndex = monthlyTotals.findIndex(m => m.month === monthStr);
        
        journal.transactions.forEach((transaction: any) => {
            if (incomeAccountIds.includes(transaction.accountId)) {
                const amount = (transaction.credit || 0) - (transaction.debit || 0);
                 if (journalDate >= currentYearStart) {
                    ytdIncome += amount;
                }
                if (monthIndex !== -1) {
                    monthlyTotals[monthIndex].income += amount;
                }
            } else if (expenseAccountIds.includes(transaction.accountId)) {
                 const amount = (transaction.debit || 0) - (transaction.credit || 0);
                if (journalDate >= currentYearStart) {
                    ytdExpenses += amount;
                }
                 if (monthIndex !== -1) {
                    monthlyTotals[monthIndex].expenses += amount;
                }
            }
        });
    });

    return {
        totalAssets: assets,
        totalLiabilities: liabilities,
        totalEquity: equity,
        netProfitLoss: ytdIncome - ytdExpenses,
        monthlyChartData: monthlyTotals,
    };

  }, [journals, accounts]);
  
  const kpiData = [
    { title: 'Total Assets', value: totalAssets, icon: Landmark, currency: true },
    { title: 'Total Liabilities', value: totalLiabilities, icon: Wallet, currency: true },
    { title: 'Total Equity', value: totalEquity, icon: Scale, currency: true },
    {
      title: 'Net Profit/Loss (YTD)',
      value: netProfitLoss,
      icon: TrendingUp,
      currency: true,
    },
  ];

  const isLoading = journalsLoading || isCoaLoading;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {kpiData.map((kpi, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              <kpi.icon className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                {isLoading ? <Skeleton className="h-8 w-3/4" /> : (
                    <div className="text-3xl font-bold">
                        {kpi.currency && 'MWK '}
                        {typeof kpi.value === 'number' ? kpi.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : kpi.value}
                    </div>
                )}
              <p className="text-xs text-muted-foreground">
                {kpi.title === 'Net Profit/Loss (YTD)' ? 'Calculated year-to-date' : 'Updated in real-time'}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Income vs. Expenses</CardTitle>
            <CardDescription>
              A visual summary of your institution's operational performance over the last 6 months.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[300px] w-full" /> : (
            <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
              <BarChart accessibilityLayer data={monthlyChartData}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                />
                <YAxis
                  tickFormatter={(value) => formatCurrency(value)}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar
                  dataKey="income"
                  fill="var(--color-income)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="expenses"
                  fill="var(--color-expenses)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Journal Entries</CardTitle>
            <CardDescription>
              The last few transactions posted to the General Ledger.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {journalsLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-3 w-1/2 mt-1" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Skeleton className="h-5 w-16 ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : recentJournals && recentJournals.length > 0 ? (
                  recentJournals.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <div className="font-medium">{entry.description}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(entry.date.seconds * 1000).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {/* Note: This assumes the first transaction is representative */}
                        {(entry.transactions?.[0]?.debit || entry.transactions?.[0]?.credit || 0).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={2}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No journal entries found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
