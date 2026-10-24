

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
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  collection,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Building, PlusCircle, Loader2, AlertCircle, Home, Hash, MapPin, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


const malawiDistricts = [
    "Balaka", "Blantyre", "Chikwawa", "Chiradzulu", "Chitipa",
    "Dedza", "Dowa", "Karonga", "Kasungu", "Likoma",
    "Lilongwe", "Machinga", "Mangochi", "Mchinji", "Mulanje",
    "Mwanza", "Mzimba", "Neno", "Nkhata Bay", "Nkhotakota",
    "Nsanje", "Ntcheu", "Ntchisi", "Phalombe", "Rumphi",
    "Salima", "Thyolo", "Zomba"
];

const branchSchema = z.object({
  name: z.string().min(1, 'Branch name is required.'),
  code: z.string().length(2, 'Branch code must be 2 digits.'),
  location: z.string().min(1, 'Location is required.'),
});

export default function BranchesPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<any | null>(null);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);

  const institutionDocRef = useMemoFirebase(
    () => (firestore && userData?.institutionId ? doc(firestore, 'institutions', userData.institutionId) : null),
    [firestore, userData]
  );
  const { data: institutionData, isLoading: isInstitutionLoading } = useDoc(institutionDocRef);
  
  const usersQuery = useMemoFirebase(
    () => (firestore && userData?.institutionId ? collection(firestore, 'users') : null),
    [firestore, userData]
  );
  const { data: users, isLoading: isUsersLoading } = useCollection(usersQuery);
  
  const allBranches = useMemo(() => {
    if (!institutionData) return [];
    
    const hqBranch = { 
      id: '01', 
      name: institutionData.hqBranch?.name || 'Headquarters', 
      code: '01', 
      location: institutionData.hqBranch?.location || institutionData.location 
    };

    const otherBranches = institutionData.branches || [];

    return [hqBranch, ...otherBranches].sort((a,b) => a.code.localeCompare(b.code));
  }, [institutionData]);

  const usedBranchCodes = useMemo(() => {
      if (!users) return new Set();
      return new Set(users.flatMap(u => u.branchIds || []));
  }, [users]);


  const form = useForm<z.infer<typeof branchSchema>>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      name: '',
      code: '',
      location: '',
    }
  });

  const editForm = useForm<z.infer<typeof branchSchema>>({
    resolver: zodResolver(branchSchema)
  });
  
  const handleEditClick = (branch: any) => {
    setSelectedBranch(branch);
    editForm.reset(branch);
    setIsEditOpen(true);
  }
  
  const handleDeleteClick = (branch: any) => {
    setSelectedBranch(branch);
    setIsDeleteOpen(true);
  }

  async function onAddSubmit(values: z.infer<typeof branchSchema>) {
    if (!firestore || !userData?.institutionId || !allBranches || !institutionDocRef) return;

    setLoading(true);
    setError(null);
    
    if (allBranches.some(branch => branch.code === values.code)) {
        setError('This branch code is already in use. Please choose a unique 2-digit code.');
        setLoading(false);
        return;
    }
    
    const newBranch = { ...values, id: values.code };

    try {
      await updateDoc(institutionDocRef, {
        branches: arrayUnion(newBranch)
      });
      form.reset();
      toast({ title: "Success", description: "New branch has been added."});
    } catch (e) {
      console.error(e);
      setError('Failed to add branch. Please try again.');
    } finally {
      setLoading(false);
    }
  }
  
  async function onEditSubmit(values: z.infer<typeof branchSchema>) {
    if (!firestore || !userData?.institutionId || !selectedBranch || !institutionDocRef) return;
    setLoading(true);
    try {
        const otherBranches = institutionData?.branches || [];
        const updatedBranches = otherBranches.map((b: any) => b.code === selectedBranch.code ? { ...b, name: values.name, location: values.location } : b);
        await updateDoc(institutionDocRef, { branches: updatedBranches });
        setIsEditOpen(false);
        toast({ title: "Branch Updated", description: `Branch ${values.name} has been updated.`});
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  }

  async function onDeleteConfirm() {
    if (!firestore || !userData?.institutionId || !selectedBranch || !institutionDocRef) return;
    setLoading(true);
    try {
        await updateDoc(institutionDocRef, {
            branches: arrayRemove(selectedBranch)
        });
        setIsDeleteOpen(false);
        toast({ title: "Branch Deleted", description: `Branch ${selectedBranch.name} has been deleted.`});
    } catch(e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  }
  
  const isLoading = isInstitutionLoading || isUsersLoading;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Registered Branches</CardTitle>
              <CardDescription>
                A list of all branches for your institution.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Branch Name</TableHead>
                    <TableHead>Branch Code</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                          <TableRow key={i}>
                              <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                              <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                              <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                              <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                              <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                          </TableRow>
                      ))
                  ) : (
                      allBranches.map((branch) => (
                          <TableRow key={branch.id}>
                              <TableCell className="font-medium">{branch.name}</TableCell>
                              <TableCell>{branch.code}</TableCell>
                              <TableCell>{branch.location}</TableCell>
                              <TableCell>
                                  {branch.code === '01' && <Badge>Headquarters</Badge>}
                              </TableCell>
                              <TableCell className="text-right">
                                  {branch.code !== '01' && (
                                    <TooltipProvider>
                                     <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5"/></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuItem onClick={() => handleEditClick(branch)}><Pencil className="mr-2 h-4 w-4"/> Edit</DropdownMenuItem>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="w-full">
                                                        <DropdownMenuItem
                                                            onClick={() => handleDeleteClick(branch)}
                                                            disabled={usedBranchCodes.has(branch.code)}
                                                            className="text-destructive w-full"
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4"/> Delete
                                                        </DropdownMenuItem>
                                                    </div>
                                                </TooltipTrigger>
                                                {usedBranchCodes.has(branch.code) && (
                                                    <TooltipContent side="left">
                                                        <p>Cannot delete a branch that is assigned to users.</p>
                                                    </TooltipContent>
                                                )}
                                            </Tooltip>
                                        </DropdownMenuContent>
                                     </DropdownMenu>
                                    </TooltipProvider>
                                  )}
                              </TableCell>
                          </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Add New Branch</CardTitle>
              <CardDescription>
                Register a new branch for your institution.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onAddSubmit)} className="space-y-6">
                  {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
                  <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Branch Name</FormLabel><FormControl><div className="relative"><Building className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input placeholder="e.g., Blantyre Branch" {...field} className="pl-10"/></div></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="code" render={({ field }) => (<FormItem><FormLabel>Branch Code</FormLabel><FormControl><div className="relative"><Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input placeholder="e.g., 02" maxLength={2} {...field} className="pl-10"/></div></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="location" render={({ field }) => (<FormItem><FormLabel>Location</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a district" /></SelectTrigger></FormControl><SelectContent>{malawiDistricts.map(district => (<SelectItem key={district} value={district}>{district}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                    Add Branch
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>

       <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogContent>
                 <DialogHeader>
                    <DialogTitle>Edit Branch</DialogTitle>
                    <DialogDescription>Modify the details for the {selectedBranch?.name} branch.</DialogDescription>
                </DialogHeader>
                 <Form {...editForm}>
                    <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-6">
                        <FormField control={editForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Branch Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={editForm.control} name="code" render={({ field }) => (<FormItem><FormLabel>Branch Code</FormLabel><FormControl><Input {...field} disabled /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={editForm.control} name="location" render={({ field }) => (<FormItem><FormLabel>Location</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{malawiDistricts.map(d => (<SelectItem key={d} value={d}>{d}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                         <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                            <Button type="submit" disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Save Changes
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
                        This action cannot be undone. This will permanently delete the <strong>{selectedBranch?.name}</strong> branch.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onDeleteConfirm} disabled={loading} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Yes, Delete Branch"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </>
  );
}
