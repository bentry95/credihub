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
import { Download, ShieldAlert } from 'lucide-react';
import { useUser, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, getDocs, doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { calculateAmortization } from '@/lib/finance';
import { isPast, differenceInDays } from 'date-fns';

interface ArrearsData {
  loan: any;
  customerName: string;
  productName: string;
  daysInArrears: number;
  parBucket: string;
}

export default function ArrearsReportPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [arrearsData, setArrearsData] = useState<ArrearsData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);
  const institutionId = userData?.institutionId;
  
  const { data: institutionData, isLoading: isInstitutionLoading } = useDoc(
    useMemoFirebase(() => (institutionId ? doc(firestore, 'institutions', institutionId) : null), [institutionId])
  );
  const systemDate = institutionData?.systemDate?.toDate();

  useEffect(() => {
    if (!firestore || !institutionId || !systemDate) {
        if (!isInstitutionLoading) setIsLoading(false);
        return;
    }
    
    const fetchAndCalculateArrears = async () => {
      setIsLoading(true);
      try {
        const loanAppsRef = collection(firestore, 'institutions', institutionId, 'loanApplications');
        const runningLoansRef = collection(firestore, 'institutions', institutionId, 'runningLoans');
        const productsRef = collection(firestore, 'institutions', institutionId, 'loanProducts');
        const customersRef = collection(firestore, 'institutions', institutionId, 'customers');

        const activeStatuses = ['Disbursed', 'Overdue'];
        const loanAppsQuery = query(loanAppsRef, where('status', 'in', activeStatuses));
        const runningLoansQuery = query(runningLoansRef, where('status', 'in', activeStatuses));

        const [loanAppsSnap, runningLoansSnap, productsSnap, customersSnap] = await Promise.all([
            getDocs(loanAppsQuery),
            getDocs(runningLoansQuery),
            getDocs(productsRef),
            getDocs(customersRef),
        ]);

        const allLoans = [...loanAppsSnap.docs, ...runningLoansSnap.docs].map(d => ({id:d.id, ...d.data()}));
        const allProducts = productsSnap.docs.map(d => ({id:d.id, ...d.data()}));
        const allCustomers = customersSnap.docs.map(d => ({id:d.id, ...d.data()}));

        const calculatedArrears: ArrearsData[] = [];

        for (const loan of allLoans) {
          const product = allProducts.find(p => p.id === loan.loanProductId);
          if (!product || !loan.disbursalDate) continue;

          const { schedule } = calculateAmortization({
            principal: loan.amount,
            annualInterestRate: product.annualInterestRate,
            term: loan.term,
            tenureUnit: loan.tenureUnit,
            interestRateType: product.interestRateType,
            startDate: loan.firstRepaymentDate?.toDate() || loan.disbursalDate.toDate(),
          });

          const totalPaid = (loan.amount || 0) - (loan.outstandingPrincipal || 0);
          
          let amountDue = 0;
          let firstOverdueDate: Date | null = null;
          
          for (const installment of schedule) {
            if (isPast(installment.paymentDate, systemDate)) {
              amountDue += installment.totalPayment;
              if (!firstOverdueDate) {
                firstOverdueDate = installment.paymentDate;
              }
            } else {
              break;
            }
          }

          if (totalPaid < amountDue && firstOverdueDate) {
            const daysInArrears = differenceInDays(systemDate, firstOverdueDate);
            let parBucket = '>90 Days';
            if (daysInArrears <= 30) parBucket = '1-30 Days';
            else if (daysInArrears <= 60) parBucket = '31-60 Days';
            else if (daysInArrears <= 90) parBucket = '61-90 Days';
            
            const customer = allCustomers.find(c => c.id === loan.customerId);

            calculatedArrears.push({
              loan,
              customerName: customer?.name || 'Unknown Customer',
              productName: product?.name || 'Unknown Product',
              daysInArrears,
              parBucket,
            });
          }
        }
        
        setArrearsData(calculatedArrears);
        
      } catch (error) {
        console.error("Error calculating arrears report: ", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAndCalculateArrears();

  }, [firestore, institutionId, systemDate, isInstitutionLoading]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Arrears & Delinquency Report</h1>
          <p className="text-muted-foreground mt-1">
            Portfolio at Risk (PAR) report, showing overdue loans and aging analysis.
          </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export to Excel
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Loans in Arrears</CardTitle>
          <CardDescription>
            A list of all loans with overdue payments, categorized by aging bucket.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer Name</TableHead>
                <TableHead>Loan Product</TableHead>
                <TableHead>Outstanding Principal (MWK)</TableHead>
                <TableHead>Days in Arrears</TableHead>
                <TableHead>PAR Bucket</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    </TableRow>
                  ))
              ) : arrearsData.length > 0 ? (
                arrearsData.map((loan) => (
                  <TableRow key={loan.loan.id}>
                    <TableCell className="font-medium">{loan.customerName}</TableCell>
                    <TableCell>{loan.productName}</TableCell>
                    <TableCell>{loan.loan.outstandingPrincipal.toLocaleString()}</TableCell>
                    <TableCell>{loan.daysInArrears}</TableCell>
                    <TableCell><Badge variant="destructive">{loan.parBucket}</Badge></TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="p-4 bg-muted rounded-full">
                            <ShieldAlert className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold">No Loans in Arrears</h3>
                        <p className="text-muted-foreground">The loan portfolio is currently performing well.</p>
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