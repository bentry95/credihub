"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import { Mail, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { sendPasswordResetEmail, AuthError } from "firebase/auth";

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
import { useAuth } from "@/firebase";

const formSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
});

export function ForgotPasswordForm() {
  const auth = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (!auth) {
        throw new Error("Firebase services are not available.");
      }
      
      await sendPasswordResetEmail(auth, values.email);
      setSuccess("Password reset email sent! Please check your inbox (and spam folder) for instructions.");
      form.reset();

    } catch (e) {
        const err = e as AuthError;
        if (err.code === 'auth/user-not-found') {
            setError("No user found with this email address. Please check your email and try again.");
        } else {
            setError("An unexpected error occurred. Please try again later.");
            console.error(err);
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
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
             <Alert variant="default" className="bg-green-100 border-green-300">
                <CheckCircle className="h-4 w-4 text-green-700" />
                <AlertTitle className="text-green-800">Email Sent</AlertTitle>
                <AlertDescription className="text-green-700">{success}</AlertDescription>
            </Alert>
        )}
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input placeholder="Email address" {...field} className="pl-10 h-12"/>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending Link...
            </>
          ) : 'Send Reset Link'}
        </Button>

        <div className="text-center text-sm">
            <Link href="/" className="font-medium text-primary hover:underline">
                Back to Sign In
            </Link>
        </div>
      </form>
    </Form>
  );
}
