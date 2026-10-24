'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  useUser,
  useFirestore,
  useDoc,
  useMemoFirebase,
} from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
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
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  AlertCircle,
  Save,
  Percent,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

const provisionSchema = z.object({
  par1to30: z.coerce.number().min(0).max(100),
  par31to60: z.coerce.number().min(0).max(100),
  par61to90: z.coerce.number().min(0).max(100),
  parOver90: z.coerce.number().min(0).max(100),
});

export default function LoanLossProvisionPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);

  const institutionDocRef = useMemoFirebase(
    () => (userData?.institutionId ? doc(firestore, 'institutions', userData.institutionId) : null),
    [firestore, userData]
  );
  const { data: institutionData, isLoading: isInstitutionLoading } = useDoc(institutionDocRef);

  const form = useForm<z.infer<typeof provisionSchema>>({
    resolver: zodResolver(provisionSchema),
    defaultValues: {
        par1to30: 1,
        par31to60: 25,
        par61to90: 50,
        parOver90: 100,
    }
  });

  useEffect(() => {
    if (institutionData?.loanLossProvision) {
      form.reset(institutionData.loanLossProvision);
    }
  }, [institutionData, form]);

  async function onSubmit(values: z.infer<typeof provisionSchema>) {
    if (!institutionDocRef) return;
    setLoading(true);
    setError(null);
    try {
        await updateDoc(institutionDocRef, {
            loanLossProvision: values,
        });
        toast({
            title: "Settings Saved",
            description: "Loan loss provisioning rules have been updated.",
        });
    } catch (e) {
      console.error(e);
      setError("Failed to update settings. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (isInstitutionLoading) {
      return (
          <div className="space-y-6">
              <Skeleton className="h-10 w-1/4" />
              <Skeleton className="h-6 w-1/2" />
              <Card>
                  <CardHeader><Skeleton className="h-7 w-1/3" /></CardHeader>
                  <CardContent><Skeleton className="h-48 w-full" /></CardContent>
              </Card>
          </div>
      )
  }

  return (
    <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
            <h1 className="text-3xl font-bold tracking-tight">Loan Loss Provisioning</h1>
            <p className="text-muted-foreground mt-1">
                Set the provisioning percentages for different Portfolio at Risk (PAR) buckets.
            </p>
            </div>
        </div>

        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Provisioning Rules</CardTitle>
                        <CardDescription>These percentages will be used to calculate provisions during the End of Day process.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {error && <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                             <FormField
                                control={form.control}
                                name="par1to30"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>PAR 1-30 Days</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                                <Input type="number" {...field} className="pl-10"/>
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="par31to60"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>PAR 31-60 Days</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                                <Input type="number" {...field} className="pl-10"/>
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="par61to90"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>PAR 61-90 Days</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                                <Input type="number" {...field} className="pl-10"/>
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="parOver90"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>PAR &gt;90 Days</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                                <Input type="number" {...field} className="pl-10"/>
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="justify-end">
                        <Button type="submit" disabled={loading || !form.formState.isDirty}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save Rules
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </Form>
    </div>
  );
}