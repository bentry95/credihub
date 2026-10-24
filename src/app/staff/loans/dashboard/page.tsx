
      

'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
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
import { Separator } from '@/components/ui/separator';
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
  } from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Pie, PieChart, Cell, Legend as RechartsLegend } from "recharts"
import { Skeleton } from '@/components/ui/skeleton';
import { startOfMonth, endOfMonth, subMonths, format, addDays, isPast } from 'date-fns';
import { useBranch } from '@/context/BranchContext';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import type { DateRange } from 'react-day-picker';
import { calculateAmortization, calculateRepaymentSplit } from '@/lib/finance';


const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

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
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  
  const { selectedBranch, availableBranches } = useBranch();

  const [date, setDate] = useState<DateRange | undefined>(undefined);
  
  const [allData, setAllData] = useState<{
    customers: any[];
    loanApps: any[];
    runningLoans: any[];
    journals: any[];
  }>({ customers: [], loanApps: [], runningLoans: [], journals: [] });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => setCurrentDate(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
        where('date', '<=', Timestamp.fromDate(date.to!))
      );
      
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
      } finally {
        setIsLoading(false);
      }
    }
    if (institutionId) {
      fetchData();
    }
  }, [firestore, institutionId, date]);
  
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
  const activeLoans = filteredLoans.filter(l => l.status === 'Disbursed' || l.status === 'Overdue');
  const principalOutstanding = activeLoans.reduce((sum, l) => sum + (l.outstandingPrincipal || 0), 0);
  
  const disbursedInRange = useMemo(() => {
    if (!date?.from || !date?.to) return 0;
    return filteredLoans
      .filter(l => {
        if (!l.disbursalDate) return false;
        const disbursalDate = l.disbursalDate.toDate();
        return disbursalDate >= date.from! && disbursalDate <= date.to!;
      })
      .reduce((sum, l) => sum + l.amount, 0);
  }, [filteredLoans, date]);

  const newCustomersInRange = useMemo(() => {
    if (!date?.from || !date?.to || !filteredCustomers) return 0;
    return filteredCustomers.filter(c => {
      if (!c.createdAt) return false;
      const creationDate = c.createdAt.toDate();
      return creationDate >= date.from! && creationDate <= date.to!;
    }).length;
  }, [filteredCustomers, date]);
    
   const { loansInArrears, portfolioAtRisk, totalInterestArrears } = useMemo(() => {
    if (!activeLoans || !loanProducts || !systemDate) return { loansInArrears: [], portfolioAtRisk: 0, totalInterestArrears: 0 };
    
    let parValue = 0;
    let totalInterestArrears = 0;
    
    const overdueLoansDetails = activeLoans.map(loan => {
      const product = loanProducts.find(p => p.id === loan.loanProductId);
      if (!product || !loan.disbursalDate) return { loan, isOverdue: false, overdueAmount: 0 };
      
      const { schedule } = calculateAmortization({
        principal: loan.amount,
        annualInterestRate: product.annualInterestRate,
        term: loan.term,
        tenureUnit: loan.tenureUnit,
        interestRateType: product.interestRateType,
        startDate: loan.firstRepaymentDate?.toDate() || loan.disbursalDate?.toDate(),
      });

      const totalPaid = (loan.amount || 0) - (loan.outstandingPrincipal || 0);

      const installmentsDue = schedule.filter(row => isPast(row.paymentDate, systemDate));
      const totalPrincipalDue = installmentsDue.reduce((sum, row) => sum + row.principal, 0);
      const totalInterestDue = installmentsDue.reduce((sum, row) => sum + row.interest, 0);

      let principalPaid = 0;
      let interestPaid = 0;
      let remainingPayment = totalPaid;

      interestPaid = Math.min(remainingPayment, totalInterestDue);
      remainingPayment -= interestPaid;
      principalPaid = Math.min(remainingPayment, totalPrincipalDue);

      const interestArrears = totalInterestDue - interestPaid;
      
      if (interestArrears > 0 || (totalPrincipalDue - principalPaid) > 0) {
        parValue += loan.outstandingPrincipal;
        totalInterestArrears += interestArrears;
        return { loan, isOverdue: true, overdueAmount: (totalPrincipalDue - principalPaid) + interestArrears };
      }
      
      return { loan, isOverdue: false, overdueAmount: 0 };
    });

    const loansInArrears = overdueLoansDetails.filter(d => d.isOverdue).map(d => ({ ...d.loan, overdueAmount: d.overdueAmount }));

    return { loansInArrears, portfolioAtRisk: parValue, totalInterestArrears };
  }, [activeLoans, loanProducts, systemDate]);

  const grossLoanPortfolio = principalOutstanding + totalInterestArrears;


  const repaymentsInRange = useMemo(() => {
    if (!filteredJournals || !loanProducts) return 0;
    
    return filteredJournals
      .filter(journal => 
        journal.status === 'Posted' && journal.repaymentAmount > 0
      )
      .reduce((sum: number, journal: any) => sum + journal.repaymentAmount, 0);
  }, [filteredJournals, loanProducts]);

  // --- Chart Data ---
  const monthlyDisbursementData = useMemo(() => {
    if (!filteredLoans) return [];
    const monthlyTotals = Array.from({ length: 6 }, (_, i) => {
        const monthDate = subMonths(new Date(), 5 - i);
        return {
            month: format(monthDate, 'MMM'),
            total: 0,
        };
    });

    filteredLoans.forEach(loan => {
        if (loan.disbursalDate) {
            const disbursementDate = loan.disbursalDate.toDate();
            const monthStr = format(disbursementDate, 'MMM');
            const monthIndex = monthlyTotals.findIndex(m => m.month === monthStr);
            if (monthIndex !== -1) {
                monthlyTotals[monthIndex].total += loan.amount;
            }
        }
    });
    return monthlyTotals;
  }, [filteredLoans]);

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

  const getCustomerName = (customerId: string) => filteredCustomers?.find(c => c.id === customerId)?.name || '...';
  
  const calculateDaysOverdue = (firstRepaymentDate?: Timestamp) => {
    if (!firstRepaymentDate || !systemDate) return 0;
    const diff = systemDate.getTime() - firstRepaymentDate.toDate().getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  }

  const pageIsLoading = isUserLoading || isInstitutionLoading || isProductsLoading || isLoading || isFyLoading;

  const kpiData = [
    { title: 'Gross Loan Portfolio', value: `MWK ${grossLoanPortfolio.toLocaleString()}`, icon: WalletCards },
    { title: 'Active Loans', value: activeLoans.length, icon: Landmark },
    { title: 'Total Customers', value: filteredCustomers?.length || 0, icon: Users },
    { title: 'Portfolio at Risk (>30d)', value: `MWK ${portfolioAtRisk.toLocaleString()}`, icon: FileWarning },
    { title: 'Disbursed', value: `MWK ${disbursedInRange.toLocaleString()}`, icon: TrendingUp },
    { title: 'Repayments', value: `MWK ${repaymentsInRange.toLocaleString()}`, icon: HandCoins },
    { title: 'New Customers', value: newCustomersInRange, icon: Users },
    { title: 'Loans in Arrears', value: loansInArrears.length, icon: ListTodo },
  ];

  return (
    <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
                <h1 className="text-2xl font-bold">Loans Dashboard</h1>
                <p className="text-muted-foreground">An analytical overview of the entire loan portfolio.</p>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
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
        </div>

        <Separator />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {kpiData.map((kpi, index) => (
            <Card key={index}>
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
            <Card className="lg:col-span-3">
                <CardHeader>
                    <CardTitle>New Loans Disbursed (by Month)</CardTitle>
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
            <Card className="lg:col-span-2">
                <CardHeader>
                    <CardTitle>Portfolio by Product</CardTitle>
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
            <Card>
                <CardHeader>
                    <CardTitle>Awaiting Disbursement</CardTitle>
                    <CardDescription>Approved loans ready to be funded.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Amount</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {pageIsLoading ? (
                                Array.from({ length: 2 }).map((_, i) => <TableRow key={i}><TableCell colSpan={3}><Skeleton className="h-6 w-full"/></TableCell></TableRow>)
                            ) : loansAwaitingDisbursement.length > 0 ? (
                                loansAwaitingDisbursement.map(loan => (
                                    <TableRow key={loan.id}>
                                        <TableCell>{getCustomerName(loan.customerId)}</TableCell>
                                        <TableCell>MWK {loan.amount.toLocaleString()}</TableCell>
                                        <TableCell className="text-right"><Button asChild size="sm"><Link href={`/staff/accounts/loan-disbursement?id=${loan.id}`}>Disburse</Link></Button></TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={3} className="h-24 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-muted-foreground mb-2"/> No loans are waiting for disbursement.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Top 5 Loans in Arrears</CardTitle>
                    <CardDescription>Customers with overdue payments needing follow-up.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Days Overdue</TableHead><TableHead className="text-right">Overdue Amount</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {pageIsLoading ? (
                                Array.from({ length: 2 }).map((_, i) => <TableRow key={i}><TableCell colSpan={3}><Skeleton className="h-6 w-full"/></TableCell></TableRow>)
                            ) : loansInArrears.length > 0 ? (
                                loansInArrears.slice(0, 5).map(loan => (
                                    <TableRow key={loan.id}>
                                        <TableCell>{getCustomerName(loan.customerId)}</TableCell>
                                        <TableCell>{calculateDaysOverdue(loan.firstRepaymentDate)}</TableCell>
                                        <TableCell className="text-right">MWK {loan.overdueAmount ? loan.overdueAmount.toLocaleString() : '0'}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                 <TableRow><TableCell colSpan={3} className="h-24 text-center"><ListTodo className="mx-auto h-8 w-8 text-muted-foreground mb-2" /> No loans are currently in arrears.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}

    