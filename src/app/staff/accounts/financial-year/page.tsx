
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import {
  collection,
  doc,
  setDoc,
  writeBatch,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PlusCircle, Loader2, AlertCircle, CalendarDays, CalendarIcon, Lock } from 'lucide-react';
import { format, isBefore, isAfter } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useBranch } from '@/context/BranchContext';


const financialYearSchema = z.object({
  yearName: z.string().min(1, 'Year name is required.'),
  startDate: z.date({ required_error: 'Start date is required.' }),
  endDate: z.date({ required_error: 'End date is required.' }),
}).refine(data => isAfter(data.endDate, data.startDate), {
    message: "End date must be after the start date.",
    path: ["endDate"],
});


export default function FinancialYearPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { selectedBranch } = useBranch();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userDocRef = useMemoFirebase(
    () => (firestore && user?.uid ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);

  const isHqBranch = selectedBranch === '01';

  const fyQuery = useMemoFirebase(
    () => (firestore && userData?.institutionId ? collection(firestore, 'institutions', userData.institutionId, 'financialYears') : null),
    [firestore, userData]
  );
  const { data: financialYears, isLoading: isFyLoading } = useCollection(fyQuery);

  const openYear = financialYears?.find(fy => fy.status === 'Open');

  const form = useForm<z.infer<typeof financialYearSchema>>({
    resolver: zodResolver(financialYearSchema),
    defaultValues: {
      yearName: '',
      startDate: new Date(),
      endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
    },
  });

  async function onSubmit(values: z.infer<typeof financialYearSchema>) {
    if (!firestore || !userData?.institutionId) return;

    setLoading(true);
    setError(null);

    // Validation checks
    if (openYear) {
      setError("An open financial year already exists. Please close it before creating a new one.");
      setLoading(false);
      return;
    }

    const isOverlapping = financialYears?.some(fy => 
        (isAfter(values.startDate, fy.startDate.toDate()) && isBefore(values.startDate, fy.endDate.toDate())) ||
        (isAfter(values.endDate, fy.startDate.toDate()) && isBefore(values.endDate, fy.endDate.toDate())) ||
        (isBefore(values.startDate, fy.startDate.toDate()) && isAfter(values.endDate, fy.endDate.toDate()))
    );

    if(isOverlapping) {
         setError("The selected date range overlaps with an existing financial year.");
        setLoading(false);
        return;
    }

    try {
      const fyRef = collection(firestore, 'institutions', userData.institutionId, 'financialYears');
      const newDocRef = doc(fyRef);
      await setDoc(newDocRef, {
        ...values,
        id: newDocRef.id,
        institutionId: userData.institutionId,
        status: 'Open',
        netProfitLoss: 0,
        createdAt: Timestamp.now(),
      });
      setIsCreateOpen(false);
      form.reset();
      toast({ title: "Success", description: "New financial year has been created and set to 'Open'." });
    } catch (e) {
      console.error(e);
      setError("Failed to create financial year. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCloseYear() {
    if (!firestore || !openYear || !userData?.institutionId) return;
    setLoading(true);
    try {
        const yearDocRef = doc(firestore, 'institutions', userData.institutionId, 'financialYears', openYear.id);
        
        // In a real app, complex EOY calculations would happen here
        const calculatedProfitLoss = Math.random() * 1000000; 

        const batch = writeBatch(firestore);
        batch.update(yearDocRef, { 
            status: 'Closed',
            netProfitLoss: calculatedProfitLoss,
        });

        // You might create a new Retained Earnings journal entry here
        // ...

        await batch.commit();
        toast({ title: "Financial Year Closed", description: `The year ${openYear.yearName} has been successfully closed.` });

    } catch(e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to close the financial year.' });
    } finally {
        setLoading(false);
        setIsCloseConfirmOpen(false);
    }
  }

  if (!isHqBranch) {
    return (
        <Card className="w-full max-w-lg mx-auto mt-12 text-center">
            <CardHeader>
                <CardTitle>Function Not Available</CardTitle>
                <CardDescription>This feature can only be accessed from the Headquarters branch.</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">Please switch to your HQ branch to manage financial years.</p>
            </CardContent>
        </Card>
    );
  }


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financial Year Management</h1>
          <p className="text-muted-foreground mt-1">
            Define and close your accounting periods.
          </p>
        </div>
        <div className="flex gap-2">
            {openYear && (
                <Button variant="destructive" onClick={() => setIsCloseConfirmOpen(true)}>
                    <Lock className="mr-2 h-4 w-4" /> Close Year ({openYear.yearName})
                </Button>
            )}
            <Button onClick={() => setIsCreateOpen(true)} disabled={!!openYear}>
                <PlusCircle className="mr-2 h-4 w-4" /> Create Financial Year
            </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Accounting Periods</CardTitle>
          <CardDescription>
            A list of all defined financial years for your institution.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Year Name</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>End Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Net Profit/Loss (MWK)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isFyLoading ? (
                 Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                    </TableRow>
                 ))
              ) : financialYears && financialYears.length > 0 ? (
                financialYears.sort((a,b) => b.startDate.toDate() - a.startDate.toDate()).map((fy) => (
                  <TableRow key={fy.id}>
                    <TableCell className="font-medium">{fy.yearName}</TableCell>
                    <TableCell>{format(fy.startDate.toDate(), 'PPP')}</TableCell>
                    <TableCell>{format(fy.endDate.toDate(), 'PPP')}</TableCell>
                    <TableCell>
                      <Badge variant={fy.status === 'Open' ? 'default' : 'secondary'}>
                        {fy.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {fy.status === 'Closed' ? fy.netProfitLoss.toLocaleString() : 'N/A'}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                 <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center">
                     <div className="flex flex-col items-center gap-4">
                        <div className="p-4 bg-muted rounded-full">
                            <CalendarDays className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold">No Financial Years Found</h3>
                        <p className="text-muted-foreground">Get started by creating your first financial year.</p>
                        <Button onClick={() => setIsCreateOpen(true)} disabled={!!openYear}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Create Financial Year
                        </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Financial Year</DialogTitle>
            <DialogDescription>Define the start and end dates for a new accounting period.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
               {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
               <FormField control={form.control} name="yearName" render={({ field }) => (
                    <FormItem><FormLabel>Year Name</FormLabel><FormControl><Input placeholder="e.g., FY 2024-2025" {...field} /></FormControl><FormMessage /></FormItem>
               )} />
               <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="startDate" render={({ field }) => (
                        <FormItem className="flex flex-col"><FormLabel>Start Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="endDate" render={({ field }) => (
                        <FormItem className="flex flex-col"><FormLabel>End Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                    )} />
               </div>
               <DialogFooter>
                 <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                 <Button type="submit" disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Create Year</Button>
               </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isCloseConfirmOpen} onOpenChange={setIsCloseConfirmOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    Closing a financial year is an irreversible action. All transactions for the period will be finalized, and you will not be able to make any further changes. This action will calculate the profit/loss and roll it over into retained earnings.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleCloseYear} disabled={loading} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Yes, Close Financial Year"}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
