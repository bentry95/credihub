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
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import { Check, X, Loader2, ListChecks } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';


export default function EodReportsApprovalPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);
  const institutionId = userData?.institutionId;

  const eodSubmissionsQuery = useMemoFirebase(
    () => (firestore && institutionId ? query(collection(firestore, 'institutions', institutionId, 'eodSubmissions'), where('status', '==', 'Pending Approval')) : null),
    [firestore, institutionId]
  );
  const { data: eodSubmissions, isLoading: isSubmissionsLoading } = useCollection(eodSubmissionsQuery);


  const handleApprove = async (submissionId: string) => {
    if (!firestore || !institutionId) return;

    setLoading(submissionId);
    try {
        const submissionRef = doc(firestore, 'institutions', institutionId, 'eodSubmissions', submissionId);
        await updateDoc(submissionRef, { status: 'Approved' });
        
        toast({
            title: "EOD Report Approved",
            description: `The end-of-day report has been approved.`,
        });
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to approve report.' });
    } finally {
        setLoading(null);
    }
  };

  const isLoading = isSubmissionsLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            End of Day Report Approvals
          </h1>
          <p className="text-muted-foreground mt-1">
            Review and approve all submitted teller EOD reports.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>EOD Approval Queue</CardTitle>
          <CardDescription>
            The following end-of-day reports are pending your final approval.
            This action is required before the main system EOD can be run.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Teller Name</TableHead>
                <TableHead>Expected Balance</TableHead>
                <TableHead>Actual Counted</TableHead>
                <TableHead>Surplus/(Shortage)</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-9 w-24" /></TableCell>
                  </TableRow>
                ))
              ) : eodSubmissions && eodSubmissions.length > 0 ? (
                eodSubmissions.map((sub) => {
                  const variance = sub.variance;
                  return (
                    <TableRow key={sub.id}>
                        <TableCell className="font-medium">{sub.tellerName}</TableCell>
                        <TableCell>MWK {sub.expectedBalance.toLocaleString()}</TableCell>
                        <TableCell>MWK {sub.actualCounted.toLocaleString()}</TableCell>
                        <TableCell className={cn(
                            "font-semibold",
                            variance > 0 && "text-green-600",
                            variance < 0 && "text-destructive"
                        )}>
                            {variance !== 0 ? `MWK ${variance.toLocaleString()}` : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                            <Button size="sm" onClick={() => handleApprove(sub.id)} disabled={loading === sub.id}>
                                {loading === sub.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4"/>}
                                Approve
                            </Button>
                        </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-muted rounded-full">
                        <ListChecks className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold">
                        No EOD Reports Pending
                      </h3>
                      <p className="text-muted-foreground">
                        All teller end-of-day submissions have been approved.
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
