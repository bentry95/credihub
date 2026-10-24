
'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Landmark, Settings, Link as LinkIcon } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, query, where, doc, getDocs } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { calculateAmortization } from '@/lib/finance';


interface LinkedLoan {
    id: string;
    employeeName: string;
    loanId: string;
    loanType: string;
    outstandingBalance: number;
    deductionAmount: number;
    deductionMethod: string;
}

export default function LoanDeductionsPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const [linkedLoans, setLinkedLoans] = useState<LinkedLoan[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const userDocRef = useMemoFirebase(
      () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
      [firestore, user]
    );
    const { data: userData } = useDoc(userDocRef);
    const institutionId = userData?.institutionId;

    const productsQuery = useMemoFirebase(
        () => (institutionId ? collection(firestore, 'institutions', institutionId, 'loanProducts') : null),
        [firestore, institutionId]
    );
    const { data: loanProducts, isLoading: isProductsLoading } = useCollection(productsQuery);
    
    useEffect(() => {
        if (!firestore || !institutionId) {
            setIsLoading(false);
            return;
        }

        const fetchLinkedLoans = async () => {
            setIsLoading(true);
            try {
                const employeesQuery = query(collection(firestore, 'institutions', institutionId, 'customers'), where('isEmployee', '==', true));
                const employeesSnap = await getDocs(employeesQuery);
                const employees = employeesSnap.docs.map(d => ({id: d.id, ...d.data()}));
                const employeeIds = employees.map(e => e.id);

                if (employeeIds.length === 0) {
                    setLinkedLoans([]);
                    setIsLoading(false);
                    return;
                }

                const loanAppsRef = collection(firestore, 'institutions', institutionId, 'loanApplications');
                const runningLoansRef = collection(firestore, 'institutions', institutionId, 'runningLoans');

                const activeStatuses = ['Disbursed', 'Overdue'];
                const loanAppsQuery = query(loanAppsRef, where('customerId', 'in', employeeIds), where('status', 'in', activeStatuses));
                const runningLoansQuery = query(runningLoansRef, where('customerId', 'in', employeeIds), where('status', 'in', activeStatuses));

                const [loanAppsSnap, runningLoansSnap] = await Promise.all([
                    getDocs(loanAppsQuery),
                    getDocs(runningLoansQuery)
                ]);

                const allActiveLoans = [
                    ...loanAppsSnap.docs.map(d => ({id:d.id, ...d.data()})),
                    ...runningLoansSnap.docs.map(d => ({id:d.id, ...d.data()}))
                ];
                
                const getProductName = (productId: string) => loanProducts?.find(p => p.id === productId)?.name || '...';
                
                const linked = allActiveLoans.map(loan => {
                    const employee = employees.find(e => e.id === loan.customerId);
                    const product = loanProducts?.find(p => p.id === loan.loanProductId);
                    
                    const { monthlyInstallment } = calculateAmortization({
                        principal: loan.amount,
                        annualInterestRate: product?.annualInterestRate || 0,
                        term: loan.term,
                        tenureUnit: loan.tenureUnit,
                        interestRateType: product?.interestRateType || 'Reducing Balance',
                        startDate: loan.disbursalDate?.toDate(),
                    });

                    return {
                        id: loan.id,
                        employeeName: employee?.name || 'Unknown',
                        loanId: loan.id,
                        loanType: product?.name || 'Unknown Product',
                        outstandingBalance: loan.outstandingPrincipal || 0,
                        deductionAmount: monthlyInstallment,
                        deductionMethod: 'Fixed Amount'
                    };
                });
                
                setLinkedLoans(linked);

            } catch (error) {
                console.error("Error fetching linked loans:", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (!isProductsLoading) {
            fetchLinkedLoans();
        }

    }, [firestore, institutionId, isProductsLoading, loanProducts]);
    
    const finalLoading = isLoading || isProductsLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payroll Loan Deductions</h1>
          <p className="text-muted-foreground mt-1">
            Manage and reconcile automated loan repayments deducted from employee salaries.
          </p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" disabled>
                <Settings className="mr-2 h-4 w-4" />
                Configure Deduction Rules
            </Button>
            <Button variant="outline" disabled>
                <Download className="mr-2 h-4 w-4" />
                Export Report
            </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Linked Employee Loans</CardTitle>
          <CardDescription>
            A list of all active loans linked to employees for automated payroll deduction.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee Name</TableHead>
                <TableHead>Loan</TableHead>
                <TableHead>Deduction Method</TableHead>
                <TableHead>Deduction Amount</TableHead>
                <TableHead>Outstanding Balance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {finalLoading ? (
                 Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-9 w-24 ml-auto" /></TableCell>
                    </TableRow>
                ))
              ) : linkedLoans.length > 0 ? (
                linkedLoans.map((link) => (
                  <TableRow key={link.id}>
                    <TableCell className="font-medium">{link.employeeName}</TableCell>
                    <TableCell>{link.loanType}</TableCell>
                    <TableCell>{link.deductionMethod}</TableCell>
                    <TableCell>MWK {link.deductionAmount.toLocaleString()}</TableCell>
                    <TableCell>MWK {link.outstandingBalance.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" disabled>Manage</Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-muted rounded-full">
                        <LinkIcon className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold">No Linked Loans</h3>
                      <p className="text-muted-foreground max-w-md">
                        There are no employee loans currently set up for automated payroll deduction.
                      </p>
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
