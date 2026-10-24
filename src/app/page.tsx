
'use client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "@/components/auth/login-form";
import { FirebaseClientProvider } from "@/firebase";

export default function Home() {
  return (
    <FirebaseClientProvider>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4 font-body">
        <div className="w-full max-w-md space-y-8">
          <h1 className="text-4xl font-bold tracking-tight text-center text-gray-900 dark:text-gray-50 font-headline">
            CrediHub
          </h1>
          <Card className="shadow-xl rounded-2xl">
            <CardHeader className="items-center text-center">
              <CardTitle className="text-2xl font-bold tracking-tight">
                Sign In
              </CardTitle>
              <CardDescription>
                Welcome back! Please enter your credentials.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              <LoginForm />
            </CardContent>
          </Card>
          <footer className="text-center text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} CrediHub. All rights reserved.
          </footer>
        </div>
      </main>
    </FirebaseClientProvider>
  );
}
