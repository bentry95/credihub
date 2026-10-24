'use client';

import React, { useState, useMemo } from 'react';
import {
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, doc, query, where, deleteDoc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from '@/firebase/config';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, Check, X, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const approvalSchema = z.object({
    institutionId: z.string().min(1, "Please select an institution."),
    branchIds: z.array(z.string()).min(1, "Select at least one branch."),
    appraisalLimit: z.coerce.number().min(0, "Limit must be a positive number."),
});

export default function SignupRequestsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pendingUsersQuery = useMemoFirebase(
    () => firestore ? query(collection(firestore, 'pendingUsers'), where('status', '==', 'pending')) : null,
    [firestore]
  );
  const { data: pendingUsers, isLoading: pendingUsersLoading } = useCollection(pendingUsersQuery);

  const institutionsQuery = useMemoFirebase(
    () => firestore ? collection(firestore, 'institutions') : null,
    [firestore]
  );
  const { data: institutions, isLoading: institutionsLoading } = useCollection(institutionsQuery);

  const form = useForm<z.infer<typeof approvalSchema>>({
    resolver: zodResolver(approvalSchema),
    defaultValues: {
        branchIds: [],
        appraisalLimit: 0,
    }
  });

  const selectedInstitutionId = form.watch('institutionId');
  const selectedInstitution = institutions?.find(i => i.id === selectedInstitutionId);

  const handleApproveClick = (user: any) => {
    setSelectedUser(user);
    setIsApproveDialogOpen(true);
    setError(null);
    form.reset();
  };

  async function handleApproveSubmit(values: z.infer<typeof approvalSchema>) {
    if (!firestore || !selectedUser) return;
    setLoading(true);
    setError(null);
    
    let secondaryApp;

    try {
        secondaryApp = initializeApp(firebaseConfig, `RequestApproval-${Date.now()}`);
        const secondaryAuth = getAuth(secondaryApp);
        
        // 1. Create the Auth user
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, selectedUser.email, selectedUser.password);
        const newUid = userCredential.user.uid;

        // 2. Create the User profile in Firestore
        const userDocRef = doc(firestore, 'users', newUid);
        const userProfile = {
            uid: newUid,
            email: selectedUser.email,
            firstName: selectedUser.firstName,
            lastName: selectedUser.lastName,
            name: selectedUser.name,
            role: 'staff',
            institutionId: values.institutionId,
            branchIds: values.branchIds,
            appraisalLimit: values.appraisalLimit,
            status: 'Active',
            createdAt: serverTimestamp(),
        };

        await setDoc(userDocRef, userProfile);

        // 3. Delete the pending request
        const pendingUserDocRef = doc(firestore, 'pendingUsers', selectedUser.id);
        await deleteDoc(pendingUserDocRef);

        toast({ title: 'User Approved', description: `${selectedUser.name} has been granted access.` });
        setIsApproveDialogOpen(false);
        setSelectedUser(null);
    } catch(e: any) {
        console.error(e);
        setError(e.message || "An unexpected error occurred. Please try again.");
    } finally {
        if (secondaryApp) {
            await deleteApp(secondaryApp);
        }
        setLoading(false);
    }
  }

  const handleDeny = async (user: any) => {
      if (!firestore) return;
      const pendingUserDocRef = doc(firestore, 'pendingUsers', user.id);
      await deleteDoc(pendingUserDocRef);
      toast({ title: 'Request Denied', description: `${user.name}'s access request has been denied.` });
  };
  
  const allBranches = useMemo(() => {
    if (!selectedInstitution) return [];
    const hq = { id: '01', name: selectedInstitution.hqBranch?.name || 'Headquarters' };
    return [hq, ...(selectedInstitution.branches || [])];
  }, [selectedInstitution]);

  const isLoading = pendingUsersLoading || institutionsLoading;

  return (
    <>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Signup Requests</h1>
        <Card>
          <CardHeader>
            <CardTitle>Pending Approvals</CardTitle>
            <CardDescription>
              Review and approve or deny requests for access from new users.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Date Requested</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell className="text-right space-x-2">
                        <Skeleton className="h-9 w-9 inline-block" />
                        <Skeleton className="h-9 w-24 inline-block" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : pendingUsers && pendingUsers.length > 0 ? (
                  pendingUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.createdAt ? format(user.createdAt.toDate(), 'PPP') : 'N/A'}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="destructive" size="icon" onClick={() => handleDeny(user)}><X className="h-4 w-4" /></Button>
                        <Button onClick={() => handleApproveClick(user)}><Check className="mr-2 h-4 w-4" />Approve</Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      No pending signup requests.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

       <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Approve User: {selectedUser?.name}</DialogTitle>
            <DialogDescription>Assign the user to an institution and set initial permissions.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleApproveSubmit)} className="space-y-4">
              {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="institutionId" render={({ field }) => (
                    <FormItem><FormLabel>Institution</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Select an institution" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {institutions?.map(inst => (<SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )} />
                 <FormField control={form.control} name="appraisalLimit" render={({ field }) => (<FormItem><FormLabel>Loan Appraisal Limit</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
               <FormField control={form.control} name="branchIds" render={({ field }) => (
                <FormItem>
                    <FormLabel>Branch Assignment</FormLabel>
                    <div className="space-y-2 rounded-md border p-4 max-h-48 overflow-y-auto grid grid-cols-2">
                        {allBranches.map(branch => (
                             <FormField
                                key={branch.id}
                                control={form.control}
                                name="branchIds"
                                render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                    <FormControl>
                                    <Checkbox
                                        checked={field.value?.includes(branch.id)}
                                        onCheckedChange={(checked) => {
                                        return checked
                                            ? field.onChange([...(field.value || []), branch.id])
                                            : field.onChange(field.value?.filter((value) => value !== branch.id));
                                        }}
                                    />
                                    </FormControl>
                                    <FormLabel className="font-normal">{branch.name}</FormLabel>
                                </FormItem>
                                )}
                            />
                        ))}
                    </div>
                    <FormMessage />
                </FormItem>
               )} />
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                <Button type="submit" disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                  Approve and Create User
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
