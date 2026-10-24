
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
import { PlusCircle, Loader2, AlertCircle, Shapes, Ruler, Trash2, Pencil } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required.'),
  description: z.string().optional(),
});

const unitSchema = z.object({
    name: z.string().min(1, 'Unit name is required.'),
    abbreviation: z.string().min(1, 'Abbreviation is required.'),
});

export default function CategoriesAndUnitsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  
  const [isUnitFormOpen, setIsUnitFormOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<any | null>(null);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);
  const institutionId = userData?.institutionId;

  const categoriesQuery = useMemoFirebase(
    () => (institutionId ? collection(firestore, 'institutions', institutionId, 'inventoryCategories') : null),
    [firestore, institutionId]
  );
  const { data: categories, isLoading: isCategoriesLoading } = useCollection(categoriesQuery);

  const unitsQuery = useMemoFirebase(
    () => (institutionId ? collection(firestore, 'institutions', institutionId, 'unitsOfMeasure') : null),
    [firestore, institutionId]
  );
  const { data: units, isLoading: isUnitsLoading } = useCollection(unitsQuery);

  const categoryForm = useForm<z.infer<typeof categorySchema>>({ resolver: zodResolver(categorySchema) });
  const unitForm = useForm<z.infer<typeof unitSchema>>({ resolver: zodResolver(unitSchema) });

  const handleCreateCategory = () => {
    setEditingCategory(null);
    categoryForm.reset({ name: '', description: '' });
    setIsCategoryFormOpen(true);
  };
  
  const handleEditCategory = (category: any) => {
    setEditingCategory(category);
    categoryForm.reset(category);
    setIsCategoryFormOpen(true);
  };

  const handleCreateUnit = () => {
    setEditingUnit(null);
    unitForm.reset({ name: '', abbreviation: '' });
    setIsUnitFormOpen(true);
  };
  
  const handleEditUnit = (unit: any) => {
    setEditingUnit(unit);
    unitForm.reset(unit);
    setIsUnitFormOpen(true);
  };

  async function onCategorySubmit(values: z.infer<typeof categorySchema>) {
    if (!institutionId) return;
    setLoading(true);
    try {
      const categoriesRef = collection(firestore, 'institutions', institutionId, 'inventoryCategories');
      if (editingCategory) {
        await updateDoc(doc(categoriesRef, editingCategory.id), values);
        toast({ title: 'Category Updated' });
      } else {
        const newDocRef = doc(categoriesRef);
        await setDoc(newDocRef, { ...values, id: newDocRef.id });
        toast({ title: 'Category Created' });
      }
      setIsCategoryFormOpen(false);
    } catch(e) { console.error(e); } finally { setLoading(false); }
  }

  async function onUnitSubmit(values: z.infer<typeof unitSchema>) {
    if (!institutionId) return;
    setLoading(true);
    try {
      const unitsRef = collection(firestore, 'institutions', institutionId, 'unitsOfMeasure');
      if (editingUnit) {
        await updateDoc(doc(unitsRef, editingUnit.id), values);
        toast({ title: 'Unit Updated' });
      } else {
        const newDocRef = doc(unitsRef);
        await setDoc(newDocRef, { ...values, id: newDocRef.id });
        toast({ title: 'Unit Created' });
      }
      setIsUnitFormOpen(false);
    } catch(e) { console.error(e); } finally { setLoading(false); }
  }


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Categories & Units</h1>
          <p className="text-muted-foreground mt-1">
            Manage the structure for classifying your inventory items.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Item Categories</CardTitle>
                    <CardDescription>e.g., Office Supplies, IT Equipment</CardDescription>
                </div>
                <Button onClick={handleCreateCategory}><PlusCircle className="mr-2 h-4 w-4"/> New Category</Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {isCategoriesLoading ? <TableRow><TableCell colSpan={3}><Skeleton className="h-20 w-full"/></TableCell></TableRow> : 
                         categories && categories.length > 0 ? categories.map(cat => (
                             <TableRow key={cat.id}>
                                 <TableCell>{cat.name}</TableCell>
                                 <TableCell className="text-sm text-muted-foreground">{cat.description}</TableCell>
                                 <TableCell className="text-right">
                                     <Button variant="ghost" size="icon" onClick={() => handleEditCategory(cat)}><Pencil className="h-4 w-4"/></Button>
                                 </TableCell>
                             </TableRow>
                         )) : <TableRow><TableCell colSpan={3} className="h-24 text-center">No categories created yet.</TableCell></TableRow>}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Units of Measure</CardTitle>
                    <CardDescription>e.g., Pieces (pcs), Kilograms (kg)</CardDescription>
                </div>
                <Button onClick={handleCreateUnit}><PlusCircle className="mr-2 h-4 w-4"/> New Unit</Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Abbreviation</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {isUnitsLoading ? <TableRow><TableCell colSpan={3}><Skeleton className="h-20 w-full"/></TableCell></TableRow> : 
                         units && units.length > 0 ? units.map(unit => (
                             <TableRow key={unit.id}>
                                 <TableCell>{unit.name}</TableCell>
                                 <TableCell>{unit.abbreviation}</TableCell>
                                 <TableCell className="text-right">
                                     <Button variant="ghost" size="icon" onClick={() => handleEditUnit(unit)}><Pencil className="h-4 w-4"/></Button>
                                 </TableCell>
                             </TableRow>
                         )) : <TableRow><TableCell colSpan={3} className="h-24 text-center">No units created yet.</TableCell></TableRow>}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
      </div>

       <Dialog open={isCategoryFormOpen} onOpenChange={setIsCategoryFormOpen}>
        <DialogContent><DialogHeader>
          <DialogTitle>{editingCategory ? 'Edit Category' : 'Create New Category'}</DialogTitle>
        </DialogHeader><Form {...categoryForm}><form onSubmit={categoryForm.handleSubmit(onCategorySubmit)} className="space-y-4 py-4">
          <FormField control={categoryForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Category Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={categoryForm.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
          <DialogFooter><DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose><Button type="submit" disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Save</Button></DialogFooter>
        </form></Form></DialogContent>
      </Dialog>
      
      <Dialog open={isUnitFormOpen} onOpenChange={setIsUnitFormOpen}>
        <DialogContent><DialogHeader>
          <DialogTitle>{editingUnit ? 'Edit Unit' : 'Create New Unit'}</DialogTitle>
        </DialogHeader><Form {...unitForm}><form onSubmit={unitForm.handleSubmit(onUnitSubmit)} className="space-y-4 py-4">
          <FormField control={unitForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Unit Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
          <FormField control={unitForm.control} name="abbreviation" render={({ field }) => (<FormItem><FormLabel>Abbreviation</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
          <DialogFooter><DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose><Button type="submit" disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Save</Button></DialogFooter>
        </form></Form></DialogContent>
      </Dialog>
    </div>
  );
}
