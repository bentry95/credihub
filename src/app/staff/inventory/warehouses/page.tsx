
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
import { PlusCircle, Loader2, AlertCircle, Warehouse, MoreVertical, Pencil, Trash2 } from 'lucide-react';
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

const warehouseSchema = z.object({
  name: z.string().min(1, 'Warehouse name is required.'),
  location: z.string().min(1, 'Location is required.'),
});

export default function WarehousesPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingWarehouse, setEditingWarehouse] = useState<any | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);
  const institutionId = userData?.institutionId;

  const warehousesQuery = useMemoFirebase(
    () => (institutionId ? collection(firestore, 'institutions', institutionId, 'warehouses') : null),
    [firestore, institutionId]
  );
  const { data: warehouses, isLoading: isWarehousesLoading } = useCollection(warehousesQuery);

  const form = useForm<z.infer<typeof warehouseSchema>>({ resolver: zodResolver(warehouseSchema) });

  const handleCreateClick = () => {
    setEditingWarehouse(null);
    form.reset({ name: '', location: '' });
    setIsFormOpen(true);
  };
  
  const handleEditClick = (warehouse: any) => {
    setEditingWarehouse(warehouse);
    form.reset(warehouse);
    setIsFormOpen(true);
  };
  
  const handleDeleteClick = (warehouse: any) => {
    setEditingWarehouse(warehouse);
    setIsDeleteOpen(true);
  };

  async function onSubmit(values: z.infer<typeof warehouseSchema>) {
    if (!institutionId) return;
    setLoading(true);
    setError(null);
    
    try {
        const warehousesRef = collection(firestore, 'institutions', institutionId, 'warehouses');
        if (editingWarehouse) {
            await updateDoc(doc(warehousesRef, editingWarehouse.id), values);
            toast({ title: "Warehouse Updated" });
        } else {
            const newDocRef = doc(warehousesRef);
            await setDoc(newDocRef, { ...values, id: newDocRef.id });
            toast({ title: "Warehouse Created" });
        }
        setIsFormOpen(false);
    } catch (e) {
      console.error(e);
      setError('Failed to save warehouse details.');
    } finally {
      setLoading(false);
    }
  }
  
  async function onDeleteConfirm() {
    if (!institutionId || !editingWarehouse) return;
    setLoading(true);
    try {
        await deleteDoc(doc(firestore, 'institutions', institutionId, 'warehouses', editingWarehouse.id));
        toast({ title: "Warehouse Deleted" });
        setIsDeleteOpen(false);
    } catch(e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete warehouse.' });
    } finally {
        setLoading(false);
    }
  }
  
  return (
    <>
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Warehouses & Stores</h1>
          <p className="text-muted-foreground mt-1">
            Manage the physical locations where your inventory is stored.
          </p>
        </div>
        <Button onClick={handleCreateClick}><PlusCircle className="mr-2 h-4 w-4"/> Add Warehouse</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Storage Locations</CardTitle>
          <CardDescription>A list of all your warehouses and stores.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Warehouse Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isWarehousesLoading ? (
                Array.from({length:3}).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={3}><Skeleton className="h-8 w-full"/></TableCell></TableRow>
                ))
              ) : warehouses && warehouses.length > 0 ? (
                warehouses.map(warehouse => (
                  <TableRow key={warehouse.id}>
                    <TableCell className="font-medium">{warehouse.name}</TableCell>
                    <TableCell>{warehouse.location}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4"/></Button></DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => handleEditClick(warehouse)}><Pencil className="mr-2 h-4 w-4"/> Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteClick(warehouse)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4"/> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={3} className="h-24 text-center">No warehouses created yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>

    <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{editingWarehouse ? 'Edit Warehouse' : 'Create New Warehouse'}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                    {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>{error}</AlertTitle></Alert>}
                    <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Warehouse Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="location" render={({ field }) => (<FormItem><FormLabel>Location</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
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
            <AlertDialogDescription>This will permanently delete the warehouse: <strong>{editingWarehouse?.name}</strong>. This action cannot be undone.</AlertDialogDescription>
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
