
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { Mail, Lock, Loader2, AlertCircle } from "lucide-react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { doc, setDoc, serverTimestamp, getFirestore } from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth, useFirestore, useFirebaseApp } from "@/firebase";
import { firebaseConfig } from "@/firebase/config";

const formSchema = z.object({
  firstName: z.string().min(1, { message: "First name is required." }),
  lastName: z.string().min(1, { message: "Last name is required." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
});

export function AdminSignupForm() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    if (!auth || !firestore) {
        setError("Firebase services are not available.");
        return;
    }

    setLoading(true);
    setError(null);
    
    let secondaryApp;

    try {
        // Create a secondary app to handle the signup process without polluting global state initially
        secondaryApp = initializeApp(firebaseConfig, `AdminSignup-${Date.now()}`);
        const secondaryAuth = getAuth(secondaryApp);
        const secondaryFirestore = getFirestore(secondaryApp);

        // 1. Create the Auth user in the secondary app context
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, values.email, values.password);
        const newUid = userCredential.user.uid;

        // 2. Create the Firestore user record (using secondary firestore to match auth context)
        const userDocRef = doc(secondaryFirestore, 'users', newUid);
        await setDoc(userDocRef, {
            uid: newUid,
            email: values.email,
            firstName: values.firstName,
            lastName: values.lastName,
            name: `${values.firstName} ${values.lastName}`,
            role: 'admin',
            institutionId: null,
            status: 'Active',
            createdAt: serverTimestamp(),
        });
        
        // 3. Clean up secondary app
        await deleteApp(secondaryApp);

        // 4. Sign in the primary app instance
        await signInWithEmailAndPassword(auth, values.email, values.password);

        router.push('/admin/dashboard');

    } catch (e: any) {
        console.error(e);
        if (e.code === 'auth/email-already-exists') {
            setError("An account with this email address already exists.");
        } else {
            setError(e.message || "An unexpected error occurred. Please try again.");
        }
    } finally {
        setLoading(false);
    }
  }

  return (
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
          {loading ? 'Creating Account...' : 'Create Account'}
        </Button>

        <div className="text-center text-sm">
            Already have an account?{' '}
            <Link href="/" className="font-medium text-primary hover:underline">
                Sign In
            </Link>
        </div>
      </form>
    </Form>
  );
}
