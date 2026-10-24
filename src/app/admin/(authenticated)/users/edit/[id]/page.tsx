
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  useUser,
  useFirestore,
  useDoc,
  useMemoFirebase,
  useCollection,
} from '@/firebase';
import { collection, doc, query, updateDoc, serverTimestamp } from 'firebase/firestore';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  AlertCircle,
  Save,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

const staffUserSchema = z.object({
  firstName: z.string().min(1, 'First name is required.'),
  lastName: z.string().min(1, 'Last name is required.'),
  email: z.string().email('A valid email is required.'),
  role: z.string().min(1, 'Please select a role.'),
  institutionId: z.string().optional(),
  branchIds: z.array(z.string()).min(1, 'Please select at least one branch.'),
  status: z.enum(['Active', 'Disabled']),
  appraisalLimit: z.coerce.number().min(0, 'Appraisal limit cannot be negative.'),
  employeeId: z.string().optional(),
});

function EditUserPageContent() {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: userData, isLoading: isUserLoading } = useDoc(
    useMemoFirebase(() => (firestore && userId ? doc(firestore, 'users', userId) : null), [firestore, userId])
  );

  const { data: institutions, isLoading: institutionsLoading } = useCollection(
    useMemoFirebase(() => (firestore ? collection(firestore, 'institutions') : null), [firestore])
  );
  
  const form = useForm<z.infer<typeof staffUserSchema>>({
    resolver: zodResolver(staffUserSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      role: '',
      institutionId: 'platform-wide',
      branchIds: [],
      status: 'Active',
      appraisalLimit: 0,
      employeeId: '',
    },
  });

  const selectedInstitutionId = form.watch('institutionId');
  const selectedRole = form.watch('role');

  const { data: selectedInstitutionData, isLoading: selectedInstitutionLoading } = useDoc(useMemoFirebase(() => (
      firestore && selectedInstitutionId ? doc(firestore, 'institutions', selectedInstitutionId) : null
  ), [firestore, selectedInstitutionId]));

  const rolesQuery = useMemoFirebase(
    () => (firestore && selectedInstitutionId ? collection(firestore, 'institutions', selectedInstitutionId, 'roles') : null),
    [firestore, selectedInstitutionId]
  );
  const { data: customRoles, isLoading: rolesLoading } = useCollection(rolesQuery);

  useEffect(() => {
    if (userData) {
      const roleValue = userData.role === 'institution-admin' ? 'institution-admin' : (userData.customRoleId || userData.role || 'staff');
      form.reset({
        ...userData,
        branchIds: userData.branchIds || [],
        role: roleValue,
        employeeId: userData.employeeId || '',
        institutionId: userData.institutionId || 'platform-wide',
      });
    }
  }, [userData, form]);


  async function onSubmit(values: z.infer<typeof staffUserSchema>) {
    if (!firestore || !userData) return;
    setLoading(true);
    setError(null);

    try {
      let customRoleId = null;
      let customRoleName = null;
      let finalRole = 'staff';
      
      if (values.role === 'admin' || values.role === 'institution-admin') {
          finalRole = values.role;
      } else {
           const selectedCustomRole = customRoles?.find(r => r.id === values.role);
           if(selectedCustomRole) {
               customRoleId = selectedCustomRole.id;
               customRoleName = selectedCustomRole.name;
           }
      }
      
      const userDocRef = doc(firestore, 'users', userData.uid);
      const updateData = {
          ...values,
          institutionId: values.institutionId === 'platform-wide' ? null : values.institutionId,
          role: finalRole,
          customRoleId,
          customRoleName,
          updatedAt: serverTimestamp(),
      };
      
      await updateDoc(userDocRef, updateData);

      toast({ title: 'User Updated', description: `User ${values.firstName} ${values.lastName} has been updated successfully.` });
      router.push('/admin/users');

    } catch (e: any) {
      console.error('User update failed:', e);
      setError(e.message || 'An unexpected error occurred during user update.');
    } finally {
      setLoading(false);
    }
  }


  const branches = useMemo(() => {
    if (!selectedInstitutionData) return [];
    
    const hqBranch = { 
        id: '01', 
        name: selectedInstitutionData.hqBranch?.name || 'Headquarters', 
        code: '01' 
    };

    const otherBranches = selectedInstitutionData.branches || [];

    return [hqBranch, ...otherBranches].sort((a, b) => a.code.localeCompare(b.code));
  }, [selectedInstitutionData]);

  const isLoading = isUserLoading || institutionsLoading || selectedInstitutionLoading || rolesLoading;
  
  if (isLoading) {
    return (
        <div className="space-y-6">
            <Skeleton className="h-10 w-1/4" />
            <Skeleton className="h-96 w-full" />
        </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Edit User</h1>
            <p className="text-muted-foreground mt-1">Editing profile for {userData?.name}.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/admin/users"><ArrowLeft className="mr-2 h-4 w-4" /> Cancel</Link>
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Changes
            </Button>
          </div>
        </div>

        {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

        <Card>
            <CardHeader><CardTitle>User Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="firstName" render={({ field }) => ( <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="lastName" render={({ field }) => ( <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} disabled /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="employeeId" render={({ field }) => ( <FormItem><FormLabel>Employee ID</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                 </div>
                 <FormField control={form.control} name="institutionId" render={({ field }) => (
                    <FormItem><FormLabel>Institution</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select an institution..." /></SelectTrigger></FormControl>
                        <SelectContent>
                            <SelectItem value="platform-wide">Platform-wide (Admin)</SelectItem>
                            {institutions?.map(inst => (<SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>))}
                        </SelectContent>
                        </Select><FormMessage />
                    </FormItem>
                )} />

                {selectedInstitutionId && selectedInstitutionId !== 'platform-wide' && (
                     <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <FormField control={form.control} name="role" render={({ field }) => (
                                <FormItem><FormLabel>Role</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="staff">Staff (Base Permissions)</SelectItem>
                                            <SelectItem value="institution-admin">Institution Admin (Full Access)</SelectItem>
                                            {customRoles?.map(role => (<SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>))}
                                        </SelectContent>
                                    </Select><FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="status" render={({ field }) => (
                                <FormItem><FormLabel>Account Status</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Disabled">Disabled</SelectItem></SelectContent>
                                    </Select><FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="appraisalLimit" render={({ field }) => (
                                <FormItem><FormLabel>Loan Appraisal Limit (MWK)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                        {selectedRole !== 'institution-admin' && (
                            <FormField
                                control={form.control}
                                name="branchIds"
                                render={() => (
                                    <FormItem>
                                        <FormLabel>Branch Assignment</FormLabel>
                                        <div className="space-y-2 rounded-md border p-4 grid grid-cols-2 md:grid-cols-4">
                                            {branches.map((branch) => (
                                            <FormField
                                                key={branch.id}
                                                control={form.control}
                                                name="branchIds"
                                                render={({ field }) => (
                                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                                    <FormControl>
                                                    <Checkbox
                                                        checked={Array.isArray(field.value) && field.value.includes(branch.id)}
                                                        onCheckedChange={(checked) => {
                                                            const currentValue = Array.isArray(field.value) ? field.value : [];
                                                            return checked
                                                                ? field.onChange([...currentValue, branch.id])
                                                                : field.onChange(currentValue.filter((value) => value !== branch.id));
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
                                )}
                            />
                        )}
                     </div>
                )}
            </CardContent>
        </Card>
      </form>
    </Form>
  );
}


export default function EditUserPage() {
    return <EditUserPageContent />
}
