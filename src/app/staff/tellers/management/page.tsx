'use client';
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { HandCoins } from "lucide-react";
import Link from "next/link";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/staff/settings/tellering');
  }, [router]);

  return (
    <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md text-center">
            <CardHeader>
                <div className="mx-auto bg-muted rounded-full p-4 w-fit">
                    <HandCoins className="h-12 w-12 text-muted-foreground" />
                </div>
                <CardTitle className="mt-4">This page has moved</CardTitle>
                <CardDescription>
                    You are being redirected to the new Teller Management page.
                </CardDescription>
            </CardHeader>
        </Card>
    </div>
  );
}
