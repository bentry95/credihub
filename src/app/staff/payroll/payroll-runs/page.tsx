'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
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
  query,
  where,
  getDocs,
  writeBatch,
  serverTimestamp,
  orderBy,
  limit,
  updateDoc,
  runTransaction
} from 'firebase/firestore';
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
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  PlusCircle,
  PlayCircle,
  Loader2,
  AlertCircle,
  MoreVertical,
  Check,
  ClipboardCheck,
  Send,
  ArrowRight,
  Calculator,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { format, getYear } from 'date-fns';

const payrollRunSchema = z.object({
  employerId: z.string().min(1, 'Please select an employer.'),
  periodMonth: z.string().min(1, 'Please select a month.'),
  periodYear: z.string().min(1, 'Please select a year.'),
});

type CalculatedPayslip = {
  customerId: string;
  employeeName: string;
  grossPay: number;
  deductions: any[];
  netPay: number;
};

export default function PayrollRunsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  
  const [currentStep, setCurrentStep] = useState(1);
  const [employees, setEmployees] = useState<any[]>([]);
  const [calculatedPayslips, setCalculatedPayslips] = useState<CalculatedPayslip[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);
  const institutionId = userData?.institutionId;
  const institutionDocRef = useMemoFirebase(
    () => (institutionId ? doc(firestore, 'institutions', institutionId) : null),
    [firestore, institutionId]
  );

  const payrollsQuery = useMemoFirebase(
    () =>
      firestore && institutionId
        ? query(collection(firestore, 'institutions', institutionId, 'payrolls'), orderBy('period', 'desc'))
        : null,
    [firestore, institutionId]
  );
  const { data: payrolls, isLoading: isPayrollsLoading } = useCollection(payrollsQuery);

  const employersQuery = useMemoFirebase(
    () => (firestore && institutionId ? collection(firestore, 'institutions', institutionId, 'employers') : null),
    [firestore, institutionId]
  );
  const { data: employers, isLoading: isEmployersLoading } = useCollection(employersQuery);
  
  const employeesQuery = useMemoFirebase(
    () => (firestore && institutionId ? query(collection(firestore, 'institutions', institutionId, 'customers'), where('isEmployee', '==', true)) : null),
    [firestore, institutionId]
  );
  const { data: allEmployees, isLoading: isEmployeesLoading } = useCollection(employeesQuery);

  const payrollSettingsDocRef = useMemoFirebase(
    () => (institutionId ? doc(firestore, 'institutions', institutionId, 'settings', 'payroll') : null),
    [firestore, institutionId]
  );
  const { data: payrollSettings, isLoading: isSettingsLoading } = useDoc(payrollSettingsDocRef);

  const form = useForm<z.infer<typeof payrollRunSchema>>({
    resolver: zodResolver(payrollRunSchema),
    defaultValues: {
        periodMonth: String(new Date().getMonth() + 1),
        periodYear: String(new Date().getFullYear()),
    }
  });

  const getBadgeVariant = (status: string) => {
    switch (status) {
      case 'Paid': return 'default';
      case 'Posted': return 'default';
      case 'Processed': return 'secondary';
      case 'Draft': return 'outline';
      default: return 'outline';
    }
  };

  const handleNextStep = async () => {
    if (currentStep === 1) {
      const isValid = await form.trigger();
      if (!isValid) return;

      // In a real scenario, you'd filter by employerId. Here we simplify.
      setEmployees(allEmployees || []);
    }
    
    if (currentStep === 2) {
        setIsCalculating(true);
        // Simulate calculation
        const payslips = employees.map(emp => {
            const grossPay = emp.salary || 0;
            // Simplified net pay calculation for MVP
            const netPay = grossPay * 0.8; 
            return {
                customerId: emp.id,
                employeeName: emp.name,
                grossPay,
                deductions: [],
                netPay,
            };
        });
        setCalculatedPayslips(payslips);
        setIsCalculating(false);
    }

    setCurrentStep(prev => prev + 1);
  };
  
  const handleCreateRun = async () => {
    if (!institutionId || !user || !institutionDocRef) return;
    setLoading('create');

    const { employerId, periodMonth, periodYear } = form.getValues();
    const period = `${periodYear}-${periodMonth.padStart(2, '0')}`;
    
    try {
        await runTransaction(firestore, async (transaction) => {
            const instDoc = await transaction.get(institutionDocRef);
            if (!instDoc.exists()) throw new Error("Institution not found!");
            
            let payrollCounter = instDoc.data().payrollCounter || 0;
            const newPayrollId = `PAY-${period}-${++payrollCounter}`;
            
            const payrollsRef = collection(firestore, 'institutions', institutionId, 'payrolls');
            const newPayrollDocRef = doc(payrollsRef, newPayrollId);

            const totalGross = calculatedPayslips.reduce((sum, p) => sum + p.grossPay, 0);
            const totalNet = calculatedPayslips.reduce((sum, p) => sum + p.netPay, 0);

            transaction.set(newPayrollDocRef, {
                id: newPayrollId,
                employerId,
                period,
                status: 'Processed',
                totalAmount: totalGross,
                totalNet,
                processedBy: user.uid,
                processedAt: serverTimestamp(),
                institutionId,
            });

            const payslipsRef = collection(newPayrollDocRef, 'payslips');
            calculatedPayslips.forEach(p => {
                const newPayslipDocRef = doc(payslipsRef);
                transaction.set(newPayslipDocRef, {
                    id: newPayslipDocRef.id,
                    payrollId: newPayrollId,
                    customerId: p.customerId,
                    grossPay: p.grossPay,
                    deductions: p.deductions,
                    netPay: p.netPay,
                    status: 'Unpaid',
                    institutionId,
                });
            });

            transaction.update(institutionDocRef, { payrollCounter });
        });
        
        toast({ title: "Payroll Run Created", description: `Payroll for ${period} has been processed.` });
        setIsDialogOpen(false);
        form.reset();
        setCurrentStep(1);

    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to create payroll run.' });
    } finally {
        setLoading(null);
    }
  }

  const handlePostToGL = async (payroll: any) => {
    if (!institutionId || !user || !institutionDocRef || !payrollSettings) {
        toast({
            variant: 'destructive',
            title: 'Configuration Error',
            description: 'Payroll GL settings are not configured. Please configure them in Payroll Settings.',
        });
        return;
    }

    setLoading(payroll.id);
    
    try {
      await runTransaction(firestore, async (transaction) => {
        const instDoc = await transaction.get(institutionDocRef);
        if (!instDoc.exists()) throw new Error("Institution not found!");

        const journalBatchCounter = instDoc.data().journalBatchCounter || 0;
        const newBatchId = `bat${String(journalBatchCounter + 1).padStart(7, '0')}`;

        const journalsRef = collection(firestore, 'institutions', institutionId, 'journals');
        const newJournalDocRef = doc(journalsRef, newBatchId);
        
        // Use configured GL accounts
        const journalData = {
          id: newBatchId,
          institutionId,
          branchId: '01', // Assuming payroll is an HQ function for now
          date: serverTimestamp(),
          description: `Payroll for period ${payroll.period}`,
          transactions: [
            { accountId: payrollSettings.salariesExpenseAccountId, debit: payroll.totalAmount, credit: 0 },
            { accountId: payrollSettings.netSalariesPayableAccountId, debit: 0, credit: payroll.totalNet }
          ],
          status: 'Posted',
          createdBy: user.uid,
          createdAt: serverTimestamp(),
        };

        transaction.set(newJournalDocRef, journalData);
        
        const payrollDocRef = doc(firestore, 'institutions', institutionId, 'payrolls', payroll.id);
        transaction.update(payrollDocRef, { status: 'Posted' });
        transaction.update(institutionDocRef, { journalBatchCounter: journalBatchCounter + 1 });
      });

      toast({ title: 'Payroll Posted', description: `Payroll run for ${payroll.period} has been posted to the General Ledger.` });
    } catch(e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to post payroll.' });
    } finally {
      setLoading(null);
    }
  }
  
  const handleMarkAsPaid = async (payroll: any) => {
      if (!institutionId) return;
      setLoading(payroll.id);
      try {
        const payrollDocRef = doc(firestore, 'institutions', institutionId, 'payrolls', payroll.id);
        await updateDoc(payrollDocRef, { status: 'Paid' });
        // In a real scenario, you'd also update all payslips to 'Paid'
        toast({ title: 'Payroll Paid', description: `Payroll run for ${payroll.period} has been marked as paid.` });
      } catch(e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to update payroll status.' });
      } finally {
          setLoading(null);
      }
  }

  const years = Array.from({ length: 5 }, (_, i) => String(getYear(new Date()) - i));
  const months = Array.from({ length: 12 }, (_, i) => ({
      value: String(i + 1),
      label: format(new Date(2000, i), 'MMMM'),
  }));
  
  const getEmployerName = (id: string) => employers?.find(e => e.id === id)?.name || id;

  return (
    <>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payroll Runs</h1>
          <p className="text-muted-foreground mt-1">
            Process payroll, manage runs, and view historical data.
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" /> Process New Payroll
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Payroll Runs</CardTitle>
          <CardDescription>A history of the most recent payrolls processed.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
                <TableHead>Period</TableHead><TableHead>Employer</TableHead><TableHead>Status</TableHead><TableHead>Total Gross</TableHead><TableHead>Total Net</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {isPayrollsLoading ? Array.from({ length: 3 }).map((_, i) => <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell></TableRow>)
               : payrolls && payrolls.length > 0 ? payrolls.map((payroll) => (
                <TableRow key={payroll.id}>
                    <TableCell className="font-medium">{payroll.period}</TableCell>
                    <TableCell>{getEmployerName(payroll.employerId)}</TableCell>
                    <TableCell><Badge variant={getBadgeVariant(payroll.status)}>{payroll.status}</Badge></TableCell>
                    <TableCell>MWK {payroll.totalAmount.toLocaleString()}</TableCell>
                    <TableCell>MWK {payroll.totalNet.toLocaleString()}</TableCell>
                    <TableCell className="text-right space-x-2">
                        {payroll.status === 'Processed' && <Button size="sm" onClick={() => handlePostToGL(payroll)} disabled={loading === payroll.id}>{loading === payroll.id ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Post to GL'}</Button>}
                        {payroll.status === 'Posted' && <Button size="sm" onClick={() => handleMarkAsPaid(payroll)} disabled={loading === payroll.id}>{loading === payroll.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Mark as Paid'}</Button>}
                        <Button variant="outline" size="sm">View</Button>
                    </TableCell>
                </TableRow>
               )) : <TableRow><TableCell colSpan={6} className="h-24 text-center">No payroll runs found.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>

    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogContent className="max-w-4xl">
        <DialogHeader><DialogTitle>Process New Payroll Run</DialogTitle></DialogHeader>
        <div className="py-4">
            {currentStep === 1 && (
                <Form {...form}>
                    <form className="space-y-4">
                        <FormField control={form.control} name="employerId" render={({ field }) => (
                            <FormItem><FormLabel>Employer</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder={isEmployersLoading ? "Loading..." : "Select an employer..."}/></SelectTrigger></FormControl>
                                <SelectContent>{employers?.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
                            </Select><FormMessage/></FormItem>
                        )}/>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="periodMonth" render={({ field }) => (
                                <FormItem><FormLabel>Period Month</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                    <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                                </Select><FormMessage/></FormItem>
                            )}/>
                            <FormField control={form.control} name="periodYear" render={({ field }) => (
                                <FormItem><FormLabel>Period Year</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                    <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                                </Select><FormMessage/></FormItem>
                            )}/>
                        </div>
                         <DialogFooter><Button type="button" onClick={handleNextStep}>Next <ArrowRight className="ml-2 h-4 w-4" /></Button></DialogFooter>
                    </form>
                </Form>
            )}
            {currentStep === 2 && (
                <div>
                    <h3 className="font-semibold mb-2">Step 2: Employee Selection</h3>
                    <p className="text-sm text-muted-foreground mb-4">The following {employees.length} employees will be included in this payroll run.</p>
                    <div className="max-h-60 overflow-y-auto border rounded-md">
                        <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Salary</TableHead></TableRow></TableHeader>
                            <TableBody>{employees.map(emp => <TableRow key={emp.id}><TableCell>{emp.name}</TableCell><TableCell>MWK {emp.salary.toLocaleString()}</TableCell></TableRow>)}</TableBody>
                        </Table>
                    </div>
                     <DialogFooter className="mt-4"><Button type="button" onClick={handleNextStep}>{isCalculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Calculator className="mr-2 h-4 w-4" />}Calculate Payroll</Button></DialogFooter>
                </div>
            )}
             {currentStep === 3 && (
                <div>
                    <h3 className="font-semibold mb-2">Step 3: Review Payroll</h3>
                    <p className="text-sm text-muted-foreground mb-4">Review the calculated amounts below before creating the payroll run.</p>
                    <div className="max-h-60 overflow-y-auto border rounded-md">
                        <Table><TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Gross Pay</TableHead><TableHead>Net Pay</TableHead></TableRow></TableHeader>
                            <TableBody>{calculatedPayslips.map(p => <TableRow key={p.customerId}><TableCell>{p.employeeName}</TableCell><TableCell>MWK {p.grossPay.toLocaleString()}</TableCell><TableCell>MWK {p.netPay.toLocaleString()}</TableCell></TableRow>)}</TableBody>
                        </Table>
                    </div>
                     <DialogFooter className="mt-4"><Button type="button" onClick={handleCreateRun} disabled={loading === 'create'}>{loading === 'create' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ClipboardCheck className="mr-2 h-4 w-4" />}Create Payroll Run</Button></DialogFooter>
                </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
