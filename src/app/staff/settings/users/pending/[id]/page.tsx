'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
import { collection, doc, query, runTransaction, serverTimestamp } from 'firebase/firestore';
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
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  AlertCircle,
  ArrowLeft,
  UserCheck,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';

const activationSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required.'),
  branchIds: z.array(z.string()).min(1, 'Please select at least one branch.'),
  role: z.string().min(1, 'Role is required.'),
  appraisalLimit: z.coerce.number().min(0, 'Appraisal limit must be a positive number.'),
});

export default function ActivateUserPage() {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userDocRef = useMemoFirebase(
    () => (firestore && userId ? doc(firestore, 'users', userId) : null),
    [firestore, userId]
  );
  const { data: pendingUserData, isLoading: isUserLoading } = useDoc(userDocRef);

  const institutionId = pendingUserData?.institutionId;

  const { data: institutionData, isLoading: institutionLoading } = useDoc(
    useMemoFirebase(() => (firestore && institutionId ? doc(firestore, 'institutions', institutionId) : null), [firestore, institutionId])
  );

  const { data: customRoles, isLoading: rolesLoading } = useCollection(
    useMemoFirebase(() => (firestore && institutionId ? query(collection(firestore, 'institutions', institutionId, 'roles')) : null), [firestore, institutionId])
  );

  const form = useForm<z.infer<typeof activationSchema>>({
    resolver: zodResolver(activationSchema),
    defaultValues: {
      employeeId: '',
      branchIds: ['01'], // Default to HQ
      role: 'staff',
      appraisalLimit: 0,
    },
  });

  async function onSubmit(values: z.infer<typeof activationSchema>) {
    if (!firestore || !institutionId || !pendingUserData || !currentUser || !userDocRef) return;
    setLoading(true);
    setError(null);

    try {
        await runTransaction(firestore, async (transaction) => {
            const instRef = doc(firestore, 'institutions', institutionId);
            const instSnap = await transaction.get(instRef);
            if (!instSnap.exists()) throw new Error("Institution not found.");

            const employeeCounter = instSnap.data().employeeCounter || 0;
            const newEmployeeNumber = employeeCounter + 1;

            let customRoleId = null;
            let customRoleName = null;
            let finalRole = 'staff';

            if (values.role === 'institution-admin') {
                finalRole = 'institution-admin';
            } else if (values.role !== 'staff') {
                const selectedCustomRole = customRoles?.find(r => r.id === values.role);
                if (selectedCustomRole) {
                    customRoleId = selectedCustomRole.id;
                    customRoleName = selectedCustomRole.name;
                }
            }

            transaction.update(userDocRef, {
                status: 'Active',
                role: finalRole,
                customRoleId,
                customRoleName,
                employeeId: values.employeeId,
                employeeNumber: newEmployeeNumber,
                branchIds: values.branchIds,
                appraisalLimit: values.appraisalLimit,
                activatedAt: serverTimestamp(),
                activatedBy: currentUser.uid,
            });

            transaction.update(instRef, { employeeCounter: newEmployeeNumber });
        });
        
        toast({
          title: "User Activated",
          description: `${pendingUserData.name} is now an active staff member.`,
        });
        router.push('/staff/settings/users');

    } catch (e: any) {
        console.error(e);
        setError(e.message || 'An unexpected error occurred during activation.');
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
      return (
        <div className="max-w-4xl mx-auto space-y-6 p-8">
            <div className="flex items-center justify-between">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-48" />
                <div className="w-24"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-[500px] w-full md:col-span-2" />
            </div>
        </div>
      );
  }

  if (!pendingUserData) {
      return (
        <div className="p-8 text-center">
            <p>User not found or has already been activated.</p>
            <Button asChild variant="outline" className="mt-4">
                <Link href="/staff/settings/users">Back to User List</Link>
            </Button>
        </div>
      );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
            <Button variant="ghost" asChild>
                <Link href="/staff/settings/users"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Users</Link>
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Activate Staff User</h1>
            <div className="w-24"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-1 h-fit">
                <CardHeader className="items-center text-center">
                    <Avatar className="h-24 w-24 mb-4">
                        <AvatarImage src={pendingUserData.photoUrl} />
                        <AvatarFallback className="text-2xl">{pendingUserData.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <CardTitle>{pendingUserData.name}</CardTitle>
                    <CardDescription>{pendingUserData.email}</CardDescription>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                    <div className="flex justify-between"><span className="text-muted-foreground">Joined:</span> <span>{pendingUserData.createdAt ? format(pendingUserData.createdAt.toDate(), 'PPP') : 'N/A'}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Institution:</span> <span>{institutionData?.name}</span></div>
                </CardContent>
            </Card>

            <Card className="md:col-span-2">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <CardHeader>
                            <CardTitle>Assignment & Roles</CardTitle>
                            <CardDescription>Assign the employee ID, role, and branch permissions.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="employeeId" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Institution Employee ID</FormLabel>
                                        <FormControl><Input placeholder="e.g., EMP-101" {...field} /></FormControl>
                                        <FormDescription>Your institution's internal ID for this person.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="role" render={({ field }) => (
                                    <FormItem><FormLabel>Access Role</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                              <SelectTrigger><SelectValue /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="staff">Staff (Base Permissions)</SelectItem>
                                                <SelectItem value="institution-admin">Institution Admin (Full Access)</SelectItem>
                                                {customRoles?.map(role => (<SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>))}
                                            </SelectContent>
                                        </Select>
                                        <FormDescription>Determines which modules they can access.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            </div>

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
                                        <FormDescription>Which branches can this staff member work in?</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField control={form.control} name="appraisalLimit" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Loan Appraisal Limit (MWK)</FormLabel>
                                    <FormControl><Input type="number" {...field} /></FormControl>
                                    <FormDescription>The maximum loan amount this user is authorized to recommend for approval.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </CardContent>
                        <CardFooter className="justify-end bg-muted/30 pt-6">
                            <Button type="submit" disabled={loading} size="lg">
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
                                Activate Account
                            </Button>
                        </CardFooter>
                    </form>
                </Form>
            </Card>
        </div>
    </div>
  );
}
