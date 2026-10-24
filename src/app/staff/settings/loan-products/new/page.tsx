'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
import { collection, doc, setDoc } from 'firebase/firestore';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertTitle, AlertDescription as AlertDescriptionComponent } from '@/components/ui/alert';
import {
  Loader2,
  AlertCircle,
  Save,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

const loanProductSchema = z.object({
    name: z.string().min(1, 'Product name is required.'),
    description: z.string().optional(),
    status: z.enum(['Active', 'Inactive']),
    loanType: z.enum(['Individual', 'Group', 'SME', 'Salary-Based', 'Agricultural']),
    minAmount: z.coerce.number().positive(),
    maxAmount: z.coerce.number().positive(),
    interestRateType: z.enum(['Flat', 'Reducing Balance']),
    interestBasis: z.enum(['360 Days', '365 Days']),
    interestStarts: z.enum(['On Disbursement Date', 'After Grace Period']),
    amortizationMethod: z.enum(['Equal Installments', 'Fixed Principal + Interest']),
    annualInterestRate: z.coerce.number().positive(),
    linkedFees: z.array(z.string()).optional(),
    repaymentFrequency: z.enum(['Daily', 'Weekly', 'Monthly']),
    repaymentDueDay: z.enum(['Same day as disbursement', 'End of month', 'Fixed day']),
    gracePeriod: z.coerce.number().int().min(0).optional(),
    minTerm: z.coerce.number().int().positive(),
    maxTerm: z.coerce.number().int().positive(),
    tenureUnit: z.enum(['Days', 'Months', 'Years']),
    disbursementMethods: z.array(z.string()).optional(),
    repaymentMethods: z.array(z.string()).optional(),
    loanPortfolioAccountId: z.string().min(1, 'Loan portfolio GL account is required.'),
    interestReceivableAccountId: z.string().min(1, 'Interest receivable GL account is required.'),
    interestIncomeAccountId: z.string().min(1, 'Interest income GL account is required.'),
    penaltyIncomeAccountId: z.string().min(1, 'Penalty income GL account is required.'),
    loanLossProvisionAccountId: z.string().min(1, 'Loan loss provision GL account is required.'),
    minMemberDuration: z.coerce.number().int().min(0).optional(),
    minSavingsBalance: z.coerce.number().min(0).optional(),
    allowMultipleActiveLoans: z.boolean().default(false),
    allowLoanTopUp: z.boolean().default(false),
    allowRescheduling: z.boolean().default(false),
    allowEarlyRepayment: z.boolean().default(false),
}).refine(data => data.maxAmount > data.minAmount, {
    message: "Max amount must be greater than min amount.",
    path: ["maxAmount"],
}).refine(data => data.maxTerm > data.minTerm, {
    message: "Max term must be greater than min term.",
    path: ["maxTerm"],
});

const CurrencyInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<'input'>
>(({ value, onChange, ...props }, ref) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const numValue = rawValue.replace(/,/g, '');
    if (numValue === '' || !isNaN(Number(numValue))) {
      if (onChange) {
        const syntheticEvent = {
          ...e,
          target: {
            ...e.target,
            value: numValue,
            name: props.name,
          },
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      }
    }
  };

  const formattedValue = (value !== undefined && value !== null && value !== '') 
    ? Number(value).toLocaleString('en-US') 
    : '';

  return (
    <Input
      {...props}
      ref={ref}
      value={formattedValue}
      onChange={handleChange}
    />
  );
});
CurrencyInput.displayName = 'CurrencyInput';


export default function NewLoanProductPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);
  const institutionId = userData?.institutionId;
  
  const coaQuery = useMemoFirebase(
    () =>
      firestore && institutionId
        ? collection(firestore, 'institutions', institutionId, 'chartOfAccounts')
        : null,
    [firestore, institutionId]
  );
  const { data: accounts, isLoading: isCoaLoading } = useCollection(coaQuery);

  const feesQuery = useMemoFirebase(
    () =>
      firestore && institutionId
        ? collection(firestore, 'institutions', institutionId, 'fees')
        : null,
    [firestore, institutionId]
  );
  const { data: fees, isLoading: isFeesLoading } = useCollection(feesQuery);

  const form = useForm<z.infer<typeof loanProductSchema>>({
    resolver: zodResolver(loanProductSchema),
    defaultValues: {
        name: '',
        description: '',
        status: 'Active',
        minAmount: 0,
        maxAmount: 0,
        interestRateType: 'Reducing Balance',
        interestBasis: '365 Days',
        interestStarts: 'On Disbursement Date',
        amortizationMethod: 'Equal Installments',
        annualInterestRate: 0,
        repaymentFrequency: 'Monthly',
        repaymentDueDay: 'Same day as disbursement',
        minTerm: 0,
        maxTerm: 0,
        tenureUnit: 'Months',
        loanPortfolioAccountId: '',
        interestReceivableAccountId: '',
        interestIncomeAccountId: '',
        penaltyIncomeAccountId: '',
        loanLossProvisionAccountId: '',
        gracePeriod: 0,
        minMemberDuration: 0,
        minSavingsBalance: 0,
        allowMultipleActiveLoans: false,
        allowLoanTopUp: false,
        allowRescheduling: false,
        allowEarlyRepayment: false,
        linkedFees: [],
        disbursementMethods: [],
        repaymentMethods: [],
    }
  });

  async function onSubmit(values: z.infer<typeof loanProductSchema>) {
    if (!firestore || !institutionId) return;
    setLoading(true);
    setError(null);
    try {
        const productsRef = collection(firestore, 'institutions', institutionId, 'loanProducts');
        const newDocRef = doc(productsRef);
        const newProduct = {
            ...values,
            description: values.description || '',
            id: newDocRef.id,
            institutionId: institutionId,
            code: newDocRef.id.substring(0,6).toUpperCase(),
        };
        await setDoc(newDocRef, newProduct);
        toast({
            title: "Product Created",
            description: `The loan product "${values.name}" has been successfully created.`,
        });
        router.push('/staff/settings/loan-products');
    } catch (e) {
        console.error(e);
        setError('Failed to create loan product.');
    } finally {
        setLoading(false);
    }
  }

  const disbursementOptions = ['Cash', 'Bank Transfer', 'Cheque', 'Mobile Money', 'Teller'];

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Create New Loan Product</h1>
              <p className="text-muted-foreground mt-1">Define the rules and parameters for a new loan product.</p>
            </div>
            <div className="flex gap-2">
                <Button variant="outline" type="button" asChild>
                    <Link href="/staff/settings/loan-products"><ArrowLeft className="mr-2 h-4 w-4"/> Cancel</Link>
                </Button>
                <Button type="submit" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Product
                </Button>
            </div>
        </div>

        {error && <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescriptionComponent>{error}</AlertDescriptionComponent></Alert>}

        <Accordion type="multiple" defaultValue={['item-1', 'item-2', 'item-3', 'item-4', 'item-5', 'item-6', 'item-7', 'item-8']} className="w-full">
            <AccordionItem value="item-1">
                <AccordionTrigger>Basic Information</AccordionTrigger>
                <AccordionContent>
                    <Card className="border-none shadow-none">
                        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Product Name</FormLabel><FormControl><Input placeholder="e.g., SME Business Loan" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="A short summary of the product." {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="status" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Status</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="Active">Active</SelectItem>
                                            <SelectItem value="Inactive">Inactive</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="loanType" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Loan Type</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="Individual">Individual Loan</SelectItem>
                                            <SelectItem value="Group">Group Loan</SelectItem>
                                            <SelectItem value="SME">SME Loan</SelectItem>
                                            <SelectItem value="Salary-Based">Salary-Based Loan</SelectItem>
                                            <SelectItem value="Agricultural">Agricultural Loan</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </CardContent>
                    </Card>
                </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
                <AccordionTrigger>Loan Amount</AccordionTrigger>
                <AccordionContent>
                    <Card className="border-none shadow-none">
                        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={form.control} name="minAmount" render={({ field }) => (<FormItem><FormLabel>Minimum Amount</FormLabel><FormControl><CurrencyInput {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="maxAmount" render={({ field }) => (<FormItem><FormLabel>Maximum Amount</FormLabel><FormControl><CurrencyInput {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </CardContent>
                    </Card>
                </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
                <AccordionTrigger>Interest and Fees</AccordionTrigger>
                <AccordionContent>
                    <Card className="border-none shadow-none">
                        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={form.control} name="interestRateType" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Interest Rate Type</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="Flat">Flat</SelectItem>
                                            <SelectItem value="Reducing Balance">Reducing Balance</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="amortizationMethod" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Amortization Method</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="Equal Installments">Equal Installments (EMI)</SelectItem>
                                            <SelectItem value="Fixed Principal + Interest">Fixed Principal + Interest</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="annualInterestRate" render={({ field }) => (<FormItem><FormLabel>Annual Interest Rate (%)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="interestBasis" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Interest Basis</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="360 Days">360 Days</SelectItem>
                                            <SelectItem value="365 Days">365 Days</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField
                                control={form.control}
                                name="linkedFees"
                                render={() => (
                                    <FormItem>
                                        <FormLabel>Applicable Fees & Charges</FormLabel>
                                        <div className="space-y-2 rounded-md border p-4 max-h-48 overflow-y-auto">
                                            {isFeesLoading ? <p>Loading fees...</p> : fees?.map((fee) => (
                                                <FormField
                                                    key={fee.id}
                                                    control={form.control}
                                                    name="linkedFees"
                                                    render={({ field }) => (
                                                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                                            <FormControl>
                                                                <Checkbox
                                                                    checked={field.value?.includes(fee.id)}
                                                                    onCheckedChange={(checked) => {
                                                                        const current = field.value || [];
                                                                        return checked ? field.onChange([...current, fee.id]) : field.onChange(current.filter(v => v !== fee.id));
                                                                    }}
                                                                />
                                                            </FormControl>
                                                            <FormLabel className="font-normal">{fee.name}</FormLabel>
                                                        </FormItem>
                                                    )}
                                                />
                                            ))}
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>
                </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4">
                <AccordionTrigger>Repayment Schedule</AccordionTrigger>
                <AccordionContent>
                    <Card className="border-none shadow-none">
                        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={form.control} name="repaymentFrequency" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Repayment Frequency</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="Daily">Daily</SelectItem>
                                            <SelectItem value="Weekly">Weekly</SelectItem>
                                            <SelectItem value="Monthly">Monthly</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                             <FormField control={form.control} name="repaymentDueDay" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Repayment Due Day Rule</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="Same day as disbursement">Same day as disbursement</SelectItem>
                                            <SelectItem value="End of month">End of month</SelectItem>
                                            <SelectItem value="Fixed day">Fixed day</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="interestStarts" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Interest Accrual Starts</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="On Disbursement Date">On Disbursement Date</SelectItem>
                                            <SelectItem value="After Grace Period">After Grace Period</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="gracePeriod" render={({ field }) => (<FormItem><FormLabel>Grace Period (days)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="minTerm" render={({ field }) => (<FormItem><FormLabel>Minimum Term</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="maxTerm" render={({ field }) => (<FormItem><FormLabel>Maximum Term</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="tenureUnit" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tenure Unit</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="Days">Days</SelectItem>
                                            <SelectItem value="Months">Months</SelectItem>
                                            <SelectItem value="Years">Years</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </CardContent>
                    </Card>
                </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-5">
                <AccordionTrigger>Disbursement Options</AccordionTrigger>
                <AccordionContent>
                    <Card className="border-none shadow-none">
                        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="disbursementMethods"
                                render={() => (
                                    <FormItem>
                                        <FormLabel>Disbursement Methods</FormLabel>
                                        <div className="space-y-2 rounded-md border p-4">
                                            {disbursementOptions.map((item) => (
                                                <FormField
                                                    key={item}
                                                    control={form.control}
                                                    name="disbursementMethods"
                                                    render={({ field }) => (
                                                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                                            <FormControl>
                                                                <Checkbox
                                                                    checked={field.value?.includes(item)}
                                                                    onCheckedChange={(checked) => {
                                                                        const current = field.value || [];
                                                                        return checked ? field.onChange([...current, item]) : field.onChange(current.filter(v => v !== item));
                                                                    }}
                                                                />
                                                            </FormControl>
                                                            <FormLabel className="font-normal">{item}</FormLabel>
                                                        </FormItem>
                                                    )}
                                                />
                                            ))}
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                    </Card>
                </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-6">
                <AccordionTrigger>Accounting Integration</AccordionTrigger>
                <AccordionContent>
                    <Card className="border-none shadow-none">
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={form.control} name="loanPortfolioAccountId" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Loan Portfolio Account</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder={isCoaLoading ? "Loading..." : "Select GL account"} /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {accounts?.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.glCode} - {acc.accountName}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="interestReceivableAccountId" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Interest Receivable Account</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder={isCoaLoading ? "Loading..." : "Select GL account"} /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {accounts?.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.glCode} - {acc.accountName}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="interestIncomeAccountId" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Interest Income Account</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder={isCoaLoading ? "Loading..." : "Select GL account"} /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {accounts?.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.glCode} - {acc.accountName}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="penaltyIncomeAccountId" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Penalty Income Account</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder={isCoaLoading ? "Loading..." : "Select GL account"} /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {accounts?.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.glCode} - {acc.accountName}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="loanLossProvisionAccountId" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Loan Loss Provision Account</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder={isCoaLoading ? "Loading..." : "Select GL account"} /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {accounts?.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.glCode} - {acc.accountName}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </CardContent>
                    </Card>
                </AccordionContent>
            </AccordionItem>
             <AccordionItem value="item-7">
                <AccordionTrigger>Eligibility Rules</AccordionTrigger>
                <AccordionContent>
                    <Card className="border-none shadow-none">
                        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={form.control} name="minMemberDuration" render={({ field }) => (<FormItem><FormLabel>Minimum Member Duration (months)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="minSavingsBalance" render={({ field }) => (<FormItem><FormLabel>Minimum Savings Balance</FormLabel><FormControl><CurrencyInput {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </CardContent>
                    </Card>
                </AccordionContent>
            </AccordionItem>
             <AccordionItem value="item-8">
                <AccordionTrigger>Advanced Settings</AccordionTrigger>
                <AccordionContent>
                    <Card className="border-none shadow-none">
                        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={form.control} name="allowMultipleActiveLoans" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div className="space-y-1 leading-none"><FormLabel>Allow Multiple Active Loans</FormLabel></div></FormItem>)} />
                            <FormField control={form.control} name="allowLoanTopUp" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div className="space-y-1 leading-none"><FormLabel>Allow Loan Top-Up</FormLabel></div></FormItem>)} />
                            <FormField control={form.control} name="allowRescheduling" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div className="space-y-1 leading-none"><FormLabel>Allow Rescheduling</FormLabel></div></FormItem>)} />
                            <FormField control={form.control} name="allowEarlyRepayment" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><div className="space-y-1 leading-none"><FormLabel>Allow Early Repayment</FormLabel></div></FormItem>)} />
                        </CardContent>
                    </Card>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
      </form>
    </Form>
  );
}
