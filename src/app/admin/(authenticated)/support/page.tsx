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
import { Skeleton } from '@/components/ui/skeleton';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collectionGroup, query, orderBy, collection } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { HelpCircle, Eye } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Open': return 'default';
      case 'In Progress': return 'secondary';
      case 'Resolved':
      case 'Closed':
        return 'outline';
      default: return 'outline';
    }
};

const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'Urgent':
      case 'High':
        return 'destructive';
      case 'Medium':
        return 'secondary';
      case 'Low':
        return 'outline';
      default: return 'outline';
    }
};


export default function AdminSupportPage() {
  const firestore = useFirestore();
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const ticketsQuery = useMemoFirebase(
    () => firestore ? query(collectionGroup(firestore, 'tickets'), orderBy('updatedAt', 'desc')) : null,
    [firestore]
  );
  const { data: tickets, isLoading: isTicketsLoading } = useCollection(ticketsQuery);

  const institutionsQuery = useMemoFirebase(
    () => firestore ? query(collection(firestore, 'institutions')) : null,
    [firestore]
  );
  const { data: institutions, isLoading: isInstitutionsLoading } = useCollection(institutionsQuery);

  const institutionMap = useMemo(() => {
    if (!institutions) return new Map();
    return new Map(institutions.map(inst => [inst.id, inst.name]));
  }, [institutions]);

  const filteredTickets = useMemo(() => {
    if (!tickets) return [];
    return tickets.filter(ticket => {
        const statusMatch = statusFilter === 'all' || ticket.status === statusFilter;
        const priorityMatch = priorityFilter === 'all' || ticket.priority === priorityFilter;
        return statusMatch && priorityMatch;
    });
  }, [tickets, statusFilter, priorityFilter]);

  const isLoading = isTicketsLoading || isInstitutionsLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Support Center</h1>
          <p className="text-muted-foreground mt-1">
            Manage and respond to support tickets from all institutions.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All Tickets</CardTitle>
           <div className="flex flex-wrap items-center gap-4 pt-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Open">Open</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Resolved">Resolved</SelectItem>
                <SelectItem value="Closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by priority..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
           </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Institution</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : filteredTickets.length > 0 ? (
                filteredTickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-medium">{ticket.subject}</TableCell>
                    <TableCell>{institutionMap.get(ticket.institutionId) || 'Unknown'}</TableCell>
                    <TableCell><Badge variant={getStatusBadgeVariant(ticket.status)}>{ticket.status}</Badge></TableCell>
                    <TableCell><Badge variant={getPriorityBadgeVariant(ticket.priority)}>{ticket.priority}</Badge></TableCell>
                    <TableCell>{ticket.updatedAt ? formatDistanceToNow(ticket.updatedAt.toDate(), { addSuffix: true }) : 'N/A'}</TableCell>
                    <TableCell className="text-right">
                       <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/support/${ticket.id}`}>
                              <Eye className="mr-2 h-4 w-4"/> View
                          </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-muted rounded-full">
                        <HelpCircle className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold">No Tickets Found</h3>
                      <p className="text-muted-foreground">There are no support tickets matching your filters.</p>
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
