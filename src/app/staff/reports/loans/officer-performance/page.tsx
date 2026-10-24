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
import { Download, UserCog, TrendingUp, TrendingDown } from 'lucide-react';
import { useUser, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, getDocs, doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';

interface OfficerPerformance {
  officerId: string;
  officerName: string;
  loansDisbursed: number;
  valueDisbursed: number;
  repaymentsCollected: number;
  valueCollected: number;
  portfolioSize: number;
}

export default function OfficerPerformanceReportPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [performanceData, setPerformanceData] = useState<OfficerPerformance[]>([]);
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
    };

    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch all necessary data
        const staffQuery = query(collection(firestore, 'users'), where('institutionId', '==', institutionId));
        const loanAppsQuery = query(collection(firestore, 'institutions', institutionId, 'loanApplications'));
        const runningLoansQuery = query(collection(firestore, 'institutions', institutionId, 'runningLoans'));
        const journalsQuery = query(collection(firestore, 'institutions', institutionId, 'journals'), where('status', '==', 'Posted'));

        const [staffSnap, loanAppsSnap, runningLoansSnap, journalsSnap] = await Promise.all([
          getDocs(staffQuery),
          getDocs(loanAppsQuery),
          getDocs(runningLoansQuery),
          getDocs(journalsQuery)
        ]);
        
        const staff = staffSnap.docs.map(d => ({...d.data(), id: d.id}));
        const allLoans = [
          ...loanAppsSnap.docs.map(d => ({...d.data(), id: d.id})),
          ...runningLoansSnap.docs.map(d => ({...d.data(), id: d.id})),
        ];
        const allJournals = journalsSnap.docs.map(d => d.data());

        const performanceMap: Record<string, OfficerPerformance> = {};

        // Initialize map for all staff
        staff.forEach(s => {
          performanceMap[s.uid] = {
            officerId: s.uid,
            officerName: s.name,
            loansDisbursed: 0,
            valueDisbursed: 0,
            repaymentsCollected: 0,
            valueCollected: 0,
            portfolioSize: 0,
          };
        });

        // Process loans
        allLoans.forEach(loan => {
          const officerId = loan.submittedBy || loan.appraisedBy;
          if (officerId && performanceMap[officerId]) {
            // Disbursed loans
            if (loan.status === 'Disbursed' || loan.status === 'Repaid' || loan.status === 'Overdue') {
              performanceMap[officerId].loansDisbursed++;
              performanceMap[officerId].valueDisbursed += loan.amount;
            }
            // Active portfolio
            if (loan.status === 'Disbursed' || loan.status === 'Overdue') {
              performanceMap[officerId].portfolioSize += loan.outstandingPrincipal;
            }
          }
        });
        
        // Process repayments
        allJournals.forEach(journal => {
            if (journal.loanId && journal.repaymentAmount > 0) {
                const relatedLoan = allLoans.find(l => l.id === journal.loanId);
                const officerId = relatedLoan?.submittedBy || relatedLoan?.appraisedBy;
                if(officerId && performanceMap[officerId]) {
                    performanceMap[officerId].repaymentsCollected++;
                    performanceMap[officerId].valueCollected += journal.repaymentAmount;
                }
            }
        });

        setPerformanceData(Object.values(performanceMap).filter(
            p => p.loansDisbursed > 0 || p.repaymentsCollected > 0 || p.portfolioSize > 0
        ));
        
      } catch (error) {
        console.error("Failed to generate performance report:", error);
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
          <h1 className="text-3xl font-bold tracking-tight">Loan Officer Performance</h1>
          <p className="text-muted-foreground mt-1">
            Compares loan officers based on disbursement volume, collections, and portfolio quality.
          </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export to Excel
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
          <CardDescription>
            A comparison of key performance indicators for each loan officer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Officer Name</TableHead>
                <TableHead className="text-right"># Loans Disbursed</TableHead>
                <TableHead className="text-right">Value Disbursed</TableHead>
                <TableHead className="text-right">Value Collected</TableHead>
                <TableHead className="text-right">Portfolio Size</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-24 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-24 ml-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-28 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : performanceData.length > 0 ? (
                performanceData.map((officer) => (
                  <TableRow key={officer.officerId}>
                    <TableCell className="font-medium">{officer.officerName}</TableCell>
                    <TableCell className="text-right">{officer.loansDisbursed}</TableCell>
                    <TableCell className="text-right font-mono">MWK {officer.valueDisbursed.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono">MWK {officer.valueCollected.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono">MWK {officer.portfolioSize.toLocaleString()}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-muted rounded-full">
                        <UserCog className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold">No Performance Data Found</h3>
                      <p className="text-muted-foreground">There is no loan officer activity to report on yet.</p>
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