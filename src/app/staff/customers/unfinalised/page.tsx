
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
import { UserRoundX, FileWarning, FileSignature } from 'lucide-react';
import { format } from 'date-fns';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, query, doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';


export default function UnfinalisedOnboardingPage() {
    const { user } = useUser();
    const firestore = useFirestore();

    const userDocRef = useMemoFirebase(
        () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
        [firestore, user]
    );
    const { data: userData, isLoading: isUserLoading } = useDoc(userDocRef);

    const unfinalisedQuery = useMemoFirebase(
        () => (firestore && userData?.institutionId ? query(collection(firestore, 'institutions', userData.institutionId, 'unfinalisedApplications')) : null),
        [firestore, userData]
    );

    const { data: unfinalisedApplications, isLoading: isAppsLoading } = useCollection(unfinalisedQuery);

    const isLoading = isUserLoading || isAppsLoading;

    const getBadge = (reason: string) => {
        if (reason === 'Draft') {
            return (
                <Badge variant="secondary" className="gap-1.5 pl-1.5">
                    <FileSignature className="h-3.5 w-3.5" />
                    {reason}
                </Badge>
            )
        }
        return (
            <Badge variant="destructive" className="gap-1.5 pl-1.5">
                <FileWarning className="h-3.5 w-3.5" />
                {reason}
            </Badge>
        )
    }

  return (
    <div className="space-y-6">
       <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Unfinalised Onboarding</h1>
          <p className="text-muted-foreground mt-1">
            Review and resolve customer applications that require manual intervention or are saved as drafts.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Applications Queue</CardTitle>
          <CardDescription>
            A list of applications that could not be automatically processed or were saved as drafts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer Name</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>ID Number</TableHead>
                <TableHead>Date Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-40" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-9 w-32 ml-auto" /></TableCell>
                    </TableRow>
                  ))
              ) : unfinalisedApplications && unfinalisedApplications.length > 0 ? (
                unfinalisedApplications.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell className="font-medium">{app.customerName}</TableCell>
                    <TableCell>
                       {getBadge(app.reason)}
                    </TableCell>
                    <TableCell>{app.idNumber}</TableCell>
                    <TableCell>{format(app.dateCreated.toDate(), 'PPP')}</TableCell>
                    <TableCell className="text-right">
                       <Button asChild size="sm" variant={app.reason === 'Draft' ? 'default' : 'outline'}>
                            <Link href={`/staff/customers/new?draftId=${app.id}`}>
                                {app.reason === 'Draft' ? 'Continue' : 'Review & Finalise'}
                            </Link>
                        </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-muted rounded-full">
                        <UserRoundX className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold">Queue is Empty</h3>
                      <p className="text-muted-foreground">
                        There are no pending applications that require manual review.
                      </p>
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
