

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { Mail, Lock, Loader2, AlertCircle, User as UserIcon } from 'lucide-react';
import { getFunctions, httpsCallable, FunctionsError } from 'firebase/functions';

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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SaileLogo } from '@/components/saile-logo';
import { useToast } from '@/hooks/use-toast';
import { useFirebaseApp } from '@/firebase';

const formSchema = z.object({
  firstName: z.string().min(1, { message: "First name is required." }),
  lastName: z.string().min(1, { message: "Last name is required." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

export default function SignupPage() {
  const router = useRouter();
  const app = useFirebaseApp();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    setError(null);
    try {
        if (!app) {
            throw new Error("Firebase app not available.");
        }
        const functions = getFunctions(app, 'us-central1');
        const requestInstitutionalAccess = httpsCallable(functions, 'requestInstitutionalAccess');
        
        await requestInstitutionalAccess(values);

        setSuccess(true);

    } catch (e: any) {
        if (e instanceof FunctionsError) {
             setError(e.message || "An unexpected error occurred. Please try again.");
        } else {
             setError("An unexpected error occurred. Please try again.");
        }
        console.error(e);
    } finally {
        setLoading(false);
    }
  }

  if (success) {
      return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 font-body">
             <div className="w-full max-w-lg space-y-8">
                <SaileLogo />
                <Card>
                    <CardHeader>
                        <CardTitle>Request Submitted</CardTitle>
                        <CardDescription>Your signup request has been sent for approval.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">You will receive an email notification once the platform administrator has reviewed your request. You may now close this page.</p>
                        <Button asChild className="mt-6 w-full"><Link href="/">Back to Login</Link></Button>
                    </CardContent>
                </Card>
             </div>
        </main>
      )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 font-body">
      <div className="w-full max-w-lg space-y-8">
        <SaileLogo />
        <Card className="shadow-xl rounded-2xl">
          <CardHeader className="items-center text-center">
            <CardTitle className="text-2xl font-bold tracking-tight">
              Create an Account
            </CardTitle>
            <CardDescription>
              Request access to join an institution on the platform.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-8">
             <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Signup Failed</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>First Name</FormLabel>
                            <FormControl>
                                <Input placeholder="John" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Last Name</FormLabel>
                            <FormControl>
                                <Input placeholder="Doe" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                        <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                          <Input placeholder="admin@example.com" {...field} className="pl-10 h-12"/>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                          <Input type="password" placeholder="••••••••" {...field} className="pl-10 h-12"/>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading ? 'Submitting Request...' : 'Request Access'}
                </Button>

                <div className="text-center text-sm">
                    Already have an account?{' '}
                    <Link href="/" className="font-medium text-primary hover:underline">
                        Sign In
                    </Link>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
