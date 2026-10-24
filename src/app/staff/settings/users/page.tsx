
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  MoreHorizontal,
  PlusCircle,
  Pencil,
  UserCheck,
  Clock,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { useFirestore, useCollection, useMemoFirebase, useDoc, useUser } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { format } from 'date-fns';
import Link from 'next/link';

function InstitutionUsersPageContent() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [searchTerm, setSearchTerm] = useState('');
  const [activePage, setActivePage] = useState(1);
  const [pendingPage, setPendingPage] = useState(1);
  const itemsPerPage = 10;

  const userDocRef = useMemoFirebase(
    () => (firestore && user?.uid ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: currentUserData, isLoading: isCurrentUserLoading } = useDoc(userDocRef);
  const institutionId = currentUserData?.institutionId;

  const usersQuery = useMemoFirebase(
    () => (firestore && institutionId ? query(collection(firestore, 'users'), where('institutionId', '==', institutionId)) : null),
    [firestore, institutionId]
  );
  const { data: institutionUsers, isLoading: isUsersLoading } = useCollection(usersQuery);
  
  const activeUsers = useMemo(() => institutionUsers?.filter(u => u.status === 'Active') || [], [institutionUsers]);
  const pendingUsers = useMemo(() => institutionUsers?.filter(u => u.status === 'Pending') || [], [institutionUsers]);

  const filterUsers = (list: any[]) => {
      if (!searchTerm) return list;
      const lower = searchTerm.toLowerCase();
      return list.filter(u => 
        u.name?.toLowerCase().includes(lower) || 
        u.email?.toLowerCase().includes(lower) ||
        u.employeeId?.toLowerCase().includes(lower)
      );
  };

  const filteredActive = useMemo(() => filterUsers(activeUsers), [activeUsers, searchTerm]);
  const filteredPending = useMemo(() => filterUsers(pendingUsers), [pendingUsers, searchTerm]);

  const isFiltered = searchTerm.length > 0;

  const paginatedActive = useMemo(() => {
      if (isFiltered) return filteredActive;
      const start = (activePage - 1) * itemsPerPage;
      return filteredActive.slice(start, start + itemsPerPage);
  }, [filteredActive, activePage, isFiltered]);

  const paginatedPending = useMemo(() => {
      if (isFiltered) return filteredPending;
      const start = (pendingPage - 1) * itemsPerPage;
      return filteredPending.slice(start, start + itemsPerPage);
  }, [filteredPending, pendingPage, isFiltered]);

  const activeTotalPages = Math.ceil(filteredActive.length / itemsPerPage);
  const pendingTotalPages = Math.ceil(filteredPending.length / itemsPerPage);

  const isLoading = isUsersLoading || isCurrentUserLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
          <div>
              <h1 className="text-3xl font-bold tracking-tight">Staff Management</h1>
              <p className="text-muted-foreground mt-1">
                  Manage users and activate new signups for your institution.
              </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/staff/settings/invitations">
              <PlusCircle className="mr-2 h-4 w-4" /> Manage Invitations
            </Link>
          </Button>
      </div>

      <Tabs defaultValue="active">
        <div className="flex items-center justify-between mb-4">
            <TabsList>
                <TabsTrigger value="active" className="gap-2">
                    Active Staff <Badge variant="secondary" className="ml-1 h-5 px-1.5">{activeUsers.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="pending" className="gap-2">
                    Pending Activation <Badge variant={pendingUsers.length > 0 ? 'default' : 'secondary'} className="ml-1 h-5 px-1.5">{pendingUsers.length}</Badge>
                </TabsTrigger>
            </TabsList>
            <div className="relative w-72">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search users..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setActivePage(1);
                        setPendingPage(1);
                    }}
                />
            </div>
        </div>

        <TabsContent value="active">
            <Card>
                <CardContent className="pt-6">
                    <UserTable users={paginatedActive} isLoading={isLoading} />
                </CardContent>
                {!isFiltered && paginatedActive.length > 0 && (
                    <CardFooter className="flex items-center justify-between border-t py-4">
                        <div className="text-sm text-muted-foreground">Page {activePage} of {activeTotalPages}</div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setActivePage(p => Math.max(1, p - 1))} disabled={activePage === 1}><ChevronLeft className="h-4 mr-1"/> Prev</Button>
                            <Button variant="outline" size="sm" onClick={() => setActivePage(p => Math.min(activeTotalPages, p + 1))} disabled={activePage === activeTotalPages}>Next <ChevronRight className="h-4 ml-1"/></Button>
                        </div>
                    </CardFooter>
                )}
            </Card>
        </TabsContent>

        <TabsContent value="pending">
            <Card>
                <CardHeader>
                    <CardTitle>Awaiting Activation</CardTitle>
                    <CardDescription>These users have signed up with an invitation code but have not yet been assigned a role or branch.</CardDescription>
                </CardHeader>
                <CardContent>
                    <UserTable users={paginatedPending} isLoading={isLoading} isPending />
                </CardContent>
                {!isFiltered && paginatedPending.length > 0 && (
                    <CardFooter className="flex items-center justify-between border-t py-4">
                        <div className="text-sm text-muted-foreground">Page {pendingPage} of {pendingTotalPages}</div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setPendingPage(p => Math.max(1, p - 1))} disabled={pendingPage === 1}><ChevronLeft className="h-4 mr-1"/> Prev</Button>
                            <Button variant="outline" size="sm" onClick={() => setPendingPage(p => Math.min(pendingTotalPages, p + 1))} disabled={pendingPage === pendingTotalPages}>Next <ChevronRight className="h-4 ml-1"/></Button>
                        </div>
                    </CardFooter>
                )}
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UserTable({ users, isLoading, isPending = false }: { users: any[], isLoading: boolean, isPending?: boolean }) {
    if (isLoading) {
        return (
            <Table>
                <TableBody>
                    {Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><div className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-full"/><div className="space-y-2"><Skeleton className="h-4 w-32"/><Skeleton className="h-3 w-40"/></div></div></TableCell>
                            <TableCell><Skeleton className="h-5 w-20"/></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-8 w-16 ml-auto"/></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        )
    }

    if (users.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                {isPending ? (
                    <div className="flex flex-col items-center gap-2">
                        <Clock className="h-8 w-8 opacity-20" />
                        <p>No users are currently awaiting activation.</p>
                    </div>
                ) : <p>No staff members found.</p>}
            </div>
        )
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>{isPending ? 'Joined On' : 'Role'}</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {users.map(user => (
                    <TableRow key={user.uid}>
                        <TableCell>
                            <div className="flex items-center gap-3">
                                <Avatar>
                                    <AvatarImage src={user.photoUrl} />
                                    <AvatarFallback>{user.name?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <div className="font-medium">{user.name}</div>
                                    <div className="text-sm text-muted-foreground">{user.email}</div>
                                </div>
                            </div>
                        </TableCell>
                        <TableCell>
                            {isPending ? (
                                user.createdAt ? format(user.createdAt.toDate(), 'PPP') : 'N/A'
                            ) : (
                                <Badge variant="secondary">{user.customRoleName || user.role}</Badge>
                            )}
                        </TableCell>
                        <TableCell className="text-right">
                            <Button asChild size="sm" variant={isPending ? 'default' : 'ghost'}>
                                <Link href={isPending ? `/staff/settings/users/pending/${user.uid}` : `/staff/settings/users/edit/${user.uid}`}>
                                    {isPending ? <><UserCheck className="mr-2 h-4 w-4"/> Activate</> : <><Pencil className="mr-2 h-4 w-4"/> Edit</>}
                                </Link>
                            </Button>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}

export default function InstitutionUsersPage() {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);
  return isClient ? <InstitutionUsersPageContent /> : <div className="space-y-8"><Skeleton className="h-96 w-full" /></div>;
}
