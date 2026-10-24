'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, doc, query, updateDoc } from 'firebase/firestore';
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
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
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
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
} from '@/components/ui/form';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { KeySquare, Pencil, Loader2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { reportsConfig, ReportCategory } from '@/lib/reports';

const permissionsSchema = z.object({
  permissions: z.array(z.string()).default([]),
});

export default function ReportPermissionsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);
  const institutionId = userData?.institutionId;

  const rolesQuery = useMemoFirebase(
    () =>
      firestore && institutionId
        ? query(collection(firestore, 'institutions', institutionId, 'roles'))
        : null,
    [firestore, institutionId]
  );
  const { data: roles, isLoading: isRolesLoading } = useCollection(rolesQuery);
  const customRoles = roles?.filter(role => !role.isSystemRole) || [];

  const form = useForm<z.infer<typeof permissionsSchema>>({
    resolver: zodResolver(permissionsSchema),
    defaultValues: {
      permissions: [],
    },
  });

  const handleEditClick = (role: any) => {
    setSelectedRole(role);
    form.reset({ permissions: role.permissions || [] });
    setIsDialogOpen(true);
  };
  
  const onSubmit = async (values: z.infer<typeof permissionsSchema>) => {
    if (!firestore || !institutionId || !selectedRole) return;

    setLoading(true);
    try {
        const roleDocRef = doc(firestore, 'institutions', institutionId, 'roles', selectedRole.id);
        await updateDoc(roleDocRef, {
            permissions: values.permissions,
        });

        toast({
            title: "Permissions Updated",
            description: `Report permissions for the "${selectedRole.name}" role have been saved.`,
        });

        setIsDialogOpen(false);
        setSelectedRole(null);
    } catch(e) {
        console.error("Error updating permissions:", e);
        toast({
            variant: "destructive",
            title: "Update Failed",
            description: "Could not save the new permissions.",
        });
    } finally {
        setLoading(false);
    }
  }

  return (
    <>
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Report Permissions</h1>
          <p className="text-muted-foreground mt-1">
            Control which user roles have access to view specific reports.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Role Access</CardTitle>
          <CardDescription>
            System roles (Admin, Staff) have access to all reports by default. Edit custom roles to configure their report access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role Name</TableHead>
                <TableHead>Accessible Reports</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isRolesLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-9 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : customRoles.length > 0 ? (
                customRoles.map((role) => {
                  const reportPermissions = role.permissions.filter((p: string) => p.startsWith('report:'));
                  return (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">{role.name}</TableCell>
                      <TableCell>{reportPermissions.length} reports</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => handleEditClick(role)}>
                          <Pencil className="mr-2 h-4 w-4" /> Manage Permissions
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-muted rounded-full">
                        <KeySquare className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold">No Custom Roles Found</h3>
                      <p className="text-muted-foreground">Create a custom role to manage granular report permissions.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
    
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl">
            <DialogHeader>
                <DialogTitle>Manage Report Permissions for: {selectedRole?.name}</DialogTitle>
                <DialogDescription>Select the reports this role should be able to access.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="max-h-[60vh] overflow-y-auto p-1 pr-4 space-y-2">
                        {reportsConfig.map(category => (
                            <Accordion key={category.category} type="single" collapsible className="w-full">
                                <AccordionItem value="item-1">
                                    <AccordionTrigger>{category.category}</AccordionTrigger>
                                    <AccordionContent>
                                        <div className="space-y-2 pl-4">
                                            {category.reports.map(report => (
                                                <FormField
                                                    key={report.href}
                                                    control={form.control}
                                                    name="permissions"
                                                    render={({ field }) => (
                                                        <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                                            <FormControl>
                                                                <Checkbox
                                                                    checked={field.value?.includes(report.permissionId)}
                                                                    onCheckedChange={(checked) => {
                                                                        const newValue = checked
                                                                            ? [...(field.value || []), report.permissionId]
                                                                            : field.value?.filter(id => id !== report.permissionId);
                                                                        field.onChange(newValue);
                                                                    }}
                                                                />
                                                            </FormControl>
                                                            <FormLabel className="font-normal">{report.title}</FormLabel>
                                                        </FormItem>
                                                    )}
                                                />
                                            ))}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        ))}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                        <Button type="submit" disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                            Save Permissions
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>
    </>
  );
}