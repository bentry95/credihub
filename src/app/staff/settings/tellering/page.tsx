'use client';

import { useState, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  useUser,
  useFirestore,
  useDoc,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import {
  doc,
  updateDoc,
  collection,
  setDoc,
  query,
  where,
} from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Building, PlusCircle, Loader2, AlertCircle, Home, Hash, MapPin, MoreVertical, Pencil, Trash2, HandCoins } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';


const tellerSchemaBase = z.object({
    userId: z.string().min(1, 'Please select a staff member.'),
    branchId: z.string().min(1, 'Please select a branch.'),
    role: z.enum(['Regular Cashier', 'Chief Cashier']),
    tillAccountId: z.string().min(1, 'Please link a GL cash account.'),
    status: z.enum(['Active', 'Suspended']),
});

const regularCashierSchema = tellerSchemaBase.extend({
    role: z.literal('Regular Cashier'),
    maxCashLimit: z.coerce.number().positive(),
    minDepositLimit: z.coerce.number().min(0),
    maxDepositLimit: z.coerce.number().positive(),
    minWithdrawalLimit: z.coerce.number().min(0),
    maxWithdrawalLimit: z.coerce.number().positive(),
});

const chiefCashierSchema = tellerSchemaBase.extend({
    role: z.literal('Chief Cashier'),
    maxCashLimit: z.coerce.number().optional(),
    minDepositLimit: z.coerce.number().optional(),
    maxDepositLimit: z.coerce.number().optional(),
    minWithdrawalLimit: z.coerce.number().optional(),
    maxWithdrawalLimit: z.coerce.number().optional(),
});

const tellerSchema = z.discriminatedUnion('role', [regularCashierSchema, chiefCashierSchema]);

export default function TellerManagementPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingTeller, setEditingTeller] = useState<any | null>(null);
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);

  const institutionDocRef = useMemoFirebase(
    () => (firestore && userData?.institutionId ? doc(firestore, 'institutions', userData.institutionId) : null),
    [firestore, userData]
  );
  const { data: institutionData, isLoading: isInstitutionLoading } = useDoc(institutionDocRef);
  
  const tellersQuery = useMemoFirebase(
    () =>
      firestore && userData?.institutionId
        ? collection(firestore, 'institutions', userData.institutionId, 'tellers')
        : null,
    [firestore, userData]
  );
  const { data: tellers, isLoading: isTellersLoading } = useCollection(tellersQuery);

  const staffQuery = useMemoFirebase(
    () => (firestore && userData?.institutionId ? query(collection(firestore, 'users'), where('institutionId', '==', userData.institutionId)) : null),
    [firestore, userData]
  );
  const { data: staff, isLoading: isStaffLoading } = useCollection(staffQuery);
  
  const coaQuery = useMemoFirebase(
    () =>
      firestore && userData?.institutionId
        ? collection(firestore, 'institutions', userData.institutionId, 'chartOfAccounts')
        : null,
    [firestore, userData]
  );
  const { data: accounts, isLoading: isCoaLoading } = useCollection(coaQuery);

  const allBranches = useMemo(() => {
    if (!institutionData) return [];
    const hqBranch = { id: '01', name: institutionData.hqBranch?.name || 'Headquarters' };
    return [hqBranch, ...(institutionData.branches || [])].sort((a,b) => a.id.localeCompare(b.id));
  }, [institutionData]);

  const form = useForm<z.infer<typeof tellerSchema>>({
    resolver: zodResolver(tellerSchema),
    defaultValues: {
        role: 'Regular Cashier',
        status: 'Active',
        maxCashLimit: 0,
        minDepositLimit: 0,
        maxDepositLimit: 0,
        minWithdrawalLimit: 0,
        maxWithdrawalLimit: 0,
    }
  });

  const selectedRole = useWatch({
    control: form.control,
    name: 'role',
  });

  const handleCreateClick = () => {
    setEditingTeller(null);
    form.reset({
        role: 'Regular Cashier',
        status: 'Active',
        maxCashLimit: 0,
        minDepositLimit: 0,
        maxDepositLimit: 0,
        minWithdrawalLimit: 0,
        maxWithdrawalLimit: 0,
    });
    setIsFormOpen(true);
  };
  
  const handleEditClick = (teller: any) => {
    setEditingTeller(teller);
    form.reset(teller);
    setIsFormOpen(true);
  };


  async function onSubmit(values: z.infer<typeof tellerSchema>) {
    if (!firestore || !userData?.institutionId) return;

    setLoading(true);
    setError(null);
    try {
      const tellersRef = collection(firestore, 'institutions', userData.institutionId, 'tellers');
      let newTellerData: any = {
        ...values,
        institutionId: userData.institutionId,
      };

      if (values.role === 'Chief Cashier') {
        delete newTellerData.maxCashLimit;
        delete newTellerData.minDepositLimit;
        delete newTellerData.maxDepositLimit;
        delete newTellerData.minWithdrawalLimit;
        delete newTellerData.maxWithdrawalLimit;
      }
      
      if (editingTeller) {
        const tellerDocRef = doc(tellersRef, editingTeller.id);
        await updateDoc(tellerDocRef, newTellerData);
        toast({ title: 'Teller Updated', description: 'The teller configuration has been saved.' });
      } else {
        const newDocRef = doc(tellersRef);
        newTellerData.id = newDocRef.id;
        await setDoc(newDocRef, newTellerData);
        toast({ title: 'Teller Created', description: 'The new teller has been configured.' });
      }
      
      setIsFormOpen(false);
      setEditingTeller(null);
      form.reset();
    } catch (e) {
      console.error('Error saving teller:', e);
      setError('Failed to save teller configuration. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const getBadgeVariant = (status: string) => (status === 'Active' ? 'default' : 'destructive');
  const cashAccounts = accounts?.filter(acc => acc.glCode.startsWith('131')) || [];
  const getStaffName = (userId: string) => staff?.find(s => s.uid === userId)?.name || 'Unknown User';
  const getAccountName = (accountId: string) => accounts?.find(a => a.id === accountId)?.accountName || 'Unknown Account';
  const getBranchName = (branchId: string) => allBranches?.find(b => b.id === branchId)?.name || 'Unknown Branch';


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Teller Management</h1>
          <p className="text-muted-foreground mt-1">
            Create, configure, and manage your tellers and their tills.
          </p>
        </div>
        <Button onClick={handleCreateClick}>
          <PlusCircle className="mr-2 h-4 w-4" /> Create Teller
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configured Tellers</CardTitle>
          <CardDescription>
            A list of all staff members assigned to teller roles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff Member</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Linked Till Account</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isTellersLoading || isStaffLoading || isCoaLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : tellers && tellers.length > 0 ? (
                tellers.map((teller) => (
                  <TableRow key={teller.id}>
                    <TableCell className="font-medium">{getStaffName(teller.userId)}</TableCell>
                    <TableCell>{getBranchName(teller.branchId)}</TableCell>
                    <TableCell>{teller.role}</TableCell>
                    <TableCell>{getAccountName(teller.tillAccountId)}</TableCell>
                    <TableCell>
                      <Badge variant={getBadgeVariant(teller.status)}>{teller.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                       <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditClick(teller)}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="p-4 bg-muted rounded-full">
                            <HandCoins className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold">No Tellers Found</h3>
                        <p className="text-muted-foreground">Get started by creating your first teller.</p>
                        <Button onClick={handleCreateClick}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Create Teller
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingTeller ? `Edit Teller: ${getStaffName(editingTeller.userId)}` : 'Create New Teller'}</DialogTitle>
            <DialogDescription>
              Assign a staff member to a teller role and configure their permissions and limits.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /> <AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
                <div className="max-h-[60vh] overflow-y-auto p-1 pr-4 space-y-4">
                    <Card>
                        <CardHeader><CardTitle>Identity & Assignment</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <FormField control={form.control} name="userId" render={({ field }) => (
                                <FormItem><FormLabel>Staff Member</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value} disabled={!!editingTeller}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder={isStaffLoading ? "Loading..." : "Select staff..."} /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {staff?.map(s => <SelectItem key={s.id} value={s.uid}>{s.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField
                                control={form.control}
                                name="branchId"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Branch</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                        <SelectValue placeholder="Select branch..." />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {allBranches.map((branch) => (
                                        <SelectItem key={branch.id} value={branch.id}>
                                            {branch.name}
                                        </SelectItem>
                                        ))}
                                    </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                             <FormField control={form.control} name="role" render={({ field }) => (
                                <FormItem><FormLabel>Teller Role</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="Regular Cashier">Regular Cashier</SelectItem>
                                            <SelectItem value="Chief Cashier">Chief Cashier</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Accounting & Status</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <FormField control={form.control} name="tillAccountId" render={({ field }) => (
                                <FormItem><FormLabel>Till GL Account</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue placeholder={isCoaLoading ? "Loading..." : "Select cash account..."} /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {cashAccounts?.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.glCode} - {acc.accountName}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="status" render={({ field }) => (
                                <FormItem><FormLabel>Status</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="Active">Active</SelectItem>
                                            <SelectItem value="Suspended">Suspended</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </CardContent>
                    </Card>
                     {selectedRole === 'Regular Cashier' && (
                        <Card>
                            <CardHeader><CardTitle>Transaction Limits</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <FormField control={form.control} name="maxCashLimit" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Maximum Till Cash Holding</FormLabel>
                                        <FormControl><Input type="number" placeholder="e.g., 1000000" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="minDepositLimit" render={({ field }) => (
                                        <FormItem><FormLabel>Min. Deposit</FormLabel><FormControl><Input type="number" placeholder="e.g., 1000" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="maxDepositLimit" render={({ field }) => (
                                        <FormItem><FormLabel>Max. Deposit</FormLabel><FormControl><Input type="number" placeholder="e.g., 500000" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="minWithdrawalLimit" render={({ field }) => (
                                        <FormItem><FormLabel>Min. Withdrawal</FormLabel><FormControl><Input type="number" placeholder="e.g., 1000" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="maxWithdrawalLimit" render={({ field }) => (
                                        <FormItem><FormLabel>Max. Withdrawal</FormLabel><FormControl><Input type="number" placeholder="e.g., 200000" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                </div>
                            </CardContent>
                        </Card>
                     )}
                </div>
                <DialogFooter className="pt-4">
                    <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                    <Button type="submit" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        {editingTeller ? 'Save Changes' : 'Create Teller'}
                    </Button>
                </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
