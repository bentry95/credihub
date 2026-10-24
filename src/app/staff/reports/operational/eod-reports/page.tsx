'use client';

import { useState, useMemo } from 'react';
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
import { Download, CandlestickChart, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, doc, orderBy, where } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';


export default function EodReportsPage() {
    const { user } = useUser();
    const firestore = useFirestore();

    const userDocRef = useMemoFirebase(
      () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
      [firestore, user]
    );
    const { data: currentUserData } = useDoc(userDocRef);
    const institutionId = currentUserData?.institutionId;

    const auditQuery = useMemoFirebase(
        () => (firestore && institutionId ? query(collection(firestore, 'institutions', institutionId, 'workflowAudits'), where('component', '==', 'End of Day Process'), orderBy('timestamp', 'desc')) : null),
        [firestore, institutionId]
    );
    const { data: eodReports, isLoading: isAuditsLoading } = useCollection(auditQuery);

    const usersQuery = useMemoFirebase(
        () => (firestore && institutionId ? query(collection(firestore, 'users'), where('institutionId', '==', institutionId)) : null),
        [firestore, institutionId]
    );
    const { data: users, isLoading: isUsersLoading } = useCollection(usersQuery);

    const getUserName = (userId: string) => {
        if (!users) return '...';
        if (userId === 'System') return 'System';
        return users.find(u => u.uid === userId)?.name || 'Unknown User';
    }
  
    const getBadgeVariant = (action: string) => {
        return action === 'Success' ? 'default' : 'destructive';
    }

    const isLoading = isAuditsLoading || isUsersLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">End-of-Day Reports</h1>
          <p className="text-muted-foreground mt-1">
            Summaries of the daily closing process, including teller balancing and system-wide transactions.
          </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export to Excel
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>EOD Process Log</CardTitle>
          <CardDescription>
            A log of all major processes run during the end-of-day sequence.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Component</TableHead>
                <TableHead>Reason / Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                  Array.from({length: 4}).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell colSpan={5}><Skeleton className="h-6 w-full" /></TableCell>
                    </TableRow>
                  ))
              ) : eodReports && eodReports.length > 0 ? (
                eodReports.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{log.timestamp ? format(log.timestamp.toDate(), 'PPP p') : 'N/A'}</TableCell>
                    <TableCell className="font-medium">{getUserName(log.userId)}</TableCell>
                    <TableCell>
                      <Badge variant={getBadgeVariant('Success')}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>{log.component}</TableCell>
                    <TableCell className="text-muted-foreground">{log.reason}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-muted rounded-full">
                        <CandlestickChart className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold">No EOD Reports Found</h3>
                      <p className="text-muted-foreground">The end-of-day process has not been run yet.</p>
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