
'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MailPlus, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function NewStaffUserLandingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
            <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit">
                <MailPlus className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="mt-4 text-2xl">Invite a New User</CardTitle>
            <CardDescription>
                To maintain security, new users must sign themselves up using a unique invitation code.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <p className="text-sm text-muted-foreground">
                You can no longer create user logins directly. Instead, generate a code, send it to the staff member, and then activate their account once they have registered.
            </p>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
            <Button asChild className="w-full">
                <Link href="/staff/settings/invitations">
                    Go to Staff Invitations <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
            </Button>
            <Button variant="ghost" asChild className="w-full">
                <Link href="/staff/settings/users">Back to User List</Link>
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
