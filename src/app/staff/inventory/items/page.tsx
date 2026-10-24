
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
  serverTimestamp,
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { PlusCircle, Package, MoreVertical, Pencil, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const itemSchema = z.object({
  name: z.string().min(1, 'Item name is required.'),
  code: z.string().min(1, 'Item code/SKU is required.'),
  categoryId: z.string().min(1, 'Category is required.'),
  itemType: z.enum(['Consumable', 'Asset', 'Loanable Item']),
  unitOfMeasureId: z.string().min(1, 'Unit of measure is required.'),
  costPrice: z.coerce.number().min(0),
  sellingPrice: z.coerce.number().min(0),
  reorderLevel: z.coerce.number().int().min(0),
  openingStock: z.coerce.number().int().min(0).optional(),
  status: z.enum(['Active', 'Discontinued']),
});

export default function ItemsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const userDocRef = useMemoFirebase(() => (firestore && user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userData } = useDoc(userDocRef);
  const institutionId = userData?.institutionId;

  const itemsQuery = useMemoFirebase(() => (institutionId ? collection(firestore, 'institutions', institutionId, 'inventoryItems') : null), [firestore, institutionId]);
  const { data: items, isLoading: isItemsLoading } = useCollection(itemsQuery);

  const categoriesQuery = useMemoFirebase(() => (institutionId ? collection(firestore, 'institutions', institutionId, 'inventoryCategories') : null), [firestore, institutionId]);
  const { data: categories, isLoading: isCategoriesLoading } = useCollection(categoriesQuery);
  
  const unitsQuery = useMemoFirebase(() => (institutionId ? collection(firestore, 'institutions', institutionId, 'unitsOfMeasure') : null), [firestore, institutionId]);
  const { data: units, isLoading: isUnitsLoading } = useCollection(unitsQuery);

  const form = useForm<z.infer<typeof itemSchema>>({ resolver: zodResolver(itemSchema) });

  const handleCreate = () => {
    setEditingItem(null);
    form.reset({ name: '', code: '', status: 'Active', costPrice: 0, sellingPrice: 0, reorderLevel: 0, openingStock: 0 });
    setIsFormOpen(true);
  };
  
  const handleEdit = (item: any) => {
    setEditingItem(item);
    form.reset(item);
    setIsFormOpen(true);
  };

  const handleDelete = (item: any) => {
    setEditingItem(item);
    setIsDeleteOpen(true);
  };

  async function onSubmit(values: z.infer<typeof itemSchema>) {
    if (!institutionId) return;
    setLoading(true);
    try {
      const itemsRef = collection(firestore, 'institutions', institutionId, 'inventoryItems');
      if (editingItem) {
        const { openingStock, ...updateValues } = values; // Exclude openingStock from update
        await updateDoc(doc(itemsRef, editingItem.id), updateValues);
        toast({ title: 'Item Updated' });
      } else {
        const newDocRef = doc(itemsRef);
        const { openingStock, ...restOfValues } = values;
        await setDoc(newDocRef, { 
          ...restOfValues, 
          id: newDocRef.id,
          quantity: openingStock || 0,
          createdAt: serverTimestamp(),
        });
        toast({ title: 'Item Created' });
      }
      setIsFormOpen(false);
    } catch(e) { console.error(e) } finally { setLoading(false); }
  }

  const confirmDelete = async () => {
    if (!editingItem || !institutionId) return;
    setLoading(true);
    try {
      await deleteDoc(doc(firestore, 'institutions', institutionId, 'inventoryItems', editingItem.id));
      toast({ title: 'Item Deleted' });
      setIsDeleteOpen(false);
    } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  const getCategoryName = (id: string) => categories?.find(c => c.id === id)?.name || id;
  const getUnitName = (id: string) => units?.find(u => u.id === id)?.abbreviation || id;

  const isLoading = isItemsLoading || isCategoriesLoading || isUnitsLoading;

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Item & Product Management</h1>
            <p className="text-muted-foreground mt-1">Manage your complete catalog of inventory items.</p>
          </div>
          <Button onClick={handleCreate}><PlusCircle className="mr-2 h-4 w-4" /> Create New Item</Button>
        </div>

        <Card>
          <CardHeader><CardTitle>Item Master</CardTitle><CardDescription>A list of all inventory items.</CardDescription></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Item Name</TableHead><TableHead>Code (SKU)</TableHead><TableHead>Category</TableHead><TableHead>Unit</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                  ))
                ) : items && items.length > 0 ? (
                  items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.code}</TableCell>
                      <TableCell>{getCategoryName(item.categoryId)}</TableCell>
                      <TableCell>{getUnitName(item.unitOfMeasureId)}</TableCell>
                      <TableCell><Badge variant={item.status === 'Active' ? 'default' : 'outline'}>{item.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5"/></Button></DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => handleEdit(item)}><Pencil className="mr-2 h-4 w-4"/> Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDelete(item)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4"/> Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={6} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-muted rounded-full"><Package className="h-10 w-10 text-muted-foreground" /></div>
                      <h3 className="text-lg font-semibold">No Items Found</h3>
                      <p className="text-muted-foreground">Get started by creating your first inventory item.</p>
                      <Button onClick={handleCreate}><PlusCircle className="mr-2 h-4 w-4" /> Create Item</Button>
                    </div>
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl"><DialogHeader>
          <DialogTitle>{editingItem ? 'Edit Item' : 'Create New Item'}</DialogTitle>
        </DialogHeader><Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Item Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="code" render={({ field }) => (<FormItem><FormLabel>Item Code / SKU</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="categoryId" render={({ field }) => (<FormItem><FormLabel>Category</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger></FormControl><SelectContent>{categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="itemType" render={({ field }) => (<FormItem><FormLabel>Item Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger></FormControl><SelectContent><SelectItem value="Consumable">Consumable</SelectItem><SelectItem value="Asset">Asset</SelectItem><SelectItem value="Loanable Item">Loanable Item</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
          </div>
           <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="unitOfMeasureId" render={({ field }) => (<FormItem><FormLabel>Unit of Measure</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger></FormControl><SelectContent>{units?.map(u => <SelectItem key={u.id} value={u.id}>{u.name} ({u.abbreviation})</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="reorderLevel" render={({ field }) => (<FormItem><FormLabel>Reorder Level</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="costPrice" render={({ field }) => (<FormItem><FormLabel>Cost Price</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="sellingPrice" render={({ field }) => (<FormItem><FormLabel>Selling Price</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
          </div>
          {!editingItem && (
            <FormField control={form.control} name="openingStock" render={({ field }) => (<FormItem><FormLabel>Opening Stock</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
          )}
          <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Discontinued">Discontinued</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
          <DialogFooter><DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose><Button type="submit" disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Save</Button></DialogFooter>
        </form></Form></DialogContent>
      </Dialog>
      
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent><AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>This will permanently delete the item: <strong>{editingItem?.name}</strong>. This action cannot be undone.</AlertDialogDescription>
        </AlertDialogHeader><AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={confirmDelete} disabled={loading} className="bg-destructive hover:bg-destructive/90">{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Delete</AlertDialogAction>
        </AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </>
  );
}
