'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import {
  collection,
  query,
  doc,
  writeBatch,
  Timestamp,
  getDocs,
  where,
  limit,
  setDoc,
  updateDoc,
  collectionGroup,
  serverTimestamp,
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
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Check,
  X,
  Loader2,
  FilePlus2,
  FileCog,
  DollarSign,
  Receipt,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { format, getMonth, getYear, startOfMonth, endOfMonth, addDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { generateInvoicePdf } from '@/lib/pdf-generator';

const FLAT_FEE = 2500000;

const generateInvoiceSchema = z.object({
    month: z.string(),
    year: z.string(),
})

export default function InvoicingPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [date, setDate] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const institutionsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'institutions') : null),
    [firestore]
  );
  const { data: institutions, isLoading: isInstitutionsLoading } = useCollection(institutionsQuery);

  const [invoices, setInvoices] = useState<any[]>([]);
  const [isInvoicesLoading, setIsInvoicesLoading] = useState(true);
  
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [isPaymentsLoading, setIsPaymentsLoading] = useState(true);

  useEffect(() => {
    async function fetchInvoicesAndPayments() {
      if (!firestore || !institutions) return;
      
      setIsInvoicesLoading(true);
      setIsPaymentsLoading(true);
      const allInvoices: any[] = [];
      const allPendingPayments: any[] = [];

      for (const inst of institutions) {
        const instId = inst.id;
        
        // Fetch Invoices
        if (date?.from && date?.to) {
          const invoicesRef = collection(firestore, 'institutions', instId, 'invoices');
          const q = query(
            invoicesRef,
            where('createdAt', '>=', Timestamp.fromDate(date.from)),
            where('createdAt', '<=', Timestamp.fromDate(date.to))
          );
          const invoiceSnap = await getDocs(q);
          invoiceSnap.forEach((doc) => allInvoices.push({ id: doc.id, ...doc.data() }));
        }

        // Fetch Pending Payments for each invoice
        const paymentsRef = collection(firestore, 'institutions', instId, 'invoices');
        const paymentsQuery = query(collectionGroup(firestore, 'payments'), where('institutionId', '==', instId), where('status', '==', 'Pending Confirmation'));
        const paymentsSnap = await getDocs(paymentsQuery);
        paymentsSnap.forEach(doc => {
            allPendingPayments.push({ ...doc.data(), id: doc.id });
        });
      }
      
      setInvoices(allInvoices.sort((a,b) => b.createdAt.toDate() - a.createdAt.toDate()));
      setPendingPayments(allPendingPayments);
      setIsInvoicesLoading(false);
      setIsPaymentsLoading(false);
    }

    if (!isInstitutionsLoading) {
        fetchInvoicesAndPayments();
    }
  }, [firestore, institutions, date, isInstitutionsLoading]);


  const totalInvoicedAmount = useMemo(() => {
      return invoices?.reduce((sum, invoice) => sum + invoice.amount, 0) || 0;
  }, [invoices]);

  const getInstitutionName = (institutionId: string) => {
      return institutions?.find(inst => inst.id === institutionId)?.name || 'Unknown Institution';
  }
  
  const getBadgeVariant = (status: string) => {
    switch (status) {
        case 'Paid': return 'default';
        case 'Pending': return 'secondary';
        case 'Partially Paid': return 'outline';
        case 'Overdue': return 'destructive';
        default: return 'secondary';
    }
  }

  const handleConfirmPayment = async (payment: any) => {
    if (!firestore || !payment) return;
    setActionLoading(payment.id);
    try {
      const batch = writeBatch(firestore);

      // Update payment status
      const paymentRef = doc(firestore, 'institutions', payment.institutionId, 'invoices', payment.invoiceId, 'payments', payment.id);
      batch.update(paymentRef, { status: 'Confirmed' });

      // Update invoice amountPaid
      const invoiceRef = doc(firestore, 'institutions', payment.institutionId, 'invoices', payment.invoiceId);
      const invoiceDoc = await getDocs(query(collectionGroup(firestore, 'invoices'), where('id', '==', payment.invoiceId), limit(1)));
      if (!invoiceDoc.empty) {
          const invoiceData = invoiceDoc.docs[0].data();
          const currentPaid = invoiceData.amountPaid || 0;
          const newAmountPaid = currentPaid + payment.amount;
          const newStatus = newAmountPaid >= invoiceData.amount ? 'Paid' : 'Partially Paid';
          batch.update(invoiceRef, { amountPaid: newAmountPaid, status: newStatus });
      }
      
      await batch.commit();
      toast({ title: 'Payment Confirmed', description: 'The payment has been confirmed and applied to the invoice.' });
      
    } catch(e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to confirm payment.' });
    } finally {
      setActionLoading(null);
    }
  }
  
  const generateForm = useForm<z.infer<typeof generateInvoiceSchema>>({
      resolver: zodResolver(generateInvoiceSchema),
      defaultValues: {
          month: String(getMonth(new Date()) + 1),
          year: String(getYear(new Date())),
      }
  })
  
 async function handleGenerateInvoice(values: z.infer<typeof generateInvoiceSchema>) {
    if (!firestore || !institutions) {
        toast({ variant: 'destructive', title: 'Error', description: 'Cannot generate invoice. Institution data is missing.' });
        return;
    }
    setActionLoading('generate');

    try {
        const year = parseInt(values.year);
        const month = parseInt(values.month) - 1; // JS months are 0-indexed
        const periodStart = startOfMonth(new Date(year, month));
        const periodString = `${values.year}-${values.month.padStart(2, '0')}`;
        
        const batch = writeBatch(firestore);

        for (const inst of institutions) {
            const instId = inst.id;

            // Check for existing invoice
            const invoicesRef = collection(firestore, 'institutions', instId, 'invoices');
            const existingInvoiceQuery = query(invoicesRef, where('period', '==', periodString), limit(1));
            const existingInvoiceSnap = await getDocs(existingInvoiceQuery);
            
            const invoiceData = {
                institutionId: instId,
                period: periodString,
                amount: FLAT_FEE,
                status: 'Pending',
                dueDate: Timestamp.fromDate(endOfMonth(addDays(periodStart, 45))),
            };

            if (existingInvoiceSnap.empty) {
                // Create new invoice
                const newDocRef = doc(invoicesRef);
                batch.set(newDocRef, { ...invoiceData, id: newDocRef.id, createdAt: serverTimestamp(), amountPaid: 0 });
            } else {
                // Update existing invoice
                const existingDocRef = existingInvoiceSnap.docs[0].ref;
                batch.update(existingDocRef, { amount: FLAT_FEE });
            }
        }
        
        await batch.commit();
        toast({ title: 'Invoice Generation Complete', description: `Successfully created/updated invoices for ${format(periodStart, 'MMMM yyyy')}.`});

    } catch (e) {
        console.error("Invoice generation failed:", e);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to generate invoices.'});
    } finally {
        setActionLoading(null);
    }
  };

  const handleViewInvoice = (invoice: any) => {
    const institution = institutions?.find(i => i.id === invoice.institutionId);
    if (institution) {
      generateInvoicePdf(invoice, institution);
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not find institution details to generate PDF.'
      });
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => String(getYear(new Date()) - i));
  const months = Array.from({ length: 12 }, (_, i) => ({
      value: String(i + 1),
      label: format(new Date(2000, i), 'MMMM'),
  }));
  
  const selectedPeriod = `${generateForm.watch('year')}-${generateForm.watch('month').padStart(2, '0')}`;
  const invoiceForSelectedPeriodExists = invoices?.some(inv => inv.period === selectedPeriod);


  return (
    <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
            <h1 className="text-3xl font-bold tracking-tight">Invoicing & Revenue</h1>
            <p className="text-muted-foreground mt-1">
                View platform revenue and manage institution invoices.
            </p>
            </div>
             <Popover>
                <PopoverTrigger asChild>
                <Button
                    id="date"
                    variant={"outline"}
                    className={cn("w-[300px] justify-start text-left font-normal", !date && "text-muted-foreground")}
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
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
             <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Total Invoiced Revenue</CardTitle>
                    <DollarSign className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    {isInvoicesLoading ? <Skeleton className="h-8 w-3/4" /> : (
                        <div className="text-3xl font-bold">MWK {totalInvoicedAmount.toLocaleString()}</div>
                    )}
                    <p className="text-xs text-muted-foreground">
                        Total from generated invoices.
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium">Standard Subscription</CardTitle>
                    <Receipt className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold">MWK 2.5M</div>
                    <p className="text-xs text-muted-foreground">
                        Flat monthly fee per institution.
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Bulk Invoice Generation</CardTitle>
                    <CardDescription>
                        Generate standard 2.5M MWK invoices for all institutions.
                    </CardDescription>
                </CardHeader>
                <Form {...generateForm}>
                    <form onSubmit={generateForm.handleSubmit(handleGenerateInvoice)}>
                        <CardContent className="flex flex-col sm:flex-row gap-4">
                           <FormField
                                control={generateForm.control}
                                name="month"
                                render={({ field }) => (
                                    <FormItem className="flex-1">
                                    <FormLabel>Month</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                        <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                                    </Select>
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={generateForm.control}
                                name="year"
                                render={({ field }) => (
                                    <FormItem className="flex-1">
                                    <FormLabel>Year</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                        <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                                    </Select>
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" disabled={actionLoading === 'generate'}>
                                 {actionLoading === 'generate' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : (invoiceForSelectedPeriodExists ? <FileCog className="mr-2 h-4 w-4" /> : <FilePlus2 className="mr-2 h-4 w-4" />)}
                                {invoiceForSelectedPeriodExists ? 'Rebuild All Invoices' : 'Generate All Invoices'}
                            </Button>
                        </CardFooter>
                    </form>
                </Form>
            </Card>
        </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Payment Confirmations</CardTitle>
          <CardDescription>Review and confirm subscription payments submitted by institutions.</CardDescription>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Institution</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Submitted On</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                </TableHeader>
                 <TableBody>
                    {isPaymentsLoading ? (
                        <TableRow><TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                    ) : pendingPayments.length > 0 ? (
                        pendingPayments.map(payment => (
                            <TableRow key={payment.id}>
                                <TableCell>{getInstitutionName(payment.institutionId)}</TableCell>
                                <TableCell>MWK {payment.amount.toLocaleString()}</TableCell>
                                <TableCell>{payment.reference}</TableCell>
                                <TableCell>{format(payment.createdAt.toDate(), 'PPP')}</TableCell>
                                <TableCell className="text-right">
                                    <Button size="sm" onClick={() => handleConfirmPayment(payment)} disabled={actionLoading === payment.id}>
                                        {actionLoading === payment.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4" />}
                                        Confirm
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow><TableCell colSpan={5} className="h-24 text-center">No pending payments to confirm.</TableCell></TableRow>
                    )}
                </TableBody>
            </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoice Log</CardTitle>
          <CardDescription>A log of all invoices generated within the selected period.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Institution</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Amount Paid</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isInvoicesLoading || isInstitutionsLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-5 w-32"/></TableCell>
                            <TableCell><Skeleton className="h-5 w-24"/></TableCell>
                            <TableCell><Skeleton className="h-5 w-20"/></TableCell>
                            <TableCell><Skeleton className="h-5 w-20"/></TableCell>
                            <TableCell><Skeleton className="h-6 w-16"/></TableCell>
                            <TableCell><Skeleton className="h-5 w-24"/></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-9 w-20 ml-auto"/></TableCell>
                        </TableRow>
                    ))
                ) : invoices && invoices.length > 0 ? (
                    invoices.map(invoice => (
                        <TableRow key={invoice.id}>
                            <TableCell className="font-medium">{getInstitutionName(invoice.institutionId)}</TableCell>
                            <TableCell>{invoice.period}</TableCell>
                            <TableCell>MWK {invoice.amount.toLocaleString()}</TableCell>
                            <TableCell>MWK {invoice.amountPaid.toLocaleString()}</TableCell>
                            <TableCell><Badge variant={getBadgeVariant(invoice.status)}>{invoice.status}</Badge></TableCell>
                            <TableCell>{format(invoice.dueDate.toDate(), 'PPP')}</TableCell>
                            <TableCell className="text-right">
                                <Button variant="outline" size="sm" onClick={() => handleViewInvoice(invoice)}>
                                    View
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))
                ) : (
                    <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center">
                            No invoices found for the selected period.
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
