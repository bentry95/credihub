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
import { collection, doc, setDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
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
  DialogClose,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  PlusCircle,
  CircleDollarSign,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  Save,
  Ban,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

const penaltySchema = z.object({
    name: z.string().min(1, 'Penalty name is required.'),
    status: z.enum(['Active', 'Inactive']),
    calculationMethod: z.enum(['Flat Amount', 'Percentage']),
    amount: z.coerce.number().optional(),
    percentage: z.coerce.number().optional(),
    incomeAccountId: z.string().min(1, 'Income account is required.'),
}).refine(data => {
    if (data.calculationMethod === 'Flat Amount') return data.amount !== undefined && data.amount > 0;
    return true;
}, { message: 'A flat amount is required.', path: ['amount']})
  .refine(data => {
    if (data.calculationMethod === 'Percentage') return data.percentage !== undefined && data.percentage > 0;
    return true;
}, { message: 'A percentage is required.', path: ['percentage']});

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


export default function PenaltiesPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingPenalty, setEditingPenalty] = useState<any | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);
  const institutionId = userData?.institutionId;

  const feesQuery = useMemoFirebase(
    () =>
      firestore && institutionId
        ? query(collection(firestore, 'institutions', institutionId, 'fees'), where('chargeType', '==', 'Penalty'))
        : null,
    [firestore, institutionId]
  );
  const { data: penalties, isLoading: isPenaltiesLoading } = useCollection(feesQuery);
  
  const coaQuery = useMemoFirebase(
    () =>
      firestore && institutionId
        ? collection(firestore, 'institutions', institutionId, 'chartOfAccounts')
        : null,
    [firestore, institutionId]
  );
  const { data: accounts, isLoading: isCoaLoading } = useCollection(coaQuery);

  const form = useForm<z.infer<typeof penaltySchema>>({
    resolver: zodResolver(penaltySchema),
  });

  const calculationMethod = useWatch({ control: form.control, name: 'calculationMethod' });

  const handleCreate = () => {
    setEditingPenalty(null);
    form.reset({
      name: '',
      status: 'Active',
      calculationMethod: 'Flat Amount',
      amount: 0,
      percentage: 0,
      incomeAccountId: '',
    });
    setIsFormOpen(true);
  };
  
  const handleEdit = (penalty: any) => {
    setEditingPenalty(penalty);
    form.reset(penalty);
    setIsFormOpen(true);
  };
  
  const handleDelete = (penalty: any) => {
    setEditingPenalty(penalty);
    setIsDeleteOpen(true);
  }

  async function onSubmit(values: z.infer<typeof penaltySchema>) {
    if (!firestore || !institutionId) return;

    setLoading(true);
    setError(null);
    try {
        const feesRef = collection(firestore, 'institutions', institutionId, 'fees');
        const penaltyData = { 
            ...values,
            chargeType: 'Penalty',
            trigger: 'On Late Payment',
            collectionMethod: 'Paid Separately',
            percentageOf: 'Overdue Amount',
        };

        if (editingPenalty) {
            const feeDoc = doc(feesRef, editingPenalty.id);
            await updateDoc(feeDoc, penaltyData);
            toast({ title: "Penalty Updated", description: `The penalty "${values.name}" has been updated.` });
        } else {
            const newDocRef = doc(feesRef);
            await setDoc(newDocRef, { ...penaltyData, id: newDocRef.id });
            toast({ title: "Penalty Created", description: `The penalty "${values.name}" has been created.` });
        }
      
        setIsFormOpen(false);
    } catch (e) {
      console.error('Error saving penalty:', e);
      setError('Failed to save penalty. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const confirmDelete = async () => {
      if (!firestore || !institutionId || !editingPenalty) return;
      setLoading(true);
      try {
          await deleteDoc(doc(firestore, 'institutions', institutionId, 'fees', editingPenalty.id));
          toast({ title: "Penalty Deleted" });
          setIsDeleteOpen(false);
      } catch (e) {
          toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete penalty.' });
      } finally {
          setLoading(false);
      }
  }

  const getBadgeVariant = (status: string) => (status === 'Active' ? 'default' : 'secondary');
  const incomeAccounts = accounts?.filter(acc => acc.accountType === 'Income') || [];

  return (
    <>
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Penalty Rules</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage penalties for overdue loans.
          </p>
        </div>
        <Button onClick={handleCreate}>
          <PlusCircle className="mr-2 h-4 w-4" /> Create New Penalty Rule
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configured Penalties</CardTitle>
          <CardDescription>
            A list of all late payment penalties configured for your institution.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Penalty Name</TableHead>
                <TableHead>Calculation</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isPenaltiesLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : penalties && penalties.length > 0 ? (
                penalties.map((penalty) => (
                  <TableRow key={penalty.id}>
                    <TableCell className="font-medium">{penalty.name}</TableCell>
                    <TableCell>
                      {penalty.calculationMethod === 'Flat Amount' 
                        ? `MWK ${penalty.amount?.toLocaleString()}` 
                        : `${penalty.percentage}% of Overdue Amount`}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getBadgeVariant(penalty.status)}>{penalty.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                       <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(penalty)}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDelete(penalty)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="p-4 bg-muted rounded-full">
                            <Ban className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold">No Penalties Found</h3>
                        <p className="text-muted-foreground">Get started by creating your first penalty rule.</p>
                        <Button onClick={handleCreate}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Create Rule
                        </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>

    <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-xl">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <DialogHeader>
                <DialogTitle>{editingPenalty ? "Edit Penalty Rule" : "Create New Penalty Rule"}</DialogTitle>
                <DialogDescription>
                  Define how penalties are calculated and applied to overdue loans.
                </DialogDescription>
              </DialogHeader>
              
              <div className="py-4 space-y-4">
                {error && <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /> <AlertTitle>Error</AlertTitle></Alert>}
                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Penalty Name</FormLabel><FormControl><Input placeholder="e.g., Standard Late Fee" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <div className="grid grid-cols-2 gap-4">
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
                    <FormField control={form.control} name="calculationMethod" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Calculation Method</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select calculation" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Flat Amount">Flat Amount</SelectItem>
                            <SelectItem value="Percentage">Percentage</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                </div>
                 {calculationMethod === 'Flat Amount' ? (
                    <FormField control={form.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Flat Amount (MWK)</FormLabel><FormControl><CurrencyInput {...field} /></FormControl><FormMessage /></FormItem>)} />
                 ) : (
                    <FormField control={form.control} name="percentage" render={({ field }) => (<FormItem><FormLabel>Percentage (%)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormDescription>This will be calculated on the overdue principal + interest amount.</FormDescription><FormMessage /></FormItem>)} />
                 )}
                 <FormField control={form.control} name="incomeAccountId" render={({ field }) => (
                    <FormItem>
                        <FormLabel>GL Income Account</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                                <SelectTrigger><SelectValue placeholder={isCoaLoading ? "Loading..." : "Select an income account"} /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {incomeAccounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.glCode} - {acc.accountName}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />
              </div>
              <DialogFooter className="pt-4">
                  <DialogClose asChild>
                      <Button type="button" variant="ghost">Cancel</Button>
                  </DialogClose>
                  <Button type="submit" disabled={loading}>
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      {editingPenalty ? "Save Changes" : "Create Penalty"}
                  </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the penalty rule: <strong>{editingPenalty?.name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Yes, Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
