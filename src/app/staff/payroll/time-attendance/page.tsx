
'use client';

import { useState } from 'react';
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
import { Input } from '@/components/ui/input';
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
import { Badge } from '@/components/ui/badge';
import {
  Download,
  Search,
  PlusCircle,
  CalendarIcon,
  Clock,
  MoreVertical,
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';

// Mock data based on the user's detailed requirements
const mockAttendanceData = [
  {
    id: 'att1',
    date: new Date(),
    employee: 'John Phiri',
    branch: 'Lilongwe Branch',
    shift: 'Morning (8am - 5pm)',
    clockIn: '08:05 AM',
    clockOut: '05:02 PM',
    hoursWorked: '8h 57m',
    status: 'Present',
  },
  {
    id: 'att2',
    date: new Date(),
    employee: 'Jane Banda',
    branch: 'Blantyre Branch',
    shift: 'Morning (8am - 5pm)',
    clockIn: '08:17 AM',
    clockOut: '04:55 PM',
    hoursWorked: '8h 38m',
    status: 'Late',
  },
  {
    id: 'att3',
    date: subDays(new Date(), 1),
    employee: 'John Phiri',
    branch: 'Lilongwe Branch',
    shift: 'Morning (8am - 5pm)',
    clockIn: '08:00 AM',
    clockOut: '05:30 PM',
    hoursWorked: '9h 30m',
    status: 'Overtime',
  },
   {
    id: 'att4',
    date: subDays(new Date(), 1),
    employee: 'Mike Moyo',
    branch: 'Mzuzu Branch',
    shift: 'Morning (8am - 5pm)',
    clockIn: 'N/A',
    clockOut: 'N/A',
    hoursWorked: '0h 0m',
    status: 'Absent',
  },
];

const getBadgeVariant = (status: string) => {
  switch (status) {
    case 'Present':
      return 'default';
    case 'Late':
      return 'secondary';
    case 'Absent':
      return 'destructive';
    case 'Overtime':
      return 'outline';
    default:
      return 'outline';
  }
};

export default function TimeAttendancePage() {
  const [date, setDate] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Time & Attendance</h1>
          <p className="text-muted-foreground mt-1">
            Track employee clock-in/out times, leave, and overtime for accurate payroll processing.
          </p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline">
                <Download className="mr-2 h-4 w-4" /> Export Report
            </Button>
            <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Manual Entry
            </Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Attendance Log</CardTitle>
          <CardDescription>
            A detailed record of employee attendance. Use the filters below to refine your search.
          </CardDescription>
          <div className="flex flex-wrap items-center gap-4 pt-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search by employee name..."
                className="pl-10"
              />
            </div>
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
             <Select defaultValue="all">
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="late">Late</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
                <SelectItem value="overtime">Overtime</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>Clock-In</TableHead>
                <TableHead>Clock-Out</TableHead>
                <TableHead>Hours Worked</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockAttendanceData.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>{format(record.date, 'PPP')}</TableCell>
                  <TableCell className="font-medium">{record.employee}</TableCell>
                  <TableCell className="text-xs">{record.shift}</TableCell>
                  <TableCell>{record.clockIn}</TableCell>
                  <TableCell>{record.clockOut}</TableCell>
                  <TableCell>{record.hoursWorked}</TableCell>
                  <TableCell>
                    <Badge variant={getBadgeVariant(record.status)}>{record.status}</Badge>
                  </TableCell>
                   <TableCell className="text-right">
                        <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                   </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
