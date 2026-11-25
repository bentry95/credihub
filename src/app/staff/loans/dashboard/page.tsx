
      

'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { DashboardPageHeader } from '@/components/staff/dashboard-page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Users,
  Landmark,
  FileWarning,
  Calendar as CalendarIcon,
  ChevronsUpDown,
  CircleDollarSign,
  CheckCircle2,
  ListTodo,
  WalletCards,
  HandCoins,
  TrendingUp,
  ArrowUpRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import {
  collection,
  doc,
  query,
  where,
  Timestamp,
  getDocs,
  collectionGroup,
  getCountFromServer,
  orderBy,
  limit,
} from 'firebase/firestore';
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
  } from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Pie, PieChart, Cell, Legend as RechartsLegend } from "recharts"
import { Skeleton } from '@/components/ui/skeleton';
import { startOfMonth, endOfMonth, subMonths, format, endOfDay, differenceInDays } from 'date-fns';
import { useBranch } from '@/context/BranchContext';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import type { DateRange } from 'react-day-picker';
import { calculateAmortization } from '@/lib/finance';


const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

const formatCurrency = (value: number) => {
    const amount = Number.isFinite(value) ? value : 0;
    return `MWK ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const toDate = (value: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

function BranchSwitcher() {
  const { selectedBranch, setSelectedBranch, availableBranches, loading } = useBranch();
  
  const currentBranchName = useMemo(() => {
      if (loading) return 'Loading...';
      if (!selectedBranch) return 'Select Branch';
      const branch = availableBranches.find(b => b.id === selectedBranch);
      return branch?.name || 'Select Branch';
  }, [selectedBranch, availableBranches, loading]);
  
  if (availableBranches.length <= 1 && !availableBranches.some(b => b.id === 'all')) {
    return null; 
  }

  return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-[200px] justify-between">
            {currentBranchName}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[200px]">
          <DropdownMenuLabel>Switch Branch</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {availableBranches.map((branch) => (
            <DropdownMenuItem key={branch.id} onSelect={() => setSelectedBranch(branch.id)}>
              {branch.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
  )
}

export default function LoansDashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  
  const { selectedBranch, availableBranches } = useBranch();

  const [date, setDate] = useState<DateRange | undefined>(undefined);
  
  const [allData, setAllData] = useState<{
    customers: any[];
    loanApps: any[];
    runningLoans: any[];
    journals: any[];
  }>({ customers: [], loanApps: [], runningLoans: [], journals: [] });

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const userDocRef = useMemoFirebase(
    () => (firestore && user?.uid ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData, isLoading: isUserLoading } = useDoc(userDocRef);

  const institutionId = userData?.institutionId;

  const institutionDocRef = useMemoFirebase(
    () => (firestore && institutionId ? doc(firestore, 'institutions', institutionId) : null),
    [firestore, institutionId]
  );
  const { data: institutionData, isLoading: isInstitutionLoading } = useDoc(institutionDocRef);
  const systemDate = institutionData?.systemDate?.toDate();

  const financialYearsQuery = useMemoFirebase(
    () => firestore && institutionId ? query(collection(firestore, 'institutions', institutionId, 'financialYears'), where('status', '==', 'Open'), limit(1)) : null,
    [firestore, institutionId]
  );
  const { data: openFinancialYears, isLoading: isFyLoading } = useCollection(financialYearsQuery);
  const currentFinancialYear = openFinancialYears?.[0];

  useEffect(() => {
    if (currentFinancialYear) {
      setDate({
        from: currentFinancialYear.startDate.toDate(),
        to: currentFinancialYear.endDate.toDate(),
      });
    } else if (!isFyLoading) {
      setDate({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
      });
    }
  }, [currentFinancialYear, isFyLoading]);

  useEffect(() => {
    async function fetchData() {
      if (!firestore || !institutionId || !date?.from) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);

      const customersQuery = collection(firestore, 'institutions', institutionId, 'customers');
      const loanAppsQuery = collection(firestore, 'institutions', institutionId, 'loanApplications');
      const runningLoansQuery = collection(firestore, 'institutions', institutionId, 'runningLoans');
      const journalsQuery = query(
        collection(firestore, 'institutions', institutionId, 'journals'),
        where('date', '>=', Timestamp.fromDate(date.from)),
        where('date', '<=', Timestamp.fromDate(endOfDay(date.to || date.from)))
      );
      
      setLoadError(false);
      setIsLoading(true);
      try {
        const [customersSnap, loanAppsSnap, runningLoansSnap, journalsSnap] = await Promise.all([
          getDocs(customersQuery),
          getDocs(loanAppsQuery),
          getDocs(runningLoansQuery),
          getDocs(journalsQuery),
        ]);

        setAllData({
          customers: customersSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          loanApps: loanAppsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          runningLoans: runningLoansSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          journals: journalsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        });
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        setLoadError(true);
      } finally {
        setIsLoading(false);
      }
    }
    if (institutionId) {
      fetchData();
    } else if (!isUserLoading) {
      setIsLoading(false);
    }
  }, [firestore, institutionId, date, isUserLoading]);
  
  // Client-side filtering
  const filteredCustomers = useMemo(() => {
    if (!allData.customers) return [];
    if (selectedBranch === 'all') return allData.customers;
    return allData.customers.filter(c => c.branchId === selectedBranch);
  }, [allData.customers, selectedBranch]);

  const filteredLoans = useMemo(() => {
    const loans = [...(allData.loanApps || []), ...(allData.runningLoans || [])];
    if (selectedBranch === 'all') return loans;
    return loans.filter(l => l.branchId === selectedBranch);
  }, [allData.loanApps, allData.runningLoans, selectedBranch]);

  const filteredJournals = useMemo(() => {
    if (!allData.journals) return [];
    if (selectedBranch === 'all') return allData.journals;
    return allData.journals.filter(j => j.branchId === selectedBranch);
  }, [allData.journals, selectedBranch]);

  const productsQuery = useMemoFirebase(() => (firestore && institutionId ? collection(firestore, 'institutions', institutionId, 'loanProducts') : null), [firestore, institutionId]);
  const { data: loanProducts, isLoading: isProductsLoading } = useCollection(productsQuery);
  
  // --- KPI Calculations ---
  const activeLoans = filteredLoans.filter(l =>
    (l.status === 'Disbursed' || l.status === 'Overdue') &&
    Number(l.outstandingPrincipal ?? l.amount) > 0
  );
  const principalOutstanding = activeLoans.reduce((sum, l) => sum + (Number(l.outstandingPrincipal ?? l.amount) || 0), 0);
  
  const disbursedInRange = useMemo(() => {
    if (!date?.from || !date?.to) return 0;
    return filteredLoans
      .filter(l => {
        if (!l.disbursalDate) return false;
        const disbursalDate = toDate(l.disbursalDate);
        if (!disbursalDate) return false;
        return disbursalDate >= date.from! && disbursalDate <= endOfDay(date.to!);
      })
      .reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  }, [filteredLoans, date]);

   const { loansInArrears, portfolioAtRisk } = useMemo(() => {
    if (!activeLoans || !loanProducts) return { loansInArrears: [], portfolioAtRisk: 0 };
    const portfolioDate = systemDate || new Date();
    
    let parValue = 0;
    
    const overdueLoansDetails = activeLoans.map(loan => {
      const product = loanProducts.find(p => p.id === loan.loanProductId);
      const disbursalDate = toDate(loan.disbursalDate);
      if (!product || !disbursalDate || !Number(loan.amount) || !Number(loan.term)) return { loan, isOverdue: false, overdueAmount: 0, daysInArrears: 0, parBucket: 'Current' };
      
      const { schedule } = calculateAmortization({
        principal: loan.amount,
        annualInterestRate: product.annualInterestRate,
        term: loan.term,
        tenureUnit: loan.tenureUnit,
        interestRateType: product.interestRateType,
        startDate: toDate(loan.firstRepaymentDate) || disbursalDate,
      });

      const installmentsDue = schedule.filter(row => row.paymentDate < portfolioDate);
      const principalDue = installmentsDue.reduce((sum, row) => sum + row.principal, 0);
      const principalPaid = Math.max(0, (Number(loan.amount) || 0) - (Number(loan.outstandingPrincipal ?? loan.amount) || 0));
      // The loan record stores principal outstanding but not historical installment allocations.
      // Calculate overdue principal only; interest arrears cannot be measured reliably from this data.
      const overdueAmount = Math.max(0, principalDue - principalPaid);
      const firstUnpaidDueDate = installmentsDue.find(row => row.paymentDate > disbursalDate)?.paymentDate;
      if (overdueAmount > 0 && firstUnpaidDueDate) {
        const daysInArrears = Math.max(0, differenceInDays(portfolioDate, firstUnpaidDueDate));
        const parBucket = daysInArrears <= 30 ? '1–30 days' : daysInArrears <= 60 ? '31–60 days' : daysInArrears <= 90 ? '61–90 days' : '90+ days';
        if (daysInArrears > 30) parValue += Number(loan.outstandingPrincipal ?? loan.amount) || 0;
        return { loan, isOverdue: true, overdueAmount, daysInArrears, parBucket };
      }
      return { loan, isOverdue: false, overdueAmount: 0, daysInArrears: 0, parBucket: 'Current' };
    });

    const loansInArrears = overdueLoansDetails.filter(d => d.isOverdue).map(d => ({ ...d.loan, overdueAmount: d.overdueAmount, daysInArrears: d.daysInArrears, parBucket: d.parBucket }));

    return { loansInArrears, portfolioAtRisk: parValue };
  }, [activeLoans, loanProducts, systemDate]);

  const parRatio = principalOutstanding > 0 ? (portfolioAtRisk / principalOutstanding) * 100 : 0;


  const repaymentsInRange = useMemo(() => {
    if (!filteredJournals) return 0;
    
    return filteredJournals
      .filter(journal => journal.status === 'Posted' && Number(journal.repaymentAmount) > 0)
      .reduce((sum: number, journal: any) => sum + Number(journal.repaymentAmount), 0);
  }, [filteredJournals]);

  // --- Chart Data ---
  const monthlyDisbursementData = useMemo(() => {
    if (!filteredLoans) return [];
    const monthlyTotals = Array.from({ length: 6 }, (_, i) => {
        const monthDate = subMonths(startOfMonth(systemDate || new Date()), 5 - i);
        return {
            month: format(monthDate, 'MMM yy'),
            key: format(monthDate, 'yyyy-MM'),
            total: 0,
        };
    });

    filteredLoans.forEach(loan => {
        if (loan.disbursalDate) {
            const disbursementDate = toDate(loan.disbursalDate);
            if (!disbursementDate) return;
            const monthStr = format(disbursementDate, 'yyyy-MM');
            const monthIndex = monthlyTotals.findIndex(m => m.key === monthStr);
            if (monthIndex !== -1) {
                monthlyTotals[monthIndex].total += Number(loan.amount) || 0;
            }
        }
    });
    return monthlyTotals;
  }, [filteredLoans, systemDate]);

  const portfolioByProductData = useMemo(() => {
    if (!activeLoans || !loanProducts) return [];
    const productTotals = activeLoans.reduce((acc, loan) => {
        const product = loanProducts.find(p => p.id === loan.loanProductId);
        const productName = product?.name || 'Unknown';
        acc[productName] = (acc[productName] || 0) + (loan.outstandingPrincipal || 0);
        return acc;
    }, {} as Record<string, number>);

    return Object.entries(productTotals).map(([name, value]) => ({ name, value }));
  }, [activeLoans, loanProducts]);

  // --- Table Data ---
  const loansAwaitingDisbursement = filteredLoans.filter(l => l.status === 'Approved');

  const getCustomerName = (customerId: string) => filteredCustomers?.find(c => c.id === customerId)?.name || 'Unknown customer';
  const getProductName = (loanProductId: string) => loanProducts?.find(product => product.id === loanProductId)?.name || '—';
  
  const averageOutstanding = activeLoans.length ? principalOutstanding / activeLoans.length : 0;

  const pageIsLoading = isUserLoading || isInstitutionLoading || isProductsLoading || isLoading || isFyLoading;

  const kpiData = [
    { title: 'Outstanding Portfolio', value: formatCurrency(principalOutstanding), icon: WalletCards },
    { title: 'Active Loans', value: activeLoans.length, icon: Landmark },
    { title: 'PAR > 30 days (est.)', value: `${formatCurrency(portfolioAtRisk)} · ${parRatio.toFixed(1)}%`, icon: FileWarning },
    { title: 'Disbursed in period', value: formatCurrency(disbursedInRange), icon: TrendingUp },
    { title: 'Collections in period', value: formatCurrency(repaymentsInRange), icon: HandCoins },
    { title: 'Approved to disburse', value: loansAwaitingDisbursement?.length || 0, icon: CircleDollarSign },
    { title: 'Loans in arrears', value: loansInArrears.length, icon: ListTodo },
    { title: 'Average outstanding', value: formatCurrency(averageOutstanding), icon: Users },
  ];

  return (
    <div className="space-y-8 pb-8">
      {loadError && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-foreground">
          We couldn’t load the latest loan dashboard information. Please refresh the page and try again.
        </div>
      )}
        <DashboardPageHeader title="Loans" description="Monitor portfolio performance, repayment activity, and loans needing follow-up." />
        <div className="flex flex-wrap items-center justify-end gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm">
                 <BranchSwitcher />
                  <Popover>
                    <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                        "w-[260px] justify-start text-left font-normal",
                        !date && "text-muted-foreground"
                        )}
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
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {kpiData.map((kpi, index) => (
            <Card key={index} className="rounded-2xl border-border/70 shadow-sm transition-shadow hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
                <kpi.icon className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {pageIsLoading ? <Skeleton className="h-8 w-3/4" /> : <div className="text-2xl font-bold">{kpi.value}</div>}
                </CardContent>
            </Card>
            ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <Card className="rounded-2xl border-border/70 shadow-sm lg:col-span-3">
                <CardHeader>
                    <CardTitle>Disbursements · last six months</CardTitle>
                    <CardDescription>Loan principal funded each month for the selected branch.</CardDescription>
                </CardHeader>
                <CardContent>
                    {pageIsLoading ? <Skeleton className="h-[250px] w-full" /> : (
                        <ChartContainer config={{}} className="min-h-[250px] w-full">
                            <BarChart data={monthlyDisbursementData}>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} />
                                <YAxis tickFormatter={(value) => formatCurrency(value)} />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <Bar dataKey="total" fill="hsl(var(--primary))" radius={4} />
                            </BarChart>
                        </ChartContainer>
                    )}
                </CardContent>
            </Card>
            <Card className="rounded-2xl border-border/70 shadow-sm lg:col-span-2">
                <CardHeader>
                    <CardTitle>Outstanding by Product</CardTitle>
                    <CardDescription>Current principal balance across active loan products.</CardDescription>
                </CardHeader>
                <CardContent>
                    {pageIsLoading ? <Skeleton className="h-[250px] w-full" /> : (
                        <ChartContainer config={{}} className="min-h-[250px] w-full">
                            <PieChart>
                                <Pie data={portfolioByProductData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                    {portfolioByProductData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <RechartsLegend />
                            </PieChart>
                        </ChartContainer>
                    )}
                </CardContent>
            </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="rounded-2xl border-border/70 shadow-sm">
                <CardHeader>
                    <CardTitle>Awaiting Disbursement</CardTitle>
                    <CardDescription>Approved loans ready to be funded.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Loan product</TableHead><TableHead>Approved</TableHead><TableHead>Amount</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {pageIsLoading ? (
                                Array.from({ length: 2 }).map((_, i) => <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-6 w-full"/></TableCell></TableRow>)
                            ) : loansAwaitingDisbursement.length > 0 ? (
                                loansAwaitingDisbursement.slice(0, 8).map(loan => (
                                    <TableRow key={loan.id}>
                                        <TableCell>{getCustomerName(loan.customerId)}</TableCell>
                                        <TableCell>{getProductName(loan.loanProductId)}</TableCell>
                                        <TableCell>{toDate(loan.approvalDate) ? format(toDate(loan.approvalDate)!, 'dd MMM yyyy') : '—'}</TableCell>
                                        <TableCell>{formatCurrency(Number(loan.amount) || 0)}</TableCell>
                                        <TableCell className="text-right"><Button asChild size="sm"><Link href={`/staff/accounts/loan-disbursement?id=${loan.id}`}>Disburse</Link></Button></TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-muted-foreground mb-2"/> No loans are waiting for disbursement.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            <Card className="rounded-2xl border-border/70 shadow-sm">
                <CardHeader>
                    <CardTitle>Highest arrears exposure</CardTitle>
                    <CardDescription>Loans with the largest estimated overdue principal. Interest arrears are not included. Select a loan to open its 360° view.</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                    <Table>
                        <TableHeader><TableRow><TableHead>Customer / Product</TableHead><TableHead>Risk band</TableHead><TableHead>Days</TableHead><TableHead className="text-right">Outstanding</TableHead><TableHead className="text-right">Overdue principal</TableHead><TableHead/></TableRow></TableHeader>
                        <TableBody>
                            {pageIsLoading ? (
                                Array.from({ length: 2 }).map((_, i) => <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-6 w-full"/></TableCell></TableRow>)
                            ) : loansInArrears.length > 0 ? (
                                [...loansInArrears].sort((a, b) => b.overdueAmount - a.overdueAmount).slice(0, 5).map(loan => (
                                    <TableRow key={loan.id}>
                                        <TableCell><div className="font-medium">{getCustomerName(loan.customerId)}</div><div className="text-xs text-muted-foreground">{getProductName(loan.loanProductId)}</div></TableCell>
                                        <TableCell><span className={loan.daysInArrears > 30 ? 'font-medium text-destructive' : 'text-muted-foreground'}>{loan.parBucket}</span></TableCell>
                                        <TableCell>{loan.daysInArrears}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(Number(loan.outstandingPrincipal ?? loan.amount) || 0)}</TableCell>
                                        <TableCell className="text-right font-medium">{formatCurrency(loan.overdueAmount || 0)}</TableCell>
                                        <TableCell className="text-right"><Button asChild variant="ghost" size="icon"><Link aria-label="Open loan details" href={`/staff/loans/loan-details/${loan.id}`}><ArrowUpRight className="h-4 w-4"/></Link></Button></TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                 <TableRow><TableCell colSpan={6} className="h-24 text-center"><ListTodo className="mx-auto h-8 w-8 text-muted-foreground mb-2" /> No loans are currently in arrears.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
