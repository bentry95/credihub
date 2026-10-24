
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { Mail, Lock, Loader2, AlertCircle, Eye, EyeOff, UserPlus } from "lucide-react";
import { doc, getDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth, useFirestore } from "@/firebase";
import { AuthError, signInWithEmailAndPassword, User } from "firebase/auth";

const formSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
  password: z.string().min(1, { message: "Password is required." }),
});

export function LoginForm() {
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const handleRedirect = async (user: User) => {
    if (!firestore) {
      setError("Firestore is not available. Cannot verify user role.");
      setLoading(false);
      return;
    }
    
    const userDocRef = doc(firestore, 'users', user.uid); 
    try {
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const role = userData.role;

        if (role === 'admin') {
          router.push('/admin/dashboard');
        } else if (role === 'institution-admin') {
          // Institution admins go directly to the dashboard
          router.push('/staff/dashboard');
        } else if (role === 'staff') {
          // Regular staff go to branch selection
          router.push('/staff/select-branch');
        } else {
          setError("Your user role is not configured for dashboard access.");
          if(auth) await signOut(auth);
        }
      } else {
         setError("User profile not found. Please contact support.");
         if(auth) await signOut(auth);
      }
    } catch (e) {
        setError("Failed to retrieve user profile. Please try again.");
        console.error(e);
        if(auth) await signOut(auth);
    } finally {
        setLoading(false);
    }
  }


  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    setError(null);
    
    try {
        if (!auth || !firestore) {
            throw new Error("Firebase services are not available.");
        }
        const userCredential = await signInWithEmailAndPassword(auth, values.email, values.password);
        const user = userCredential.user;
        
        await handleRedirect(user);

    } catch (e) {
        const err = e as AuthError;
        if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
            setError("Invalid credentials. Please check your email and password.");
        } else {
            setError("An unexpected error occurred. Please try again.");
            console.error(err);
        }
        setLoading(false);
    }
  }


  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Login Failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input placeholder="Email address" {...field} className="pl-10 h-12" />
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
                <FormControl>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Password"
                      {...field}
                      className="pl-10 h-12 pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex flex-col gap-2 items-end text-sm">
            <Link href="/forgot-password" title="Reset your password"  className="font-medium text-primary hover:underline">
                Forgot Password?
            </Link>
            <Link href="/signup" title="Join an institution as a staff member" className="font-medium text-primary hover:underline flex items-center gap-1">
                <UserPlus className="h-4 w-4" /> Join an Institution
            </Link>
        </div>
        <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign In
        </Button>
      </form>
    </Form>
  );
}
