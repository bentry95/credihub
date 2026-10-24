
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
import { Download, FileSearch, FileWarning } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import {
  useUser,
  useFirestore,
  useMemoFirebase,
} from '@/firebase';
import { collection, query, getDocs, doc, getDoc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';


export default function LoanFunnelReportPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  
  const [allLoans, setAllLoans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [institutionId, setInstitutionId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserData() {
      if (user && firestore) {
        const userDocRef = doc(firestore, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          setInstitutionId(userDocSnap.data().institutionId);
        }
      }
    }
    fetchUserData();
  }, [user, firestore]);
  
  useEffect(() => {
    async function fetchLoans() {
        if (!firestore || !institutionId) {
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        try {
            const loanAppsQuery = query(collection(firestore, 'institutions', institutionId, 'loanApplications'));
            const runningLoansQuery = query(collection(firestore, 'institutions', institutionId, 'runningLoans'));

            const [loanAppsSnap, runningLoansSnap] = await Promise.all([
                getDocs(loanAppsQuery),
                getDocs(runningLoansQuery),
            ]);

            const loans = [
                ...loanAppsSnap.docs.map(d => ({...d.data(), id: d.id})),
                ...runningLoansSnap.docs.map(d => ({...d.data(), id: d.id}))
            ];
            setAllLoans(loans);
        } catch (error) {
            console.error("Failed to fetch loan data for funnel report:", error);
        } finally {
            setIsLoading(false);
        }
    }
    if (institutionId) {
        fetchLoans();
    }
  }, [firestore, institutionId]);

  const funnelData = useMemo(() => {
    if (!allLoans) return [];

    const stages = [
      {
        stage: 'Application',
        statuses: ['Application', 'Appraisal', 'Pending Approval', 'Approved', 'Disbursed', 'Repaid', 'Overdue', 'Rejected', 'Write-Off Pending', 'Written-Off', 'Reversal Pending', 'Reversed'],
      },
      {
        stage: 'Appraisal',
        statuses: ['Appraisal', 'Pending Approval', 'Approved', 'Disbursed', 'Repaid', 'Overdue', 'Rejected', 'Write-Off Pending', 'Written-Off', 'Reversal Pending', 'Reversed'],
      },
      {
        stage: 'Pending Approval',
        statuses: ['Pending Approval', 'Approved', 'Disbursed', 'Repaid', 'Overdue', 'Rejected', 'Write-Off Pending', 'Written-Off', 'Reversal Pending', 'Reversed'],
      },
      {
        stage: 'Approved',
        statuses: ['Approved', 'Disbursed', 'Repaid', 'Overdue'],
      },
      {
        stage: 'Disbursed',
        statuses: ['Disbursed', 'Repaid', 'Overdue'],
      },
      {
        stage: 'Rejected',
        statuses: ['Rejected'],
      },
    ];

    let previousStageCount = allLoans.length;

    return stages.map(s => {
      const loansInStage = allLoans.filter(loan => s.statuses.includes(loan.status));
      const count = loansInStage.length;
      const value = loansInStage.reduce((sum, loan) => sum + (loan.amount || 0), 0);
      
      let conversion = 0;
      if (s.stage !== 'Rejected') {
          conversion = previousStageCount > 0 ? (count / previousStageCount) * 100 : 0;
          previousStageCount = count;
      } else {
          // For 'Rejected', calculate as a percentage of the 'Pending Approval' stage
          const pendingApprovalStage = allLoans.filter(loan => stages.find(st => st.stage === 'Pending Approval')?.statuses.includes(loan.status)).length;
          conversion = pendingApprovalStage > 0 ? (count / pendingApprovalStage) * 100 : 0;
      }

      return {
        stage: s.stage,
        count,
        value,
        conversion: parseFloat(conversion.toFixed(2)),
      };
    });
  }, [allLoans]);


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Loan Application Funnel</h1>
          <p className="text-muted-foreground mt-1">
            Tracks the conversion rate of applications through the loan cycle stages.
          </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export to Excel
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Application Funnel Analysis</CardTitle>
          <CardDescription>
            A summary of loan application progression from submission to disbursement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stage</TableHead>
                <TableHead>Number of Applications</TableHead>
                <TableHead>Value (MWK)</TableHead>
                <TableHead>Conversion Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                  </TableRow>
                ))
              ) : funnelData.length > 0 ? (
                funnelData.map((item) => (
                  <TableRow key={item.stage}>
                    <TableCell className="font-medium">{item.stage}</TableCell>
                    <TableCell>{item.count}</TableCell>
                    <TableCell>{item.value.toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                          <Progress value={item.conversion} className="w-24" />
                          <span>{item.conversion}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                 <TableRow>
                  <TableCell colSpan={4} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="p-4 bg-muted rounded-full">
                            <FileWarning className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold">No Loan Data Found</h3>
                        <p className="text-muted-foreground">There are no loans in the system to build the funnel report.</p>
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
