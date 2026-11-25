'use client';

import { useMemo, useState } from 'react';
import { addDoc, collection, doc, serverTimestamp } from 'firebase/firestore';
import { format, isWithinInterval, parseISO, subDays } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { AlertCircle, CalendarIcon, Download, Loader2, PlusCircle, Search, Clock3, Users, Timer, UserX } from 'lucide-react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { useBranch } from '@/context/BranchContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type Attendance = { id: string; employeeId: string; employeeName: string; branchId?: string; date: any; clockIn?: string; clockOut?: string; shift?: string; status: string; minutesWorked?: number };
const statusVariant = (status: string) => status === 'Absent' ? 'destructive' : status === 'Late' ? 'secondary' : status === 'Overtime' ? 'outline' : 'default';
const formatHours = (minutes: number) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
const timeMinutes = (value: string) => { const [hour, minute] = value.split(':').map(Number); return hour * 60 + minute; };

export default function TimeAttendancePage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { selectedBranch, availableBranches } = useBranch();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: subDays(new Date(), 7), to: new Date() });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [entryDate, setEntryDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [clockIn, setClockIn] = useState('08:00');
  const [clockOut, setClockOut] = useState('17:00');
  const [shift, setShift] = useState('Standard');

  const userRef = useMemoFirebase(() => firestore && user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userData } = useDoc(userRef);
  const institutionId = userData?.institutionId;
  const employeesQuery = useMemoFirebase(() => firestore && institutionId ? collection(firestore, 'institutions', institutionId, 'customers') : null, [firestore, institutionId]);
  const attendanceQuery = useMemoFirebase(() => firestore && institutionId ? collection(firestore, 'institutions', institutionId, 'attendanceRecords') : null, [firestore, institutionId]);
  const { data: employees, isLoading: employeesLoading } = useCollection(employeesQuery);
  const { data: attendance, isLoading: attendanceLoading } = useCollection(attendanceQuery);
  const staff = useMemo(() => (employees || []).filter((person: any) => person.customerType === 'Individual' || person.employmentType || person.employeeId), [employees]);

  const records = useMemo(() => (attendance || []).map((record: any) => ({ ...record, dateObject: record.date?.toDate?.() || (record.date ? new Date(record.date) : null) })) as (Attendance & { dateObject: Date | null })[], [attendance]);
  const filtered = useMemo(() => records.filter(record => {
    if (!record.dateObject || (dateRange?.from && record.dateObject < new Date(new Date(dateRange.from).setHours(0, 0, 0, 0))) || (dateRange?.to && record.dateObject > new Date(new Date(dateRange.to).setHours(23, 59, 59, 999)))) return false;
    if (selectedBranch !== 'all' && record.branchId !== selectedBranch) return false;
    if (statusFilter !== 'all' && record.status.toLowerCase() !== statusFilter) return false;
    return !search || `${record.employeeName} ${record.employeeId}`.toLowerCase().includes(search.toLowerCase());
  }).sort((a, b) => (b.dateObject?.getTime() || 0) - (a.dateObject?.getTime() || 0)), [records, dateRange, selectedBranch, statusFilter, search]);
  const stats = useMemo(() => ({ present: filtered.filter(item => item.status === 'Present' || item.status === 'Overtime').length, late: filtered.filter(item => item.status === 'Late').length, absent: filtered.filter(item => item.status === 'Absent').length, minutes: filtered.reduce((sum, item) => sum + (item.minutesWorked || 0), 0) }), [filtered]);

  const exportCsv = () => {
    const columns = ['date', 'employeeName', 'employeeId', 'branchId', 'shift', 'clockIn', 'clockOut', 'hoursWorked', 'status'];
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [columns.join(','), ...filtered.map(record => [record.dateObject ? format(record.dateObject, 'yyyy-MM-dd') : '', record.employeeName, record.employeeId, record.branchId, record.shift, record.clockIn, record.clockOut, formatHours(record.minutesWorked || 0), record.status].map(escape).join(','))].join('\n');
    const link = document.createElement('a'); link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`; link.download = `attendance-${format(new Date(), 'yyyy-MM-dd')}.csv`; link.click();
  };

  const resetDialog = () => { setIsDialogOpen(false); setError(''); setEmployeeId(''); setClockIn('08:00'); setClockOut('17:00'); setShift('Standard'); setEntryDate(format(new Date(), 'yyyy-MM-dd')); };
  const saveEntry = async () => {
    const employee: any = staff.find((person: any) => person.id === employeeId);
    if (!firestore || !institutionId || !user || !employee || !entryDate || !clockIn || !clockOut) { setError('Complete all required fields.'); return; }
    if (timeMinutes(clockOut) <= timeMinutes(clockIn)) { setError('Clock-out must be later than clock-in. Overnight shifts are not supported yet.'); return; }
    setIsSaving(true); setError('');
    try {
      const minutesWorked = timeMinutes(clockOut) - timeMinutes(clockIn);
      const status = timeMinutes(clockIn) > 8 * 60 ? 'Late' : minutesWorked > 9 * 60 ? 'Overtime' : 'Present';
      await addDoc(collection(firestore, 'institutions', institutionId, 'attendanceRecords'), {
        institutionId, employeeId, employeeName: employee.name || `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
        branchId: employee.branchId || null, date: parseISO(entryDate), clockIn, clockOut, shift: shift.trim() || 'Standard',
        minutesWorked, status, entryType: 'Manual', createdBy: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      toast({ title: 'Attendance recorded', description: 'The manual entry was added to the attendance log.' }); resetDialog();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save this attendance entry.'); }
    finally { setIsSaving(false); }
  };

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-bold tracking-tight">Time &amp; Attendance</h1><p className="mt-1 text-muted-foreground">Review attendance records, track hours, and record manual adjustments.</p></div><div className="flex gap-2"><Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}><Download className="mr-2 h-4 w-4"/>Export CSV</Button><Button onClick={() => setIsDialogOpen(true)}><PlusCircle className="mr-2 h-4 w-4"/>Add Manual Entry</Button></div></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[{ label: 'Present', value: stats.present, icon: Users }, { label: 'Late', value: stats.late, icon: Clock3 }, { label: 'Absent', value: stats.absent, icon: UserX }, { label: 'Hours recorded', value: formatHours(stats.minutes), icon: Timer }].map(item => <Card key={item.label}><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-muted-foreground">{item.label}</p><p className="mt-1 text-2xl font-semibold">{item.value}</p></div><item.icon className="h-5 w-5 text-muted-foreground"/></CardContent></Card>)}</div>
    <Card><CardHeader><CardTitle>Attendance Log</CardTitle><CardDescription>Showing {filtered.length} record{filtered.length === 1 ? '' : 's'} from the selected period.</CardDescription><div className="flex flex-wrap items-center gap-3 pt-4"><div className="relative w-full max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search employee name or ID" className="pl-9"/></div><Popover><PopoverTrigger asChild><Button variant="outline" className={cn('justify-start text-left font-normal', !dateRange && 'text-muted-foreground')}><CalendarIcon className="mr-2 h-4 w-4"/>{dateRange?.from ? `${format(dateRange.from, 'LLL dd, y')} – ${dateRange.to ? format(dateRange.to, 'LLL dd, y') : '…'}` : 'Pick date range'}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2}/></PopoverContent></Popover><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-[170px]"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="present">Present</SelectItem><SelectItem value="late">Late</SelectItem><SelectItem value="absent">Absent</SelectItem><SelectItem value="overtime">Overtime</SelectItem></SelectContent></Select></div></CardHeader>
      <CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Employee</TableHead><TableHead>Branch</TableHead><TableHead>Shift</TableHead><TableHead>Clock-in</TableHead><TableHead>Clock-out</TableHead><TableHead>Hours</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>
        {attendanceLoading || employeesLoading ? Array.from({ length: 4 }, (_, i) => <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-8 w-full"/></TableCell></TableRow>) : filtered.length ? filtered.map(record => <TableRow key={record.id}><TableCell>{record.dateObject ? format(record.dateObject, 'PPP') : '—'}</TableCell><TableCell className="font-medium">{record.employeeName || record.employeeId}</TableCell><TableCell>{availableBranches.find((branch: any) => branch.id === record.branchId)?.name || record.branchId || '—'}</TableCell><TableCell>{record.shift || '—'}</TableCell><TableCell>{record.clockIn || '—'}</TableCell><TableCell>{record.clockOut || '—'}</TableCell><TableCell>{formatHours(record.minutesWorked || 0)}</TableCell><TableCell><Badge variant={statusVariant(record.status)}>{record.status}</Badge></TableCell></TableRow>) : <TableRow><TableCell colSpan={8} className="h-32 text-center text-muted-foreground">No attendance records match these filters.</TableCell></TableRow>}
      </TableBody></Table></CardContent></Card>
    <Dialog open={isDialogOpen} onOpenChange={open => open ? setIsDialogOpen(true) : resetDialog()}><DialogContent><DialogHeader><DialogTitle>Add Manual Attendance Entry</DialogTitle><DialogDescription>Record an employee’s attendance for one shift. The status is calculated from the clock-in time and hours worked.</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><div className="grid gap-2"><Label>Employee</Label><Select value={employeeId} onValueChange={setEmployeeId}><SelectTrigger><SelectValue placeholder={employeesLoading ? 'Loading employees…' : 'Select employee'}/></SelectTrigger><SelectContent>{staff.map((person: any) => <SelectItem key={person.id} value={person.id}>{person.name || `${person.firstName || ''} ${person.lastName || ''}`.trim()}{person.accountNumber ? ` · ${person.accountNumber}` : ''}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label htmlFor="entry-date">Date</Label><Input id="entry-date" type="date" value={entryDate} onChange={event => setEntryDate(event.target.value)}/></div><div className="grid grid-cols-2 gap-3"><div className="grid gap-2"><Label htmlFor="clock-in">Clock-in</Label><Input id="clock-in" type="time" value={clockIn} onChange={event => setClockIn(event.target.value)}/></div><div className="grid gap-2"><Label htmlFor="clock-out">Clock-out</Label><Input id="clock-out" type="time" value={clockOut} onChange={event => setClockOut(event.target.value)}/></div></div><div className="grid gap-2"><Label htmlFor="shift-name">Shift</Label><Input id="shift-name" value={shift} onChange={event => setShift(event.target.value)} placeholder="e.g. Morning"/></div>{error && <Alert variant="destructive"><AlertCircle className="h-4 w-4"/><AlertTitle>Could not save entry</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}</div><DialogFooter><Button variant="outline" onClick={resetDialog} disabled={isSaving}>Cancel</Button><Button onClick={saveEntry} disabled={isSaving || employeesLoading || staff.length === 0}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Save Entry</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
