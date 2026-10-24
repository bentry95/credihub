
'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  MoreHorizontal,
  PlusCircle,
  Building,
  Save,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';


const assignSchema = z.object({
    institutionId: z.string().min(1, 'Please select an institution.'),
});

function UsersPageContent() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usersQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'users') : null),
    [firestore]
  );
  const { data: users, isLoading: usersLoading } = useCollection(usersQuery);

  const institutionsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'institutions') : null),
    [firestore]
  );
  const { data: institutions, isLoading: institutionsLoading } = useCollection(institutionsQuery);
  
  const form = useForm<z.infer<typeof assignSchema>>({
    resolver: zodResolver(assignSchema),
  });

  const handleAssignClick = (user: any) => {
    setSelectedUser(user);
    form.reset({ institutionId: user.institutionId || '' });
    setError(null);
    setIsAssignDialogOpen(true);
  };
  
  const onAssignSubmit = async (values: z.infer<typeof assignSchema>) => {
    if (!firestore || !selectedUser) return;
    setLoading(true);
    setError(null);

    try {
        const userDocRef = doc(firestore, 'users', selectedUser.uid);

        await updateDoc(userDocRef, {
            role: 'institution-admin',
            institutionId: values.institutionId,
            updatedAt: serverTimestamp(),
        });

        toast({
            title: 'User Assigned',
            description: `${selectedUser.name} has been assigned as an admin to the selected institution.`
        });
        
        setIsAssignDialogOpen(false);
    } catch (e: any) {
        console.error("User assignment failed:", e);
        setError(e.message || 'An unexpected error occurred.');
    } finally {
        setLoading(false);
    }
  }


  return (
     <>
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">System Users</h1>
                <div className="flex gap-2">
                    <Button asChild>
                        <Link href="/admin/users/new">
                            <PlusCircle className="mr-2 h-4 w-4"/> Add New User
                        </Link>
                    </Button>
                </div>
            </div>
        
            <Card>
                <CardHeader>
                <CardTitle>All Users</CardTitle>
                <CardDescription>
                    A directory of every user on the platform.
                </CardDescription>
                </CardHeader>
                <CardContent>
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Institution</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {usersLoading || institutionsLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell>
                            <div className="flex items-center gap-4">
                                <Skeleton className="h-10 w-10 rounded-full" />
                                <div className="space-y-2">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-3 w-40" />
                                </div>
                            </div>
                            </TableCell>
                            <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                        </TableRow>
                        ))
                    ) : users && users.length > 0 ? (
                        users.map(user => {
                        const institution = institutions?.find(inst => inst.id === user.institutionId);
                        return (
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
                                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                                        {user.customRoleName || (user.role === 'admin' ? 'Platform Admin' : user.role === 'institution-admin' ? 'Inst. Admin' : 'Staff')}
                                    </Badge>
                                </TableCell>
                                <TableCell>{institution?.name ?? 'Platform-wide'}</TableCell>
                                <TableCell className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <MoreHorizontal className="h-5 w-5" />
                                    </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                    <DropdownMenuItem asChild>
                                        <Link href={`/admin/users/edit/${user.uid}`}>
                                            Edit User
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleAssignClick(user)}>
                                        Assign to Institution
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>Send Password Reset</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        );
                        })
                    ) : (
                        <TableRow>
                        <TableCell colSpan={4} className="h-24 text-center">
                            No users found.
                        </TableCell>
                        </TableRow>
                    )}
                    </TableBody>
                </Table>
                </CardContent>
            </Card>
        </div>
        <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Assign {selectedUser?.name} to Institution</DialogTitle>
                    <DialogDescription>
                        This will make the user an Institution Admin for the selected institution.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onAssignSubmit)} className="space-y-4">
                        {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
                        <FormField
                            control={form.control}
                            name="institutionId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Institution</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select an institution..." /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {institutionsLoading ? <SelectItem value="loading" disabled>Loading...</SelectItem> : institutions?.map(inst => (
                                                <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                            <Button type="submit" disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                            Assign & Make Admin
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    </>
  );
}

export default function UsersPage() {
  const [isClient, setIsClient] = useState(false)
 
  useEffect(() => {
    setIsClient(true)
  }, [])
 
  return isClient ? <UsersPageContent /> : <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>System Users</CardTitle>
          <CardDescription>
            Manage all administrative and staff user accounts.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
  </div>;
}
