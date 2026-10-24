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
import { Download, Building, FileWarning } from 'lucide-react';
import {
  useUser,
  useFirestore,
  useDoc,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, getDocs, doc, getDoc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';

interface BranchPerformanceData {
  id: string;
  name: string;
  loanCount: number;
  valueDisbursed: number;
  portfolioSize: number;
  customerCount: number;
}

export default function BranchPerformanceReportPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [performanceData, setPerformanceData] = useState<BranchPerformanceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);
  const institutionId = userData?.institutionId;

  useEffect(() => {
    if (!firestore || !institutionId) {
      setIsLoading(false);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const loanAppsQuery = query(collection(firestore, 'institutions', institutionId, 'loanApplications'));
        const runningLoansQuery = query(collection(firestore, 'institutions', institutionId, 'runningLoans'));
        const customersQuery = query(collection(firestore, 'institutions', institutionId, 'customers'));
        const institutionQuery = doc(firestore, 'institutions', institutionId);

        const [loanAppsSnap, runningLoansSnap, customersSnap, institutionSnap] = await Promise.all([
          getDocs(loanAppsQuery),
          getDocs(runningLoansQuery),
          getDocs(customersQuery),
          getDoc(institutionQuery),
        ]);

        const allLoans = [
          ...loanAppsSnap.docs.map(d => ({ ...d.data(), id: d.id })),
          ...runningLoansSnap.docs.map(d => ({ ...d.data(), id: d.id })),
        ];
        const allCustomers = customersSnap.docs.map(d => ({ ...d.data(), id: d.id }));
        const institutionData = institutionSnap.data();
        
        if (!institutionData) {
            setIsLoading(false);
            return;
        }
        
        const hqBranch = { id: '01', code: '01', name: institutionData.hqBranch?.name || 'Headquarters' };
        const allBranches = [hqBranch, ...(institutionData.branches || [])];

        const branchDataMap: Record<string, BranchPerformanceData> = {};

        allBranches.forEach(branch => {
            branchDataMap[branch.id] = {
                id: branch.id,
                name: branch.name,
                loanCount: 0,
                valueDisbursed: 0,
                portfolioSize: 0,
                customerCount: 0,
            };
        });
        
        allCustomers.forEach(customer => {
            if (branchDataMap[customer.branchId]) {
                branchDataMap[customer.branchId].customerCount++;
            }
        });
        
        allLoans.forEach(loan => {
          if (branchDataMap[loan.branchId]) {
            if (loan.status === 'Disbursed' || loan.status === 'Overdue' || loan.status === 'Repaid') {
              branchDataMap[loan.branchId].valueDisbursed += loan.amount || 0;
            }
            if (loan.status === 'Disbursed' || loan.status === 'Overdue') {
              branchDataMap[loan.branchId].loanCount++;
              branchDataMap[loan.branchId].portfolioSize += loan.outstandingPrincipal || 0;
            }
          }
        });

        setPerformanceData(Object.values(branchDataMap));

      } catch (error) {
        console.error("Failed to generate branch performance report:", error);
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
          <h1 className="text-3xl font-bold tracking-tight">Branch Performance Report</h1>
          <p className="text-muted-foreground mt-1">
            Compares key metrics like disbursements, collections, and portfolio quality across all branches.
          </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export to Excel
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Performance by Branch</CardTitle>
          <CardDescription>
            A high-level summary of each branch's contribution to the portfolio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Branch</TableHead>
                <TableHead>No. of Active Loans</TableHead>
                <TableHead>Total Value Disbursed</TableHead>
                <TableHead>Active Portfolio Size</TableHead>
                <TableHead>No. of Customers</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  </TableRow>
                ))
              ) : performanceData.length > 0 ? (
                performanceData.map((branch) => (
                  <TableRow key={branch.id}>
                    <TableCell className="font-medium">{branch.name}</TableCell>
                    <TableCell>{branch.loanCount}</TableCell>
                    <TableCell>MWK {branch.valueDisbursed.toLocaleString()}</TableCell>
                    <TableCell>MWK {branch.portfolioSize.toLocaleString()}</TableCell>
                    <TableCell>{branch.customerCount}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-muted rounded-full">
                        <FileWarning className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold">No Data to Display</h3>
                      <p className="text-muted-foreground">There is no performance data available for any branches.</p>
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