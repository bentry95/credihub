'use client';

import { useState, useMemo } from 'react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, query } from 'firebase/firestore';
import { KeySquare } from 'lucide-react';

interface RoleAuditData {
  id: string;
  name: string;
  isSystemRole: boolean;
  userCount: number;
  permissionCount: string;
}

export default function RoleAuditReportPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData, isLoading: isUserLoading } = useDoc(userDocRef);
  const institutionId = userData?.institutionId;

  const rolesQuery = useMemoFirebase(
    () =>
      firestore && institutionId
        ? query(collection(firestore, 'institutions', institutionId, 'roles'))
        : null,
    [firestore, institutionId]
  );
  const { data: customRoles, isLoading: isRolesLoading } = useCollection(rolesQuery);

  const usersQuery = useMemoFirebase(
    () =>
      firestore && institutionId
        ? query(collection(firestore, 'institutions', institutionId, 'users'))
        : null,
    [firestore, institutionId]
  );
  const { data: users, isLoading: isUsersLoading } = useCollection(usersQuery);

  const auditData = useMemo(() => {
    if (!users) return [];

    const systemRoles = [
      { id: 'admin', name: 'Platform Admin', isSystemRole: true, permissions: ['all'] },
      { id: 'institution-admin', name: 'Institution Admin', isSystemRole: true, permissions: ['all'] },
      { id: 'staff', name: 'Staff (Base)', isSystemRole: true, permissions: ['dashboard', 'customers', 'loans', 'profile', 'manual', 'reports'] },
    ];
    
    const allRoles = [...systemRoles, ...(customRoles || [])];

    return allRoles.map(role => {
        let userCount = 0;
        if(role.isSystemRole) {
            userCount = users.filter(u => u.role === role.id && !u.customRoleId).length;
        } else {
            userCount = users.filter(u => u.customRoleId === role.id).length;
        }

        return {
            id: role.id,
            name: role.name,
            isSystemRole: role.isSystemRole,
            userCount: userCount,
            permissionCount: role.permissions.includes('all') ? 'All' : `${role.permissions.length} permissions`
        }
    });

  }, [customRoles, users]);

  const isLoading = isUserLoading || isRolesLoading || isUsersLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Role & Permission Audit</h1>
          <p className="text-muted-foreground mt-1">
            An overview of all configured roles and their assigned user counts.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Role Summary</CardTitle>
          <CardDescription>
            This report shows all system and custom roles within your institution.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role Name</TableHead>
                <TableHead>Role Type</TableHead>
                <TableHead>Assigned Users</TableHead>
                <TableHead>Permission Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  </TableRow>
                ))
              ) : auditData.length > 0 ? (
                auditData.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell>
                      <Badge variant={role.isSystemRole ? 'secondary' : 'outline'}>
                        {role.isSystemRole ? 'System' : 'Custom'}
                      </Badge>
                    </TableCell>
                    <TableCell>{role.userCount}</TableCell>
                    <TableCell>{role.permissionCount}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-muted rounded-full">
                        <KeySquare className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold">No Roles Found</h3>
                      <p className="text-muted-foreground">
                        System and custom roles will be displayed here once configured.
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