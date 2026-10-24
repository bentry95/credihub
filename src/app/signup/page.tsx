
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { Mail, Lock, Loader2, AlertCircle, KeyRound, User as UserIcon, Building } from 'lucide-react';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp, updateDoc, collectionGroup, limit, getDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';

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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SaileLogo } from '@/components/saile-logo';
import { FirebaseClientProvider, useFirebaseApp, useFirestore, useAuth } from '@/firebase';

const codeSchema = z.object({
  code: z.string().min(1, "Invitation code is required."),
});

const infoSchema = z.object({
  firstName: z.string().min(1, "First name is required."),
  lastName: z.string().min(1, "Last name is required."),
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

function SignupPageContent() {
  const router = useRouter();
  const firestore = useFirestore();
  const auth = useAuth();
  
  const [step, setStep] = useState(1); // 1: Enter Code, 2: Enter Info
  const [institution, setInstitution] = useState<{ id: string, name: string } | null>(null);
  const [codeDoc, setCodeDoc] = useState<any>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const codeForm = useForm<z.infer<typeof codeSchema>>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "" },
  });

  const infoForm = useForm<z.infer<typeof infoSchema>>({
    resolver: zodResolver(infoSchema),
    defaultValues: { firstName: "", lastName: "", email: "", password: "" },
  });

  async function onCodeSubmit(values: z.infer<typeof codeSchema>) {
    if (!firestore) return;
    setLoading(true);
    setError(null);
    try {
        const q = query(
            collectionGroup(firestore, 'invitationCodes'),
            where('code', '==', values.code.toUpperCase()),
            where('status', '==', 'Active'),
            limit(1)
        );
        const snap = await getDocs(q);
        
        if (snap.empty) {
            throw new Error("Invalid or expired invitation code.");
        }

        const foundCode = { id: snap.docs[0].id, ...snap.docs[0].data() as any };
        const instDoc = await getDoc(doc(firestore, 'institutions', foundCode.institutionId));
        
        setInstitution({
            id: foundCode.institutionId,
            name: instDoc.data()?.name || 'Unknown Institution'
        });
        setCodeDoc(foundCode);
        setStep(2);
    } catch (e: any) {
        setError(e.message);
    } finally {
        setLoading(false);
    }
  }

  async function onInfoSubmit(values: z.infer<typeof infoSchema>) {
    if (!auth || !firestore || !codeDoc) return;
    setLoading(true);
    setError(null);
    try {
        // 1. Create Auth User
        const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
        const user = userCredential.user;

        // 2. Mark code as used
        const codeRef = doc(firestore, 'institutions', codeDoc.institutionId, 'invitationCodes', codeDoc.id);
        await updateDoc(codeRef, { status: 'Used' });

        // 3. Create User profile with Pending status
        await setDoc(doc(firestore, 'users', user.uid), {
            uid: user.uid,
            email: values.email,
            firstName: values.firstName,
            lastName: values.lastName,
            name: `${values.firstName} ${values.lastName}`,
            institutionId: codeDoc.institutionId,
            status: 'Pending',
            createdAt: serverTimestamp(),
        });

        setSuccess(true);
    } catch (e: any) {
        console.error(e);
        setError(e.message || "Signup failed. Please try again.");
    } finally {
        setLoading(false);
    }
  }

  if (success) {
      return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4 font-body">
             <div className="w-full max-w-lg space-y-8">
                <SaileLogo />
                <Card>
                    <CardHeader>
                        <CardTitle>Signup Complete</CardTitle>
                        <CardDescription>Your account has been created and is awaiting approval.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground">
                            You have been registered for <strong>{institution?.name}</strong>. 
                            Your account is currently in a "Pending" status. You will be able to sign in once an administrator assigns your role and activates your profile.
                        </p>
                        <Button asChild className="mt-6 w-full"><Link href="/">Back to Login</Link></Button>
                    </CardContent>
                </Card>
             </div>
        </main>
      )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4 font-body">
      <div className="w-full max-w-lg space-y-8">
        <SaileLogo />
        <Card className="shadow-xl rounded-2xl">
          <CardHeader className="items-center text-center">
            <CardTitle className="text-2xl font-bold tracking-tight">
              {step === 1 ? 'Join an Institution' : 'Finalize Your Profile'}
            </CardTitle>
            <CardDescription>
              {step === 1 
                ? 'Enter the invitation code shared by your administrator.' 
                : `Joining ${institution?.name}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-8">
             {error && (
                <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {step === 1 ? (
                <Form {...codeForm}>
                    <form onSubmit={codeForm.handleSubmit(onCodeSubmit)} className="space-y-6">
                        <FormField
                            control={codeForm.control}
                            name="code"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Invitation Code</FormLabel>
                                <FormControl>
                                    <div className="relative">
                                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                        <Input placeholder="Enter your 6-digit code" {...field} className="pl-10 h-12 text-lg font-mono uppercase"/>
                                    </div>
                                </FormControl>
                                <FormDescription>Codes are valid for one-time use.</FormDescription>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Validate Code
                        </Button>
                        <div className="text-center text-sm">
                            Already have an account?{' '}
                            <Link href="/" className="font-medium text-primary hover:underline">Sign In</Link>
                        </div>
                    </form>
                </Form>
            ) : (
                <Form {...infoForm}>
                    <form onSubmit={infoForm.handleSubmit(onInfoSubmit)} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={infoForm.control}
                                name="firstName"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>First Name</FormLabel>
                                    <FormControl><Input placeholder="John" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={infoForm.control}
                                name="lastName"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Last Name</FormLabel>
                                    <FormControl><Input placeholder="Doe" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={infoForm.control}
                            name="email"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Email Address</FormLabel>
                                <FormControl>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                        <Input type="email" placeholder="john@example.com" {...field} className="pl-10 h-12"/>
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={infoForm.control}
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
                            Complete Signup
                        </Button>
                         <Button type="button" variant="ghost" className="w-full" onClick={() => setStep(1)} disabled={loading}>
                            Back to Code Entry
                        </Button>
                    </form>
                </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function SignupPage() {
    return (
        <FirebaseClientProvider>
            <SignupPageContent />
        </FirebaseClientProvider>
    )
}
