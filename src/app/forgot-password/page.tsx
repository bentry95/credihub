
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { FirebaseClientProvider } from "@/firebase";

export default function ForgotPasswordPage() {
  return (
    <FirebaseClientProvider>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4 font-body">
        <div className="w-full max-w-md">
          <Card className="shadow-xl rounded-2xl">
            <CardHeader className="items-center text-center space-y-4 pt-8">
              <CardTitle className="text-3xl font-bold tracking-tight">
                Forgot Your Password?
              </CardTitle>
              <CardDescription className="px-4">
                No problem. Enter your email address below and we'll send you a link to reset it.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-8">
              <ForgotPasswordForm />
            </CardContent>
          </Card>
        </div>
      </main>
    </FirebaseClientProvider>
  );
}
