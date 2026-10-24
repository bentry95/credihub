'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Undo } from 'lucide-react';

export default function ReversalApprovalsPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/staff/accounts/transaction-reversal?tab=approve');
    }, [router]);

    return (
        <div className="flex h-full items-center justify-center">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                        <Undo className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <CardTitle className="mt-4 text-2xl">Page Moved</CardTitle>
                    <CardDescription>
                        This page has been consolidated. Redirecting you now...
                    </CardDescription>
                </CardHeader>
            </Card>
        </div>
    );
}
