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
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Settings, Save, Loader2, AlertCircle, Timer } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';


const securitySchema = z.object({
  inactivityTimeout: z.coerce.number().min(0, 'Timeout must be a positive number. Use 0 to disable.'),
});

export default function SecuritySettingsPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const userDocRef = useMemoFirebase(
      () => (user && user.uid ? doc(firestore, 'users', user.uid) : null),
      [firestore, user]
    );
    const { data: userData } = useDoc(userDocRef);

    const institutionDocRef = useMemoFirebase(
      () => (userData?.institutionId ? doc(firestore, 'institutions', userData.institutionId) : null),
      [firestore, userData]
    );
    const { data: institutionData, isLoading: isInstitutionLoading } = useDoc(institutionDocRef);

    const form = useForm<z.infer<typeof securitySchema>>({
      resolver: zodResolver(securitySchema),
      defaultValues: {
          inactivityTimeout: 0,
      }
    });

    useEffect(() => {
        if (institutionData) {
            form.reset({
                inactivityTimeout: institutionData.securitySettings?.inactivityTimeout ?? 15,
            });
        }
    }, [institutionData, form]);

    async function onSubmit(values: z.infer<typeof securitySchema>) {
        if (!institutionDocRef) return;
        setLoading(true);
        setError(null);
        try {
            await updateDoc(institutionDocRef, {
                'securitySettings.inactivityTimeout': values.inactivityTimeout,
            });
            toast({
                title: "Settings Saved",
                description: "Security settings have been updated successfully.",
            });
        } catch (e) {
            console.error(e);
            setError("Failed to update security settings. Please try again.");
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
                    <CardContent><Skeleton className="h-24 w-full" /></CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                <h1 className="text-3xl font-bold tracking-tight">Security Settings</h1>
                <p className="text-muted-foreground mt-1">
                    Configure system-wide security parameters for your institution.
                </p>
                </div>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Session Timeout</CardTitle>
                            <CardDescription>Configure automatic logout for inactive users.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {error && <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
                            <FormField
                                control={form.control}
                                name="inactivityTimeout"
                                render={({ field }) => (
                                    <FormItem className="max-w-sm">
                                        <FormLabel>Inactivity Timeout (minutes)</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Timer className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                                <Input type="number" {...field} className="pl-10"/>
                                            </div>
                                        </FormControl>
                                        <FormDescription>
                                            Automatically log out users after this period of inactivity. Set to 0 to disable this feature.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                        <CardFooter className="justify-end">
                            <Button type="submit" disabled={loading || !form.formState.isDirty}>
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Save Settings
                            </Button>
                        </CardFooter>
                    </Card>
                </form>
            </Form>
        </div>
    );
}