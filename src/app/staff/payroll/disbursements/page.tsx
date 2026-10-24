
'use client';

import { useState, useEffect } from 'react';
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
import { Send, Banknote } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, query, where, getDocs, getCountFromServer } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';

export default function PayrollDisbursementsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [employeeCounts, setEmployeeCounts] = useState<Record<string, number>>({});
  const [employers, setEmployers] = useState<any[]>([]);
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);

  const { data: userData, isLoading: isUserLoading } = useDoc(useMemoFirebase(() => (
    firestore && user ? doc(firestore, 'users', user.uid) : null
  ), [firestore, user]));
  
  const institutionId = userData?.institutionId;

  const { data: pendingPayrollRuns, isLoading: isPayrollsLoading } = useCollection(useMemoFirebase(() => (
    firestore && institutionId ? query(collection(firestore, 'institutions', institutionId, 'payrolls'), where('status', '==', 'Processed')) : null
  ), [firestore, institutionId]));

  const { data: allEmployers, isLoading: isEmployersLoading } = useCollection(useMemoFirebase(() => (
    firestore && institutionId ? collection(firestore, 'institutions', institutionId, 'employers') : null
  ), [firestore, institutionId]));

  useEffect(() => {
    if (allEmployers) {
      setEmployers(allEmployers);
    }
  }, [allEmployers]);

  useEffect(() => {
    if (pendingPayrollRuns && firestore && institutionId) {
        const fetchCounts = async () => {
            setIsLoadingCounts(true);
            const counts: Record<string, number> = {};
            for (const run of pendingPayrollRuns) {
                const payslipsRef = collection(firestore, 'institutions', institutionId, 'payrolls', run.id, 'payslips');
                const snapshot = await getDocs(payslipsRef);
                counts[run.id] = snapshot.size;
            }
            setEmployeeCounts(counts);
            setIsLoadingCounts(false);
        };
        fetchCounts();
    }
  }, [pendingPayrollRuns, firestore, institutionId]);

  const getEmployerName = (employerId: string) => {
    return employers.find(e => e.id === employerId)?.name || 'Unknown Employer';
  }

  const isLoading = isPayrollsLoading || isUserLoading || isEmployersLoading || isLoadingCounts;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payroll Disbursements</h1>
          <p className="text-muted-foreground mt-1">
            Generate payment files and mark payrolls as paid.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Disbursement</CardTitle>
          <CardDescription>
            The following processed payrolls are ready for payment disbursement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Employer</TableHead>
                <TableHead>Employees</TableHead>
                <TableHead>Total Net Pay</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                 Array.from({ length: 2 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-9 w-48 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : pendingPayrollRuns && pendingPayrollRuns.length > 0 ? (
                pendingPayrollRuns.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium">{run.period}</TableCell>
                    <TableCell>{getEmployerName(run.employerId)}</TableCell>
                    <TableCell>{employeeCounts[run.id] || '...'}</TableCell>
                    <TableCell>MWK {run.totalNet.toLocaleString()}</TableCell>
                    <TableCell className="text-right space-x-2">
                        <Button variant="outline" size="sm">Generate Bank File</Button>
                        <Button size="sm">Mark as Paid</Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-muted rounded-full">
                        <Banknote className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold">No Payrolls Awaiting Disbursement</h3>
                      <p className="text-muted-foreground">
                        Process a payroll run to see it here.
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
