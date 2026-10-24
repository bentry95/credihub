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
  useFirebaseApp,
} from '@/firebase';
import {
  collection,
  doc,
  updateDoc,
  query,
  where,
  getDocs,
  limit,
} from 'firebase/firestore';
import { getFunctions, httpsCallable, FunctionsError } from 'firebase/functions';
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
  FormDescription,
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
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  AlertCircle,
  Save,
  ArrowLeft,
  User as UserIcon,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

const staffUserSchema = z.object({
  firstName: z.string().min(1, 'First name is required.'),
  lastName: z.string().min(1, 'Last name is required.'),
  email: z.string().email('A valid email is required.'),
  phone: z.string().optional(),
  employeeId: z.string().optional(),
  branchIds: z.array(z.string()).min(1, 'Please select at least one branch.'),
  role: z.string().min(1, 'Role is required.'),
  status: z.enum(['Active', 'Disabled']),
  appraisalLimit: z.coerce.number().min(0, 'Appraisal limit must be a positive number.'),
});

export default function EditStaffUserPage() {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();
  const app = useFirebaseApp();
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string; // This is the user's UID
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Directly fetch the user document by UID
  const userDocRef = useMemoFirebase(
    () => (firestore && userId ? doc(firestore, 'users', userId) : null),
    [firestore, userId]
  );
  const { data: userData, isLoading: isUserLoading } = useDoc(userDocRef);

  const institutionId = userData?.institutionId;

  const institutionDocRef = useMemoFirebase(
    () => (firestore && institutionId ? doc(firestore, 'institutions', institutionId) : null),
    [firestore, institutionId]
  );
  const { data: institutionData, isLoading: institutionLoading } = useDoc(institutionDocRef);

  const rolesQuery = useMemoFirebase(
    () => (firestore && institutionId ? query(collection(firestore, 'institutions', institutionId, 'roles')) : null),
    [firestore, institutionId]
  );
  const { data: customRoles, isLoading: rolesLoading } = useCollection(rolesQuery);

  const form = useForm<z.infer<typeof staffUserSchema>>({
    resolver: zodResolver(staffUserSchema),
  });

  useEffect(() => {
    if (userData) {
      const roleValue = userData.role === 'institution-admin' ? 'institution-admin' : userData.customRoleId || 'staff';
      form.reset({
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        email: userData.email || '',
        phone: userData.phone || '',
        employeeId: userData.employeeId || '',
        branchIds: userData.branchIds || [],
        role: roleValue,
        status: (userData.status as any) || 'Active',
        appraisalLimit: userData.appraisalLimit || 0,
      });
    }
  }, [userData, form]);

  async function onSubmit(values: z.infer<typeof staffUserSchema>) {
    if (!app || !institutionId || !userData) return;
    setLoading(true);
    setError(null);

    try {
        const functions = getFunctions(app, 'us-central1');
        const updateUser = httpsCallable(functions, 'updateUser');

        let role = 'staff';
        let customRoleId = null;
        let customRoleName = null;

        if (values.role === 'institution-admin') {
            role = 'institution-admin';
        } else if (values.role !== 'staff') {
            const selectedCustomRole = customRoles?.find(r => r.id === values.role);
            if (selectedCustomRole) {
                customRoleId = selectedCustomRole.id;
                customRoleName = selectedCustomRole.name;
            }
        }

        const userPayload = {
            uid: userData.uid,
            ...values,
            role,
            customRoleId,
            customRoleName,
        };
        
        await updateUser(userPayload);

        toast({
            title: "User Updated",
            description: `Staff account for ${values.firstName} ${values.lastName} has been updated successfully.`
        });
        router.push('/staff/settings/users');

    } catch (e: any) {
        console.error(e);
        const errorMessage = (e instanceof FunctionsError) 
            ? e.message 
            : (e.message || 'An unexpected error occurred while updating the user.');
        setError(errorMessage);
    } finally {
        setLoading(false);
    }
  }

  const allBranches = useMemo(() => {
    if (!institutionData) return [];
    const hqBranch = { id: '01', name: institutionData.hqBranch?.name || 'Headquarters', code: '01' };
    const otherBranches = institutionData.branches || [];
    return [hqBranch, ...otherBranches].sort((a,b) => a.code.localeCompare(b.code));
  }, [institutionData]);

  const isLoading = isUserLoading || institutionLoading || rolesLoading;

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-12 w-1/4" /><Skeleton className="h-96 w-full" /></div>
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Edit Staff User</h1>
            <p className="text-muted-foreground mt-1">Update profile and permissions for {userData?.name}.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/staff/settings/users"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Users</Link>
            </Button>
            <Button type="submit" disabled={loading || !form.formState.isDirty}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Changes
            </Button>
          </div>
        </div>

        {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="lastName" render={({ field }) => (<FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" {...field} readOnly disabled /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="employeeId" render={({ field }) => (<FormItem><FormLabel>Custom Employee ID</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Access & Role</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                    control={form.control}
                    name="branchIds"
                    render={() => (
                        <FormItem>
                            <FormLabel>Branch Assignment</FormLabel>
                            <div className="space-y-2 rounded-md border p-4 max-h-48 overflow-y-auto">
                                {allBranches.map((branch) => (
                                <FormField
                                    key={branch.id}
                                    control={form.control}
                                    name="branchIds"
                                    render={({ field }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                        <FormControl>
                                        <Checkbox
                                            checked={field.value?.includes(branch.code)}
                                            onCheckedChange={(checked) => {
                                            return checked
                                                ? field.onChange([...(field.value || []), branch.code])
                                                : field.onChange(field.value?.filter((value) => value !== branch.code));
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
                <div className='space-y-6'>
                 <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>User Role</FormLabel>
                             <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="staff">Staff (Base Permissions)</SelectItem>
                                    <SelectItem value="institution-admin">Institution Admin (Full Access)</SelectItem>
                                    {customRoles?.map(role => (
                                        <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormDescription>Assign a custom or system role.</FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Account Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="Active">Active</SelectItem>
                                    <SelectItem value="Disabled">Disabled</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Financial Permissions</CardTitle></CardHeader>
              <CardContent>
                <FormField control={form.control} name="appraisalLimit" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Appraisal Limit (MWK)</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormDescription>Max loan amount recommendation power.</FormDescription>
                        <FormMessage />
                    </FormItem>
                )} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Profile Photo</CardTitle></CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                 <Avatar className="h-32 w-32">
                    <AvatarImage src={userData?.photoUrl || ''} />
                    <AvatarFallback><UserIcon className="h-16 w-16" /></AvatarFallback>
                 </Avatar>
                 <Button type="button" variant="outline" className="w-full"><Upload className="mr-2 h-4 w-4"/> Change Photo</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </Form>
  );
}
