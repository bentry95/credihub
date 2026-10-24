'use client';

import { useState, useMemo } from 'react';
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
import { collection, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { PlusCircle, Coins, MoreVertical, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import React from 'react';

const shareProductSchema = z.object({
  name: z.string().min(1, 'Product name is required.'),
  nominalValue: z.coerce.number().positive('Nominal value must be a positive number.'),
  minSharesPerMember: z.coerce.number().int().min(0, 'Minimum shares cannot be negative.'),
  sharesPayableAccountId: z.string().min(1, 'Shares GL account is required.'),
  eligibleForDividends: z.boolean().default(false),
  allowShareWithdrawal: z.boolean().default(false),
  status: z.enum(['Active', 'Inactive']),
});

const CurrencyInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<'input'>
>(({ value, onChange, ...props }, ref) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const numValue = rawValue.replace(/,/g, '');
    if (!isNaN(Number(numValue)) && onChange) {
      e.target.value = numValue;
      onChange(e);
    }
  };

  const formattedValue = value ? Number(value).toLocaleString() : '';

  return (
    <Input
      ref={ref}
      value={formattedValue}
      onChange={handleChange}
      onFocus={(e) => (e.target.value = e.target.value.replace(/,/g, ''))}
      onBlur={(e) => {
        const num = parseFloat(e.target.value);
        if (!isNaN(num)) {
          e.target.value = num.toLocaleString();
        }
      }}
      {...props}
    />
  );
});
CurrencyInput.displayName = 'CurrencyInput';


export default function ShareProductsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);
  
  const institutionId = userData?.institutionId;

  const productsQuery = useMemoFirebase(
    () => (institutionId ? collection(firestore, 'institutions', institutionId, 'shareProducts') : null),
    [firestore, institutionId]
  );
  const { data: products, isLoading: isProductsLoading } = useCollection(productsQuery);
  
  const coaQuery = useMemoFirebase(
    () => (institutionId ? collection(firestore, 'institutions', institutionId, 'chartOfAccounts') : null),
    [firestore, institutionId]
  );
  const { data: accounts, isLoading: isCoaLoading } = useCollection(coaQuery);

  const equityAccounts = useMemo(() => accounts?.filter(acc => acc.accountType === 'Equity') || [], [accounts]);

  const form = useForm<z.infer<typeof shareProductSchema>>({
    resolver: zodResolver(shareProductSchema),
  });

  const handleCreate = () => {
    setEditingProduct(null);
    form.reset({
      name: '',
      nominalValue: 0,
      minSharesPerMember: 0,
      sharesPayableAccountId: '',
      eligibleForDividends: false,
      allowShareWithdrawal: false,
      status: 'Active',
    });
    setIsFormOpen(true);
  };
  
  const handleEdit = (product: any) => {
    setEditingProduct(product);
    form.reset(product);
    setIsFormOpen(true);
  };
  
  const handleDelete = (product: any) => {
    setSelectedProduct(product);
    setIsDeleteOpen(true);
  };

  async function onSubmit(values: z.infer<typeof shareProductSchema>) {
    if (!institutionId) return;
    setLoading(true);
    try {
      const productsRef = collection(firestore, 'institutions', institutionId, 'shareProducts');
      if (editingProduct) {
        await updateDoc(doc(productsRef, editingProduct.id), values);
        toast({ title: 'Product Updated' });
      } else {
        const newDocRef = doc(productsRef);
        const newProduct = { ...values, id: newDocRef.id, code: newDocRef.id.substring(0, 6).toUpperCase() };
        await setDoc(newDocRef, newProduct);
        toast({ title: 'Product Created' });
      }
      setIsFormOpen(false);
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save product.' });
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelete() {
    if (!selectedProduct || !institutionId) return;
    setLoading(true);
    try {
        await deleteDoc(doc(firestore, 'institutions', institutionId, 'shareProducts', selectedProduct.id));
        toast({ title: 'Product Deleted' });
        setIsDeleteOpen(false);
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete product.' });
    } finally {
        setLoading(false);
    }
  }

  const getBadgeVariant = (status: string) => (status === 'Active' ? 'default' : 'secondary');

  return (
    <>
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Share Products</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage share products for your members.
          </p>
        </div>
        <Button onClick={handleCreate}>
          <PlusCircle className="mr-2 h-4 w-4" /> Create New Share Product
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Existing Share Products</CardTitle>
          <CardDescription>
            A list of all share products configured for your institution.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Name</TableHead>
                <TableHead>Nominal Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isProductsLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : products && products.length > 0 ? (
                products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>MWK {product.nominalValue?.toLocaleString()}</TableCell>
                    <TableCell><Badge variant={getBadgeVariant(product.status)}>{product.status}</Badge></TableCell>
                    <TableCell className="text-right">
                       <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(product)}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDelete(product)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
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
                            <Coins className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold">No Share Products Found</h3>
                        <p className="text-muted-foreground">Get started by creating your first share product.</p>
                        <Button onClick={handleCreate}><PlusCircle className="mr-2 h-4 w-4" /> Create Product</Button>
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
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle>{editingProduct ? 'Edit Share Product' : 'Create Share Product'}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                    <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Product Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="nominalValue" render={({ field }) => (<FormItem><FormLabel>Nominal Value per Share</FormLabel><FormControl><CurrencyInput {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="minSharesPerMember" render={({ field }) => (<FormItem><FormLabel>Minimum Shares per Member</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="sharesPayableAccountId" render={({ field }) => (
                        <FormItem><FormLabel>GL Share Account</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder={isCoaLoading ? "Loading..." : "Select an equity account"} /></SelectTrigger></FormControl>
                                <SelectContent>{equityAccounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.glCode} - {acc.accountName}</SelectItem>)}</SelectContent>
                            </Select><FormMessage />
                        </FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="eligibleForDividends" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0 pt-6"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Eligible for Dividends?</FormLabel></FormItem>)} />
                        <FormField control={form.control} name="allowShareWithdrawal" render={({ field }) => (<FormItem className="flex flex-row items-center space-x-3 space-y-0 pt-6"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Allow Withdrawal?</FormLabel></FormItem>)} />
                    </div>
                    <FormField control={form.control} name="status" render={({ field }) => (
                        <FormItem><FormLabel>Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem></SelectContent>
                            </Select><FormMessage />
                        </FormItem>)} />
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                        <Button type="submit" disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (editingProduct ? 'Save Changes' : 'Create Product')}</Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>
    <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>This action cannot be undone. This will permanently delete the "{selectedProduct?.name}" share product.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDelete} disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Delete"}</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
