
'use client';

import { useState, useEffect } from 'react';
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
import {
  collection,
  doc,
  writeBatch,
  serverTimestamp,
  setDoc,
  updateDoc,
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
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
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Book,
  PlusCircle,
  FileText,
  Loader2,
  AlertCircle,
  Pencil,
  Download,
  Upload,
  Landmark,
} from 'lucide-react';
import { coaTemplate } from '@/lib/coa-template';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

const accountSchema = z.object({
  accountType: z.enum(['Asset', 'Liability', 'Equity', 'Income', 'Expense']),
  accountName: z.string().min(1, 'Account Name is required.'),
  subType: z.string().min(1, 'Sub-type is required.'),
  isBankAccount: z.boolean().default(false),
});

const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'];
const ACCOUNT_TYPE_PLURALS: Record<string, string> = {
    Asset: 'Assets',
    Liability: 'Liabilities',
    Equity: 'Equity',
    Income: 'Income',
    Expense: 'Expenses',
};


const subTypeOptions: Record<string, string[]> = {
    Asset: ['Current Asset', 'Fixed Asset', 'Financial Asset', 'Intangible Asset'],
    Liability: ['Current Liability', 'Long-term Liability'],
    Equity: ['Member Equity', 'Institutional Capital'],
    Income: ['Operating Income', 'Non-Operating Income'],
    Expense: ['Operating Expense', 'Financial Expense', 'Personnel Expense'],
};


export default function ChartOfAccountsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any | null>(null);
  const [suggestedGlCode, setSuggestedGlCode] = useState('');

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData, isLoading: userLoading } = useDoc(userDocRef);

  const coaQuery = useMemoFirebase(
    () =>
      firestore && userData?.institutionId
        ? collection(firestore, 'institutions', userData.institutionId, 'chartOfAccounts')
        : null,
    [firestore, userData]
  );
  const { data: accounts, isLoading: isAccountsLoading } = useCollection(coaQuery);

  const form = useForm<z.infer<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
        accountType: undefined,
        subType: '',
        accountName: '',
        isBankAccount: false,
    },
  });

  const watchedAccountType = useWatch({
      control: form.control,
      name: 'accountType',
  });

  useEffect(() => {
    if (watchedAccountType && accounts) {
        const typePrefixes: Record<string, string> = {
            'Asset': '1',
            'Liability': '2',
            'Equity': '3',
            'Income': '4',
            'Expense': '5',
        };
        const prefix = typePrefixes[watchedAccountType];
        
        const relevantAccounts = accounts.filter(acc => acc.glCode.startsWith(prefix));
        let maxCode = 0;
        
        relevantAccounts.forEach(acc => {
            const codeNum = parseInt(acc.glCode, 10);
            if (!isNaN(codeNum) && codeNum > maxCode) {
                maxCode = codeNum;
            }
        });
        
        const nextCode = maxCode > 0 ? maxCode + 1 : parseInt(`${prefix}0001`, 10);
        setSuggestedGlCode(String(nextCode).padStart(4, '0'));
    }
  }, [watchedAccountType, accounts]);


  const handleImportTemplate = async () => {
    if (!firestore || !userData?.institutionId) {
        setError('Could not identify your institution. Please try again.');
        return;
    }

    setLoading(true);
    setError(null);
    try {
      const batch = writeBatch(firestore);
      const coaRef = collection(firestore, 'institutions', userData.institutionId, 'chartOfAccounts');

      coaTemplate.forEach(account => {
        const docRef = doc(coaRef, account.glCode);
        batch.set(docRef, {
          ...account,
          id: docRef.id,
        });
      });

      await batch.commit();
    } catch (e) {
      console.error(e);
      setError('Failed to import Chart of Accounts template. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  async function onCreateSubmit(values: z.infer<typeof accountSchema>) {
    if (!firestore || !userData?.institutionId || !suggestedGlCode) return;
    setLoading(true);
    setError(null);
    try {
      const coaRef = collection(firestore, 'institutions', userData.institutionId, 'chartOfAccounts');
      const newDocRef = doc(coaRef, suggestedGlCode); // Use suggested code as ID
      await setDoc(newDocRef, {
        ...values,
        glCode: suggestedGlCode,
        id: newDocRef.id,
        isEditable: true,
      });
      setIsCreateDialogOpen(false);
      form.reset();
    } catch (e) {
      console.error(e);
      setError('Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const handleEditClick = (account: any) => {
    setEditingAccount(account);
    form.reset({
        accountName: account.accountName,
        subType: account.subType,
        accountType: account.accountType,
        isBankAccount: account.isBankAccount || false,
    });
    setIsEditDialogOpen(true);
  };

  async function onEditSubmit(values: z.infer<typeof accountSchema>) {
    if (!firestore || !userData?.institutionId || !editingAccount) return;
    setLoading(true);
    setError(null);
    try {
        const accountDocRef = doc(firestore, 'institutions', userData.institutionId, 'chartOfAccounts', editingAccount.id);
        await updateDoc(accountDocRef, {
            accountName: values.accountName,
            subType: values.subType,
            isBankAccount: values.isBankAccount,
        });
        setIsEditDialogOpen(false);
        setEditingAccount(null);
    } catch (e) {
        console.error(e);
        setError('Failed to update account. Please try again.');
    } finally {
        setLoading(false);
    }
  }


  const groupedAccounts = accounts?.reduce((acc, account) => {
    const type = account.accountType;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(account);
    return acc;
  }, {} as Record<string, any[]>);

  const pageIsLoading = isAccountsLoading || userLoading;

  if (pageIsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-8 w-2/3" />
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-1/4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!accounts || accounts.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="w-full max-w-2xl text-center">
          <CardHeader>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Book className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle className="mt-4 text-2xl">
              Set Up Your Chart of Accounts
            </CardTitle>
            <CardDescription>
              To get started, you need a Chart of Accounts (COA) for your institution. You can import
              our standard template or create your accounts manually.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card className="p-6">
              <div className="flex flex-col items-center gap-4">
                <Download className="h-10 w-10 text-primary" />
                <h3 className="font-semibold">Use CrediHub Template</h3>
                <p className="text-sm text-muted-foreground">
                  Recommended for most institutions. Imports a standardized,
                  ready-to-use COA.
                </p>
                <Button onClick={handleImportTemplate} disabled={loading || pageIsLoading} className="w-full mt-2">
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    'Import Template'
                  )}
                </Button>
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex flex-col items-center gap-4">
                <Upload className="h-10 w-10 text-primary" />
                <h3 className="font-semibold">Create Manually</h3>
                <p className="text-sm text-muted-foreground">
                  For institutions with a highly customized accounting
                  structure.
                </p>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(true)}
                  disabled={loading || pageIsLoading}
                  className="w-full mt-2"
                >
                  Start Manually
                </Button>
              </div>
            </Card>
          </CardContent>
          {error && (
            <CardFooter>
                <Alert variant="destructive" className="w-full">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
                </Alert>
            </CardFooter>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Chart of Accounts</h1>
          <p className="text-muted-foreground mt-1">
            Manage your institution's General Ledger accounts.
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" /> Create New Account
        </Button>
      </div>
      
      <Accordion type="single" collapsible className="w-full" defaultValue="Asset">
        {ACCOUNT_TYPES.map(type => (
          <AccordionItem value={type} key={type}>
            <AccordionTrigger className="text-lg font-medium">{ACCOUNT_TYPE_PLURALS[type]}</AccordionTrigger>
            <AccordionContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>GL Code</TableHead>
                    <TableHead>Account Name</TableHead>
                    <TableHead>Sub-Type</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedAccounts && groupedAccounts[type] ? (
                    groupedAccounts[type].map(account => (
                      <TableRow key={account.id}>
                        <TableCell className="font-mono">{account.glCode}</TableCell>
                        <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                                {account.accountName}
                                {account.isBankAccount && (
                                    <Badge variant="secondary" className="gap-1">
                                        <Landmark className="h-3 w-3" />
                                        Bank
                                    </Badge>
                                )}
                            </div>
                        </TableCell>
                        <TableCell>{account.subType}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" disabled={!account.isEditable} onClick={() => handleEditClick(account)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center">
                        No {type} accounts found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

       <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New GL Account</DialogTitle>
            <DialogDescription>
              Add a new account to your Chart of Accounts for this institution.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onCreateSubmit)} className="space-y-4">
              {error && <p className="text-sm text-destructive">{error}</p>}
              <FormField
                control={form.control}
                name="accountType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select account type" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ACCOUNT_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="subType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sub-Type</FormLabel>
                     <Select onValueChange={field.onChange} value={field.value} disabled={!watchedAccountType}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select sub-type" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {watchedAccountType && subTypeOptions[watchedAccountType]?.map(subType => <SelectItem key={subType} value={subType}>{subType}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormItem>
                    <FormLabel>GL Code (Auto-generated)</FormLabel>
                    <FormControl>
                      <Input value={suggestedGlCode} disabled />
                    </FormControl>
                </FormItem>
              <FormField
                control={form.control}
                name="accountName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Cash on Hand" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isBankAccount"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Is Bank/Cash Account?</FormLabel>
                      <FormDescription>Enable this if the account is used to hold cash or is a bank account for processing receipts/payments.</FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="ghost">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Account
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
       <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit GL Account</DialogTitle>
            <DialogDescription>
              Editing account: {editingAccount?.glCode} - {editingAccount?.accountName}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onEditSubmit)} className="space-y-4">
              {error && <p className="text-sm text-destructive">{error}</p>}
              <FormField
                control={form.control}
                name="accountName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="subType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sub-Type</FormLabel>
                     <Select onValueChange={field.onChange} value={field.value} disabled={!editingAccount?.isEditable}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select sub-type" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {editingAccount?.accountType && subTypeOptions[editingAccount?.accountType]?.map(subType => <SelectItem key={subType} value={subType}>{subType}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isBankAccount"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Is Bank/Cash Account?</FormLabel>
                      <FormDescription>Enable this if the account is used to hold cash or is a bank account for processing receipts/payments.</FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="ghost">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
