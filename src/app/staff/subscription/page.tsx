'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  useUser,
  useFirestore,
  useDoc,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import {
  collection,
  doc,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  where,
  Timestamp,
  getDocs,
  setDoc,
  updateDoc,
  limit,
} from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  CreditCard,
  Banknote,
  FilePlus2,
  Loader2,
  AlertCircle,
  CheckCircle,
  FileCog,
  Info,
  Eye,
  HandCoins,
} from 'lucide-react';
import { format, getMonth, getYear, startOfMonth, endOfMonth, addDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { generateInvoicePdf } from '@/lib/pdf-generator';

const FLAT_FEE = 2500000;

const paymentSchema = z.object({
  amount: z.coerce.number().positive('Amount must be positive.'),
  reference: z.string().min(1, 'Payment reference is required.'),
});

const generateInvoiceSchema = z.object({
    month: z.string(),
    year: z.string(),
})

export default function SubscriptionPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [totalDisbursedThisMonth, setTotalDisbursedThisMonth] = useState(0);
  const [isLoansLoading, setIsLoansLoading] = useState(true);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);

  const institutionDocRef = useMemoFirebase(
    () =>
      firestore && userData?.institutionId
        ? doc(firestore, 'institutions', userData.institutionId)
        : null,
    [firestore, userData]
  );
  const { data: institutionData, isLoading: isInstitutionLoading } =
    useDoc(institutionDocRef);

  const invoicesQuery = useMemoFirebase(
    () =>
      firestore && userData?.institutionId
        ? query(
            collection(
              firestore,
              'institutions',
              userData.institutionId,
              'invoices'
            ),
            orderBy('createdAt', 'desc')
          )
        : null,
    [firestore, userData]
  );
  const { data: invoices, isLoading: isInvoicesLoading } =
    useCollection(invoicesQuery);

  useEffect(() => {
    const fetchDisbursedLoans = async () => {
      if (!firestore || !userData?.institutionId || !institutionData?.systemDate) return;
      setIsLoansLoading(true);

      const systemDate = institutionData.systemDate.toDate();
      const currentMonthStart = startOfMonth(systemDate);
      const currentMonthEnd = endOfMonth(systemDate);
      const instId = userData.institutionId;

      const loanAppRef = collection(firestore, 'institutions', instId, 'loanApplications');
      const runningLoansRef = collection(firestore, 'institutions', instId, 'runningLoans');

      const q1 = query(loanAppRef, where('disbursalDate', '>=', Timestamp.fromDate(currentMonthStart)), where('disbursalDate', '<=', Timestamp.fromDate(currentMonthEnd)));
      const q2 = query(runningLoansRef, where('disbursalDate', '>=', Timestamp.fromDate(currentMonthStart)), where('disbursalDate', '<=', Timestamp.fromDate(currentMonthEnd)));
      
      const [loanAppSnap, runningLoansSnap] = await Promise.all([
        getDocs(q1),
        getDocs(q2),
      ]);

      const disbursedAmount = [...loanAppSnap.docs, ...runningLoansSnap.docs]
        .reduce((sum, doc) => sum + doc.data().amount, 0);

      setTotalDisbursedThisMonth(disbursedAmount);
      setIsLoansLoading(false);
    };

    if(userData?.institutionId && institutionData) {
        fetchDisbursedLoans();
    }
  }, [firestore, userData, institutionData]);


  const paymentForm = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
  });
  
  const generateForm = useForm<z.infer<typeof generateInvoiceSchema>>({
      resolver: zodResolver(generateInvoiceSchema),
      defaultValues: {
          month: String(getMonth(new Date()) + 1),
          year: String(getYear(new Date())),
      }
  })

  const handleMakePayment = (invoice: any) => {
    setSelectedInvoice(invoice);
    setIsPaymentDialogOpen(true);
    setError(null);
    setSuccess(null);
    paymentForm.reset();
  };
  
 async function handleGenerateInvoice(values: z.infer<typeof generateInvoiceSchema>) {
    if (!userData?.institutionId || !institutionData) {
        toast({ variant: 'destructive', title: 'Error', description: 'Cannot generate invoice. Institution data is missing.' });
        return;
    }
    setLoading(true);

    try {
        const year = parseInt(values.year);
        const month = parseInt(values.month) - 1; // JS months are 0-indexed
        const periodStart = startOfMonth(new Date(year, month));
        const periodString = `${values.year}-${values.month.padStart(2, '0')}`;
        const instId = userData.institutionId;

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
            await setDoc(newDocRef, {
                ...invoiceData,
                id: newDocRef.id,
                createdAt: serverTimestamp(),
                amountPaid: 0,
            });
            toast({ title: 'Invoice Generated', description: `Successfully created invoice for ${format(periodStart, 'MMMM yyyy')}.`});
        } else {
            // Update existing invoice
            const existingDocRef = existingInvoiceSnap.docs[0].ref;
            await updateDoc(existingDocRef, {
                amount: FLAT_FEE,
            });
            toast({ title: 'Invoice Rebuilt', description: `Successfully rebuilt invoice for ${format(periodStart, 'MMMM yyyy')}.`});
        }
    } catch (e) {
        console.error("Invoice generation failed:", e);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to generate invoice.'});
    } finally {
        setLoading(false);
    }
  };


  async function onPaymentSubmit(values: z.infer<typeof paymentSchema>) {
    if (!firestore || !userData?.institutionId || !selectedInvoice) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const paymentsRef = collection(
        firestore,
        'institutions',
        userData.institutionId,
        'invoices',
        selectedInvoice.id,
        'payments'
      );
      
      const newPayment = {
        invoiceId: selectedInvoice.id,
        institutionId: userData.institutionId,
        amount: values.amount,
        reference: values.reference,
        createdAt: serverTimestamp(),
        status: 'Pending Confirmation',
      };
      
      await addDoc(paymentsRef, newPayment);
      
      setSuccess('Payment submitted for confirmation.');
      setIsPaymentDialogOpen(false);
    } catch (e) {
      console.error(e);
      setError('Failed to submit payment. Please try again.');
    } finally {
      setLoading(false);
    }
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

  const handleViewInvoice = (invoice: any) => {
    if (institutionData) {
      generateInvoicePdf(invoice, institutionData);
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
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Subscription &amp; Billing</CardTitle>
          <CardDescription>
            Manage your institution's subscription and view billing details.
          </CardDescription>
        </CardHeader>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Disbursed this Month
            </CardTitle>
            <Banknote className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoansLoading ? (
              <Skeleton className="h-8 w-3/4" />
            ) : (
              <div className="text-3xl font-bold">
                {totalDisbursedThisMonth.toLocaleString('en-US', {
                  style: 'currency',
                  currency: 'MWK',
                })}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Total loan amount disbursed in {format(new Date(), 'MMMM yyyy')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Subscription Model
            </CardTitle>
            <HandCoins className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">Flat Monthly Fee</div>
            <p className="text-xs text-muted-foreground">
              Standard platform access fee.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Monthly Charge
            </CardTitle>
            <CreditCard className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {FLAT_FEE.toLocaleString('en-US', {
                style: 'currency',
                currency: 'MWK',
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Fixed recurring monthly amount.
            </p>
          </CardContent>
        </Card>
      </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <Card>
            <CardHeader>
                <CardTitle>Invoice Generation</CardTitle>
                <CardDescription>Generate a new subscription invoice or rebuild an existing one for a specific period.</CardDescription>
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
                        <Button type="submit" disabled={loading}>
                             {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : (invoiceForSelectedPeriodExists ? <FileCog className="mr-2 h-4 w-4" /> : <FilePlus2 className="mr-2 h-4 w-4" />)}
                            {invoiceForSelectedPeriodExists ? 'Rebuild Invoice' : 'Generate Invoice'}
                        </Button>
                    </CardFooter>
                </form>
            </Form>
        </Card>
         <Card className="bg-muted/50 border-dashed">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Info className="h-5 w-5 text-primary" /> Billing Policy</CardTitle>
            </CardHeader>
             <CardContent>
                <p className="text-sm text-muted-foreground">
                    CrediHub charges a flat monthly platform fee of 2,500,000 MWK per institution. Invoices are automatically generated on the first day of each month for the preceding month.
                </p>
            </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
            <CardTitle>Invoice History</CardTitle>
            <CardDescription>
                Review and manage your monthly subscription invoices.
            </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice Period</TableHead>
                <TableHead>Amount (MWK)</TableHead>
                <TableHead>Amount Paid (MWK)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isInvoicesLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-5 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-16 rounded-full" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="h-8 w-28 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : invoices && invoices.length > 0 ? (
                invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      {format(new Date(`${invoice.period}-02`), 'MMMM yyyy')}
                    </TableCell>
                    <TableCell>{invoice.amount.toLocaleString()}</TableCell>
                    <TableCell>{invoice.amountPaid.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={getBadgeVariant(invoice.status)}>{invoice.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewInvoice(invoice)}
                      >
                         <Eye className="mr-2 h-4 w-4" /> View
                      </Button>
                      <Button
                        onClick={() => handleMakePayment(invoice)}
                        size="sm"
                        disabled={invoice.status === 'Paid'}
                      >
                        Make Payment
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No invoices found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Make a Payment</DialogTitle>
            <DialogDescription>
              Record a payment for invoice period{' '}
              {selectedInvoice && format(new Date(`${selectedInvoice.period}-02`), 'MMMM yyyy')}.
            </DialogDescription>
          </DialogHeader>
          <Form {...paymentForm}>
            <form onSubmit={paymentForm.handleSubmit(onPaymentSubmit)} className="space-y-6 py-4">
            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
             {success && (
                <Alert variant="default" className="bg-green-100 dark:bg-green-900/20 border-green-300 dark:border-green-700">
                    <CheckCircle className="h-4 w-4 text-green-700 dark:text-green-300" />
                    <AlertTitle className="text-green-800 dark:text-green-200">Success</AlertTitle>
                    <AlertDescription className="text-green-700 dark:text-green-300">{success}</AlertDescription>
                </Alert>
             )}
              <FormField
                control={paymentForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount Paid (MWK)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 50000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={paymentForm.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Reference</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Bank transaction ID" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsPaymentDialogOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Submit Payment'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
