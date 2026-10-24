
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
  useFirebaseApp,
} from '@/firebase';
import { collection, doc, query, setDoc } from 'firebase/firestore';
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
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';


const platformAdminSchema = z.object({
  firstName: z.string().min(1, 'First name is required.'),
  lastName: z.string().min(1, 'Last name is required.'),
  email: z.string().email('A valid email is required.'),
  tempPassword: z.string().min(8, 'Password must be at least 8 characters.'),
});

const institutionStaffSchema = z.object({
  institutionId: z.string().min(1, 'Please select an institution.'),
  role: z.string().min(1, 'Please select a role.'),
  firstName: z.string().min(1, 'First name is required.'),
  lastName: z.string().min(1, 'Last name is required.'),
  email: z.string().email('Invalid email address.'),
  tempPassword: z.string().min(8, 'Password must be at least 8 characters.'),
  branchIds: z.array(z.string()).min(1, 'Please select at least one branch.'),
  employeeId: z.string().min(1, 'Employee ID is required.'),
  status: z.enum(['Active', 'Disabled']),
  appraisalLimit: z.coerce.number().min(0, 'Appraisal limit cannot be negative.'),
});

function AddNewUserContent() {
  const { user: currentUser } = useUser();
  const firestore = useFirestore();
  const app = useFirebaseApp();
  const router = useRouter();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('platform-admin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: institutions, isLoading: institutionsLoading } = useCollection(
    useMemoFirebase(() => (firestore ? collection(firestore, 'institutions') : null), [firestore])
  );

  const adminForm = useForm<z.infer<typeof platformAdminSchema>>({
    resolver: zodResolver(platformAdminSchema),
    defaultValues: { firstName: '', lastName: '', email: '', tempPassword: '' },
  });

  const staffForm = useForm<z.infer<typeof institutionStaffSchema>>({
    resolver: zodResolver(institutionStaffSchema),
    defaultValues: {
      institutionId: '',
      role: 'staff',
      firstName: '',
      lastName: '',
      email: '',
      tempPassword: '',
      branchIds: [],
      employeeId: '',
      status: 'Active',
      appraisalLimit: 0,
    },
  });
  
  const selectedInstitutionId = staffForm.watch('institutionId');

  const { data: selectedInstitutionData, isLoading: selectedInstitutionLoading } = useDoc(useMemoFirebase(() => (
      firestore && selectedInstitutionId ? doc(firestore, 'institutions', selectedInstitutionId) : null
  ), [firestore, selectedInstitutionId]));

  const rolesQuery = useMemoFirebase(
    () => (firestore && selectedInstitutionId ? collection(firestore, 'institutions', selectedInstitutionId, 'roles') : null),
    [firestore, selectedInstitutionId]
  );
  const { data: customRoles, isLoading: rolesLoading } = useCollection(rolesQuery);

  async function handleUserCreation(values: any, roleType: 'admin' | 'staff') {
    setLoading(true);
    setError(null);
    
    if (!app || !currentUser) {
      setError("Authentication services are not ready. Please try again.");
      setLoading(false);
      return;
    }

    try {
      await currentUser.getIdToken(true); // Force refresh the token to get latest claims
      const functions = getFunctions(app, 'us-central1');
      const createUser = httpsCallable(functions, 'createUser');

      let payload;
      if (roleType === 'admin') {
          payload = {
              email: values.email,
              password: values.tempPassword, // Ensure field name matches backend
              firstName: values.firstName,
              lastName: values.lastName,
              role: 'admin',
          };
      } else {
           let customRoleId = null;
           let customRoleName = null;
           let finalRole = 'staff';
           if (values.role === 'institution-admin') {
               finalRole = 'institution-admin';
           } else if (values.role !== 'staff') {
               const selectedCustomRole = customRoles?.find(r => r.id === values.role);
               if(selectedCustomRole) {
                   customRoleId = selectedCustomRole.id;
                   customRoleName = selectedCustomRole.name;
               }
           }
           payload = {
               ...values,
               password: values.tempPassword, // Ensure field name matches backend
               role: finalRole,
               customRoleId,
               customRoleName,
           };
      }
      
      await createUser(payload);
      
      const successMessage = `User ${values.firstName} ${values.lastName} created successfully.`;
      toast({ title: 'User Created', description: successMessage });
      
      if (roleType === 'admin') {
        adminForm.reset();
      } else {
        staffForm.reset();
      }
      router.push('/admin/users');

    } catch (e: any) {
      console.error('User creation failed:', e);
      const errorMessage = (e instanceof FunctionsError)
        ? e.message
        : (e.message || 'An unexpected error occurred during user creation.');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }


  const branches = useMemo(() => {
    if (!selectedInstitutionData) return [];
    
    const hqBranch = { 
        id: '01', 
        name: selectedInstitutionData.hqBranchName || 'Headquarters', 
        code: '01' 
    };

    const otherBranches = selectedInstitutionData.branches || [];

    return [hqBranch, ...otherBranches].sort((a, b) => a.code.localeCompare(b.code));
  }, [selectedInstitutionData]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add New User</CardTitle>
        <CardDescription>
          Choose the type of user you want to create.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
        
        <Tabs defaultValue="platform-admin" onValueChange={setActiveTab} className="mt-4">
          <TabsList>
            <TabsTrigger value="platform-admin">Platform Admin</TabsTrigger>
            <TabsTrigger value="institution-staff">Institution Staff</TabsTrigger>
          </TabsList>
          <TabsContent value="platform-admin">
            <Form {...adminForm}>
              <form onSubmit={adminForm.handleSubmit((values) => handleUserCreation(values, 'admin'))} className="space-y-6">
                <Card className="border-none shadow-none">
                  <CardHeader><CardDescription>Create an account with full platform administrative privileges.</CardDescription></CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={adminForm.control} name="firstName" render={({ field }) => ( <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={adminForm.control} name="lastName" render={({ field }) => ( <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={adminForm.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={adminForm.control} name="tempPassword" render={({ field }) => ( <FormItem><FormLabel>Temporary Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem> )} />
                  </CardContent>
                  <CardFooter className="justify-end">
                    <Button type="submit" disabled={loading}>
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Create Platform Admin
                    </Button>
                  </CardFooter>
                </Card>
              </form>
            </Form>
          </TabsContent>
          <TabsContent value="institution-staff">
             <Form {...staffForm}>
              <form onSubmit={staffForm.handleSubmit((values) => handleUserCreation(values, 'staff'))} className="space-y-6">
                 <Card className="border-none shadow-none">
                     <CardHeader><CardDescription>Create a staff or admin account for a specific institution.</CardDescription></CardHeader>
                      <CardContent className="space-y-4">
                        <FormField
                            control={staffForm.control}
                            name="institutionId"
                            render={({ field }) => (
                                <FormItem><FormLabel>Institution</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder={institutionsLoading ? "Loading..." : "Select an institution"} /></SelectTrigger></FormControl>
                                    <SelectContent>{institutions?.map(inst => (<SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>))}</SelectContent>
                                    </Select><FormMessage />
                                </FormItem>
                            )}
                        />
                        {selectedInstitutionId && (
                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <FormField control={staffForm.control} name="firstName" render={({ field }) => ( <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={staffForm.control} name="lastName" render={({ field }) => ( <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={staffForm.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={staffForm.control} name="tempPassword" render={({ field }) => ( <FormItem><FormLabel>Temporary Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={staffForm.control} name="employeeId" render={({ field }) => ( <FormItem><FormLabel>Employee ID</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={staffForm.control} name="role" render={({ field }) => (
                                    <FormItem><FormLabel>Role</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="staff">Staff (Base Permissions)</SelectItem>
                                                <SelectItem value="institution-admin">Institution Admin (Full Access)</SelectItem>
                                                {customRoles?.map(role => (<SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>))}
                                            </SelectContent>
                                        </Select><FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={staffForm.control} name="status" render={({ field }) => (
                                    <FormItem><FormLabel>Account Status</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Disabled">Disabled</SelectItem></SelectContent>
                                        </Select><FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={staffForm.control} name="appraisalLimit" render={({ field }) => (
                                    <FormItem><FormLabel>Loan Appraisal Limit (MWK)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField
                                    control={staffForm.control}
                                    name="branchIds"
                                    render={() => (
                                        <FormItem className="lg:col-span-3">
                                            <FormLabel>Branch Assignment</FormLabel>
                                            <div className="space-y-2 rounded-md border p-4 grid grid-cols-2 md:grid-cols-4">
                                                {branches.map((branch) => (
                                                <FormField
                                                    key={branch.id}
                                                    control={staffForm.control}
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
                                    )}
                                />
                             </div>
                        )}
                    </CardContent>
                     <CardFooter className="justify-end">
                        <Button type="submit" disabled={loading || !selectedInstitutionId}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Create Institution User
                        </Button>
                    </CardFooter>
                </Card>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default function AddNewUserPage() {
    const [isClient, setIsClient] = useState(false);
    useEffect(() => { setIsClient(true) }, [])
    return isClient ? <AddNewUserContent /> : null;
}
