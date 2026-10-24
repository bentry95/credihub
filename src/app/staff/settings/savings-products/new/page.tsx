'use client';

import React, { useState, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
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
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  PlusCircle,
  Loader2,
  AlertCircle,
  Save,
  ArrowLeft,
} from 'lucide-react';
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
import { Alert, AlertTitle, AlertDescription as AlertDescriptionComponent } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';

const savingsProductSchema = z.object({
  name: z.string().min(1, 'Product name is required.'),
  code: z.string().min(1, 'Product code is required.'),
  description: z.string().optional(),
  status: z.enum(['Active', 'Inactive']),
  
  // Interest Configuration
  schemeType: z.enum(['Flexible', 'Recurring', 'Fixed Deposit']),
  interestRate: z.coerce.number().min(0, 'Interest rate must be a positive number.'),
  interestCalculation: z.enum(['Daily Balance', 'Average Balance']),
  interestPosting: z.enum(['Monthly', 'Quarterly', 'Annually']),
  isTaxable: z.boolean().default(false),
  taxRate: z.coerce.number().min(0).optional(),

  // Deposit Rules
  initialDeposit: z.coerce.number().min(0),
  minDeposit: z.coerce.number().min(0),
  maxDeposit: z.coerce.number().optional(),
  allowedDepositChannels: z.array(z.string()).optional(),

  // Withdrawal Rules
  withdrawalAllowance: z.enum(['Anytime', 'Only on Maturity']),
  minWithdrawal: z.coerce.number().min(0),
  maxWithdrawal: z.coerce.number().optional(),
  maxWithdrawalsPerMonth: z.coerce.number().int().min(0).optional(),
  earlyWithdrawalPenalty: z.coerce.number().min(0),
  earlyWithdrawalPenaltyType: z.enum(['Interest', 'Principal']).optional(),
  
  // Dormancy
  dormancyPeriodMonths: z.coerce.number().int().min(0),
  
  // Eligibility
  targetMembers: z.enum(['Individuals', 'Groups', 'Both']),
  allowJointAccounts: z.boolean().default(false),
  
  // Accounting
  savingsControlAccountId: z.string().min(1, 'Savings control GL account is required.'),
  interestPayableAccountId: z.string().min(1, 'Interest payable GL account is required.'),
  interestExpenseAccountId: z.string().min(1, 'Interest expense GL account is required.'),
  feesIncomeAccountId: z.string().optional(),
  taxPayableAccountId: z.string().optional(),
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


export default function NewSavingsProductPage() {
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

  const form = useForm<z.infer<typeof savingsProductSchema>>({
    resolver: zodResolver(savingsProductSchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
      status: 'Active',
      schemeType: 'Flexible',
      interestRate: 0,
      interestCalculation: 'Daily Balance',
      interestPosting: 'Monthly',
      isTaxable: false,
      taxRate: 0,
      initialDeposit: 0,
      minDeposit: 0,
      maxDeposit: 0,
      allowedDepositChannels: [],
      withdrawalAllowance: 'Anytime',
      minWithdrawal: 0,
      maxWithdrawal: 0,
      maxWithdrawalsPerMonth: 0,
      earlyWithdrawalPenalty: 0,
      earlyWithdrawalPenaltyType: undefined,
      dormancyPeriodMonths: 12,
      targetMembers: 'Individuals',
      allowJointAccounts: false,
      savingsControlAccountId: '',
      interestPayableAccountId: '',
      interestExpenseAccountId: '',
      feesIncomeAccountId: '',
      taxPayableAccountId: '',
    },
  });

  const { control } = form;
  const isTaxable = useWatch({ control, name: 'isTaxable' });
  const withdrawalAllowance = useWatch({ control, name: 'withdrawalAllowance' });

  async function onSubmit(values: z.infer<typeof savingsProductSchema>) {
    if (!firestore || !institutionId) return;

    setLoading(true);
    setError(null);
    try {
      const productsRef = collection(firestore, 'institutions', institutionId, 'savingsProducts');
      const newDocRef = doc(productsRef);
      
      const newProduct = {
        ...values,
        id: newDocRef.id,
        institutionId: institutionId,
        description: values.description || '',
        maxDeposit: values.maxDeposit || null,
        maxWithdrawal: values.maxWithdrawal || null,
        maxWithdrawalsPerMonth: values.maxWithdrawalsPerMonth || null,
        earlyWithdrawalPenaltyType: values.earlyWithdrawalPenaltyType || null,
        feesIncomeAccountId: values.feesIncomeAccountId || null,
        taxPayableAccountId: values.taxPayableAccountId || null,
        taxRate: values.taxRate || 0,
      };

      await setDoc(newDocRef, newProduct);
      
      toast({
        title: "Product Created",
        description: `The savings product "${values.name}" has been created successfully.`,
      });

      router.push('/staff/settings/savings-products');

    } catch (e) {
      console.error('Error creating product:', e);
      setError('Failed to create product. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const liabilityAccounts = useMemo(() => {
    if (!accounts) return [];
    return accounts.filter(acc => acc.accountType === 'Liability');
  }, [accounts]);
  
  const expenseAccounts = useMemo(() => {
    if (!accounts) return [];
    return accounts.filter(acc => acc.accountType === 'Expense');
  }, [accounts]);

  const incomeAccounts = useMemo(() => {
    if (!accounts) return [];
    return accounts.filter(acc => acc.accountType === 'Income');
  }, [accounts]);

  const depositChannels = [
      { id: 'Cash', label: 'Cash Deposit' },
      { id: 'Bank', label: 'Bank Transfer' },
      { id: 'Mobile Money', label: 'Mobile Money' },
      { id: 'Teller', label: 'Teller' },
  ];
   const withdrawalChannels = [
      { id: 'Cash', label: 'Cash Withdrawal' },
      { id: 'Bank', label: 'Bank Transfer' },
      { id: 'Mobile Money', label: 'Mobile Money' },
      { id: 'Teller', label: 'Teller' },
  ];


  return (
     <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Create New Savings Product</h1>
                    <p className="text-muted-foreground mt-1">
                        Define the rules and parameters for a new savings product.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" asChild>
                        <Link href="/staff/settings/savings-products"><ArrowLeft className="mr-2 h-4 w-4"/> Cancel</Link>
                    </Button>
                    <Button type="submit" disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Create Product
                    </Button>
                </div>
            </div>

            {error && <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /> <AlertTitle>Error</AlertTitle><AlertDescriptionComponent>{error}</AlertDescriptionComponent></Alert>}

            <Accordion type="multiple" defaultValue={['item-1', 'item-2', 'item-3', 'item-4', 'item-5', 'item-6']} className="w-full">
                <AccordionItem value="item-1">
                    <AccordionTrigger>General Details</AccordionTrigger>
                    <AccordionContent>
                        <Card className="border-none shadow-none">
                            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Product Name</FormLabel><FormControl><Input placeholder="e.g., Regular Savings Account" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="code" render={({ field }) => (<FormItem><FormLabel>Product Code</FormLabel><FormControl><Input placeholder="e.g., SAV001" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <div className="md:col-span-2">
                                <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="A short summary of the product's purpose and benefits." {...field} /></FormControl><FormMessage /></FormItem>)} />
                                </div>
                                <FormField control={form.control} name="status" render={({ field }) => (
                                    <FormItem><FormLabel>Status</FormLabel>
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
                            </CardContent>
                        </Card>
                    </AccordionContent>
                </AccordionItem>
                 <AccordionItem value="item-2">
                    <AccordionTrigger>Interest Configuration</AccordionTrigger>
                    <AccordionContent>
                        <Card className="border-none shadow-none">
                            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <FormField control={form.control} name="schemeType" render={({ field }) => (
                                    <FormItem><FormLabel>Scheme Type</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="Flexible">Flexible</SelectItem>
                                                <SelectItem value="Recurring">Recurring</SelectItem>
                                                <SelectItem value="Fixed Deposit">Fixed Deposit</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="interestRate" render={({ field }) => (<FormItem><FormLabel>Annual Interest Rate (%)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="interestCalculation" render={({ field }) => (
                                    <FormItem><FormLabel>Interest Calculation</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="Daily Balance">Daily Balance</SelectItem>
                                                <SelectItem value="Average Balance">Average Balance</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="interestPosting" render={({ field }) => (
                                    <FormItem><FormLabel>Interest Posting</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="Monthly">Monthly</SelectItem>
                                                <SelectItem value="Quarterly">Quarterly</SelectItem>
                                                <SelectItem value="Annually">Annually</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="isTaxable" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel>Withholding Tax Applicable?</FormLabel></div><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                                {isTaxable && <FormField control={form.control} name="taxRate" render={({ field }) => (<FormItem><FormLabel>Tax Rate (%)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />}
                            </CardContent>
                        </Card>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-3">
                    <AccordionTrigger>Deposit Rules</AccordionTrigger>
                    <AccordionContent>
                        <Card className="border-none shadow-none">
                            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                                <FormField control={form.control} name="initialDeposit" render={({ field }) => (<FormItem><FormLabel>Minimum Initial Deposit</FormLabel><FormControl><CurrencyInput {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="minDeposit" render={({ field }) => (<FormItem><FormLabel>Minimum Subsequent Deposit</FormLabel><FormControl><CurrencyInput {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="maxDeposit" render={({ field }) => (<FormItem><FormLabel>Maximum Deposit (per tx)</FormLabel><FormControl><CurrencyInput {...field} /></FormControl><FormMessage /></FormItem>)} />
                                 <FormField
                                    control={form.control}
                                    name="allowedDepositChannels"
                                    render={() => (<FormItem className="md:col-span-3"><FormLabel>Allowed Deposit Channels</FormLabel>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 rounded-md border p-4">
                                            {depositChannels.map((item) => (<FormField key={item.id} control={form.control} name="allowedDepositChannels"
                                                render={({ field }) => (<FormItem key={item.id} className="flex flex-row items-start space-x-3 space-y-0">
                                                    <FormControl><Checkbox checked={field.value?.includes(item.id)} onCheckedChange={(checked) => {
                                                        return checked ? field.onChange([...(field.value || []), item.id]) : field.onChange(field.value?.filter((value) => value !== item.id));
                                                    }}/></FormControl><FormLabel className="font-normal">{item.label}</FormLabel></FormItem>)} />
                                            ))}
                                        </div><FormMessage /></FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-4">
                    <AccordionTrigger>Withdrawal Rules</AccordionTrigger>
                    <AccordionContent>
                        <Card className="border-none shadow-none">
                            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                                <FormField control={form.control} name="withdrawalAllowance" render={({ field }) => (
                                    <FormItem><FormLabel>Withdrawal Rules</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="Anytime">Anytime</SelectItem>
                                                <SelectItem value="Only on Maturity">Only on Maturity</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>)} />
                                <FormField control={form.control} name="minWithdrawal" render={({ field }) => (<FormItem><FormLabel>Minimum Withdrawal Amount</FormLabel><FormControl><CurrencyInput {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="maxWithdrawal" render={({ field }) => (<FormItem><FormLabel>Maximum Withdrawal (per tx)</FormLabel><FormControl><CurrencyInput {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="maxWithdrawalsPerMonth" render={({ field }) => (<FormItem><FormLabel>Max Withdrawals per Month</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                {withdrawalAllowance === 'Only on Maturity' && <>
                                    <FormField control={form.control} name="earlyWithdrawalPenalty" render={({ field }) => (<FormItem><FormLabel>Early Withdrawal Penalty (%)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="earlyWithdrawalPenaltyType" render={({ field }) => (
                                        <FormItem><FormLabel>Penalty Applies To</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger><SelectValue placeholder="Select base..."/></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="Interest">Interest</SelectItem>
                                                    <SelectItem value="Principal">Principal</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>)} />
                                </>}
                                <FormField
                                    control={form.control}
                                    name="allowedWithdrawalChannels"
                                    render={() => (<FormItem className="md:col-span-3"><FormLabel>Allowed Withdrawal Channels</FormLabel>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 rounded-md border p-4">
                                            {withdrawalChannels.map((item) => (<FormField key={item.id} control={form.control} name="allowedWithdrawalChannels"
                                                render={({ field }) => (<FormItem key={item.id} className="flex flex-row items-start space-x-3 space-y-0">
                                                    <FormControl><Checkbox checked={field.value?.includes(item.id)} onCheckedChange={(checked) => {
                                                        return checked ? field.onChange([...(field.value || []), item.id]) : field.onChange(field.value?.filter((value) => value !== item.id));
                                                    }}/></FormControl><FormLabel className="font-normal">{item.label}</FormLabel></FormItem>)} />
                                            ))}
                                        </div><FormMessage /></FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-5">
                    <AccordionTrigger>Dormancy & Eligibility</AccordionTrigger>
                    <AccordionContent>
                         <Card className="border-none shadow-none">
                           <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField control={form.control} name="dormancyPeriodMonths" render={({ field }) => (<FormItem><FormLabel>Dormancy Period (months)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="targetMembers" render={({ field }) => (
                                    <FormItem><FormLabel>Target Members</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="Individuals">Individuals</SelectItem>
                                                <SelectItem value="Groups">Groups</SelectItem>
                                                <SelectItem value="Both">Both</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>)} />
                                <FormField control={form.control} name="allowJointAccounts" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 md:col-span-2"><div className="space-y-0.5"><FormLabel>Allow Joint Accounts</FormLabel><FormDescription>Permit multiple individuals to co own an account.</FormDescription></div><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                           </CardContent>
                        </Card>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-6">
                    <AccordionTrigger>Accounting Integration</AccordionTrigger>
                     <AccordionContent>
                        <Card className="border-none shadow-none">
                           <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField control={form.control} name="savingsControlAccountId" render={({ field }) => (
                                    <FormItem><FormLabel>Savings Control GL Account</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger><SelectValue placeholder={isCoaLoading ? "Loading..." : "Select a liability account"} /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>{liabilityAccounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.glCode} - {acc.accountName}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>)} />
                                <FormField control={form.control} name="interestPayableAccountId" render={({ field }) => (
                                    <FormItem><FormLabel>Interest Payable GL Account</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger><SelectValue placeholder={isCoaLoading ? "Loading..." : "Select a liability account"} /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>{liabilityAccounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.glCode} - {acc.accountName}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>)} />
                                <FormField control={form.control} name="interestExpenseAccountId" render={({ field }) => (
                                    <FormItem><FormLabel>Interest Expense GL Account</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger><SelectValue placeholder={isCoaLoading ? "Loading..." : "Select an expense account"} /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>{expenseAccounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.glCode} - {acc.accountName}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>)} />
                                <FormField control={form.control} name="feesIncomeAccountId" render={({ field }) => (
                                    <FormItem><FormLabel>Fees/Penalty Income GL Account</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger><SelectValue placeholder={isCoaLoading ? "Loading..." : "Select an income account"} /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>{incomeAccounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.glCode} - {acc.accountName}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>)} />
                                {isTaxable && <FormField control={form.control} name="taxPayableAccountId" render={({ field }) => (
                                    <FormItem><FormLabel>Withholding Tax Payable GL</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger><SelectValue placeholder={isCoaLoading ? "Loading..." : "Select a liability account"} /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>{liabilityAccounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.glCode} - {acc.accountName}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>)} />}
                           </CardContent>
                        </Card>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </form>
    </Form>
  );
}
