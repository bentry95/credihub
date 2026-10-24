

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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  Wallet,
  Landmark,
  FileText,
  PlayCircle,
  MoreVertical,
} from 'lucide-react';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, doc, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { format } from 'date-fns';
import Link from 'next/link';

const kpiData = [
  { title: 'Active Employees on Payroll', icon: Users, dataKey: 'activeEmployees' },
  { title: 'Gross Pay (Last Run)', icon: Wallet, dataKey: 'grossPay', currency: true },
  { title: 'Net Pay (Last Run)', icon: Landmark, dataKey: 'netPay', currency: true },
  { title: 'Loan Deductions (Last Run)', icon: FileText, dataKey: 'loanDeductions', currency: true },
];

export default function PayrollDashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [kpiValues, setKpiValues] = useState({
    activeEmployees: 0,
    grossPay: 0,
    netPay: 0,
    loanDeductions: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);
  const institutionId = userData?.institutionId;

  const payrollsQuery = useMemoFirebase(
    () =>
      firestore && institutionId
        ? query(
            collection(firestore, 'institutions', institutionId, 'payrolls'),
            orderBy('period', 'desc'),
            limit(5)
          )
        : null,
    [firestore, institutionId]
  );
  const { data: recentPayrolls, isLoading: isPayrollsLoading } = useCollection(payrollsQuery);

  const employeesQuery = useMemoFirebase(
    () =>
      firestore && institutionId
        ? query(
            collection(firestore, 'institutions', institutionId, 'customers'),
            where('isEmployee', '==', true)
          )
        : null,
    [firestore, institutionId]
  );
  const { data: employees, isLoading: isEmployeesLoading } = useCollection(employeesQuery);

  useEffect(() => {
    async function calculateStats() {
      if (!firestore || !institutionId || !recentPayrolls || !employees) {
        if (!isPayrollsLoading && !isEmployeesLoading) setIsLoading(false);
        return;
      }
      setIsLoading(true);

      let totalLoanDeductions = 0;
      if (recentPayrolls.length > 0) {
        const lastRun = recentPayrolls[0];
        const payslipsRef = collection(firestore, 'institutions', institutionId, 'payrolls', lastRun.id, 'payslips');
        const payslipsSnap = await getDocs(payslipsRef);
        
        payslipsSnap.forEach(doc => {
            const deductions = doc.data().deductions || [];
            const loanDeduction = deductions.find((d: any) => d.name.toLowerCase().includes('loan'));
            if (loanDeduction) {
                totalLoanDeductions += loanDeduction.amount;
            }
        });

        setKpiValues({
            activeEmployees: employees.length,
            grossPay: lastRun.totalAmount || 0,
            netPay: lastRun.totalNet || 0,
            loanDeductions: totalLoanDeductions,
        });
      } else {
         setKpiValues({
            activeEmployees: employees.length,
            grossPay: 0,
            netPay: 0,
            loanDeductions: 0,
        });
      }
      
      setIsLoading(false);
    }
    
    if (!isPayrollsLoading && !isEmployeesLoading) {
      calculateStats();
    }
  }, [firestore, institutionId, recentPayrolls, employees, isPayrollsLoading, isEmployeesLoading]);

  const getBadgeVariant = (status: string) => {
    switch (status) {
      case 'Paid':
        return 'default';
      case 'Processed':
        return 'secondary';
      case 'Draft':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const finalIsLoading = isLoading || isPayrollsLoading || isEmployeesLoading;

  return (
    <div className="space-y-6">
       <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payroll Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            An overview of payroll activities and key metrics.
          </p>
        </div>
        <Button asChild>
            <Link href="/staff/payroll/payroll-runs">
                <PlayCircle className="mr-2 h-4 w-4" /> Process New Payroll
            </Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {kpiData.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              <kpi.icon className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {finalIsLoading ? <Skeleton className="h-8 w-3/4" /> : (
                 <div className="text-3xl font-bold">
                    {kpi.currency ? `MWK ${kpiValues[kpi.dataKey as keyof typeof kpiValues].toLocaleString()}` : kpiValues[kpi.dataKey as keyof typeof kpiValues]}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

       <Card>
        <CardHeader>
          <CardTitle>Recent Payroll Runs</CardTitle>
          <CardDescription>
            A history of the most recent payrolls processed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total Gross Pay</TableHead>
                <TableHead>Total Net Pay</TableHead>
                <TableHead>Processed By</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPayrollsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                    </TableRow>
                ))
              ) : recentPayrolls && recentPayrolls.length > 0 ? (
                recentPayrolls.map((payroll) => (
                  <TableRow key={payroll.id}>
                    <TableCell className="font-medium">{payroll.period}</TableCell>
                    <TableCell><Badge variant={getBadgeVariant(payroll.status)}>{payroll.status}</Badge></TableCell>
                    <TableCell>MWK {payroll.totalAmount.toLocaleString()}</TableCell>
                    <TableCell>MWK {payroll.totalNet.toLocaleString()}</TableCell>
                    <TableCell>{payroll.processedBy}</TableCell>
                    <TableCell className="text-right">
                       <Button variant="ghost" size="icon">
                           <MoreVertical className="h-5 w-5" />
                       </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No payroll runs found.
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
