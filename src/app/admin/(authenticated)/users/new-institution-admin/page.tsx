
'use client';

import React, { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useFirebaseApp,
} from '@/firebase';
import { collection } from 'firebase/firestore';
import { getFunctions, httpsCallable, FunctionsError } from 'firebase/functions';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Loader2,
  AlertCircle,
  Save,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';


const instAdminSchema = z.object({
  firstName: z.string().min(1, 'First name is required.'),
  lastName: z.string().min(1, 'Last name is required.'),
  email: z.string().email('A valid email address is required.'),
  phone: z.string().optional(),
  nationalId: z.string().optional(),
  institutionId: z.string().min(1, 'Please select an institution.'),
  status: z.enum(['Active', 'Suspended']),
  forcePasswordReset: z.boolean().default(true),
  tempPassword: z.string().min(8, 'Temporary password must be at least 8 characters.'),
});

export default function AddInstitutionAdminPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const { toast } = useToast();
  const app = useFirebaseApp();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const institutionsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'institutions') : null),
    [firestore]
  );
  const { data: institutions, isLoading: institutionsLoading } = useCollection(institutionsQuery);

  const form = useForm<z.infer<typeof instAdminSchema>>({
    resolver: zodResolver(instAdminSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      nationalId: '',
      institutionId: '',
      status: 'Active',
      forcePasswordReset: true,
      tempPassword: '',
    },
  });

  async function onSubmit(values: z.infer<typeof instAdminSchema>) {
    setLoading(true);
    setError(null);

    if (!currentUser || !app) {
        setError("Admin user not authenticated or app not available. Please log in again.");
        setLoading(false);
        return;
    }

    try {
        const functions = getFunctions(app, 'us-central1');
        const createUser = httpsCallable(functions, 'createUser');

        const payload = {
            ...values,
            role: 'institution-admin',
            password: values.tempPassword,
        };
      
        await createUser(payload);

      toast({
        title: "Institution Admin Created",
        description: `Successfully created an admin account for ${values.firstName} ${values.lastName}.`,
      });
      router.push('/admin/users');

    } catch (e: any) {
        console.error("Function call failed:", e);
        const errorMessage = e instanceof FunctionsError ? e.message : (e.message || 'An unexpected error occurred while creating the user.');
        setError(errorMessage);
    } finally {
        setLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Add Institution Admin</h1>
            <p className="text-muted-foreground mt-1">Create a new administrative account for an institution.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/admin/users"><ArrowLeft className="mr-2 h-4 w-4" /> Cancel</Link>
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Create Admin User
            </Button>
          </div>
        </div>

        {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

        <div className="grid grid-cols-1 gap-8 max-w-4xl mx-auto">
            <Card>
                <CardHeader><CardTitle>User Identity</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="lastName" render={({ field }) => (<FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone Number (Optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="nationalId" render={({ field }) => (<FormItem><FormLabel>National ID / Passport (Optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Institution Assignment</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="institutionId" render={({ field }) => (
                        <FormItem><FormLabel>Institution</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder={institutionsLoading ? 'Loading...' : 'Select an institution'} /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {institutions?.map(inst => (<SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>))}
                                </SelectContent>
                            </Select><FormMessage />
                        </FormItem>
                    )} />
                    <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Input value="Institution Admin" readOnly disabled />
                    </FormItem>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Access & Security</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <FormField control={form.control} name="status" render={({ field }) => (
                        <FormItem><FormLabel>Account Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                <SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Suspended">Suspended</SelectItem></SelectContent>
                            </Select><FormMessage />
                        </FormItem>
                    )}/>
                    <FormField control={form.control} name="tempPassword" render={({ field }) => (
                        <FormItem><FormLabel>Temporary Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                     <FormField
                        control={form.control}
                        name="forcePasswordReset"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 md:col-span-2">
                            <div className="space-y-0.5">
                                <FormLabel>Force Password Reset</FormLabel>
                                <FormDescription>
                                Require user to change their password on first login.
                                </FormDescription>
                            </div>
                            <FormControl>
                                <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                />
                            </FormControl>
                            </FormItem>
                        )}
                        />
                </CardContent>
            </Card>
        </div>
      </form>
    </Form>
  );
}
