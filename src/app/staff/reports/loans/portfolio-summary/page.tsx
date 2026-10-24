
'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
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
import { Download, FilePieChart, FileWarning } from 'lucide-react';
import {
  useUser,
  useFirestore,
  useDoc,
  useMemoFirebase,
} from '@/firebase';
import { collection, doc, query, getDocs, getDoc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { calculateAmortization } from '@/lib/finance';

interface PortfolioRow {
    branch: string;
    product: string;
    loanCount: number;
    principal: number;
    interest: number;
    total: number;
}


export default function PortfolioSummaryPage() {
    const { user } = useUser();
    const firestore = useFirestore();

    const [portfolioData, setPortfolioData] = useState<PortfolioRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const { data: userData, isLoading: isUserLoading } = useDoc(
        useMemoFirebase(() => (user && user.uid ? doc(firestore, 'users', user.uid) : null), [firestore, user])
    );
    const institutionId = userData?.institutionId;

    useEffect(() => {
        if (!firestore || !institutionId) {
            setIsLoading(false);
            return;
        };

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const loanAppsQuery = query(collection(firestore, 'institutions', institutionId, 'loanApplications'));
                const runningLoansQuery = query(collection(firestore, 'institutions', institutionId, 'runningLoans'));
                const productsQuery = query(collection(firestore, 'institutions', institutionId, 'loanProducts'));
                const institutionQuery = doc(firestore, 'institutions', institutionId);

                const [
                    loanAppsSnap,
                    runningLoansSnap,
                    productsSnap,
                    institutionSnap
                ] = await Promise.all([
                    getDocs(loanAppsQuery),
                    getDocs(runningLoansQuery),
                    getDocs(productsQuery),
                    getDoc(institutionQuery),
                ]);

                const activeLoans = [
                    ...loanAppsSnap.docs.map(d => ({...d.data()})),
                    ...runningLoansSnap.docs.map(d => ({...d.data()}))
                ].filter(l => l.status === 'Disbursed' || l.status === 'Overdue');
                
                const products = productsSnap.docs.map(d => ({...d.data(), id: d.id}));
                const institutionData = institutionSnap.data();

                const hqBranch = { id: '01', name: institutionData?.hqBranch?.name || 'Headquarters' };
                const allBranches = [hqBranch, ...(institutionData?.branches || [])];

                const summary: Record<string, PortfolioRow> = {};

                for (const loan of activeLoans) {
                    const product = products.find(p => p.id === loan.loanProductId);
                    const branch = allBranches.find(b => b.id === loan.branchId);

                    if (!product || !branch) continue;
                    
                    const { schedule } = calculateAmortization({
                      principal: loan.amount,
                      annualInterestRate: product.annualInterestRate,
                      term: loan.term,
                      tenureUnit: loan.tenureUnit || 'Months',
                      interestRateType: product.interestRateType,
                      startDate: loan.disbursalDate?.toDate(),
                    });
                    
                    const outstandingPrincipal = loan.outstandingPrincipal || loan.amount;
                    const totalInterestToPay = schedule.reduce((acc, row) => acc + row.interest, 0);
                    const outstandingInterest = totalInterestToPay; // Simplified
                    const totalOutstanding = outstandingPrincipal + outstandingInterest;


                    const key = `${branch.id}-${product.id}`;
                    if (!summary[key]) {
                        summary[key] = {
                            branch: branch.name,
                            product: product.name,
                            loanCount: 0,
                            principal: 0,
                            interest: 0,
                            total: 0,
                        };
                    }
                    summary[key].loanCount++;
                    summary[key].principal += outstandingPrincipal;
                    summary[key].interest += outstandingInterest;
                    summary[key].total += totalOutstanding;
                }
                
                setPortfolioData(Object.values(summary));
            } catch (error) {
                console.error("Failed to fetch portfolio data", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [firestore, institutionId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Loan Portfolio Summary</h1>
          <p className="text-muted-foreground mt-1">
            A high-level overview of all active loans, broken down by branch and product.
          </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export to Excel
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Active Loan Portfolio</CardTitle>
          <CardDescription>
            A summary of the current loan book.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Branch</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>No. of Loans</TableHead>
                <TableHead className="text-right">Outstanding Principal</TableHead>
                <TableHead className="text-right">Outstanding Interest</TableHead>
                <TableHead className="text-right">Total Outstanding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                          <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                          <TableCell className="text-right"><Skeleton className="h-5 w-28 ml-auto" /></TableCell>
                          <TableCell className="text-right"><Skeleton className="h-5 w-24 ml-auto" /></TableCell>
                          <TableCell className="text-right"><Skeleton className="h-5 w-28 ml-auto" /></TableCell>
                      </TableRow>
                  ))
              ) : portfolioData.length > 0 ? (
                portfolioData.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>{row.branch}</TableCell>
                    <TableCell>{row.product}</TableCell>
                    <TableCell>{row.loanCount}</TableCell>
                    <TableCell className="text-right font-mono">{row.principal.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono">{row.interest.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono">{row.total.toLocaleString()}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                    <TableCell colSpan={6} className="h-48 text-center">
                         <div className="flex flex-col items-center gap-4">
                            <div className="p-4 bg-muted rounded-full">
                                <FilePieChart className="h-10 w-10 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-semibold">No Active Loans Found</h3>
                            <p className="text-muted-foreground">There is no active loan data to build the report.</p>
                        </div>
                    </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        {portfolioData.length > 0 && (
            <CardFooter className="justify-end pt-4">
                 <p className="text-xs text-muted-foreground">Note: Outstanding Interest is a simplified sum of total interest over the loan life.</p>
            </CardFooter>
        )}
      </Card>
    </div>
  );
}
