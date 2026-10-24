'use client';

import { useState, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  PlusCircle,
  KeyRound,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronRight,
  Save,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { permissionsConfig } from '@/lib/permissions';
import { useToast } from '@/hooks/use-toast';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const roleSchema = z.object({
    name: z.string().min(1, 'Role name is required.'),
    permissions: z.array(z.string()).min(1, 'At least one permission must be selected.'),
});

export default function RolesPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<any | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<any | null>(null);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);
  const institutionId = userData?.institutionId;

  const rolesQuery = useMemoFirebase(
    () =>
      firestore && institutionId
        ? collection(firestore, 'institutions', institutionId, 'roles')
        : null,
    [firestore, institutionId]
  );
  const { data: customRoles, isLoading: isRolesLoading } = useCollection(rolesQuery);
  
  const form = useForm<z.infer<typeof roleSchema>>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
        name: '',
        permissions: [],
    }
  });

  const systemRoles = [
    { id: 'institution-admin', name: 'Institution Admin', isSystemRole: true, permissions: ['all'] },
    { id: 'staff', name: 'Staff (Standard)', isSystemRole: true, permissions: ['dashboard', 'customers', 'loans', 'profile', 'manual'] },
  ];

  const allRoles = useMemo(() => {
    return [...systemRoles, ...(customRoles || [])];
  }, [customRoles]);

  const handleEdit = (role: any) => {
    if (role.isSystemRole) return;
    setEditingRole(role);
    form.reset({ name: role.name, permissions: role.permissions });
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setEditingRole(null);
    form.reset({ name: '', permissions: [] });
    setIsFormOpen(true);
  }
  
  const handleDeleteClick = (role: any) => {
      setRoleToDelete(role);
      setIsDeleteOpen(true);
  };

  async function onSubmit(values: z.infer<typeof roleSchema>) {
    if (!firestore || !institutionId) return;

    setLoading(true);
    setError(null);
    try {
        const rolesRef = collection(firestore, 'institutions', institutionId, 'roles');
        if (editingRole) {
            const roleDoc = doc(rolesRef, editingRole.id);
            await updateDoc(roleDoc, values);
            toast({ title: 'Role Updated', description: `The role "${values.name}" has been updated.`});
        } else {
            const newDocRef = doc(rolesRef);
            await setDoc(newDocRef, {
                ...values,
                id: newDocRef.id,
                institutionId,
                isSystemRole: false,
            });
            toast({ title: 'Role Created', description: `The role "${values.name}" has been created.`});
        }
      
      setIsFormOpen(false);
    } catch (e) {
      console.error('Error saving role:', e);
      setError('Failed to save role. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function confirmDelete() {
      if (!firestore || !institutionId || !roleToDelete) return;
      setLoading(true);
      try {
          await deleteDoc(doc(firestore, 'institutions', institutionId, 'roles', roleToDelete.id));
          toast({ title: "Role Deleted" });
          setIsDeleteOpen(false);
      } catch (e) {
          console.error(e);
          toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete role.' });
      } finally {
          setLoading(false);
      }
  }

  const PermissionGroup = ({ category }: { category: any }) => {
    const [isOpen, setIsOpen] = useState(false);
    const permissions = useWatch({ control: form.control, name: 'permissions' }) || [];
    
    const allCategoryPermissions = category.permissions.map((p: any) => p.id);
    const selectedInCategory = permissions.filter((pId: string) => allCategoryPermissions.includes(pId));

    const isAllSelected = allCategoryPermissions.length > 0 && selectedInCategory.length === allCategoryPermissions.length;
    const isIndeterminate = selectedInCategory.length > 0 && !isAllSelected;

    const handleCategoryChange = (checked: boolean | 'indeterminate') => {
      const currentPermissions = form.getValues('permissions') || [];
      let newPermissions;
      if (checked === true) {
        newPermissions = [...new Set([...currentPermissions, ...allCategoryPermissions])];
      } else {
        newPermissions = currentPermissions.filter((pId: string) => !allCategoryPermissions.includes(pId));
      }
      form.setValue('permissions', newPermissions, { shouldDirty: true, shouldValidate: true });
    };

    return (
        <div className="rounded-md border p-4 bg-card">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                     <Checkbox
                        checked={isAllSelected ? true : isIndeterminate ? 'indeterminate' : false}
                        onCheckedChange={handleCategoryChange}
                    />
                    <label className="font-semibold text-base">{category.label}</label>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => setIsOpen(!isOpen)}>
                    {isOpen ? <ChevronDown className="h-5 w-5"/> : <ChevronRight className="h-5 w-5"/>}
                </Button>
            </div>
            {isOpen && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 pl-7 border-t pt-4">
                    {category.permissions.map((permission: any) => (
                        <FormField
                            key={permission.id}
                            control={form.control}
                            name="permissions"
                            render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                <FormControl>
                                <Checkbox
                                    checked={field.value?.includes(permission.id)}
                                    onCheckedChange={(checked) => {
                                      const currentValue = field.value || [];
                                      const updatedValue = checked
                                        ? [...currentValue, permission.id]
                                        : currentValue.filter((value) => value !== permission.id);
                                      field.onChange(updatedValue);
                                    }}
                                />
                                </FormControl>
                                <FormLabel className="font-normal text-sm cursor-pointer">{permission.label}</FormLabel>
                            </FormItem>
                            )}
                        />
                    ))}
                </div>
            )}
        </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Roles & Permissions</h1>
          <p className="text-muted-foreground mt-1">
            Define institutional roles and assign functional and report-specific permissions.
          </p>
        </div>
        <Button onClick={handleCreate}>
          <PlusCircle className="mr-2 h-4 w-4" /> Create New Role
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configured Roles</CardTitle>
          <CardDescription>
            System roles are fixed. Custom roles can be modified as needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Assigned Permissions</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isRolesLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : allRoles.length > 0 ? (
                allRoles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">{role.name}</TableCell>
                    <TableCell>
                      <Badge variant={role.isSystemRole ? 'secondary' : 'outline'}>
                        {role.isSystemRole ? 'System' : 'Custom'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                        {role.permissions.includes('all') ? 'All Permissions' : `${role.permissions.length} permissions`}
                    </TableCell>
                    <TableCell className="text-right">
                        {!role.isSystemRole && (
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <MoreVertical className="h-5 w-5" />
                                </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleEdit(role)}><Pencil className="mr-2 h-4 w-4" /> Edit Permissions</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDeleteClick(role)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete Role</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
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
                        <h3 className="text-lg font-semibold">No Custom Roles Found</h3>
                        <p className="text-muted-foreground">Get started by creating your first custom role.</p>
                        <Button onClick={handleCreate}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Create Role
                        </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full overflow-hidden">
                <DialogHeader className="p-6 border-b">
                    <DialogTitle>{editingRole ? 'Edit Role' : 'Create New Role'}</DialogTitle>
                    <DialogDescription>
                    {editingRole ? `Update name and permissions for "${editingRole.name}".` : 'Define a new role and assign its functional modules and accessible reports.'}
                    </DialogDescription>
                </DialogHeader>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /> <AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
                    
                    <FormField control={form.control} name="name" render={({ field }) => (
                        <FormItem><FormLabel>Role Name</FormLabel><FormControl><Input placeholder="e.g., Senior Credit Officer" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    
                    <FormField
                        control={form.control}
                        name="permissions"
                        render={() => (
                            <FormItem className="space-y-4">
                                <div className="mb-2">
                                    <FormLabel className="text-lg font-bold">Permissions Assignment</FormLabel>
                                    <p className="text-sm text-muted-foreground">Select the functional modules and specific reports this role can access.</p>
                                    <FormMessage />
                                </div>
                                <div className="space-y-4">
                                    {permissionsConfig.map(category => (
                                        <PermissionGroup key={category.id} category={category} />
                                    ))}
                                </div>
                            </FormItem>
                        )}
                    />
                </div>
                
                <DialogFooter className="p-6 border-t bg-muted/30">
                    <DialogClose asChild>
                        <Button type="button" variant="ghost">Cancel</Button>
                    </DialogClose>
                    <Button type="submit" disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Role
                    </Button>
                </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the role: <strong>{roleToDelete?.name}</strong>. Users assigned to this role will lose their specific permissions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={loading} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Yes, Delete Role"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}