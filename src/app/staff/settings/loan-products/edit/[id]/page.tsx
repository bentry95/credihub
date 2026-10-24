'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useParams, useRouter } from 'next/navigation';
import {
  useUser,
  useAuth,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, doc, updateDoc } from 'firebase/firestore';
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
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Loader2,
  AlertCircle,
  Save,
  ArrowLeft,
} from 'lucide-react';
import React from 'react';
import Link from 'next/link';
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


function EditLoanProductPageContent() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);
  const institutionId = userData?.institutionId;
  
  const productDocRef = useMemoFirebase(
    () => (firestore && institutionId && productId ? doc(firestore, 'institutions', institutionId, 'loanProducts', productId) : null),
    [firestore, institutionId, productId]
  );
  const { data: productData, isLoading: isProductLoading } = useDoc(productDocRef);

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
  });

  useEffect(() => {
    if (productData) {
      form.reset(productData);
    }
  }, [productData, form]);

  async function onSubmit(values: z.infer<typeof loanProductSchema>) {
    if (!firestore || !productDocRef) return;
    setLoading(true);
    setError(null);
    try {
        await updateDoc(productDocRef, values);
        toast({ title: "Product Updated" });
        router.push('/staff/settings/loan-products');
    } catch (e) {
        console.error(e);
        setError('Failed to update product.');
    } finally {
        setLoading(false);
    }
  }

  const disbursementOptions = ['Cash', 'Bank Transfer', 'Cheque', 'Mobile Money', 'Teller'];

  if (isProductLoading) return <div className="space-y-6"><Skeleton className="h-10 w-1/4" /><Skeleton className="h-96 w-full" /></div>;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Edit Loan Product</h1>
              <p className="text-muted-foreground mt-1">Modify rules for "{productData?.name}".</p>
            </div>
            <div className="flex gap-2">
                <Button variant="outline" type="button" asChild>
                    <Link href="/staff/settings/loan-products"><ArrowLeft className="mr-2 h-4 w-4"/> Cancel</Link>
                </Button>
                <Button type="submit" disabled={loading || !form.formState.isDirty}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Changes
                </Button>
            </div>
        </div>

        {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

        <Accordion type="multiple" defaultValue={['item-1', 'item-2', 'item-3', 'item-4', 'item-5', 'item-6', 'item-7', 'item-8']} className="w-full">
            <AccordionItem value="item-1">
                <AccordionTrigger>Basic Information</AccordionTrigger>
                <AccordionContent>
                    <Card className="border-none shadow-none">
                        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Product Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="status" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Status</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
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
                                    <Select onValueChange={field.onChange} value={field.value}>
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
                            <FormField control={form.control} name="minAmount" render={({ field }) => (<FormItem><FormLabel>Min Amount</FormLabel><FormControl><CurrencyInput {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="maxAmount" render={({ field }) => (<FormItem><FormLabel>Max Amount</FormLabel><FormControl><CurrencyInput {...field} /></FormControl><FormMessage /></FormItem>)} />
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
                                    <FormLabel>Rate Type</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
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
                            <FormField control={form.control} name="annualInterestRate" render={({ field }) => (<FormItem><FormLabel>Annual Rate (%)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField
                                control={form.control}
                                name="linkedFees"
                                render={() => (
                                    <FormItem>
                                        <FormLabel>Fees</FormLabel>
                                        <div className="space-y-2 rounded-md border p-4 max-h-48 overflow-y-auto">
                                            {fees?.map((fee) => (
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
                                    <FormLabel>Frequency</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
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
                            <FormField control={form.control} name="minTerm" render={({ field }) => (<FormItem><FormLabel>Min Term</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="maxTerm" render={({ field }) => (<FormItem><FormLabel>Max Term</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="tenureUnit" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tenure Unit</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
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
                                    <FormLabel>Portfolio Account</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Select GL..." /></SelectTrigger>
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
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Select GL..." /></SelectTrigger>
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
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Select GL..." /></SelectTrigger>
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
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Select GL..." /></SelectTrigger>
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
                                    <FormLabel>Provision Account</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Select GL..." /></SelectTrigger>
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
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={form.control} name="minMemberDuration" render={({ field }) => (<FormItem><FormLabel>Min Membership (months)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            <FormField control={form.control} name="minSavingsBalance" render={({ field }) => (<FormItem><FormLabel>Min Savings Balance</FormLabel><FormControl><CurrencyInput {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </CardContent>
                    </Card>
                </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-8">
                <AccordionTrigger>Advanced Rules</AccordionTrigger>
                <AccordionContent>
                    <Card className="border-none shadow-none">
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={form.control} name="allowMultipleActiveLoans" render={({ field }) => (<FormItem className="flex items-center gap-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>Allow Multiple Active Loans</FormLabel></FormItem>)} />
                            <FormField control={form.control} name="allowLoanTopUp" render={({ field }) => (<FormItem className="flex items-center gap-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>Allow Loan Top-Up</FormLabel></FormItem>)} />
                            <FormField control={form.control} name="allowRescheduling" render={({ field }) => (<FormItem className="flex items-center gap-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>Allow Rescheduling</FormLabel></FormItem>)} />
                            <FormField control={form.control} name="allowEarlyRepayment" render={({ field }) => (<FormItem className="flex items-center gap-2 space-y-0"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel>Allow Early Repayment</FormLabel></FormItem>)} />
                        </CardContent>
                    </Card>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
      </form>
    </Form>
  );
}

export default function EditLoanProductWrapper() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <EditLoanProductPageContent />
        </Suspense>
    )
}
