

'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import Link from "next/link";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Gavel } from 'lucide-react';

export default function TopUpApprovalsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/staff/loans/approvals/top-ups');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md text-center">
            <CardHeader>
                <div className="mx-auto bg-muted rounded-full p-4 w-fit">
                    <Gavel className="h-12 w-12 text-muted-foreground" />
                </div>
                <CardTitle className="mt-4">Page Moved</CardTitle>
                <CardDescription>
                   This page has been consolidated into the main approvals queue. Redirecting you...
                </CardDescription>
            </CardHeader>
        </Card>
    </div>
  );
}
