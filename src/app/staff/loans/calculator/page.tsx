

'use client';

import * as React from 'react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import {
  Calculator,
  Landmark,
  CircleDollarSign,
  TrendingDown,
  Receipt,
  CalendarIcon,
  Download,
} from 'lucide-react';
import { calculateAmortization, AmortizationRow } from '@/lib/finance';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import Papa from 'papaparse';


const calculatorSchema = z.object({
  principal: z.coerce.number().positive('Principal must be a positive number.'),
  annualInterestRate: z.coerce
    .number()
    .min(0, 'Interest rate cannot be negative.'),
  term: z.coerce.number().int().positive('Term must be a positive integer.'),
  tenureUnit: z.enum(['Days', 'Months', 'Years']),
  interestRateType: z.enum(['Flat', 'Reducing Balance']),
  amortizationMethod: z.enum([
    'Equal Installments',
    'Fixed Principal + Interest',
  ]),
  startDate: z.date({ required_error: 'A start date is required.'}),
});

type CalculatorInput = z.infer<typeof calculatorSchema>;


export default function LoanCalculatorPage() {
  const [activeTab, setActiveTab] = useState<'product' | 'manual'>('product');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<AmortizationRow[]>([]);
  const [summary, setSummary] = useState({ totalInterest: 0, totalPayment: 0, monthlyInstallment: 0 });

  const { user } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);

  const productsQuery = useMemoFirebase(
    () =>
      firestore && userData?.institutionId
        ? query(
            collection(
              firestore,
              'institutions',
              userData.institutionId,
              'loanProducts'
            ),
            where('status', '==', 'Active')
          )
        : null,
    [firestore, userData]
  );
  const { data: products, isLoading: isProductsLoading } = useCollection(productsQuery);

  const productForm = useForm<{ principal: number, term: number, startDate: Date }>({
      defaultValues: { principal: 100000, term: 12, startDate: new Date() }
  });
  
  const manualForm = useForm<CalculatorInput>({
    resolver: zodResolver(calculatorSchema),
    defaultValues: {
      principal: 100000,
      annualInterestRate: 24,
      term: 12,
      tenureUnit: 'Months',
      interestRateType: 'Reducing Balance',
      amortizationMethod: 'Equal Installments',
      startDate: new Date(),
    },
  });

  const watchedManualFields = useWatch({ control: manualForm.control });
  const watchedProductFields = useWatch({ control: productForm.control });

  useEffect(() => {
    if (activeTab === 'manual') {
      const result = calculatorSchema.safeParse(watchedManualFields);
      if (result.success) {
        const { schedule, totalInterest, totalPayment, monthlyInstallment } = calculateAmortization(result.data);
        setSchedule(schedule);
        setSummary({ totalInterest, totalPayment, monthlyInstallment });
      } else {
        setSchedule([]);
        setSummary({ totalInterest: 0, totalPayment: 0, monthlyInstallment: 0 });
      }
    }
  }, [watchedManualFields, activeTab]);

  useEffect(() => {
    if (activeTab === 'product' && selectedProductId) {
      const product = products?.find(p => p.id === selectedProductId);
      const principal = Number(watchedProductFields.principal);
      const term = Number(watchedProductFields.term);
      const startDate = watchedProductFields.startDate;

      if(product && principal > 0 && term > 0 && startDate) {
        const input: CalculatorInput = {
            principal,
            term,
            startDate,
            tenureUnit: product.tenureUnit || 'Months',
            annualInterestRate: product.annualInterestRate,
            interestRateType: product.interestRateType,
            amortizationMethod: product.amortizationMethod
        };
        const { schedule, totalInterest, totalPayment, monthlyInstallment } = calculateAmortization(input);
        setSchedule(schedule);
        setSummary({ totalInterest, totalPayment, monthlyInstallment });
      } else {
        setSchedule([]);
        setSummary({ totalInterest: 0, totalPayment: 0, monthlyInstallment: 0 });
      }
    }
  }, [watchedProductFields, selectedProductId, products, activeTab]);
  
  const displayedPrincipal = useMemo(() => {
    if (activeTab === 'product') {
      return watchedProductFields.principal || 0;
    }
    return watchedManualFields.principal || 0;
  }, [activeTab, watchedProductFields, watchedManualFields]);

  const handleDownloadCsv = () => {
    if (!summary || schedule.length === 0) {
      return;
    }
    
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Summary
    csvContent += "Loan Quotation Summary\n";
    csvContent += `Principal,MWK ${displayedPrincipal.toLocaleString()}\n`;
    csvContent += `Monthly Repayment,MWK ${summary.monthlyInstallment.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}\n`;
    csvContent += `Total Interest,MWK ${summary.totalInterest.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}\n`;
    csvContent += `Total Repayable,MWK ${summary.totalPayment.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}\n`;
    csvContent += "\n";

    // Schedule Header
    const headers = ["Payment Date", "Principal", "Interest", "Total Payment", "Loan Balance"];
    csvContent += headers.join(",") + "\n";
    
    // Schedule Rows
    schedule.forEach(row => {
      const rowData = [
        format(row.paymentDate, 'yyyy-MM-dd'),
        row.principal.toFixed(2),
        row.interest.toFixed(2),
        row.totalPayment.toFixed(2),
        row.closingBalance.toFixed(2),
      ];
      csvContent += rowData.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "loan_quotation.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Loan Calculator</h1>
          <p className="text-muted-foreground mt-1">
            Generate loan quotations and amortization schedules.
          </p>
        </div>
        <Button onClick={handleDownloadCsv} variant="outline" disabled={schedule.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Download Quotation (CSV)
        </Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-1 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Calculation Mode</CardTitle>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="product" className="w-full" onValueChange={(value) => setActiveTab(value as 'product' | 'manual')}>
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="product">From Product</TabsTrigger>
                            <TabsTrigger value="manual">Manual</TabsTrigger>
                        </TabsList>
                        <TabsContent value="product" className="pt-6">
                            <Form {...productForm}>
                                <form className="space-y-4">
                                    <FormItem>
                                        <FormLabel>Loan Product</FormLabel>
                                        <Select onValueChange={setSelectedProductId} disabled={isProductsLoading}>
                                            <FormControl>
                                                <SelectTrigger><SelectValue placeholder={isProductsLoading ? "Loading..." : "Select a product"} /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {products?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </FormItem>
                                    <FormField control={productForm.control} name="principal" render={({ field }) => (
                                        <FormItem><FormLabel>Principal Amount</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                                    )}/>
                                    <FormField control={productForm.control} name="term" render={({ field }) => (
                                        <FormItem><FormLabel>Term</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                                    )}/>
                                    <FormField control={productForm.control} name="startDate" render={({ field }) => (
                                        <FormItem className="flex flex-col"><FormLabel>Loan Start Date</FormLabel>
                                            <Popover><PopoverTrigger asChild>
                                                <FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl>
                                            </PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover>
                                        <FormMessage /></FormItem>
                                    )} />
                                </form>
                            </Form>
                        </TabsContent>
                        <TabsContent value="manual" className="pt-6">
                            <Form {...manualForm}>
                                <form className="space-y-4">
                                    <FormField control={manualForm.control} name="principal" render={({ field }) => (<FormItem><FormLabel>Principal Amount</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage/></FormItem>)} />
                                    <FormField control={manualForm.control} name="annualInterestRate" render={({ field }) => (<FormItem><FormLabel>Annual Interest Rate (%)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage/></FormItem>)} />
                                    <div className="grid grid-cols-2 gap-4">
                                      <FormField control={manualForm.control} name="term" render={({ field }) => (<FormItem><FormLabel>Term</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage/></FormItem>)} />
                                      <FormField control={manualForm.control} name="tenureUnit" render={({ field }) => (<FormItem><FormLabel>Units</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="Days">Days</SelectItem><SelectItem value="Months">Months</SelectItem><SelectItem value="Years">Years</SelectItem></SelectContent></Select></FormItem>)} />
                                    </div>
                                    <FormField control={manualForm.control} name="startDate" render={({ field }) => (
                                        <FormItem className="flex flex-col"><FormLabel>Loan Start Date</FormLabel>
                                            <Popover><PopoverTrigger asChild>
                                                <FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl>
                                            </PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover>
                                        <FormMessage /></FormItem>
                                    )} />
                                    <FormField control={manualForm.control} name="interestRateType" render={({ field }) => (<FormItem><FormLabel>Interest Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="Flat">Flat</SelectItem><SelectItem value="Reducing Balance">Reducing Balance</SelectItem></SelectContent></Select></FormItem>)} />
                                </form>
                            </Form>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Monthly Repayment</CardTitle><Receipt className="h-4 w-4 text-muted-foreground"/></CardHeader>
                    <CardContent><p className="text-2xl font-bold">MWK {summary.monthlyInstallment.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p></CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Repayable</CardTitle><CircleDollarSign className="h-4 w-4 text-muted-foreground"/></CardHeader>
                    <CardContent><p className="text-2xl font-bold">MWK {summary.totalPayment.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p></CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Interest</CardTitle><TrendingDown className="h-4 w-4 text-muted-foreground"/></CardHeader>
                    <CardContent><p className="text-2xl font-bold">MWK {summary.totalInterest.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p></CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Principal</CardTitle><Landmark className="h-4 w-4 text-muted-foreground"/></CardHeader>
                    <CardContent><p className="text-2xl font-bold">MWK {displayedPrincipal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p></CardContent>
                </Card>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Amortization Schedule</CardTitle>
                    <CardDescription>A breakdown of payments over the loan term.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Payment Date</TableHead>
                                <TableHead>Principal</TableHead>
                                <TableHead>Interest</TableHead>
                                <TableHead>Total Payment</TableHead>
                                <TableHead>Loan Balance</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {schedule.length > 0 ? schedule.map(row => (
                                <TableRow key={row.period}>
                                    <TableCell>{row.paymentDate ? format(row.paymentDate, 'dd-MMM-yy') : ''}</TableCell>
                                    <TableCell>{row.principal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
                                    <TableCell>{row.interest.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
                                    <TableCell>{row.totalPayment.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
                                    <TableCell>{row.closingBalance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">Enter valid loan details to generate a schedule.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
         </div>
        </div>
      </div>
  );
}
