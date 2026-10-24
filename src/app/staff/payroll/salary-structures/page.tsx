
'use client';

import { useState, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
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
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlusCircle, Album, MoreVertical, Pencil, Trash2, Loader2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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

const gradeSchema = z.object({
  gradeName: z.string().min(1, 'Grade name is required.'),
  minSalary: z.coerce.number().min(0),
  maxSalary: z.coerce.number().min(0),
}).refine(data => data.maxSalary >= data.minSalary, {
  message: 'Max salary must be >= min salary.',
  path: ['maxSalary'],
});

const allowanceSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  type: z.enum(['Fixed', 'Percentage']),
  value: z.coerce.number().positive(),
  expenseAccountId: z.string().min(1, 'GL Account is required.'),
});

const deductionSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  type: z.enum(['Fixed', 'Percentage']),
  value: z.coerce.number().positive(),
  liabilityAccountId: z.string().min(1, 'GL Account is required.'),
});

const structureSchema = z.object({
  name: z.string().min(1, 'Structure name is required.'),
  description: z.string().optional(),
  grades: z.array(gradeSchema).min(1, 'At least one grade is required.'),
  allowances: z.array(allowanceSchema).optional(),
  deductions: z.array(deductionSchema).optional(),
});


export default function SalaryStructuresPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
  
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [editingStructure, setEditingStructure] = useState<any | null>(null);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    const userDocRef = useMemoFirebase(
      () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
      [firestore, user]
    );
    const { data: userData } = useDoc(userDocRef);
    const institutionId = userData?.institutionId;
  
    const structuresQuery = useMemoFirebase(
      () => (institutionId ? collection(firestore, 'institutions', institutionId, 'salaryStructures') : null),
      [firestore, institutionId]
    );
    const { data: structures, isLoading: isStructuresLoading } = useCollection(structuresQuery);
    
    const coaQuery = useMemoFirebase(
        () => (institutionId ? collection(firestore, 'institutions', institutionId, 'chartOfAccounts') : null),
        [firestore, institutionId]
    );
    const { data: accounts, isLoading: isCoaLoading } = useCollection(coaQuery);

    const form = useForm<z.infer<typeof structureSchema>>({
        resolver: zodResolver(structureSchema),
    });
    
    const { control, handleSubmit, reset } = form;

    const { fields: gradeFields, append: appendGrade, remove: removeGrade } = useFieldArray({ control, name: "grades" });
    const { fields: allowanceFields, append: appendAllowance, remove: removeAllowance } = useFieldArray({ control, name: "allowances" });
    const { fields: deductionFields, append: appendDeduction, remove: removeDeduction } = useFieldArray({ control, name: "deductions" });
    
    const expenseAccounts = useMemo(() => accounts?.filter(a => a.accountType === 'Expense') || [], [accounts]);
    const liabilityAccounts = useMemo(() => accounts?.filter(a => a.accountType === 'Liability') || [], [accounts]);
    
    const handleCreate = () => {
        setEditingStructure(null);
        reset({ name: '', description: '', grades: [{gradeName: 'Grade 1', minSalary: 0, maxSalary: 0}], allowances: [], deductions: [] });
        setIsFormOpen(true);
    };
    
    const handleEdit = (structure: any) => {
        setEditingStructure(structure);
        reset(structure);
        setIsFormOpen(true);
    };

    const handleDelete = (structure: any) => {
        setEditingStructure(structure);
        setIsDeleteOpen(true);
    };

    const onSubmit = async (values: z.infer<typeof structureSchema>) => {
        if (!institutionId) return;
        setLoading(true);
        try {
            const structuresRef = collection(firestore, 'institutions', institutionId, 'salaryStructures');
            if (editingStructure) {
                await updateDoc(doc(structuresRef, editingStructure.id), values);
                toast({ title: "Structure Updated" });
            } else {
                const newDocRef = doc(structuresRef);
                await setDoc(newDocRef, { ...values, id: newDocRef.id, institutionId });
                toast({ title: "Structure Created" });
            }
            setIsFormOpen(false);
        } catch (e) {
            console.error(e);
            toast({ variant: "destructive", title: "Error", description: "Failed to save salary structure." });
        } finally {
            setLoading(false);
        }
    };
    
    const confirmDelete = async () => {
        if (!institutionId || !editingStructure) return;
        setLoading(true);
        try {
            await deleteDoc(doc(firestore, "institutions", institutionId, "salaryStructures", editingStructure.id));
            toast({ title: "Structure Deleted" });
            setIsDeleteOpen(false);
            setEditingStructure(null);
        } catch (e) {
            console.error(e);
            toast({ variant: "destructive", title: "Error", description: "Failed to delete salary structure." });
        } finally {
            setLoading(false);
        }
    };


  return (
    <>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Salary Structures</h1>
          <p className="text-muted-foreground mt-1">
            Define and manage salary components, allowances, and deductions.
          </p>
        </div>
        <Button onClick={handleCreate}>
          <PlusCircle className="mr-2 h-4 w-4" /> Create New Structure
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Structure Library</CardTitle>
          <CardDescription>
            A list of all salary structures configured for your institution.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Structure Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead># of Grades</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isStructuresLoading ? (
                  Array.from({length: 2}).map((_, i) => <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-8 w-full"/></TableCell></TableRow>)
              ) : structures && structures.length > 0 ? (
                structures.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.name}</TableCell>
                    <TableCell>{s.description}</TableCell>
                    <TableCell>{s.grades?.length || 0}</TableCell>
                    <TableCell className="text-right">
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(s)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(s)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
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
                        <Album className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold">No Salary Structures Found</h3>
                      <p className="text-muted-foreground">
                        Get started by creating your first salary structure.
                      </p>
                      <Button onClick={handleCreate}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Create Structure
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
        <DialogContent className="max-w-4xl">
            <DialogHeader>
                <DialogTitle>{editingStructure ? "Edit Salary Structure" : "Create Salary Structure"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                     <FormField control={control} name="name" render={({ field }) => (<FormItem><FormLabel>Structure Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <Tabs defaultValue="grades">
                        <TabsList><TabsTrigger value="grades">Grades</TabsTrigger><TabsTrigger value="allowances">Allowances</TabsTrigger><TabsTrigger value="deductions">Deductions</TabsTrigger></TabsList>
                        <div className="max-h-[50vh] overflow-y-auto p-4 border rounded-md mt-2">
                        <TabsContent value="grades" className="space-y-4">
                            {gradeFields.map((field, index) => (
                                <div key={field.id} className="flex gap-4 items-end p-4 border rounded-md"><div className="grid grid-cols-3 gap-4 flex-grow">
                                    <FormField control={control} name={`grades.${index}.gradeName`} render={({ field }) => (<FormItem><FormLabel>Grade Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={control} name={`grades.${index}.minSalary`} render={({ field }) => (<FormItem><FormLabel>Min Salary</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={control} name={`grades.${index}.maxSalary`} render={({ field }) => (<FormItem><FormLabel>Max Salary</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                </div><Button type="button" variant="ghost" size="icon" onClick={() => removeGrade(index)}><Trash2 className="h-4 w-4"/></Button></div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={() => appendGrade({gradeName: '', minSalary: 0, maxSalary: 0})}><PlusCircle className="mr-2 h-4 w-4"/>Add Grade</Button>
                        </TabsContent>
                        <TabsContent value="allowances" className="space-y-4">
                            {allowanceFields.map((field, index) => (
                                <div key={field.id} className="flex gap-4 items-end p-4 border rounded-md"><div className="grid grid-cols-4 gap-4 flex-grow">
                                    <FormField control={control} name={`allowances.${index}.name`} render={({ field }) => (<FormItem><FormLabel>Allowance Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={control} name={`allowances.${index}.type`} render={({ field }) => (<FormItem><FormLabel>Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="Fixed">Fixed</SelectItem><SelectItem value="Percentage">Percentage</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                    <FormField control={control} name={`allowances.${index}.value`} render={({ field }) => (<FormItem><FormLabel>Value</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={control} name={`allowances.${index}.expenseAccountId`} render={({ field }) => (<FormItem><FormLabel>GL Account</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger></FormControl><SelectContent>{expenseAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.glCode} - {a.accountName}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                </div><Button type="button" variant="ghost" size="icon" onClick={() => removeAllowance(index)}><Trash2 className="h-4 w-4"/></Button></div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={() => appendAllowance({name: '', type: 'Fixed', value: 0, expenseAccountId: ''})}><PlusCircle className="mr-2 h-4 w-4"/>Add Allowance</Button>
                        </TabsContent>
                        <TabsContent value="deductions" className="space-y-4">
                             {deductionFields.map((field, index) => (
                                <div key={field.id} className="flex gap-4 items-end p-4 border rounded-md"><div className="grid grid-cols-4 gap-4 flex-grow">
                                    <FormField control={control} name={`deductions.${index}.name`} render={({ field }) => (<FormItem><FormLabel>Deduction Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={control} name={`deductions.${index}.type`} render={({ field }) => (<FormItem><FormLabel>Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="Fixed">Fixed</SelectItem><SelectItem value="Percentage">Percentage</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                    <FormField control={control} name={`deductions.${index}.value`} render={({ field }) => (<FormItem><FormLabel>Value</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={control} name={`deductions.${index}.liabilityAccountId`} render={({ field }) => (<FormItem><FormLabel>GL Account</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger></FormControl><SelectContent>{liabilityAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.glCode} - {a.accountName}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                </div><Button type="button" variant="ghost" size="icon" onClick={() => removeDeduction(index)}><Trash2 className="h-4 w-4"/></Button></div>
                            ))}
                            <Button type="button" variant="outline" size="sm" onClick={() => appendDeduction({name: '', type: 'Fixed', value: 0, liabilityAccountId: ''})}><PlusCircle className="mr-2 h-4 w-4"/>Add Deduction</Button>
                        </TabsContent>
                        </div>
                    </Tabs>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                        <Button type="submit" disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} {editingStructure ? 'Save Changes' : 'Create Structure'}</Button>
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
              This action cannot be undone. This will permanently delete the salary structure: <strong>{editingStructure?.name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={loading} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
