
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Building,
  Mail,
  MapPin,
  Phone,
  PlusCircle,
  Hash,
  Loader2,
  AlertCircle,
  MoreVertical,
  Briefcase,
  Globe,
  Home,
  FileText,
  CalendarIcon,
  Trash2,
  Pencil,
  User,
  Lock,
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
  Form,
  FormControl,
  FormDescription,
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useFirestore, useCollection, useMemoFirebase, useFirebaseApp, useUser } from '@/firebase';
import { collection, addDoc, doc, setDoc, serverTimestamp, writeBatch, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { coaTemplate } from '@/lib/coa-template';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';

const malawiDistricts = [
    "Balaka", "Blantyre", "Chikwawa", "Chiradzulu", "Chitipa",
    "Dedza", "Dowa", "Karonga", "Kasungu", "Likoma",
    "Lilongwe", "Machinga", "Mangochi", "Mchinji", "Mulanje",
    "Mwanza", "Mzimba", "Neno", "Nkhata Bay", "Nkhotakota",
    "Nsanje", "Ntcheu", "Ntchisi", "Phalombe", "Rumphi",
    "Salima", "Thyolo", "Zomba"
];

const formSchema = z.object({
  name: z.string().min(1, 'Institution name is required.'),
  shortName: z.string().min(1, 'Short name is required.'),
  registrationNumber: z.string(),
  type: z.enum(['SACCO', 'MFI']),
  isDepositTaking: z.boolean().default(true),
  location: z.string().min(1, 'District is required.'),
  physicalAddress: z.string().min(1, 'Physical address is required.'),
  hqBranchName: z.string().optional(),
  hqBranchCode: z.string().length(2, 'HQ branch code must be 2 digits.'),
  contactEmail: z.string().email('Invalid email address.'),
  contactPhone: z.string().min(1, 'Phone number is required.'),
  website: z.string().url('Invalid URL.').optional().or(z.literal('')),
  systemDate: z.date({ required_error: 'Initial system date is required.' }),
});

const branchSchema = z.object({
  name: z.string().min(1, 'Branch name is required.'),
  code: z.string().length(2, 'Branch code must be 2 digits.'),
  location: z.string().min(1, 'Location is required.'),
});

export default function InstitutionsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [selectedInstitution, setSelectedInstitution] = useState<any | null>(null);
  const firestore = useFirestore();
  const app = useFirebaseApp();
  const { user: currentUser } = useUser();
  const { toast } = useToast();

  const institutionsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'institutions') : null),
    [firestore]
  );
  const { data: institutions, isLoading: institutionsLoading } = useCollection(institutionsQuery);

  const nextRegistrationNumber = useMemo(() => {
    if (!institutions) return '001';
    const existingNumbers = institutions
        .map(inst => parseInt(inst.registrationNumber, 10))
        .filter(num => !isNaN(num));

    if (existingNumbers.length === 0) return '001';
    
    const maxNumber = Math.max(...existingNumbers);
    return String(maxNumber + 1).padStart(3, '0');
  }, [institutions]);


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      shortName: '',
      registrationNumber: nextRegistrationNumber,
      type: undefined,
      isDepositTaking: true,
      location: '',
      physicalAddress: '',
      hqBranchName: 'Headquarters',
      hqBranchCode: '01',
      contactEmail: '',
      contactPhone: '',
      website: '',
      systemDate: new Date(),
    },
  });
  
  const branchForm = useForm<z.infer<typeof branchSchema>>({
    resolver: zodResolver(branchSchema),
    defaultValues: { name: '', code: '', location: ''},
  });

  useEffect(() => {
    form.setValue('registrationNumber', nextRegistrationNumber);
  }, [nextRegistrationNumber, form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (!firestore || !app || !currentUser) {
        setError('Firebase services are not available. Please try again.');
        setLoading(false);
        return;
    }
      
    const batch = writeBatch(firestore);
    const institutionsRef = collection(firestore, 'institutions');
    const newInstitutionRef = doc(institutionsRef);

    try {
      const hqBranch = {
        id: values.hqBranchCode,
        code: values.hqBranchCode,
        name: values.hqBranchName || 'Headquarters',
        location: values.location,
      };

      const newInstitution = {
        id: newInstitutionRef.id,
        createdAt: serverTimestamp(),
        name: values.name,
        shortName: values.shortName,
        registrationNumber: nextRegistrationNumber,
        type: values.type,
        isDepositTaking: values.isDepositTaking,
        location: values.location,
        physicalAddress: values.physicalAddress,
        contactEmail: values.contactEmail,
        contactPhone: values.contactPhone,
        website: values.website,
        systemDate: values.systemDate,
        hqBranch: hqBranch,
        branches: [],
        customerCounter: 0,
        loanCounter: 0,
        journalBatchCounter: 0,
        transactionReceiptCounter: 0,
      };
      
      batch.set(newInstitutionRef, newInstitution);

      const coaRef = collection(newInstitutionRef, 'chartOfAccounts');
      coaTemplate.forEach(account => {
        const docRef = doc(coaRef, account.glCode);
        batch.set(docRef, { ...account, id: docRef.id });
      });

      await batch.commit();

      setSuccess(
          `Institution "${values.name}" has been added successfully.`
      );
      form.reset();
      

    } catch (e) {
      console.error(e);
      setError('An unexpected error occurred while creating the institution. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const handleOpenBranchManager = (inst: any) => {
    setSelectedInstitution(inst);
    setIsBranchModalOpen(true);
  }

  const handleAddBranch = async (values: z.infer<typeof branchSchema>) => {
    if (!selectedInstitution || !firestore) return;
    setLoading(true);

    const newBranch = { ...values, id: values.code };
    const institutionDocRef = doc(firestore, 'institutions', selectedInstitution.id);

    try {
        await updateDoc(institutionDocRef, {
            branches: arrayUnion(newBranch)
        });
        toast({ title: "Branch added successfully." });
        branchForm.reset();
        // The main institution data will refetch automatically via useCollection
    } catch(e) {
        toast({ variant: 'destructive', title: "Error", description: "Failed to add branch." });
    } finally {
        setLoading(false);
    }
  };

  return (
    <>
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Registered Institutions</CardTitle>
          <CardDescription>
            View and manage all financial institutions on the platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Institution Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Contact Email</TableHead>
                <TableHead>Contact Phone</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {institutionsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : institutions && institutions.length > 0 ? (
                institutions.map(inst => (
                    <TableRow key={inst.id}>
                        <TableCell className="font-medium">{inst.name}</TableCell>
                        <TableCell>{inst.type}</TableCell>
                        <TableCell>{inst.contactEmail}</TableCell>
                        <TableCell>{inst.contactPhone}</TableCell>
                        <TableCell className="text-right">
                           <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <MoreVertical className="h-5 w-5" />
                                </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleOpenBranchManager(inst)}>Manage Branches</DropdownMenuItem>
                                <DropdownMenuItem>Manage Roles</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                    </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No institutions found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Add New Institution</CardTitle>
          <CardDescription>
            Register a new SACCO or MFI on the platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {success && (
                <Alert variant="default" className="bg-green-100 dark:bg-green-900/20 border-green-300 dark:border-green-700">
                  <AlertCircle className="h-4 w-4 text-green-700 dark:text-green-300" />
                  <AlertTitle className="text-green-800 dark:text-green-200">Success</AlertTitle>
                  <AlertDescription className="text-green-700 dark:text-green-300">{success}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-4">
                  <h3 className="text-lg font-medium border-b pb-2">Institution Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Institution Name</FormLabel><FormControl><div className="relative"><Building className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input placeholder="e.g., Unity SACCO" {...field} className="pl-10"/></div></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="shortName" render={({ field }) => (<FormItem><FormLabel>Short Name</FormLabel><FormControl><div className="relative"><Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input placeholder="e.g., MULI SACCO" {...field} className="pl-10"/></div></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="registrationNumber" render={({ field }) => (<FormItem><FormLabel>Institution Code</FormLabel><FormControl><div className="relative"><Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input {...field} className="pl-10" readOnly disabled/></div></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="type" render={({ field }) => (<FormItem><FormLabel>Institution Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a type" /></SelectTrigger></FormControl><SelectContent><SelectItem value="SACCO">SACCO</SelectItem><SelectItem value="MFI">MFI</SelectItem></SelectContent></Select><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="location" render={({ field }) => (<FormItem><FormLabel>District</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a district" /></SelectTrigger></FormControl><SelectContent>{malawiDistricts.map(district => (<SelectItem key={district} value={district}>{district}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="physicalAddress" render={({ field }) => (<FormItem><FormLabel>Physical Address (HQ)</FormLabel><FormControl><div className="relative"><MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input placeholder="e.g., Address, City" {...field} className="pl-10"/></div></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="hqBranchName" render={({ field }) => (<FormItem><FormLabel>HQ Branch Name</FormLabel><FormControl><div className="relative"><Home className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input {...field} className="pl-10"/></div></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="hqBranchCode" render={({ field }) => (<FormItem><FormLabel>HQ Branch Code</FormLabel><FormControl><div className="relative"><Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input {...field} maxLength={2} placeholder="e.g., 01" className="pl-10"/></div></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="contactEmail" render={({ field }) => (<FormItem><FormLabel>Contact Email</FormLabel><FormControl><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input type="email" placeholder="e.g., contact@unitysacco.com" {...field} className="pl-10"/></div></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="contactPhone" render={({ field }) => (<FormItem><FormLabel>Phone Number</FormLabel><FormControl><div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input placeholder="e.g., +265 123 456 789" {...field} className="pl-10"/></div></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="website" render={({ field }) => (<FormItem><FormLabel>Website (Optional)</FormLabel><FormControl><div className="relative"><Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input placeholder="e.g., https://www.institution.com" {...field} className="pl-10"/></div></FormControl><FormMessage /></FormItem>)}/>
                    <FormField control={form.control} name="systemDate" render={({ field }) => (<FormItem><FormLabel>Initial System Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4 opacity-50" />{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)}/>
                    <FormField
                        control={form.control}
                        name="isDepositTaking"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <FormLabel>Deposit-Taking?</FormLabel>
                                <FormDescription>Is this institution licensed to take deposits?</FormDescription>
                            </div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                            </FormItem>
                        )}
                        />
                </div>
              </div>


              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={loading} size="lg">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Create Institution
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>

    <Dialog open={isBranchModalOpen} onOpenChange={setIsBranchModalOpen}>
        <DialogContent className="max-w-4xl">
             <DialogHeader>
                <DialogTitle>Manage Branches for {selectedInstitution?.name}</DialogTitle>
                <DialogDescription>Add, edit, or delete branches for this institution.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                <div>
                    <h3 className="font-semibold mb-4">Existing Branches</h3>
                    <Table>
                        <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Location</TableHead></TableRow></TableHeader>
                        <TableBody>
                            <TableRow><TableCell>{selectedInstitution?.hqBranch.name}</TableCell><TableCell>{selectedInstitution?.hqBranch.code}</TableCell><TableCell>{selectedInstitution?.hqBranch.location}</TableCell></TableRow>
                            {selectedInstitution?.branches?.map((branch: any) => (
                                <TableRow key={branch.id}><TableCell>{branch.name}</TableCell><TableCell>{branch.code}</TableCell><TableCell>{branch.location}</TableCell></TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                 <div>
                    <h3 className="font-semibold mb-4">Add New Branch</h3>
                    <Form {...branchForm}>
                        <form onSubmit={branchForm.handleSubmit(handleAddBranch)} className="space-y-4">
                            <FormField control={branchForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Branch Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                            <FormField control={branchForm.control} name="code" render={({ field }) => (<FormItem><FormLabel>Branch Code</FormLabel><FormControl><Input maxLength={2} {...field} /></FormControl><FormMessage /></FormItem>)}/>
                            <FormField control={branchForm.control} name="location" render={({ field }) => (<FormItem><FormLabel>Location</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select district..."/></SelectTrigger></FormControl><SelectContent>{malawiDistricts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)}/>
                            <div className="flex justify-end">
                                <Button type="submit" disabled={loading}><PlusCircle className="mr-2 h-4 w-4"/> Add Branch</Button>
                            </div>
                        </form>
                    </Form>
                 </div>
            </div>
        </DialogContent>
    </Dialog>
    </>
  );
}

  

    
