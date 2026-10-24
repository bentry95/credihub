'use client';

import React, { useState, useEffect, Suspense, useRef, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm, useFieldArray, FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  useUser,
  useFirestore,
  useDoc,
  useMemoFirebase,
  useStorage,
  useCollection,
} from '@/firebase';
import { collection, doc, runTransaction, serverTimestamp, query, where, getDocs, limit, getDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import {
  Search,
  Camera,
  Upload,
  User as UserIcon,
  Trash2,
  CalendarIcon,
  PlusCircle,
  Save,
  Loader2,
  AlertCircle,
  Pencil,
  FileEdit,
  Lock,
  Check
} from 'lucide-react';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { countries } from '@/lib/countries';
import { customerNationalIdIndexRef, findCustomerWithNationalId, nationalIdIndexKey, normalizeNationalId } from '@/lib/customer-identification';

const malawiDistricts = [
    "Balaka", "Blantyre", "Chikwawa", "Chiradzulu", "Chitipa",
    "Dedza", "Dowa", "Karonga", "Kasungu", "Likoma",
    "Lilongwe", "Machinga", "Mangochi", "Mchinji", "Mulanje",
    "Mwanza", "Mzimba", "Neno", "Nkhata Bay", "Nkhotakota",
    "Nsanje", "Ntcheu", "Ntchisi", "Phalombe", "Rumphi",
    "Salima", "Thyolo", "Zomba"
];

const nextOfKinSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  relationship: z.string().min(1, 'Relationship is required'),
  phone: z.string().min(1, 'Phone number is required'),
  workplace: z.string().optional(),
  residence: z.string().optional(),
});

const workmateSchema = z.object({
    fullName: z.string().min(1, 'Full name is required'),
    position: z.string().min(1, 'Position is required'),
    contacts: z.string().min(1, 'Contact number is required'),
});

const spouseDetailsSchema = z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    workplace: z.string().optional(),
}).optional();

const formSchema = z.object({
  // KYC
  photoUrl: z.string().optional(),
  firstName: z.string().min(1, 'First name is required'),
  middleName: z.string().optional(),
  lastName: z.string().min(1, 'Last name is required'),
  dateOfBirth: z.date({ required_error: 'Date of birth is required' }),
  gender: z.enum(['Male', 'Female']),
  maritalStatus: z.enum(['Single', 'Married', 'Divorced', 'Widowed']),
  nationality: z.string().min(1, 'Nationality is required'),
  numberOfDependents: z.coerce.number().min(0).optional(),
  idType: z.string().min(1, 'ID type is required'),
  idNumber: z.string().min(1, 'ID number is required'),
  idExpiryDate: z.date().optional().nullable(),
  
  // Contact
  phone: z.string().min(1, 'Primary phone is required'),
  alternatePhone: z.string().optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  currentResidence: z.object({
    physicalAddress: z.string().min(1, 'Address is required'),
    district: z.string().min(1, 'District is required'),
    area: z.string().min(1, 'Area/Village is required'),
  }),
  homeVillage: z.object({
    district: z.string().min(1, 'District is required'),
    traditionalAuthority: z.string().min(1, 'T/A is required'),
    village: z.string().min(1, 'Village is required'),
  }),
  residenceType: z.enum(['Own', 'Rented'], { required_error: "Residence type is required." }).optional(),
  monthlyRent: z.coerce.number().min(0).optional(),
  residenceStayInYears: z.coerce.number().min(0).optional(),

  // Financial
  occupationCategory: z.string().min(1, 'Occupation is required'),
  position: z.string().optional(),
  employerName: z.string().optional(),
  employerLocation: z.string().optional(),
  officePhone: z.string().optional(),
  yearsOfService: z.coerce.number().min(0).optional(),
  primaryIncome: z.coerce.number().min(0, 'Income must be a positive number'),
  spouseDetails: spouseDetailsSchema,
  
  // Next of Kin
  nextOfKin: z.array(nextOfKinSchema).optional(),
  workmates: z.array(workmateSchema).optional(),

  // System
  branchId: z.string().min(1, 'Branch assignment is required'),
  isPep: z.boolean().default(false),
  accountPurpose: z.string().min(1, 'Account purpose is required'),
});


function EditCustomerPageContent() {
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [hasActiveLoan, setHasActiveLoan] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('kyc');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);
  const institutionId = userData?.institutionId;

  const institutionDocRef = useMemoFirebase(
    () => (firestore && institutionId ? doc(firestore, 'institutions', institutionId) : null),
    [firestore, institutionId]
  );
  const { data: institutionData } = useDoc(institutionDocRef);
  
  const employersQuery = useMemoFirebase(
    () => (firestore && userData?.institutionId ? collection(firestore, 'institutions', userData.institutionId, 'employers') : null),
    [firestore, userData]
  );
  const { data: employers, isLoading: isEmployersLoading } = useCollection(employersQuery);


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nextOfKin: [],
      workmates: [],
    }
  });

   useEffect(() => {
    if (selectedCustomer) {
        const defaultValues = {
            ...selectedCustomer,
            photoUrl: selectedCustomer.photoUrl || '',
            firstName: selectedCustomer.firstName || '',
            middleName: selectedCustomer.middleName || '',
            lastName: selectedCustomer.lastName || '',
            dateOfBirth: selectedCustomer.dateOfBirth?.toDate ? selectedCustomer.dateOfBirth.toDate() : undefined,
            gender: selectedCustomer.gender,
            maritalStatus: selectedCustomer.maritalStatus,
            nationality: selectedCustomer.nationality || 'Malawi',
            numberOfDependents: selectedCustomer.numberOfDependents || 0,
            idType: selectedCustomer.idType || '',
            idNumber: selectedCustomer.idNumber || '',
            idExpiryDate: selectedCustomer.idExpiryDate?.toDate ? selectedCustomer.idExpiryDate.toDate() : null,
            phone: selectedCustomer.phone || '',
            alternatePhone: selectedCustomer.alternatePhone || '',
            email: selectedCustomer.email || '',
            currentResidence: selectedCustomer.currentResidence || { physicalAddress: '', district: '', area: '' },
            homeVillage: selectedCustomer.homeVillage || { district: '', traditionalAuthority: '', village: '' },
            residenceType: selectedCustomer.residenceType,
            monthlyRent: selectedCustomer.monthlyRent || 0,
            residenceStayInYears: selectedCustomer.residenceStayInYears || 0,
            occupationCategory: selectedCustomer.occupationCategory || '',
            position: selectedCustomer.position || '',
            employerName: selectedCustomer.employerName || '',
            employerLocation: selectedCustomer.employerLocation || '',
            officePhone: selectedCustomer.officePhone || '',
            yearsOfService: selectedCustomer.yearsOfService || 0,
            primaryIncome: selectedCustomer.primaryIncome || 0,
            spouseDetails: selectedCustomer.spouseDetails || { name: '', phone: '', workplace: '' },
            nextOfKin: selectedCustomer.nextOfKin || [],
            workmates: selectedCustomer.workmates || [],
            branchId: selectedCustomer.branchId || '',
            isPep: selectedCustomer.isPep || false,
            accountPurpose: selectedCustomer.accountPurpose || '',
        };
        form.reset(defaultValues);
        setPhotoPreview(selectedCustomer.photoUrl);
    }
  }, [selectedCustomer, form]);

  const performSearch = async () => {
    if (searchTerm.length < 3 || !firestore || !institutionId) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const customersRef = collection(firestore, 'institutions', institutionId, 'customers');
    const lowercasedSearchTerm = searchTerm.toLowerCase();
    
    const nameQuery = query(customersRef, where('name_lowercase', '>=', lowercasedSearchTerm), where('name_lowercase', '<=', lowercasedSearchTerm + '\uf8ff'), limit(5));
    const idNumberQuery = query(customersRef, where('idNumber_lowercase', '==', lowercasedSearchTerm), limit(5));
    const phoneQuery = query(customersRef, where('phone_lowercase', '==', lowercasedSearchTerm), limit(5));
    const accountNumberQuery = query(customersRef, where('accountNumber_lowercase', '==', lowercasedSearchTerm), limit(5));


    const [nameSnap, idNumberSnap, phoneSnap, accountNumberSnap] = await Promise.all([
        getDocs(nameQuery),
        getDocs(idNumberQuery),
        getDocs(phoneQuery),
        getDocs(accountNumberQuery),
    ]);

    const resultsMap = new Map();
    nameSnap.forEach(doc => resultsMap.set(doc.id, { id: doc.id, ...doc.data() }));
    idNumberSnap.forEach(doc => resultsMap.set(doc.id, { id: doc.id, ...doc.data() }));
    phoneSnap.forEach(doc => resultsMap.set(doc.id, { id: doc.id, ...doc.data() }));
    accountNumberSnap.forEach(doc => resultsMap.set(doc.id, { id: doc.id, ...doc.data() }));
    
    setSearchResults(Array.from(resultsMap.values()));
    setIsSearching(false);
  };

  const { fields: nokFields, append: appendNok, remove: removeNok } = useFieldArray({
    control: form.control,
    name: 'nextOfKin',
  });
  const { fields: workmateFields, append: appendWorkmate, remove: removeWorkmate } = useFieldArray({
    control: form.control,
    name: 'workmates',
  });
  
  const maritalStatus = form.watch('maritalStatus');
  const occupationCategory = form.watch('occupationCategory');

  const handleSelectCustomer = async (customer: any) => {
    if (!firestore || !institutionId) return;

    const customerDocRef = doc(firestore, 'institutions', institutionId, 'customers', customer.id);
    const customerSnap = await getDoc(customerDocRef);
    if (customerSnap.exists()) {
      setSelectedCustomer({ id: customerSnap.id, ...customerSnap.data() });
    }
    
    setSearchTerm('');
    setSearchResults([]);

    if (institutionId) {
        setHasActiveLoan(false); // Reset
        const runningLoansRef = collection(firestore, 'institutions', institutionId, 'runningLoans');
        const q = query(
            runningLoansRef, 
            where('customerId', '==', customer.id), 
            where('status', 'in', ['Disbursed', 'Overdue']),
            limit(1)
        );
        const loanSnap = await getDocs(q);
        setHasActiveLoan(!loanSnap.empty);
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        toast({ variant: "destructive", title: "Image Too Large", description: "Please select an image smaller than 2MB." });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setPhotoPreview(dataUrl);
        form.setValue('photoUrl', dataUrl, { shouldDirty: true });
      };
      reader.readAsDataURL(file);
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore || !institutionId || !selectedCustomer || !storage) return;
    setLoading(true);
    setError(null);
    try {
        const normalizedNationalId = normalizeNationalId(values.idNumber);
        const existingCustomer = await findCustomerWithNationalId(
          firestore,
          institutionId,
          values.idNumber,
          selectedCustomer.id
        );
        if (existingCustomer) {
          throw new Error(`National ID ${values.idNumber.trim()} is already registered to another customer.`);
        }

        const nationalIdIndexRef = customerNationalIdIndexRef(firestore, institutionId, values.idNumber);
        const previousNationalId = normalizeNationalId(selectedCustomer.idNumber);
        const previousIdIndexRef = previousNationalId
          ? customerNationalIdIndexRef(firestore, institutionId, selectedCustomer.idNumber)
          : null;
        let finalPhotoUrl = selectedCustomer.photoUrl || '';
        if (photoPreview && photoPreview.startsWith('data:')) {
          const photoRef = ref(storage, `institutions/${institutionId}/customers/${selectedCustomer.id}/photo`);
          const uploadResult = await uploadString(photoRef, photoPreview, 'data_url');
          finalPhotoUrl = await getDownloadURL(uploadResult.ref);
        }

        const customerDocRef = doc(firestore, 'institutions', institutionId, 'customers', selectedCustomer.id);
        const updatedCustomer = {
            ...values,
            idNumber: values.idNumber.trim(),
            photoUrl: finalPhotoUrl,
            idExpiryDate: values.idExpiryDate || null,
            name: `${values.firstName} ${values.lastName}`,
            name_lowercase: `${values.firstName} ${values.lastName}`.toLowerCase(),
            idNumber_lowercase: normalizedNationalId,
            idNumberKey: nationalIdIndexKey(normalizedNationalId),
            phone_lowercase: values.phone.toLowerCase(),
        };
        await runTransaction(firestore, async (transaction) => {
          const newIndexSnapshot = await transaction.get(nationalIdIndexRef);
          const previousIndexSnapshot = !previousIdIndexRef || nationalIdIndexRef.path === previousIdIndexRef.path
            ? newIndexSnapshot
            : await transaction.get(previousIdIndexRef);

          if (newIndexSnapshot.exists() && newIndexSnapshot.data().customerId !== selectedCustomer.id) {
            throw new Error(`National ID ${values.idNumber.trim()} is already registered.`);
          }

          transaction.update(customerDocRef, updatedCustomer);
          if (!newIndexSnapshot.exists()) {
            transaction.set(nationalIdIndexRef, {
              customerId: selectedCustomer.id,
              idNumber: updatedCustomer.idNumber,
              createdAt: serverTimestamp(),
            });
          }

          if (
            previousNationalId !== normalizedNationalId &&
            previousIdIndexRef &&
            previousIndexSnapshot.exists() &&
            previousIndexSnapshot.data().customerId === selectedCustomer.id
          ) {
            transaction.delete(previousIdIndexRef);
          }
        });
        toast({
            title: "Customer Updated",
            description: `Successfully updated customer ${updatedCustomer.name}.`,
        });
        setSelectedCustomer({...selectedCustomer, ...updatedCustomer, photoUrl: finalPhotoUrl});

    } catch (e) {
        console.error("Error updating customer: ", e);
        setError(e instanceof Error ? e.message : "Failed to update customer. Please check the details and try again.");
    } finally {
        setLoading(false);
    }
  }

  const allBranches = useMemo(() => {
    if (!institutionData) return [];
    
    const hqBranch = { 
      id: '01', 
      name: institutionData.hqBranch?.name || 'Headquarters', 
      code: '01' 
    };

    const otherBranches = institutionData.branches || [];

    return [hqBranch, ...otherBranches].sort((a,b) => a.code.localeCompare(b.code));
  }, [institutionData]);

  return (
    <div className="space-y-6">
        <Card>
            <CardHeader>
            <CardTitle>Edit Customer Information</CardTitle>
            <CardDescription>
                Search for a customer by name, account number, phone, or ID to update their profile.
            </CardDescription>
            </CardHeader>
            <CardContent>
            <div className="flex items-center gap-2 max-w-lg relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                placeholder="Search customers..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => { if(e.key === 'Enter') { e.preventDefault(); performSearch(); }}}
                />
                <Button type="button" onClick={performSearch} disabled={isSearching || !searchTerm}>
                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin"/> : "Search"}
                </Button>
                {searchResults.length > 0 && (
                <Card className="absolute top-full mt-2 w-full z-10">
                    <CardContent className="p-2">
                    {isSearching ? (
                        <div className="p-4 text-center">Loading...</div>
                    ) : (
                        searchResults.map((customer) => (
                        <div
                            key={customer.id}
                            className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer"
                            onClick={() => handleSelectCustomer(customer)}
                        >
                            <Avatar>
                            <AvatarImage src={customer.photoUrl} />
                            <AvatarFallback>{customer.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                            <div className="font-medium">{customer.name}</div>
                            <div className="text-sm text-muted-foreground">
                                {customer.accountNumber}
                            </div>
                            </div>
                        </div>
                        ))
                    )}
                    </CardContent>
                </Card>
                )}
            </div>
            </CardContent>
        </Card>

        {!selectedCustomer ? (
            <div className="flex h-64 items-center justify-center">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <div className="mx-auto bg-muted rounded-full p-4 w-fit">
                        <Search className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <CardTitle className="mt-4">Search for a Customer</CardTitle>
                    <CardDescription>
                        Use the search bar above to find a customer to edit.
                    </CardDescription>
                </CardHeader>
            </Card>
        </div>
        ) : (
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                     <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-bold tracking-tight">Editing: {selectedCustomer.name}</h1>
                        <Button type="submit" disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save Changes
                        </Button>
                    </div>

                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-5">
                            <TabsTrigger value="kyc">Personal & KYC</TabsTrigger>
                            <TabsTrigger value="contact">Contact & Address</TabsTrigger>
                            <TabsTrigger value="financial">Employment & Income</TabsTrigger>
                            <TabsTrigger value="kin">References</TabsTrigger>
                            <TabsTrigger value="system">Account & System</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="kyc">
                            <Card>
                                <CardHeader><CardTitle>Personal & KYC Details</CardTitle></CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="flex flex-col md:flex-row gap-6">
                                        <div className="space-y-2 flex-shrink-0">
                                            <FormLabel>Customer Photo</FormLabel>
                                            <div className="w-48 h-48 rounded-md border border-dashed flex items-center justify-center bg-muted overflow-hidden relative">
                                                {photoPreview ? <Image src={photoPreview} alt="Captured" layout="fill" className="object-cover"/> : <UserIcon className="h-16 w-16 text-muted-foreground"/>}
                                            </div>
                                            <Button type="button" variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                                                <Upload className="mr-2 h-4 w-4"/> Change Photo
                                            </Button>
                                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <FormField control={form.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="middleName" render={({ field }) => (<FormItem><FormLabel>Middle Name (Optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="lastName" render={({ field }) => (<FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <FormField control={form.control} name="dateOfBirth" render={({ field }) => (
                                            <FormItem className="flex flex-col"><FormLabel>Date of Birth</FormLabel>
                                                <Popover><PopoverTrigger asChild>
                                                    <FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl>
                                                </PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date() || date < new Date("1900-01-01")} initialFocus /></PopoverContent></Popover><FormMessage />
                                            </FormItem>)} />
                                            <FormField control={form.control} name="gender" render={({ field }) => (<FormItem><FormLabel>Gender</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                            <FormField control={form.control} name="maritalStatus" render={({ field }) => (<FormItem><FormLabel>Marital Status</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Single">Single</SelectItem><SelectItem value="Married">Married</SelectItem><SelectItem value="Divorced">Divorced</SelectItem><SelectItem value="Widowed">Widowed</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                            <FormField control={form.control} name="nationality" render={({ field }) => (<FormItem><FormLabel>Nationality</FormLabel><Popover><PopoverTrigger asChild>
                                                <FormControl><Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>{field.value ? countries.find((country) => country.name === field.value)?.name : "Select country"}</Button></FormControl>
                                            </PopoverTrigger><PopoverContent className="w-[300px] p-0"><Command><CommandInput placeholder="Search country..." /><CommandList><CommandEmpty>No country found.</CommandEmpty><CommandGroup>
                                                {countries.map((country) => (<CommandItem value={country.name} key={country.code} onSelect={() => { form.setValue("nationality", country.name) }}>
                                                    <Check className={cn("mr-2 h-4 w-4", country.name === field.value ? "opacity-100" : "opacity-0")} />{country.name}</CommandItem>))}
                                            </CommandGroup></CommandList></Command></PopoverContent></Popover><FormMessage /></FormItem>)} />
                                        </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <FormField control={form.control} name="numberOfDependents" render={({ field }) => (<FormItem><FormLabel>No. of Dependents</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="idType" render={({ field }) => (<FormItem><FormLabel>ID Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="National ID">National ID</SelectItem><SelectItem value="Passport">Passport</SelectItem><SelectItem value="Driving Permit">Driving Permit</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="idNumber" render={({ field }) => (<FormItem><FormLabel>ID Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                        
                        <TabsContent value="contact">
                             <Card>
                                <CardHeader><CardTitle>Contact & Address</CardTitle></CardHeader>
                                <CardContent className="space-y-6">
                                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Primary Phone Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="alternatePhone" render={({ field }) => (<FormItem><FormLabel>Alternate Phone (Optional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email (Optional)</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    </div>
                                    <div className="space-y-4 rounded-md border p-4">
                                        <h3 className="font-medium">Current Residence</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <FormField control={form.control} name="currentResidence.physicalAddress" render={({ field }) => (<FormItem><FormLabel>Physical Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                            <FormField control={form.control} name="currentResidence.district" render={({ field }) => (<FormItem><FormLabel>District</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{malawiDistricts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                            <FormField control={form.control} name="currentResidence.area" render={({ field }) => (<FormItem><FormLabel>Area / Village</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                                            <FormField control={form.control} name="residenceType" render={({ field }) => (<FormItem><FormLabel>Residence Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="Own">Own House</SelectItem><SelectItem value="Rented">Rented House</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                            <FormField control={form.control} name="monthlyRent" render={({ field }) => (<FormItem><FormLabel>Monthly Rent (if rented)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                            <FormField control={form.control} name="residenceStayInYears" render={({ field }) => (<FormItem><FormLabel>Years at Residence</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        </div>
                                    </div>
                                    <div className="space-y-4 rounded-md border p-4">
                                        <h3 className="font-medium">Home Village</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <FormField control={form.control} name="homeVillage.district" render={({ field }) => (<FormItem><FormLabel>District</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{malawiDistricts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                            <FormField control={form.control} name="homeVillage.traditionalAuthority" render={({ field }) => (<FormItem><FormLabel>Traditional Authority (T/A)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                            <FormField control={form.control} name="homeVillage.village" render={({ field }) => (<FormItem><FormLabel>Village</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                        
                        <TabsContent value="financial">
                            <Card>
                                <CardHeader><CardTitle>Financial Profile</CardTitle></CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <FormField control={form.control} name="occupationCategory" render={({ field }) => (<FormItem><FormLabel>Primary Occupation</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Salaried">Salaried Employee</SelectItem><SelectItem value="Business">Business / Self-Employed</SelectItem><SelectItem value="Farming">Farming</SelectItem><SelectItem value="Unemployed">Unemployed</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                        {occupationCategory === 'Salaried' ? (
                                             <FormField control={form.control} name="employerName" render={({ field }) => (
                                                <FormItem><FormLabel>Employer</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder={isEmployersLoading ? "Loading..." : "Select employer..."}/></SelectTrigger></FormControl>
                                                        <SelectContent>
                                                            {employers?.map(e => (<SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>))}
                                                        </SelectContent>
                                                    </Select>
                                                <FormMessage /></FormItem>
                                             )} />
                                          ) : (
                                            <FormField control={form.control} name="employerName" render={({ field }) => (<FormItem><FormLabel>Employer/Business Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                          )}
                                        <FormField control={form.control} name="position" render={({ field }) => (<FormItem><FormLabel>Present Position</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="employerLocation" render={({ field }) => (<FormItem><FormLabel>Employer Address</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="yearsOfService" render={({ field }) => (<FormItem><FormLabel>Years of Service</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="officePhone" render={({ field }) => (<FormItem><FormLabel>Office Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="primaryIncome" render={({ field }) => (<FormItem><FormLabel>Net Salary / Monthly Income</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                        
                        <TabsContent value="kin">
                            <Card>
                                <CardHeader><CardTitle>References</CardTitle></CardHeader>
                                <CardContent className="space-y-6">
                                {maritalStatus === 'Married' && (
                                    <div className="space-y-4 rounded-md border p-4">
                                    <h3 className="font-medium">Spouse's Details</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <FormField control={form.control} name="spouseDetails.name" render={({ field }) => (<FormItem><FormLabel>Spouse's Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="spouseDetails.phone" render={({ field }) => (<FormItem><FormLabel>Spouse's Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="spouseDetails.workplace" render={({ field }) => (<FormItem><FormLabel>Spouse's Work Place</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    </div>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <h3 className="font-medium">Next of Kin / Emergency Contacts</h3>
                                    {nokFields.map((field, index) => (
                                        <div key={field.id} className="p-4 border rounded-md space-y-4">
                                            <div className="flex gap-4 items-start">
                                                <FormField control={form.control} name={`nextOfKin.${index}.fullName`} render={({ field }) => (<FormItem className="flex-1"><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                                <FormField control={form.control} name={`nextOfKin.${index}.relationship`} render={({ field }) => (<FormItem className="flex-1"><FormLabel>Relationship</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                                <Button type="button" variant="destructive" size="icon" onClick={() => removeNok(index)}><Trash2 className="h-4 w-4"/></Button>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <FormField control={form.control} name={`nextOfKin.${index}.phone`} render={({ field }) => (<FormItem><FormLabel>Contact Numbers</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                                <FormField control={form.control} name={`nextOfKin.${index}.workplace`} render={({ field }) => (<FormItem><FormLabel>Work Place</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                                <FormField control={form.control} name={`nextOfKin.${index}.residence`} render={({ field }) => (<FormItem><FormLabel>Residence</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                            </div>
                                        </div>
                                    ))}
                                    <Button type="button" variant="outline" size="sm" onClick={() => appendNok({ fullName: '', relationship: '', phone: '', workplace: '', residence: '' })}><PlusCircle className="mr-2 h-4 w-4"/>Add Next of Kin</Button>
                                 </div>

                                 <div className="space-y-4">
                                    <h3 className="font-medium">Workmates</h3>
                                    {workmateFields.map((field, index) => (
                                         <div key={field.id} className="flex gap-4 items-end p-4 border rounded-md">
                                            <FormField control={form.control} name={`workmates.${index}.fullName`} render={({ field }) => (<FormItem className="flex-1"><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                            <FormField control={form.control} name={`workmates.${index}.position`} render={({ field }) => (<FormItem className="flex-1"><FormLabel>Position</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                            <FormField control={form.control} name={`workmates.${index}.contacts`} render={({ field }) => (<FormItem className="flex-1"><FormLabel>Contacts</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                            <Button type="button" variant="destructive" size="icon" onClick={() => removeWorkmate(index)}><Trash2 className="h-4 w-4"/></Button>
                                        </div>
                                    ))}
                                    <Button type="button" variant="outline" size="sm" onClick={() => appendWorkmate({ fullName: '', position: '', contacts: '' })}><PlusCircle className="mr-2 h-4 w-4"/>Add Workmate</Button>
                                 </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="system">
                            <Card>
                                <CardHeader><CardTitle>Account & System</CardTitle></CardHeader>
                                <CardContent className="space-y-6">
                                     <FormItem>
                                        <FormLabel>System Account Number</FormLabel>
                                        <FormControl><Input value={selectedCustomer.accountNumber} readOnly disabled /></FormControl>
                                    </FormItem>
                                    {hasActiveLoan && (
                                        <Alert variant="destructive">
                                            <Lock className="h-4 w-4" />
                                            <AlertTitle>Branch Change Blocked</AlertTitle>
                                            <AlertDescription>
                                                This customer has an active loan and cannot be moved to a different branch.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    <FormField control={form.control} name="branchId" render={({ field }) => (
                                        <FormItem><FormLabel>Assign to Branch</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value} disabled={hasActiveLoan}>
                                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent>{institutionData && <>
                                                        <SelectItem value="01">{institutionData.hqBranch?.name}</SelectItem>
                                                        {institutionData.branches?.map((branch: any) => (<SelectItem key={branch.code} value={branch.code}>{branch.name}</SelectItem>))}
                                                </>}</SelectContent>
                                            </Select><FormMessage />
                                        </FormItem>)} />
                                    <FormField control={form.control} name="accountPurpose" render={({ field }) => (<FormItem><FormLabel>Purpose of Account</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="isPep" render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                            <div className="space-y-0.5"><FormLabel>Politically Exposed Person (PEP)</FormLabel><FormDescription>Is this customer a politically exposed person?</FormDescription></div>
                                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                        </FormItem>)} />
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </form>
            </Form>
        )}
    </div>
  );
}


export default function EditCustomerPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <EditCustomerPageContent />
        </Suspense>
    )
}
