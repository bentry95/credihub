
'use client';

import { useState } from 'react';
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
  deleteDoc,
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
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PlusCircle, Loader2, AlertCircle, MoreVertical, Pencil, Trash2, ShoppingCart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


const supplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required.'),
  address: z.string().optional(),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email({ message: "Invalid email address." }).optional().or(z.literal('')),
  tinNumber: z.string().optional(),
});


export default function ProcurementPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editingSupplier, setEditingSupplier] = useState<any | null>(null);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    const userDocRef = useMemoFirebase(
      () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
      [firestore, user]
    );
    const { data: userData } = useDoc(userDocRef);
    const institutionId = userData?.institutionId;

    const suppliersQuery = useMemoFirebase(
      () => (institutionId ? collection(firestore, 'institutions', institutionId, 'suppliers') : null),
      [firestore, institutionId]
    );
    const { data: suppliers, isLoading: isSuppliersLoading } = useCollection(suppliersQuery);

    const form = useForm<z.infer<typeof supplierSchema>>({ resolver: zodResolver(supplierSchema) });

    const handleCreateClick = () => {
        setEditingSupplier(null);
        form.reset({ name: '', address: '', contactPerson: '', contactPhone: '', contactEmail: '' });
        setIsFormOpen(true);
    };
    
    const handleEditClick = (supplier: any) => {
        setEditingSupplier(supplier);
        form.reset(supplier);
        setIsFormOpen(true);
    };
    
    const handleDeleteClick = (supplier: any) => {
        setEditingSupplier(supplier);
        setIsDeleteOpen(true);
    };

    async function onSubmit(values: z.infer<typeof supplierSchema>) {
        if (!institutionId) return;
        setLoading(true);
        setError(null);
        
        try {
            const suppliersRef = collection(firestore, 'institutions', institutionId, 'suppliers');
            if (editingSupplier) {
                const supplierDocRef = doc(suppliersRef, editingSupplier.id);
                await updateDoc(supplierDocRef, values);
                toast({ title: "Supplier Updated" });
            } else {
                const newDocRef = doc(suppliersRef);
                await setDoc(newDocRef, { ...values, id: newDocRef.id });
                toast({ title: "Supplier Added" });
            }
            setIsFormOpen(false);
        } catch (e) {
            console.error(e);
            setError('Failed to save supplier details.');
        } finally {
            setLoading(false);
        }
    }
    
    async function onDeleteConfirm() {
        if (!institutionId || !editingSupplier) return;
        setLoading(true);
        try {
            await deleteDoc(doc(firestore, 'institutions', institutionId, 'suppliers', editingSupplier.id));
            toast({ title: "Supplier Deleted" });
            setIsDeleteOpen(false);
        } catch(e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

  return (
    <>
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Procurement &amp; Purchases</h1>
          <p className="text-muted-foreground mt-1">
            Manage suppliers, purchase orders, and goods received.
          </p>
        </div>
      </div>
      
      <Tabs defaultValue="suppliers">
        <TabsList>
            <TabsTrigger value="purchase-orders">Purchase Orders</TabsTrigger>
            <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
        </TabsList>
        <TabsContent value="purchase-orders" className="pt-4">
             <Card>
                <CardHeader>
                    <CardTitle>Purchase Orders</CardTitle>
                </CardHeader>
                <CardContent className="h-48 flex items-center justify-center">
                    <p className="text-muted-foreground">Purchase order management is under construction.</p>
                </CardContent>
             </Card>
        </TabsContent>
        <TabsContent value="suppliers" className="pt-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Supplier Directory</CardTitle>
                        <CardDescription>Manage your list of vendors and suppliers.</CardDescription>
                    </div>
                    <Button onClick={handleCreateClick}><PlusCircle className="mr-2 h-4 w-4"/> Add Supplier</Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Contact Person</TableHead><TableHead>Phone</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {isSuppliersLoading ? Array.from({length:3}).map((_,i) => <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-8 w-full"/></TableCell></TableRow>)
                             : suppliers && suppliers.length > 0 ? suppliers.map(supplier => (
                                 <TableRow key={supplier.id}>
                                     <TableCell className="font-medium">{supplier.name}</TableCell>
                                     <TableCell>{supplier.contactPerson}</TableCell>
                                     <TableCell>{supplier.contactPhone}</TableCell>
                                     <TableCell className="text-right">
                                         <DropdownMenu>
                                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4"/></Button></DropdownMenuTrigger>
                                            <DropdownMenuContent>
                                                <DropdownMenuItem onClick={() => handleEditClick(supplier)}><Pencil className="mr-2 h-4 w-4"/>Edit</DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleDeleteClick(supplier)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4"/>Delete</DropdownMenuItem>
                                            </DropdownMenuContent>
                                         </DropdownMenu>
                                     </TableCell>
                                 </TableRow>
                             )) : <TableRow><TableCell colSpan={4} className="h-24 text-center">No suppliers found.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
    
     <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
            <DialogHeader>
                <DialogTitle>{editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                    {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>{error}</AlertTitle></Alert>}
                    <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Supplier Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="contactPerson" render={({ field }) => (<FormItem><FormLabel>Contact Person</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="contactPhone" render={({ field }) => (<FormItem><FormLabel>Contact Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="contactEmail" render={({ field }) => (<FormItem><FormLabel>Contact Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="tinNumber" render={({ field }) => (<FormItem><FormLabel>TIN Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                        <Button type="submit" disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Save</Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the supplier: <strong>{editingSupplier?.name}</strong>. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onDeleteConfirm} disabled={loading} className="bg-destructive hover:bg-destructive/90">{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Delete"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
