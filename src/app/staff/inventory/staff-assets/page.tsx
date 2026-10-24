
'use client';

import { useState, useMemo, useEffect } from 'react';
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
  updateDoc,
  runTransaction,
  query,
  where,
  serverTimestamp
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
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PlusCircle, Loader2, AlertCircle, Save, CalendarIcon, User, Package, Hand } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';


const issueSchema = z.object({
  customerId: z.string().min(1, 'Please select an employee.'),
  inventoryItemId: z.string().min(1, 'Please select an item to issue.'),
  dateIssued: z.date({ required_error: 'Issue date is required.' }),
  notes: z.string().optional(),
});


export default function StaffAssetsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isIssueFormOpen, setIsIssueFormOpen] = useState(false);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);
  const institutionId = userData?.institutionId;

  const staffAssetsQuery = useMemoFirebase(
    () => (institutionId ? collection(firestore, 'institutions', institutionId, 'staffAssets') : null),
    [firestore, institutionId]
  );
  const { data: issuedAssets, isLoading: isAssetsLoading } = useCollection(staffAssetsQuery);
  
  const employeesQuery = useMemoFirebase(
    () => (institutionId ? query(collection(firestore, 'institutions', institutionId, 'customers'), where('isEmployee', '==', true)) : null),
    [firestore, institutionId]
  );
  const { data: employees, isLoading: isEmployeesLoading } = useCollection(employeesQuery);
  
  const inventoryQuery = useMemoFirebase(
    () => (institutionId ? query(collection(firestore, 'institutions', institutionId, 'inventoryItems'), where('itemType', '==', 'Asset')) : null),
    [firestore, institutionId]
  );
  const { data: inventoryItems, isLoading: isInventoryLoading } = useCollection(inventoryQuery);


  const form = useForm<z.infer<typeof issueSchema>>({
    resolver: zodResolver(issueSchema),
    defaultValues: {
        dateIssued: new Date(),
    }
  });

  const handleIssueClick = () => {
    form.reset({
        customerId: '',
        inventoryItemId: '',
        dateIssued: new Date(),
        notes: '',
    });
    setIsIssueFormOpen(true);
  };
  
  async function onSubmit(values: z.infer<typeof issueSchema>) {
    if (!institutionId) return;
    setLoading(true);
    setError(null);
    try {
      await runTransaction(firestore, async (transaction) => {
        const itemRef = doc(firestore, 'institutions', institutionId, 'inventoryItems', values.inventoryItemId);
        const itemSnap = await transaction.get(itemRef);

        if (!itemSnap.exists()) throw new Error("Inventory item not found.");
        
        const currentQuantity = itemSnap.data().quantity || 0;
        if (currentQuantity < 1) throw new Error("Item is out of stock.");

        transaction.update(itemRef, { quantity: currentQuantity - 1 });

        const staffAssetsRef = collection(firestore, 'institutions', institutionId, 'staffAssets');
        const newAssetRef = doc(staffAssetsRef);

        const employee = employees?.find(e => e.id === values.customerId);
        const item = inventoryItems?.find(i => i.id === values.inventoryItemId);
        
        transaction.set(newAssetRef, {
            id: newAssetRef.id,
            customerId: values.customerId,
            customerName: employee?.name || 'Unknown Employee',
            inventoryItemId: values.inventoryItemId,
            inventoryItemName: item?.name || 'Unknown Item',
            dateIssued: values.dateIssued,
            status: 'Issued',
            notes: values.notes || '',
            createdAt: serverTimestamp(),
        });
      });
      toast({ title: 'Asset Issued', description: 'The asset has been successfully issued.' });
      setIsIssueFormOpen(false);
    } catch (e: any) {
      setError(e.message || 'Failed to issue asset.');
    } finally {
      setLoading(false);
    }
  }
  
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Issued': return 'default';
      case 'Returned': return 'secondary';
      case 'Lost':
      case 'Damaged':
        return 'destructive';
      default: return 'outline';
    }
  };
  
  const isLoading = isAssetsLoading || isEmployeesLoading || isInventoryLoading;

  return (
    <>
    <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
            <h1 className="text-3xl font-bold tracking-tight">Staff-Issued Assets</h1>
            <p className="text-muted-foreground mt-1">
                Track and manage all company assets assigned to employees.
            </p>
            </div>
            <Button onClick={handleIssueClick}><PlusCircle className="mr-2 h-4 w-4" /> Issue New Asset</Button>
        </div>
        <Card>
            <CardHeader>
            <CardTitle>Employee Asset Register</CardTitle>
            <CardDescription>
                A log of all assets currently issued to staff members.
            </CardDescription>
            </CardHeader>
            <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Item Issued</TableHead>
                        <TableHead>Date Issued</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-9 w-24" /></TableCell>
                    </TableRow>
                    ))
                ) : issuedAssets && issuedAssets.length > 0 ? (
                    issuedAssets.map((asset) => (
                    <TableRow key={asset.id}>
                        <TableCell className="font-medium">{asset.customerName}</TableCell>
                        <TableCell>{asset.inventoryItemName}</TableCell>
                        <TableCell>{format(asset.dateIssued.toDate(), 'PPP')}</TableCell>
                        <TableCell><Badge variant={getStatusBadgeVariant(asset.status)}>{asset.status}</Badge></TableCell>
                        <TableCell>
                            <Button variant="outline" size="sm">Manage</Button>
                        </TableCell>
                    </TableRow>
                    ))
                ) : (
                    <TableRow>
                    <TableCell colSpan={5} className="h-48 text-center">
                        <div className="flex flex-col items-center gap-4">
                        <div className="p-4 bg-muted rounded-full">
                            <Hand className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold">No Assets Issued</h3>
                        <p className="text-muted-foreground">Get started by issuing an asset to an employee.</p>
                        </div>
                    </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
            </CardContent>
        </Card>
    </div>
    <Dialog open={isIssueFormOpen} onOpenChange={setIsIssueFormOpen}>
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle>Issue New Asset</DialogTitle>
                <DialogDescription>Assign a new asset to an employee.</DialogDescription>
            </DialogHeader>
             <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>{error}</AlertTitle></Alert>}
                    <FormField control={form.control} name="customerId" render={({ field }) => (
                        <FormItem><FormLabel>Employee</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl>
                            <SelectTrigger><SelectValue placeholder={isEmployeesLoading ? "Loading..." : "Select employee..."} /></SelectTrigger>
                        </FormControl><SelectContent>{employees?.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                    )} />
                     <FormField control={form.control} name="inventoryItemId" render={({ field }) => (
                        <FormItem><FormLabel>Asset to Issue</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl>
                            <SelectTrigger><SelectValue placeholder={isInventoryLoading ? "Loading..." : "Select item..."} /></SelectTrigger>
                        </FormControl><SelectContent>{inventoryItems?.map(item => <SelectItem key={item.id} value={item.id} disabled={item.quantity === 0}>{item.name} ({item.quantity} available)</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                    )} />
                     <FormField control={form.control} name="dateIssued" render={({ field }) => (
                        <FormItem className="flex flex-col"><FormLabel>Date Issued</FormLabel><Popover><PopoverTrigger asChild><FormControl>
                            <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                        </FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                     )}/>
                     <FormField control={form.control} name="notes" render={({ field }) => (
                        <FormItem><FormLabel>Notes (Optional)</FormLabel><FormControl><Textarea placeholder="e.g., Issued for Blantyre office project." {...field} /></FormControl><FormMessage /></FormItem>
                    )} />

                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                        <Button type="submit" disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Issue Asset</Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>
    </>
  );
}
