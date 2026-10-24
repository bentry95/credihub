
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AdminSignupForm } from "@/components/auth/admin-signup-form";
import { SaileLogo } from "@/components/saile-logo";
import { FirebaseClientProvider } from "@/firebase";

export default function AdminSignupPage() {
  return (
    <FirebaseClientProvider>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4 font-body">
        <div className="w-full max-w-lg space-y-8">
          <SaileLogo />
          <Card className="shadow-xl rounded-2xl">
            <CardHeader className="items-center text-center">
              <CardTitle className="text-2xl font-bold tracking-tight">
                Platform Administrator Signup
              </CardTitle>
              <CardDescription>
                Create an account to manage the CrediHub platform.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              <AdminSignupForm />
            </CardContent>
          </Card>
        </div>
      </main>
    </FirebaseClientProvider>
  );
}
