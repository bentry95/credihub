'use client';

import React, { useState, useMemo } from 'react';
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
import { collection, doc, setDoc, updateDoc } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
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
  CircleDollarSign,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  Save,
  ChevronLeft,
  ChevronRight,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';

const feeSchema = z.object({
    name: z.string().min(1, 'Fee name is required.'),
    code: z.string().min(1, 'Fee code is required.'),
    category: z.enum(['Loan', 'Savings', 'Transaction', 'Penalty']),
    status: z.enum(['Active', 'Inactive']),
    calculationMethod: z.enum(['Flat Amount', 'Percentage']),
    amount: z.coerce.number().optional(),
    percentage: z.coerce.number().optional(),
    percentageOf: z.enum(['Approved Amount', 'Disbursed Amount', 'Outstanding Balance', 'Overdue Amount']).optional().nullable(),
    trigger: z.enum(['On Application', 'On Approval', 'On Disbursement', 'On Repayment', 'Monthly', 'On Closure', 'On Late Payment', 'On Top-Up', 'On Deposit']),
    collectionMethod: z.enum(['Deduct from Disbursement', 'Add to Principal', 'Paid Separately']),
    incomeAccountId: z.string().min(1, 'Income account is required.'),
    isWaivable: z.boolean().default(false),
}).refine(data => {
    if (data.calculationMethod === 'Flat Amount') return data.amount !== undefined && data.amount > 0;
    return true;
}, { message: 'A flat amount is required.', path: ['amount']})
  .refine(data => {
    if (data.calculationMethod === 'Percentage') return data.percentage !== undefined && data.percentage > 0 && data.percentageOf;
    return true;
}, { message: 'Percentage and what it is a percentage of are required.', path: ['percentage']});

const CurrencyInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<'input'>
>(({ value, onChange, ...props }, ref) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const numValue = rawValue.replace(/,/g, '');
    if (numValue === '' || !isNaN(Number(numValue))) {
      if (onChange) {
        const syntheticEvent = {
          ...e,
          target: {
            ...e.target,
            value: numValue,
            name: props.name,
          },
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      }
    }
  };

  const formattedValue = (value !== undefined && value !== null && value !== '') 
    ? Number(value).toLocaleString('en-US') 
    : '';

  return (
    <Input
      {...props}
      ref={ref}
      value={formattedValue}
      onChange={handleChange}
    />
  );
});
CurrencyInput.displayName = 'CurrencyInput';


export default function FeesPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingFee, setEditingFee] = useState<any | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);

  const institutionId = userData?.institutionId;

  const feesQuery = useMemoFirebase(
    () =>
      firestore && institutionId
        ? collection(firestore, 'institutions', institutionId, 'fees')
        : null,
    [firestore, institutionId]
  );
  const { data: fees, isLoading: isFeesLoading } = useCollection(feesQuery);
  
  const paginatedFees = useMemo(() => {
    if (!fees) return [];
    const startIndex = (currentPage - 1) * itemsPerPage;
    return fees.slice(startIndex, startIndex + itemsPerPage);
  }, [fees, currentPage, itemsPerPage]);

  const totalPages = fees ? Math.ceil(fees.length / itemsPerPage) : 0;

  const coaQuery = useMemoFirebase(
    () =>
      firestore && institutionId
        ? collection(firestore, 'institutions', institutionId, 'chartOfAccounts')
        : null,
    [firestore, institutionId]
  );
  const { data: accounts, isLoading: isCoaLoading } = useCollection(coaQuery);

  const form = useForm<z.infer<typeof feeSchema>>({
    resolver: zodResolver(feeSchema),
  });

  const calculationMethod = useWatch({ control: form.control, name: 'calculationMethod' });

  const handleCreate = () => {
    setEditingFee(null);
    form.reset({
      name: '',
      code: '',
      category: 'Loan',
      status: 'Active',
      calculationMethod: 'Flat Amount',
      amount: 0,
      percentage: 0,
      percentageOf: null,
      trigger: 'On Disbursement',
      collectionMethod: 'Deduct from Disbursement',
      incomeAccountId: '',
      isWaivable: false,
    });
    setIsFormOpen(true);
  };
  
  const handleEdit = (fee: any) => {
    setEditingFee(fee);
    form.reset(fee);
    setIsFormOpen(true);
  };

  async function onSubmit(values: z.infer<typeof feeSchema>) {
    if (!firestore || !institutionId) return;

    setLoading(true);
    setError(null);
    try {
        const feesRef = collection(firestore, 'institutions', institutionId, 'fees');
        const feeData = { ...values };

        if (editingFee) {
            const feeDoc = doc(feesRef, editingFee.id);
            await updateDoc(feeDoc, feeData);
            toast({ title: "Fee Updated", description: `The fee "${values.name}" has been updated.` });
        } else {
            const newDocRef = doc(feesRef);
            await setDoc(newDocRef, { ...feeData, id: newDocRef.id });
            toast({ title: "Fee Created", description: `The fee "${values.name}" has been created.` });
        }
      
        setIsFormOpen(false);
        setEditingFee(null);
        form.reset();
    } catch (e) {
      console.error('Error saving fee:', e);
      setError('Failed to save fee. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const getBadgeVariant = (status: string) => (status === 'Active' ? 'default' : 'secondary');
  const incomeAccounts = accounts?.filter(acc => acc.accountType === 'Income') || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fees &amp; Charges</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage a central library of all fees.
          </p>
        </div>
        <Button onClick={handleCreate}>
          <PlusCircle className="mr-2 h-4 w-4" /> Create New Fee
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fee Library</CardTitle>
          <CardDescription>
            A list of all fees configured for your institution.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fee Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Calculation</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isFeesLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : paginatedFees && paginatedFees.length > 0 ? (
                paginatedFees.map((fee) => (
                  <TableRow key={fee.id}>
                    <TableCell className="font-medium">{fee.name}</TableCell>
                    <TableCell>{fee.category}</TableCell>
                    <TableCell>
                      {fee.calculationMethod === 'Flat Amount' 
                        ? `MWK ${fee.amount?.toLocaleString()}` 
                        : `${fee.percentage}% of ${fee.percentageOf}`}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getBadgeVariant(fee.status)}>{fee.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                       <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <MoreVertical className="h-5 w-5" />
                            </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(fee)}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="p-4 bg-muted rounded-full">
                            <CircleDollarSign className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold">No Fees Found</h3>
                        <p className="text-muted-foreground">Get started by creating your first fee.</p>
                        <Button onClick={handleCreate}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Create Fee
                        </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        {paginatedFees && paginatedFees.length > 0 && (
          <CardFooter className="flex items-center justify-between border-t py-4">
            <div className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</div>
            <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 mr-1"/> Prev</Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next <ChevronRight className="h-4 ml-1"/></Button>
            </div>
          </CardFooter>
        )}
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <DialogHeader>
                <DialogTitle>{editingFee ? "Edit Fee" : "Create New Fee"}</DialogTitle>
                <DialogDescription>
                  Define the details for a new fee or charge.
                </DialogDescription>
              </DialogHeader>
              
              <div className="py-4 max-h-[70vh] overflow-y-auto pr-6">
                {error && <Alert variant="destructive" className="mb-4"><AlertCircle className="h-4 w-4" /> <AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
                <Accordion type="multiple" defaultValue={['item-1', 'item-2', 'item-3']} className="w-full">
                   <AccordionItem value="item-1">
                        <AccordionTrigger>Basic Information</AccordionTrigger>
                        <AccordionContent>
                            <Card className="border-none shadow-none"><CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Fee Name</FormLabel><FormControl><Input placeholder="e.g., Loan Processing Fee" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="code" render={({ field }) => (<FormItem><FormLabel>Fee Code</FormLabel><FormControl><Input placeholder="e.g., LPF01" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="category" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Fee Category</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl>
                                        <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="Loan">Loan</SelectItem>
                                        <SelectItem value="Savings">Savings</SelectItem>
                                        <SelectItem value="Transaction">Transaction</SelectItem>
                                        <SelectItem value="Penalty">Penalty</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )} />
                                <FormField control={form.control} name="status" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Status</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="Active">Active</SelectItem>
                                        <SelectItem value="Inactive">Inactive</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )} />
                            </CardContent></Card>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-2">
                        <AccordionTrigger>Calculation &amp; Collection</AccordionTrigger>
                        <AccordionContent>
                             <Card className="border-none shadow-none"><CardContent className="pt-6 space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                     <FormField control={form.control} name="calculationMethod" render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Calculation Method</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                          <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Select calculation" /></SelectTrigger>
                                          </FormControl>
                                          <SelectContent>
                                            <SelectItem value="Flat Amount">Flat Amount</SelectItem>
                                            <SelectItem value="Percentage">Percentage</SelectItem>
                                          </SelectContent>
                                        </Select>
                                        <FormMessage />
                                      </FormItem>
                                     )} />
                                     {calculationMethod === 'Flat Amount' && <FormField control={form.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Amount (MWK)</FormLabel><FormControl><CurrencyInput {...field} /></FormControl><FormMessage /></FormItem>)} />}
                                </div>
                                {calculationMethod === 'Percentage' && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={form.control} name="percentage" render={({ field }) => (<FormItem><FormLabel>Percentage (%)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="percentageOf" render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>Percentage Of</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value || ''}>
                                              <FormControl>
                                                <SelectTrigger><SelectValue placeholder="Select base..." /></SelectTrigger>
                                              </FormControl>
                                              <SelectContent>
                                                <SelectItem value="Approved Amount">Approved Amount</SelectItem>
                                                <SelectItem value="Disbursed Amount">Disbursed Amount</SelectItem>
                                                <SelectItem value="Outstanding Balance">Outstanding Balance</SelectItem>
                                                <SelectItem value="Overdue Amount">Overdue Amount</SelectItem>
                                              </SelectContent>
                                            </Select>
                                            <FormMessage />
                                          </FormItem>
                                        )} />
                                    </div>
                                )}
                                 <FormField control={form.control} name="trigger" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Trigger Event</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl>
                                        <SelectTrigger><SelectValue placeholder="When is this fee charged?" /></SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="On Application">On Application</SelectItem>
                                        <SelectItem value="On Approval">On Approval</SelectItem>
                                        <SelectItem value="On Disbursement">On Disbursement</SelectItem>
                                        <SelectItem value="On Repayment">On Repayment</SelectItem>
                                        <SelectItem value="Monthly">Monthly</SelectItem>
                                        <SelectItem value="On Closure">On Account Closure</SelectItem>
                                        <SelectItem value="On Late Payment">On Late Payment</SelectItem>
                                        <SelectItem value="On Top-Up">On Top-Up</SelectItem>
                                        <SelectItem value="On Deposit">On Deposit</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                 )} />
                                 <FormField control={form.control} name="collectionMethod" render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Collection Method</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl>
                                        <SelectTrigger><SelectValue placeholder="How is the fee collected?" /></SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="Deduct from Disbursement">Deduct from Disbursement</SelectItem>
                                        <SelectItem value="Add to Principal">Add to Principal (Capitalize)</SelectItem>
                                        <SelectItem value="Paid Separately">Paid Separately</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                 )} />
                             </CardContent></Card>
                        </AccordionContent>
                    </AccordionItem>
                     <AccordionItem value="item-3">
                        <AccordionTrigger>Accounting &amp; Rules</AccordionTrigger>
                        <AccordionContent>
                             <Card className="border-none shadow-none"><CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField control={form.control} name="incomeAccountId" render={({ field }) => (
                                    <FormItem className="md:col-span-2">
                                        <FormLabel>GL Income Account</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger><SelectValue placeholder={isCoaLoading ? "Loading..." : "Select an income account"} /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                              {incomeAccounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.glCode} - {acc.accountName}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={form.control} name="isWaivable" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 col-span-full"><div className="space-y-0.5"><FormLabel>Fee Waivable</FormLabel></div><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                             </CardContent></Card>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
              </div>
              <DialogFooter className="pt-4 px-6 pb-6">
                  <DialogClose asChild>
                      <Button type="button" variant="ghost">Cancel</Button>
                  </DialogClose>
                  <Button type="submit" disabled={loading}>
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      {editingFee ? "Save Changes" : "Create Fee"}
                  </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
