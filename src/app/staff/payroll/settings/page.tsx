
'use client';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  useUser,
  useFirestore,
  useDoc,
  useMemoFirebase,
  useCollection,
} from '@/firebase';
import { collection, doc, setDoc, updateDoc } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Settings, Save, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';


const settingsSchema = z.object({
    payrollFrequency: z.enum(['Monthly', 'Bi-weekly', 'Weekly']),
    defaultPayDate: z.coerce.number().min(1).max(31),
    lockPayrollAfterPosting: z.boolean().default(true),
    allowNegativeNetPay: z.boolean().default(false),
    enablePAYE: z.boolean().default(true),
    enablePension: z.boolean().default(true),
    salariesExpenseAccountId: z.string().min(1, 'GL Account is required.'),
    payePayableAccountId: z.string().min(1, 'GL Account is required.'),
    pensionPayableAccountId: z.string().min(1, 'GL Account is required.'),
    netSalariesPayableAccountId: z.string().min(1, 'GL Account is required.'),
    payrollClearingAccountId: z.string().min(1, 'GL Account is required.'),
    requirePayrollApproval: z.boolean().default(true),
    defaultPaymentMethod: z.enum(['Bank Transfer', 'Cash', 'Mobile Money']),
});

export default function PayrollSettingsPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const userDocRef = useMemoFirebase(
      () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
      [firestore, user]
    );
    const { data: userData } = useDoc(userDocRef);
    const institutionId = userData?.institutionId;
  
    const settingsDocRef = useMemoFirebase(
      () => (institutionId ? doc(firestore, 'institutions', institutionId, 'settings', 'payroll') : null),
      [firestore, institutionId]
    );
    const { data: settingsData, isLoading: isSettingsLoading } = useDoc(settingsDocRef);
    
    const coaQuery = useMemoFirebase(
        () => (institutionId ? collection(firestore, 'institutions', institutionId, 'chartOfAccounts') : null),
        [firestore, institutionId]
    );
    const { data: accounts, isLoading: isCoaLoading } = useCollection(coaQuery);

    const form = useForm<z.infer<typeof settingsSchema>>({
      resolver: zodResolver(settingsSchema),
      defaultValues: {
        payrollFrequency: 'Monthly',
        defaultPayDate: 25,
        lockPayrollAfterPosting: true,
        allowNegativeNetPay: false,
        enablePAYE: true,
        enablePension: true,
        requirePayrollApproval: true,
        defaultPaymentMethod: 'Bank Transfer',
      },
    });

    useEffect(() => {
        if (settingsData) {
            form.reset(settingsData);
        }
    }, [settingsData, form]);

    async function onSubmit(values: z.infer<typeof settingsSchema>) {
        if (!settingsDocRef) return;
        setLoading(true);
        setError(null);
        try {
            if(settingsData) {
                await updateDoc(settingsDocRef, values);
            } else {
                await setDoc(settingsDocRef, values);
            }
            toast({ title: 'Success', description: 'Payroll settings have been saved.'});
        } catch(e) {
            console.error(e);
            setError('Failed to save settings.');
        } finally {
            setLoading(false);
        }
    }
    
    const isLoading = isSettingsLoading || isCoaLoading;

  return (
    <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                <h1 className="text-3xl font-bold tracking-tight">Payroll Settings</h1>
                <p className="text-muted-foreground mt-1">
                    Configure global settings for the payroll module.
                </p>
                </div>
                <Button type="submit" disabled={loading || !form.formState.isDirty}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                     Save Changes
                </Button>
            </div>
            
            {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>{error}</AlertTitle></Alert>}
            
            {isLoading ? <Skeleton className="w-full h-96" /> : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <Card>
                    <CardHeader><CardTitle>General Settings</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <FormField control={form.control} name="payrollFrequency" render={({ field }) => (
                            <FormItem><FormLabel>Default Payroll Frequency</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent><SelectItem value="Monthly">Monthly</SelectItem><SelectItem value="Bi-weekly">Bi-weekly</SelectItem><SelectItem value="Weekly">Weekly</SelectItem></SelectContent>
                                </Select><FormMessage />
                            </FormItem>
                        )}/>
                         <FormField control={form.control} name="defaultPayDate" render={({ field }) => (
                            <FormItem><FormLabel>Default Pay Date (Day of Month)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader><CardTitle>Statutory Configuration</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <FormField control={form.control} name="enablePAYE" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel>Enable PAYE Calculation</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)}/>
                        <FormField control={form.control} name="enablePension" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel>Enable Pension Calculation</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)}/>
                    </CardContent>
                </Card>
                
                <Card className="lg:col-span-2">
                    <CardHeader><CardTitle>Accounting Integration</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField control={form.control} name="salariesExpenseAccountId" render={({ field }) => (<FormItem><FormLabel>Salaries Expense Account</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select GL..."/></SelectTrigger></FormControl><SelectContent>{accounts?.map(a => <SelectItem key={a.id} value={a.id}>{a.glCode} - {a.accountName}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                        <FormField control={form.control} name="payePayableAccountId" render={({ field }) => (<FormItem><FormLabel>PAYE Payable Account</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select GL..."/></SelectTrigger></FormControl><SelectContent>{accounts?.map(a => <SelectItem key={a.id} value={a.id}>{a.glCode} - {a.accountName}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                        <FormField control={form.control} name="pensionPayableAccountId" render={({ field }) => (<FormItem><FormLabel>Pension Payable Account</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select GL..."/></SelectTrigger></FormControl><SelectContent>{accounts?.map(a => <SelectItem key={a.id} value={a.id}>{a.glCode} - {a.accountName}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                        <FormField control={form.control} name="netSalariesPayableAccountId" render={({ field }) => (<FormItem><FormLabel>Net Salaries Payable Account</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select GL..."/></SelectTrigger></FormControl><SelectContent>{accounts?.map(a => <SelectItem key={a.id} value={a.id}>{a.glCode} - {a.accountName}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                        <FormField control={form.control} name="payrollClearingAccountId" render={({ field }) => (<FormItem><FormLabel>Payroll Clearing Account</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select GL..."/></SelectTrigger></FormControl><SelectContent>{accounts?.map(a => <SelectItem key={a.id} value={a.id}>{a.glCode} - {a.accountName}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                    </CardContent>
                </Card>

                 <Card>
                    <CardHeader><CardTitle>Approval & Payment Controls</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <FormField control={form.control} name="requirePayrollApproval" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel>Require Approval Before Posting</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)}/>
                        <FormField control={form.control} name="lockPayrollAfterPosting" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel>Lock Payroll After Posting</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)}/>
                        <FormField control={form.control} name="allowNegativeNetPay" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel>Allow Negative Net Pay</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)}/>
                        <FormField control={form.control} name="defaultPaymentMethod" render={({ field }) => (
                            <FormItem><FormLabel>Default Payment Method</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent><SelectItem value="Bank Transfer">Bank Transfer</SelectItem><SelectItem value="Cash">Cash</SelectItem><SelectItem value="Mobile Money">Mobile Money</SelectItem></SelectContent>
                                </Select><FormMessage />
                            </FormItem>
                        )}/>
                    </CardContent>
                </Card>
            </div>
            )}
        </form>
    </Form>
  );
}
