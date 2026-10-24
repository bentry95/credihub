'use client';
import { useState, useEffect, useMemo } from 'react';
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
import { Calendar, ChevronsRight, Settings, Save, Workflow, Percent, ToggleLeft, KeyRound, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';


const settingsSchema = z.object({
    costingMethod: z.enum(['Moving Average', 'FIFO', 'Standard Cost']),
    inventoryAssetAccountId: z.string().min(1, 'GL Account is required.'),
    grnClearingAccountId: z.string().min(1, 'GL Account is required.'),
    adjustmentGainAccountId: z.string().min(1, 'GL Account is required.'),
    adjustmentLossAccountId: z.string().min(1, 'GL Account is required.'),
    cogsAccountId: z.string().min(1, 'GL Account is required.'),
    allowNegativeStock: z.boolean().default(false),
    enableMultiWarehouse: z.boolean().default(true),
    requireAdjustmentApproval: z.boolean().default(true),
});

export default function InventorySettingsPage() {
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
      () => (institutionId ? doc(firestore, 'institutions', institutionId, 'settings', 'inventory') : null),
      [firestore, institutionId]
    );
    const { data: settingsData, isLoading: isSettingsLoading } = useDoc(settingsDocRef);
    
    const coaQuery = useMemoFirebase(
        () => (institutionId ? collection(firestore, 'institutions', institutionId, 'chartOfAccounts') : null),
        [firestore, institutionId]
    );
    const { data: accounts, isLoading: isCoaLoading } = useCollection(coaQuery);

    const assetAccounts = useMemo(() => accounts?.filter(a => a.accountType === 'Asset'), [accounts]);
    const liabilityAccounts = useMemo(() => accounts?.filter(a => a.accountType === 'Liability'), [accounts]);
    const expenseAccounts = useMemo(() => accounts?.filter(a => a.accountType === 'Expense'), [accounts]);
    const incomeAccounts = useMemo(() => accounts?.filter(a => a.accountType === 'Income'), [accounts]);
  
    const form = useForm<z.infer<typeof settingsSchema>>({
      resolver: zodResolver(settingsSchema),
      defaultValues: {
        costingMethod: 'Moving Average',
        allowNegativeStock: false,
        enableMultiWarehouse: true,
        requireAdjustmentApproval: true,
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
            if(settingsData) { // If settings exist, update them
                await updateDoc(settingsDocRef, values);
            } else { // Otherwise, create the document
                await setDoc(settingsDocRef, values);
            }
            toast({ title: 'Success', description: 'Inventory settings have been saved.'});
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
                <h1 className="text-3xl font-bold tracking-tight">Inventory Settings</h1>
                <p className="text-muted-foreground mt-1">
                    Configure global settings for the inventory module.
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
                    <CardHeader>
                        <CardTitle>Costing & General Rules</CardTitle>
                        <CardDescription>Define how inventory is valued and managed.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <FormField control={form.control} name="costingMethod" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Costing Method</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value} disabled={!!settingsData}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="Moving Average">Moving Average</SelectItem>
                                        <SelectItem value="FIFO">First-In, First-Out (FIFO)</SelectItem>
                                        <SelectItem value="Standard Cost">Standard Cost</SelectItem>
                                    </SelectContent>
                                </Select>
                                {!!settingsData && <FormDescription>Costing method is locked after initial setup.</FormDescription>}
                                <FormMessage />
                            </FormItem>
                        )}/>
                        <FormField control={form.control} name="allowNegativeStock" render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5"><FormLabel>Allow Negative Stock</FormLabel></div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )}/>
                        <FormField control={form.control} name="enableMultiWarehouse" render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5"><FormLabel>Enable Multi-Warehouse</FormLabel></div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )}/>
                        <FormField control={form.control} name="requireAdjustmentApproval" render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                <div className="space-y-0.5"><FormLabel>Require Adjustment Approval</FormLabel></div>
                                <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )}/>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Accounting Integration</CardTitle>
                        <CardDescription>Map key inventory processes to your Chart of Accounts.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <FormField control={form.control} name="inventoryAssetAccountId" render={({ field }) => (
                            <FormItem><FormLabel>Inventory Asset Account</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select GL..."/></SelectTrigger></FormControl><SelectContent>{assetAccounts?.map(a => <SelectItem key={a.id} value={a.id}>{a.glCode} - {a.accountName}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                        )}/>
                         <FormField control={form.control} name="grnClearingAccountId" render={({ field }) => (
                            <FormItem><FormLabel>GRN Clearing / Accrual Account</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select GL..."/></SelectTrigger></FormControl><SelectContent>{liabilityAccounts?.map(a => <SelectItem key={a.id} value={a.id}>{a.glCode} - {a.accountName}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                        )}/>
                        <FormField control={form.control} name="cogsAccountId" render={({ field }) => (
                            <FormItem><FormLabel>COGS / Consumption Account</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select GL..."/></SelectTrigger></FormControl><SelectContent>{expenseAccounts?.map(a => <SelectItem key={a.id} value={a.id}>{a.glCode} - {a.accountName}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                        )}/>
                        <FormField control={form.control} name="adjustmentGainAccountId" render={({ field }) => (
                            <FormItem><FormLabel>Adjustment Gain Account</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select GL..."/></SelectTrigger></FormControl><SelectContent>{incomeAccounts?.map(a => <SelectItem key={a.id} value={a.id}>{a.glCode} - {a.accountName}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                        )}/>
                        <FormField control={form.control} name="adjustmentLossAccountId" render={({ field }) => (
                            <FormItem><FormLabel>Adjustment Loss Account</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select GL..."/></SelectTrigger></FormControl><SelectContent>{expenseAccounts?.map(a => <SelectItem key={a.id} value={a.id}>{a.glCode} - {a.accountName}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                        )}/>
                    </CardContent>
                </Card>
            </div>
            )}
        </form>
    </Form>
  );
}