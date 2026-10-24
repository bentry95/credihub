
'use client';
import { useState, useEffect, useMemo } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { useBranch } from '@/context/BranchContext';
import {
  collection,
  doc,
  writeBatch,
  serverTimestamp,
  query,
  where,
  updateDoc,
  collectionGroup,
  getDocs,
  runTransaction,
} from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  PlusCircle,
  Loader2,
  AlertCircle,
  Trash2,
  Check,
  X,
  Undo,
  Copy,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

const transactionSchema = z.object({
  accountId: z.string().min(1, 'Account is required.'),
  debit: z.coerce.number().min(0).optional(),
  credit: z.coerce.number().min(0).optional(),
}).refine(data => data.debit || data.credit, {
    message: 'Either debit or credit must have a value.',
    path: ['debit'],
}).refine(data => !(data.debit && data.credit), {
    message: 'Cannot have both debit and credit.',
    path: ['credit'],
});

const journalSchema = z.object({
    date: z.date({ required_error: 'Date is required.' }),
    description: z.string().min(1, 'Description is required.'),
    branchId: z.string().min(1, 'You must select a branch.'),
    transactions: z.array(transactionSchema).min(2, 'At least two transactions are required.'),
}).refine(data => {
    const totalDebits = data.transactions.reduce((sum, t) => sum + (t.debit || 0), 0);
    const totalCredits = data.transactions.reduce((sum, t) => sum + (t.credit || 0), 0);
    return Math.abs(totalDebits - totalCredits) < 0.01; 
}, {
    message: 'Total debits must equal total credits.',
    path: ['transactions'],
});

export default function JournalVouchersPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { selectedBranch, availableBranches } = useBranch();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const userDocRef = useMemoFirebase(
    () => (firestore && user?.uid ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);

  const journalsQuery = useMemoFirebase(
    () => (firestore && userData?.institutionId ? collection(firestore, 'institutions', userData.institutionId, 'journals') : null),
    [firestore, userData]
  );
  const { data: allJournals, isLoading: isJournalsLoading } = useCollection(journalsQuery);
  
  const journals = useMemo(() => {
    if (!allJournals) return [];
    if (selectedBranch === 'all') return allJournals;
    return allJournals.filter(j => j.branchId === selectedBranch);
  }, [allJournals, selectedBranch]);


  const pendingNewEntries = journals?.filter(j => j.status === 'Pending') || [];

  const isFiltered = selectedBranch !== 'all';
  
  const paginatedJournals = useMemo(() => {
    if (isFiltered) return journals;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return journals?.slice(startIndex, startIndex + itemsPerPage);
  }, [journals, currentPage, itemsPerPage, isFiltered]);

  const totalPages = journals ? Math.ceil(journals.length / itemsPerPage) : 0;


  const coaQuery = useMemoFirebase(
    () =>
      firestore && userData?.institutionId
        ? collection(firestore, 'institutions', userData.institutionId, 'chartOfAccounts')
        : null,
    [firestore, userData]
  );
  const { data: accounts, isLoading: isCoaLoading } = useCollection(coaQuery);

  const form = useForm<z.infer<typeof journalSchema>>({
    resolver: zodResolver(journalSchema),
    defaultValues: {
        description: '',
        branchId: selectedBranch !== 'all' ? selectedBranch : '',
        transactions: [
            { accountId: '', debit: '' as any, credit: '' as any },
            { accountId: '', debit: '' as any, credit: '' as any },
        ]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'transactions',
  });

  const transactions = useWatch({
      control: form.control,
      name: 'transactions'
  });

  const totalDebits = transactions.reduce((sum, t) => sum + (Number(t.debit) || 0), 0);
  const totalCredits = transactions.reduce((sum, t) => sum + (Number(t.credit) || 0), 0);
  const balance = totalDebits - totalCredits;

  async function handleApproval(journalId: string, action: 'Posted' | 'Rejected') {
      if (!firestore || !userData?.institutionId) return;
      setActionLoading(journalId);
      try {
          const journalRef = doc(firestore, 'institutions', userData.institutionId, 'journals', journalId);
          await updateDoc(journalRef, { status: action });
          toast({ title: 'Success', description: `Journal entry has been ${action.toLowerCase()}.`})
      } catch (e) {
          console.error(e);
          toast({ variant: 'destructive', title: 'Error', description: `Failed to ${action.toLowerCase()} journal.`})
      } finally {
          setActionLoading(null);
      }
  }

  async function onCreateSubmit(values: z.infer<typeof journalSchema>) {
    if (!firestore || !userData?.institutionId) {
        setError('Institution context not found.');
        return;
    };
    setLoading(true);
    setError(null);
    try {
        const institutionDocRef = doc(firestore, 'institutions', userData.institutionId);
        
        await runTransaction(firestore, async (transaction) => {
            const instDoc = await transaction.get(institutionDocRef);
            if (!instDoc.exists()) {
                throw new Error("Institution not found!");
            }
            const journalBatchCounter = instDoc.data().journalBatchCounter || 0;
            const newBatchNumber = journalBatchCounter + 1;
            const newBatchId = `bat${String(newBatchNumber).padStart(7, '0')}`;
            
            const journalsRef = collection(firestore, 'institutions', userData.institutionId, 'journals');
            const newDocRef = doc(journalsRef, newBatchId);
            
            transaction.set(newDocRef, {
                ...values,
                id: newBatchId,
                institutionId: userData.institutionId,
                status: 'Pending',
                createdBy: user?.uid,
                createdAt: serverTimestamp(),
            });

            transaction.update(institutionDocRef, { journalBatchCounter: newBatchNumber });
        });

      setIsCreateDialogOpen(false);
      form.reset();
    } catch (e) {
      console.error(e);
      setError('Failed to create journal entry. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const getBadgeVariant = (status: string) => {
    switch (status) {
        case 'Posted': return 'default';
        case 'Pending': return 'secondary';
        case 'Rejected': return 'destructive';
        case 'Reversal Pending': return 'outline';
        case 'Reversed': return 'outline';
        default: return 'outline';
    }
  }
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
        title: "Copied to clipboard",
        description: `Batch ID ${text} has been copied.`,
    });
  }
  
  const branchesForSelection = useMemo(() => {
    return availableBranches.filter(b => b.id !== 'all');
  }, [availableBranches]);

  return (
    <>
      <Tabs defaultValue="create" className="space-y-4">
          <div className="flex items-center justify-between">
              <div>
                  <h1 className="text-3xl font-bold tracking-tight">Manual Journal Entries</h1>
                  <p className="text-muted-foreground mt-1">
                      Record and approve financial transactions.
                  </p>
              </div>
              <TabsList>
                  <TabsTrigger value="create">Create & View Entries</TabsTrigger>
                  <TabsTrigger value="approve">Approval Queue</TabsTrigger>
              </TabsList>
          </div>
        
        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle>Transaction Log</CardTitle>
              <CardDescription>A complete history of all manual journal entries.</CardDescription>
              <div className="pt-2">
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Create Manual Entry
                  </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Batch ID</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isJournalsLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                      </TableRow>
                    ))
                  ) : paginatedJournals && paginatedJournals.length > 0 ? (
                    paginatedJournals.map((journal) => (
                      <TableRow key={journal.id}>
                        <TableCell>{format(journal.date.toDate(), 'PPP')}</TableCell>
                        <TableCell>
                            <div className="flex items-center gap-2">
                                <span className="font-mono">{journal.id}</span>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(journal.id)}>
                                    <Copy className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </TableCell>
                        <TableCell>{journal.description}</TableCell>
                        <TableCell>{journal.transactions.reduce((sum: number, t: any) => sum + (t.debit || 0), 0).toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={getBadgeVariant(journal.status)}>{journal.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">No journal entries found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
            {!isFiltered && paginatedJournals && paginatedJournals.length > 0 && (
                <CardFooter className="flex items-center justify-between border-t py-4">
                    <div className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                        >
                            Next <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </CardFooter>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="approve">
            <Card>
                <CardHeader>
                    <CardTitle>Approval Queue</CardTitle>
                    <CardDescription>Review and approve or reject pending journal entries.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Amount</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                        <TableBody>
                        {isJournalsLoading ? (
                            <TableRow><TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                        ) : pendingNewEntries.length > 0 ? (
                            pendingNewEntries.map(journal => (
                                <TableRow key={journal.id}>
                                    <TableCell>{format(journal.date.toDate(), 'PPP')}</TableCell>
                                    <TableCell>{journal.description}</TableCell>
                                    <TableCell>{journal.transactions.reduce((sum: number, t: any) => sum + (t.debit || 0), 0).toLocaleString()}</TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button size="icon" variant="outline" onClick={() => handleApproval(journal.id, 'Posted')} disabled={!!actionLoading}><Check className="h-4 w-4" /></Button>
                                        <Button size="icon" variant="destructive" onClick={() => handleApproval(journal.id, 'Rejected')} disabled={!!actionLoading}><X className="h-4 w-4" /></Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow><TableCell colSpan={4} className="h-24 text-center">No pending entries to approve.</TableCell></TableRow>
                        )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
      
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Create Manual Journal Entry</DialogTitle>
            <DialogDescription>
              Record a new double-entry transaction. Ensure total debits equal total credits.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onCreateSubmit)} className="space-y-4">
              {error && <p className="text-sm text-destructive">{error}</p>}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>Value Date</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                            <FormControl>
                                <Button
                                variant={"outline"}
                                className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                )}
                                >
                                {field.value ? (
                                    format(field.value, "PPP")
                                ) : (
                                    <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                            </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) =>
                                date > new Date() || date < new Date("1900-01-01")
                                }
                                initialFocus
                            />
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="branchId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Branch</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select branch" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {branchesForSelection?.map(b => (
                                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                    <FormItem className="md:col-span-2">
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                            <Textarea placeholder="e.g., Monthly office rent payment" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
               </div>
              
              <div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>GL Account</TableHead>
                            <TableHead>Debit</TableHead>
                            <TableHead>Credit</TableHead>
                            <TableHead></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {fields.map((field, index) => (
                            <TableRow key={field.id}>
                                <TableCell>
                                    <FormField
                                        control={form.control}
                                        name={`transactions.${index}.accountId`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select an account" />
                                                    </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                    {isCoaLoading ? <SelectItem value="loading" disabled>Loading...</SelectItem> : accounts?.map(acc => (
                                                        <SelectItem key={acc.glCode} value={acc.glCode}>{acc.glCode} - {acc.accountName}</SelectItem>
                                                    ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </TableCell>
                                <TableCell>
                                    <FormField
                                        control={form.control}
                                        name={`transactions.${index}.debit`}
                                        render={({ field }) => (
                                        <FormItem>
                                            <FormControl><Input type="number" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </TableCell>
                                <TableCell>
                                     <FormField
                                        control={form.control}
                                        name={`transactions.${index}.credit`}
                                        render={({ field }) => (
                                        <FormItem>
                                            <FormControl><Input type="number" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                </TableCell>
                                <TableCell>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 2}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => append({ accountId: '', debit: '' as any, credit: '' as any })}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Row
                </Button>
              </div>

              <div className="pt-4 flex justify-between items-center bg-muted p-4 rounded-md">
                 <div className="text-sm font-medium">
                    {form.formState.errors.transactions && <p className="text-destructive">{form.formState.errors.transactions.message || form.formState.errors.transactions.root?.message}</p>}
                </div>
                <div className="text-right">
                    <p>Total Debits: <span className="font-mono">{totalDebits.toLocaleString()}</span></p>
                    <p>Total Credits: <span className="font-mono">{totalCredits.toLocaleString()}</span></p>
                    <p className={cn("font-bold", balance !== 0 ? 'text-destructive' : 'text-green-600')}>
                        Balance: <span className="font-mono">{balance.toLocaleString()}</span>
                    </p>
                </div>
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="ghost">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={loading || balance !== 0}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit for Approval
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
