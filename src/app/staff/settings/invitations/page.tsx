'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { useFirebaseApp } from '@/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, doc, query, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { PlusCircle, Loader2, KeyRound, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';

export default function InvitationsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { toast } = useToast();
  
  const [generating, setGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);
  const institutionId = userData?.institutionId;

  const codesQuery = useMemoFirebase(
    () => (firestore && institutionId ? query(collection(firestore, 'institutions', institutionId, 'invitationCodes'), orderBy('createdAt', 'desc')) : null),
    [firestore, institutionId]
  );
  const { data: codes, isLoading: isCodesLoading } = useCollection(codesQuery);

  const handleGenerateCode = async () => {
    if (!firestore || !firebaseApp || !institutionId || !user) return;
    setGenerating(true);
    try {
        const generateInvite = httpsCallable<undefined, { code: string }>(getFunctions(firebaseApp, 'us-central1'), 'generateInviteCode');
        const { data } = await generateInvite();
        const code = data.code;

        if (inviteEmail.trim()) {
          const sendInvitation = httpsCallable(getFunctions(firebaseApp, 'us-central1'), 'sendStaffInvitationEmail');
          await sendInvitation({ email: inviteEmail.trim(), code, institutionId });
        }

        toast({ title: inviteEmail.trim() ? "Invitation Sent" : "Code Generated", description: inviteEmail.trim() ? `An invitation was emailed to ${inviteEmail.trim()}.` : "A new invitation code is ready for use." });
    } catch (e: any) {
        toast({ variant: 'destructive', title: "Error", description: inviteEmail.trim() ? "The code was created, but the invitation email could not be sent. Check SMTP configuration and try again." : "Failed to generate code." });
    } finally {
        setGenerating(false);
    }
  };

  const copyToClipboard = (code: string) => {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
      toast({ title: "Copied!", description: "Invitation code copied to clipboard." });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
        case 'Active': return 'default';
        case 'Used': return 'secondary';
        case 'Expired': return 'destructive';
        default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff Invitations</h1>
          <p className="text-muted-foreground mt-1">
            Generate and manage one-time codes for new staff members to join.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <Input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="Email address (optional)" className="w-64" aria-label="Invitee email address" />
        <Button onClick={handleGenerateCode} disabled={generating}>
          {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
          Generate New Code
        </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Codes</CardTitle>
          <CardDescription>
            Share these codes with new staff members. They can enter them on the signup page to create an account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isCodesLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : codes && codes.length > 0 ? (
                codes.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono font-bold text-lg tracking-widest">{item.code}</TableCell>
                    <TableCell>{item.createdAt ? format(item.createdAt.toDate(), 'PPP p') : 'N/A'}</TableCell>
                    <TableCell><Badge variant={getStatusBadge(item.status)}>{item.status}</Badge></TableCell>
                    <TableCell className="text-right">
                        {item.status === 'Active' && (
                            <Button variant="ghost" size="icon" onClick={() => copyToClipboard(item.code)}>
                                {copiedCode === item.code ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                            </Button>
                        )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-muted rounded-full">
                        <KeyRound className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold">No Invitation Codes</h3>
                      <p className="text-muted-foreground">Click the button above to generate your first invitation code.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
