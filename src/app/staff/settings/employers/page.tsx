

'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  useUser,
  useFirestore,
  useDoc,
  useCollection,
  useMemoFirebase,
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Building, PlusCircle, Loader2, AlertCircle, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const employerSchema = z.object({
  name: z.string().min(1, 'Employer name is required.'),
  employerIdNumber: z.string().optional(),
  address: z.string().optional(),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email({ message: "Invalid email address." }).optional().or(z.literal('')),
  tinNumber: z.string().optional(),
});

export default function EmployersPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedEmployer, setSelectedEmployer] = useState<any | null>(null);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);

  const employersQuery = useMemoFirebase(
    () => (firestore && userData?.institutionId ? collection(firestore, 'institutions', userData.institutionId, 'employers') : null),
    [firestore, userData]
  );
  const { data: employers, isLoading: isEmployersLoading } = useCollection(employersQuery);

  const form = useForm<z.infer<typeof employerSchema>>({
    resolver: zodResolver(employerSchema),
    defaultValues: {
      name: '',
      employerIdNumber: '',
      address: '',
      contactPerson: '',
      contactPhone: '',
      contactEmail: '',
      tinNumber: '',
    }
  });

  const handleCreateClick = () => {
    setSelectedEmployer(null);
    form.reset({ name: '', employerIdNumber: '', address: '', contactPerson: '', contactPhone: '', contactEmail: '', tinNumber: '' });
    setIsFormOpen(true);
  };

  const handleEditClick = (employer: any) => {
    setSelectedEmployer(employer);
    form.reset(employer);
    setIsFormOpen(true);
  };
  
  const handleDeleteClick = (employer: any) => {
    setSelectedEmployer(employer);
    setIsDeleteOpen(true);
  };

  async function onSubmit(values: z.infer<typeof employerSchema>) {
    if (!firestore || !userData?.institutionId) return;

    setLoading(true);
    setError(null);
    
    try {
        const employersRef = collection(firestore, 'institutions', userData.institutionId, 'employers');
        if (selectedEmployer) {
            // Update
            const employerDocRef = doc(employersRef, selectedEmployer.id);
            await updateDoc(employerDocRef, values);
            toast({ title: "Employer Updated", description: "The employer details have been saved." });
        } else {
            // Create
            const newDocRef = doc(employersRef);
            await setDoc(newDocRef, { ...values, id: newDocRef.id });
            toast({ title: "Employer Added", description: "The new employer has been added to the directory." });
        }
        setIsFormOpen(false);
    } catch (e) {
      console.error(e);
      setError('Failed to save employer details. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function onDeleteConfirm() {
    if (!firestore || !userData?.institutionId || !selectedEmployer) return;
    setLoading(true);
    try {
        const employerDocRef = doc(firestore, 'institutions', userData.institutionId, 'employers', selectedEmployer.id);
        await deleteDoc(employerDocRef);
        toast({ title: "Employer Deleted", description: "The employer has been removed from the directory." });
        setIsDeleteOpen(false);
    } catch(e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete employer.' });
    } finally {
        setLoading(false);
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Employer Directory</CardTitle>
              <CardDescription>
                A list of all employers registered with your institution.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employer Name</TableHead>
                    <TableHead>Employer ID</TableHead>
                    <TableHead>Contact Person</TableHead>
                    <TableHead>Contact Phone</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isEmployersLoading ? Array.from({length: 4}).map((_, i) => (
                      <TableRow key={i}>
                          <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                          <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                      </TableRow>
                  ))
                  : employers && employers.length > 0 ? (
                      employers.map((employer) => (
                          <TableRow key={employer.id}>
                              <TableCell className="font-medium">{employer.name}</TableCell>
                              <TableCell>{employer.employerIdNumber || 'N/A'}</TableCell>
                              <TableCell>{employer.contactPerson || 'N/A'}</TableCell>
                              <TableCell>{employer.contactPhone || 'N/A'}</TableCell>
                              <TableCell className="text-right">
                                 <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4"/></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuItem onClick={() => handleEditClick(employer)}><Pencil className="mr-2 h-4 w-4"/> Edit</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDeleteClick(employer)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4"/> Delete</DropdownMenuItem>
                                    </DropdownMenuContent>
                                 </DropdownMenu>
                              </TableCell>
                          </TableRow>
                      ))
                  ) : (
                    <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                            No employers found.
                        </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Add New Employer</CardTitle>
              <CardDescription>
                Add a new employer to the directory.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleCreateClick} className="w-full">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Employer
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

       <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogContent>
                 <DialogHeader>
                    <DialogTitle>{selectedEmployer ? 'Edit Employer' : 'Add New Employer'}</DialogTitle>
                </DialogHeader>
                 <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                        {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>{error}</AlertTitle></Alert>}
                        <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Employer Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="employerIdNumber" render={({ field }) => (<FormItem><FormLabel>Employer ID Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="tinNumber" render={({ field }) => (<FormItem><FormLabel>TIN Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="contactPerson" render={({ field }) => (<FormItem><FormLabel>Contact Person</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="contactPhone" render={({ field }) => (<FormItem><FormLabel>Contact Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="contactEmail" render={({ field }) => (<FormItem><FormLabel>Contact Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
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
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the employer: <strong>{selectedEmployer?.name}</strong>.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onDeleteConfirm} disabled={loading} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Yes, Delete Employer"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
  );
}
