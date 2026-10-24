
'use client';

import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  Download,
  History,
  Building,
  User,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, collectionGroup } from 'firebase/firestore';

export default function GlobalAuditLogsPage() {
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Query across all institutions for workflow audits
  const auditQuery = useMemoFirebase(
    () => firestore ? query(collectionGroup(firestore, 'workflowAudits'), orderBy('timestamp', 'desc')) : null,
    [firestore]
  );
  const { data: auditLogs, isLoading: isAuditsLoading } = useCollection(auditQuery);

  // Fetch institutions to map IDs to names
  const institutionsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'institutions') : null),
    [firestore]
  );
  const { data: institutions, isLoading: isInstitutionsLoading } = useCollection(institutionsQuery);

  // Fetch all users to map IDs to names
  const usersQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'users') : null),
    [firestore]
  );
  const { data: users, isLoading: isUsersLoading } = useCollection(usersQuery);

  const institutionMap = useMemo(() => {
    if (!institutions) return new Map();
    return new Map(institutions.map(inst => [inst.id, inst.name]));
  }, [institutions]);

  const userMap = useMemo(() => {
      if (!users) return new Map();
      return new Map(users.map(u => [u.uid, u.name]));
  }, [users]);

  const filteredLogs = useMemo(() => {
    if (!auditLogs) return [];
    const lower = searchTerm.toLowerCase();
    return auditLogs.filter(log => {
        const instName = institutionMap.get(log.institutionId) || '';
        const userName = userMap.get(log.userId) || '';
        return (
            log.action.toLowerCase().includes(lower) ||
            log.component.toLowerCase().includes(lower) ||
            instName.toLowerCase().includes(lower) ||
            userName.toLowerCase().includes(lower)
        );
    });
  }, [auditLogs, searchTerm, institutionMap, userMap]);

  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(start, start + itemsPerPage);
  }, [filteredLogs, currentPage]);

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case 'Activated':
      case 'Approved':
      case 'Loan Approved':
      case 'Success':
        return 'default';
      case 'Deactivated':
      case 'Rejected':
      case 'Loan Rejected':
        return 'destructive';
      case 'Loan Disbursed':
      case 'End of Day Process':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const isLoading = isAuditsLoading || isInstitutionsLoading || isUsersLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Global Audit Trail</h1>
          <p className="text-muted-foreground mt-1">
            Monitor all critical operations and configuration changes across every institution on the platform.
          </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export All Logs
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>System Activity</CardTitle>
            <div className="relative w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search institution, user, or action..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Institution</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Component</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : paginatedLogs.length > 0 ? (
                paginatedLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {log.timestamp ? format(log.timestamp.toDate(), 'dd MMM HH:mm') : 'N/A'}
                    </TableCell>
                    <TableCell className="font-medium">
                        {institutionMap.get(log.institutionId) || 'Unknown'}
                    </TableCell>
                    <TableCell>{userMap.get(log.userId) || 'System'}</TableCell>
                    <TableCell className="text-xs uppercase tracking-wider text-muted-foreground">{log.component}</TableCell>
                    <TableCell>
                      <Badge variant={getActionBadgeVariant(log.action)} className="whitespace-nowrap">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm">
                      {log.reason}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-muted rounded-full">
                        <History className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold">No Logs Found</h3>
                      <p className="text-muted-foreground">There are no audit events matching your search.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        {totalPages > 1 && (
            <CardFooter className="flex items-center justify-between border-t py-4">
                <div className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 mr-1"/> Prev</Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next <ChevronRight className="h-4 ml-1"/></Button>
                </div>
            </CardFooter>
        )}
      </Card>
    </div>
  );
}

    