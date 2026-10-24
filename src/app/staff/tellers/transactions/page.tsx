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
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { DateRange } from 'react-day-picker';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, query, where, doc, orderBy } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Calendar as CalendarIcon, Filter, List } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function TellerTransactionsPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [date, setDate] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [selectedTellerId, setSelectedTellerId] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);
  const institutionId = userData?.institutionId;

  const journalsQuery = useMemoFirebase(
    () => (firestore && institutionId ? query(collection(firestore, 'institutions', institutionId, 'journals'), orderBy('createdAt', 'desc')) : null),
    [firestore, institutionId]
  );
  const { data: allJournals, isLoading: isJournalsLoading } = useCollection(journalsQuery);
  
  const staffQuery = useMemoFirebase(
    () => (firestore && institutionId ? query(collection(firestore, 'users'), where('institutionId', '==', institutionId)) : null),
    [firestore, institutionId]
  );
  const { data: staff, isLoading: isStaffLoading } = useCollection(staffQuery);

  const tellersQuery = useMemoFirebase(
    () => (firestore && institutionId ? collection(firestore, 'institutions', institutionId, 'tellers') : null),
    [firestore, institutionId]
  );
  const { data: tellers, isLoading: isTellersLoading } = useCollection(tellersQuery);

  const getStaffName = (staffId: string) => staff?.find((s) => s.uid === staffId)?.name || 'Unknown';
  
  const filteredJournals = useMemo(() => {
    if (!allJournals || !tellers) return [];
    
    const tellerUserIds = new Set(tellers.map(t => t.userId));

    return allJournals.filter(journal => {
      if (!tellerUserIds.has(journal.createdBy)) {
          return false;
      }
      const journalDate = journal.createdAt.toDate();
      const isDateInRange = date?.from && date?.to ? journalDate >= date.from && journalDate <= date.to : true;
      const isTellerMatch = selectedTellerId === 'all' || journal.createdBy === selectedTellerId;
      return isDateInRange && isTellerMatch;
    });
  }, [allJournals, date, selectedTellerId, tellers]);

  const paginatedJournals = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredJournals.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredJournals, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredJournals.length / itemsPerPage);

  const getBadgeVariant = (status: string) => {
    switch (status) {
        case 'Posted': return 'default';
        case 'Pending': return 'secondary';
        case 'Rejected': return 'destructive';
        default: return 'outline';
    }
  }

  const isLoading = isJournalsLoading || isStaffLoading || isTellersLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Teller Transactions</h1>
          <p className="text-muted-foreground mt-1">
            View and filter all journal entries created by tellers.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Transaction Log</CardTitle>
          <CardDescription>
            A log of all journal entries. Use the filters to narrow your search.
          </CardDescription>
           <div className="flex flex-wrap items-center gap-4 pt-4">
              <Popover>
                <PopoverTrigger asChild>
                <Button
                    id="date"
                    variant={"outline"}
                    className={cn("w-[280px] justify-start text-left font-normal", !date && "text-muted-foreground")}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date?.from ? (
                    date.to ? (
                        <>
                        {format(date.from, "LLL dd, y")} - {format(date.to, "LLL dd, y")}
                        </>
                    ) : (
                        format(date.from, "LLL dd, y")
                    )
                    ) : (
                    <span>Pick a date range</span>
                    )}
                </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={date?.from}
                    selected={date}
                    onSelect={setDate}
                    numberOfMonths={2}
                />
                </PopoverContent>
            </Popover>
            <Select value={selectedTellerId} onValueChange={setSelectedTellerId}>
                <SelectTrigger className="w-[280px]">
                    <SelectValue placeholder="Filter by teller..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Tellers</SelectItem>
                    {tellers?.map(teller => {
                        const tellerStaff = staff?.find(s => s.uid === teller.userId);
                        return tellerStaff ? (
                            <SelectItem key={teller.userId} value={teller.userId}>{tellerStaff.name}</SelectItem>
                        ) : null;
                    })}
                </SelectContent>
            </Select>
           </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead>Amount (MWK)</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-64" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  </TableRow>
                ))
              ) : paginatedJournals && paginatedJournals.length > 0 ? (
                paginatedJournals.map((journal) => (
                  <TableRow key={journal.id}>
                    <TableCell>{format(journal.createdAt.toDate(), 'PPP p')}</TableCell>
                    <TableCell className="font-medium">{journal.description}</TableCell>
                    <TableCell>{getStaffName(journal.createdBy)}</TableCell>
                    <TableCell className="font-mono">
                      {journal.transactions.reduce((sum: number, t: any) => sum + (t.debit || 0), 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getBadgeVariant(journal.status)}>{journal.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-muted rounded-full">
                        <List className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold">No Transactions Found</h3>
                      <p className="text-muted-foreground">
                        There are no transactions matching your filter criteria.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
         <CardFooter>
            <div className="flex items-center justify-between w-full">
                <div className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages || 1}
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                    >
                        Next
                    </Button>
                </div>
            </div>
        </CardFooter>
      </Card>
    </div>
  );
}
