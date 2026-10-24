
'use client';

import React, { useState, useRef, useEffect, useMemo, Suspense } from 'react';
import { useForm, useFieldArray, FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  useUser,
  useFirestore,
  useDoc,
  useMemoFirebase,
  useCollection,
  useStorage,
} from '@/firebase';
import { collection, doc, runTransaction, writeBatch, serverTimestamp, query, where, limit, getDocs, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import {
  Camera,
  Video,
  User as UserIcon,
  Trash2,
  CalendarIcon,
  PlusCircle,
  Save,
  Loader2,
  AlertCircle,
  Upload,
  Check,
  FileSignature,
  Search,
} from 'lucide-react';
import Image from 'next/image';
import { countries } from '@/lib/countries';
import { customerNationalIdIndexRef, findCustomerWithNationalId, nationalIdIndexKey, normalizeNationalId } from '@/lib/customer-identification';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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
  gender: z.enum(['Male', 'Female'], { required_error: "Gender is required." }),
  maritalStatus: z.enum(['Single', 'Married', 'Divorced', 'Widowed'], { required_error: "Marital status is required." }),
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
  savingsProductId: z.string().min(1, 'A savings product must be selected.'),
  isPep: z.boolean().default(false),
  accountPurpose: z.string().min(1, 'Account purpose is required'),
});

const CurrencyInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<'input'>
>(({ value, onChange, ...props }, ref) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const numValue = rawValue.replace(/,/g, '');
    if (!isNaN(Number(numValue)) && onChange) {
      e.target.value = numValue;
      onChange(e);
    }
  };

  const formattedValue = value ? Number(value).toLocaleString() : '';

  return (
    <Input
      ref={ref}
      value={formattedValue}
      onChange={handleChange}
      onFocus={(e) => (e.target.value = e.target.value.replace(/,/g, ''))}
      onBlur={(e) => {
        const num = parseFloat(e.target.value);
        if (!isNaN(num)) {
          e.target.value = num.toLocaleString();
        }
      }}
      {...props}
    />
  );
});
CurrencyInput.displayName = 'CurrencyInput';


function AddNewCustomerContent() {
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const searchParams = useSearchParams();
  const draftId = searchParams.get('draftId');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('kyc');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const { toast } = useToast();
  const router = useRouter();

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
  const { data: institutionData, isLoading: institutionLoading } = useDoc(institutionDocRef);

  const savingsProductsQuery = useMemoFirebase(
    () => (firestore && institutionId ? query(collection(firestore, 'institutions', institutionId, 'savingsProducts')) : null),
    [firestore, institutionId]
  );
  const { data: savingsProducts, isLoading: isSavingsProductsLoading } = useCollection(savingsProductsQuery);
  
  const employersQuery = useMemoFirebase(
    () => (firestore && institutionId ? collection(firestore, 'institutions', institutionId, 'employers') : null),
    [firestore, institutionId]
  );
  const { data: employers, isLoading: isEmployersLoading } = useCollection(employersQuery);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      photoUrl: '',
      firstName: '',
      middleName: '',
      lastName: '',
      nationality: 'Malawi',
      numberOfDependents: 0,
      phone: '',
      alternatePhone: '',
      email: '',
      currentResidence: { physicalAddress: '', district: '', area: '' },
      homeVillage: { district: '', traditionalAuthority: '', village: '' },
      monthlyRent: 0,
      residenceStayInYears: 0,
      position: '',
      employerName: '',
      employerLocation: '',
      officePhone: '',
      yearsOfService: 0,
      primaryIncome: 0,
      spouseDetails: { name: '', phone: '', workplace: '' },
      nextOfKin: [{ fullName: '', relationship: '', phone: '', workplace: '', residence: '' }],
      workmates: [{ fullName: '', position: '', contacts: '' }],
      branchId: '',
      savingsProductId: '',
      isPep: false,
      accountPurpose: '',
    },
  });

  // Handle Draft Loading
  useEffect(() => {
    if (draftId && firestore && institutionId) {
      const fetchDraft = async () => {
        setLoading(true);
        try {
          const draftDocRef = doc(firestore, 'institutions', institutionId, 'unfinalisedApplications', draftId);
          const snap = await getDoc(draftDocRef);
          if (snap.exists()) {
            const data = snap.data();
            const payload = data.payload;
            
            // Convert Firestore Timestamps back to Date objects if they were serialized
            if (payload.dateOfBirth?.toDate) payload.dateOfBirth = payload.dateOfBirth.toDate();
            else if (typeof payload.dateOfBirth === 'string') payload.dateOfBirth = new Date(payload.dateOfBirth);

            if (payload.idExpiryDate?.toDate) payload.idExpiryDate = payload.idExpiryDate.toDate();
            else if (typeof payload.idExpiryDate === 'string') payload.idExpiryDate = new Date(payload.idExpiryDate);

            if (payload.dateApplied?.toDate) payload.dateApplied = payload.dateApplied.toDate();
            else if (typeof payload.dateApplied === 'string') payload.dateApplied = new Date(payload.dateApplied);

            form.reset(payload);
            if (payload.photoUrl) {
              setCapturedImage(payload.photoUrl);
            }
            toast({ title: "Draft Loaded", description: `Resumed application for ${data.customerName}.` });
          }
        } catch (e) {
          console.error("Error loading draft:", e);
          toast({ variant: 'destructive', title: "Error", description: "Failed to load draft data." });
        } finally {
          setLoading(false);
        }
      };
      fetchDraft();
    }
  }, [draftId, firestore, institutionId, form, toast]);

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


  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      toast({
          variant: "destructive",
          title: "Camera Access Denied",
          description: "Please enable camera permissions in your browser to use this feature.",
      });
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            toast({
                variant: "destructive",
                title: "Image Too Large",
                description: "Please select an image smaller than 5MB.",
            });
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            const dataUrl = reader.result as string;
            setCapturedImage(dataUrl);
            form.setValue('photoUrl', dataUrl, { shouldDirty: true });
        };
        reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stream]);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current && stream) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      context?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');
      
      const sizeInBytes = dataUrl.length * (3/4) - 2;
      if (sizeInBytes > 5 * 1024 * 1024) {
          toast({
              variant: "destructive",
              title: "Image Too Large",
              description: "The captured photo is too large. Please try again.",
          });
          return;
      }
      
      setCapturedImage(dataUrl);
      form.setValue('photoUrl', dataUrl, { shouldDirty: true });
      stopCamera();
    }
  };

  const handleFormErrors = (errors: FieldErrors<z.infer<typeof formSchema>>) => {
    const errorFields = Object.keys(errors);
    if (errorFields.length > 0) {
      const firstErrorField = errorFields[0] as keyof z.infer<typeof formSchema>;
      
      const kycFields: (keyof z.infer<typeof formSchema>)[] = ['firstName', 'lastName', 'dateOfBirth', 'gender', 'maritalStatus', 'nationality', 'idType', 'idNumber'];
      const contactFields: (keyof z.infer<typeof formSchema>)[] = ['phone', 'currentResidence', 'homeVillage'];
      const financialFields: (keyof z.infer<typeof formSchema>)[] = ['occupationCategory', 'primaryIncome'];
      const kinFields: (keyof z.infer<typeof formSchema>)[] = ['nextOfKin', 'workmates'];
      const systemFields: (keyof z.infer<typeof formSchema>)[] = ['branchId', 'savingsProductId', 'accountPurpose'];

      if (kycFields.includes(firstErrorField)) setActiveTab('kyc');
      else if (contactFields.some(f => firstErrorField.toString().startsWith(f as string))) setActiveTab('contact');
      else if (financialFields.includes(firstErrorField)) setActiveTab('financial');
      else if (kinFields.includes(firstErrorField)) setActiveTab('kin');
      else if (systemFields.includes(firstErrorField)) setActiveTab('system');
    }
  };

  const handleSearch = async () => {
    if (!firestore || !institutionId || searchTerm.length < 3) return;
    setIsSearching(true);
    const customersRef = collection(firestore, 'institutions', institutionId, 'customers');
    const lowercasedSearchTerm = searchTerm.toLowerCase();
    const q = query(
      customersRef,
      where('name_lowercase', '>=', lowercasedSearchTerm),
      where('name_lowercase', '<=', lowercasedSearchTerm + '\uf8ff'),
      limit(5)
    );

    try {
      const snap = await getDocs(q);
      setSearchResults(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) {
      console.error("Search failed:", e);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectCustomer = (customer: any) => {
    toast({
        title: "Customer Already Exists",
        description: `The customer ${customer.name} is already registered with account number ${customer.accountNumber}.`,
    });
    setIsSearchOpen(false);
  };
  
  async function handleSaveAsDraft() {
    if (!firestore || !institutionId) return;

    setLoading(true);
    setError(null);
    const values = form.getValues();

    try {
        const unfinalisedRef = collection(firestore, 'institutions', institutionId, 'unfinalisedApplications');
        const draftDocRef = draftId ? doc(unfinalisedRef, draftId) : doc(unfinalisedRef);

        const draftData = {
            id: draftDocRef.id,
            institutionId: institutionId,
            customerName: `${values.firstName || ''} ${values.lastName || ''}`.trim() || 'Unnamed Draft',
            reason: 'Draft',
            idNumber: values.idNumber || '',
            dateCreated: serverTimestamp(),
            payload: { ...values, photoUrl: capturedImage },
        };

        await setDoc(draftDocRef, draftData);
        
        toast({
            title: "Draft Saved",
            description: "The customer application has been saved as a draft.",
        });
        form.reset();
        setCapturedImage(null);
        router.push('/staff/customers/unfinalised');
    } catch(e) {
        console.error("Error saving draft: ", e);
        setError("Failed to save draft. Please try again.");
    } finally {
        setLoading(false);
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore || !storage || !institutionId || !institutionDocRef) return;
  
    setLoading(true);
    setError(null);
  
    try {
      const normalizedNationalId = normalizeNationalId(values.idNumber);
      const existingCustomer = await findCustomerWithNationalId(firestore, institutionId, values.idNumber);
      if (existingCustomer) {
        throw new Error(`National ID ${values.idNumber.trim()} is already registered to customer ${existingCustomer.id}.`);
      }

      const nationalIdIndexRef = customerNationalIdIndexRef(firestore, institutionId, values.idNumber);
      await runTransaction(firestore, async (transaction) => {
        const instDoc = await transaction.get(institutionDocRef);
        if (!instDoc.exists()) throw "Institution not found!";

        const nationalIdIndexSnap = await transaction.get(nationalIdIndexRef);
        if (nationalIdIndexSnap.exists()) {
          throw new Error(`National ID ${values.idNumber.trim()} is already registered.`);
        }
  
        const institution = instDoc.data();
        const currentCounter = institution.customerCounter || 0;
        const newCounter = currentCounter + 1;
        const shortName = institution.shortName || "INST";
  
        const accountNumber = `${shortName}CUS${String(newCounter).padStart(6, '0')}`;
        
        let photoDownloadUrl = '';
        if (capturedImage && capturedImage.startsWith('data:')) {
          const photoRef = ref(storage, `institutions/${institutionId}/customers/${accountNumber}/photo`);
          const uploadResult = await uploadString(photoRef, capturedImage, 'data_url');
          photoDownloadUrl = await getDownloadURL(uploadResult.ref);
        } else if (capturedImage) {
          photoDownloadUrl = capturedImage;
        }
        
        const customersRef = collection(firestore, 'institutions', institutionId, 'customers');
        const newCustomerDocRef = doc(customersRef, accountNumber);
  
        const fullName = `${values.firstName} ${values.lastName}`;
  
        const newCustomer = {
            ...values,
            idNumber: values.idNumber.trim(),
            photoUrl: photoDownloadUrl,
            id: newCustomerDocRef.id,
            institutionId: institutionId,
            name: fullName,
            name_lowercase: fullName.toLowerCase(),
            accountNumber,
            accountNumber_lowercase: accountNumber.toLowerCase(),
            idNumber_lowercase: normalizedNationalId,
            idNumberKey: nationalIdIndexKey(normalizedNationalId),
            phone_lowercase: values.phone.toLowerCase(),
            kycStatus: 'Verified',
            customerType: 'Individual',
            createdAt: serverTimestamp(),
        };
  
        transaction.set(newCustomerDocRef, newCustomer);
        transaction.set(nationalIdIndexRef, {
          customerId: newCustomerDocRef.id,
          idNumber: newCustomer.idNumber,
          createdAt: serverTimestamp(),
        });
        transaction.update(institutionDocRef, { customerCounter: newCounter });
  
        const savingsAccountRef = doc(collection(newCustomerDocRef, 'savingsAccounts'));
        transaction.set(savingsAccountRef, {
            id: savingsAccountRef.id,
            productId: values.savingsProductId,
            status: 'Active',
            balance: 0,
            branchId: values.branchId,
            createdAt: serverTimestamp(),
        });

        // Cleanup draft if one existed
        if (draftId) {
          const draftDocRef = doc(firestore, 'institutions', institutionId, 'unfinalisedApplications', draftId);
          transaction.delete(draftDocRef);
        }
      });
  
      toast({
        title: "Customer Created",
        description: `Successfully created customer ${values.firstName} ${values.lastName}.`,
      });
  
      form.reset();
      setCapturedImage(null);
      router.push('/staff/customers/all');
  
    } catch (e) {
      console.error("Error creating customer: ", e);
      setError(e instanceof Error ? e.message : "Failed to create customer. Check details and try again.");
    } finally {
      setLoading(false);
    }
  }

  const allBranches = useMemo(() => {
    if (!institutionData) return [];
    const hqBranch = { id: '01', name: institutionData.hqBranch?.name || 'Headquarters', code: '01' };
    const otherBranches = institutionData.branches || [];
    return [hqBranch, ...otherBranches].sort((a,b) => a.code.localeCompare(b.code));
  }, [institutionData]);

  return (
    <>
      <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, handleFormErrors)} className="space-y-8">
              <div className="flex items-center justify-between">
                  <div>
                  <h1 className="text-3xl font-bold tracking-tight">
                    {draftId ? 'Finalise Application' : 'Add New Customer'}
                  </h1>
                  <p className="text-muted-foreground mt-1">
                      Onboard a new individual customer using the multi-step form below.
                  </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" onClick={handleSaveAsDraft} disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSignature className="mr-2 h-4 w-4" />}
                        Save as Draft
                    </Button>
                    <Button type="submit" disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Customer
                    </Button>
                  </div>
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
                      <TabsTrigger value="kyc">KYC Details</TabsTrigger>
                      <TabsTrigger value="contact">Contact Details</TabsTrigger>
                      <TabsTrigger value="financial">Financial Profile</TabsTrigger>
                      <TabsTrigger value="kin">References</TabsTrigger>
                      <TabsTrigger value="system">Account &amp; System</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="kyc">
                      <Card>
                          <CardHeader><CardTitle>KYC Details</CardTitle></CardHeader>
                          <CardContent className="space-y-6">
                               <div className="flex flex-col md:flex-row gap-6">
                                  <div className="space-y-2 flex-shrink-0">
                                      <FormLabel>Customer Photo</FormLabel>
                                      <div className="w-48 h-48 rounded-md border border-dashed flex items-center justify-center bg-muted overflow-hidden relative">
                                          {capturedImage ? <Image src={capturedImage} alt="Captured" layout="fill" className="object-cover"/> : <UserIcon className="h-16 w-16 text-muted-foreground"/>}
                                      </div>
                                       <div className="flex gap-2">
                                            <Button type="button" variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                                                <Upload className="mr-2 h-4 w-4"/> Upload
                                            </Button>
                                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                                            {!stream && (
                                                <Button type="button" variant="outline" className="w-full" onClick={startCamera}>
                                                    <Video className="mr-2 h-4 w-4"/> Camera
                                                </Button>
                                            )}
                                        </div>
                                  </div>
                                  <div className="flex-grow space-y-4">
                                      {stream && (
                                          <div className="space-y-2">
                                            <video ref={videoRef} className={cn("w-full aspect-video rounded-md bg-black")} autoPlay muted playsInline />
                                            <Button type="button" variant="default" className="w-full" onClick={handleCapture}>
                                                <Camera className="mr-2 h-4 w-4"/> Capture Photo
                                            </Button>
                                          </div>
                                      )}
                                      <canvas ref={canvasRef} className="hidden" />
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
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <FormControl>
                                              <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                              </Button>
                                            </FormControl>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                captionLayout="dropdown-buttons"
                                                fromYear={1930}
                                                toYear={new Date().getFullYear() - 18}
                                                selected={field.value}
                                                onSelect={field.onChange}
                                                disabled={(date) => date > new Date(new Date().setFullYear(new Date().getFullYear() - 18))}
                                                initialFocus
                                            />
                                          </PopoverContent>
                                        </Popover><FormMessage />
                                      </FormItem>)} />
                                    <FormField control={form.control} name="gender" render={({ field }) => (<FormItem><FormLabel>Gender</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="maritalStatus" render={({ field }) => (<FormItem><FormLabel>Marital Status</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Single">Single</SelectItem><SelectItem value="Married">Married</SelectItem><SelectItem value="Divorced">Divorced</SelectItem><SelectItem value="Widowed">Widowed</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                     <FormField
                                        control={form.control}
                                        name="nationality"
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel>Nationality</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value && "text-muted-foreground")}>
                                                    {field.value ? countries.find((country) => country.name === field.value)?.name : "Select country"}
                                                    </Button>
                                                </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[300px] p-0">
                                                <Command>
                                                    <CommandInput placeholder="Search country..." />
                                                    <CommandList>
                                                    <CommandEmpty>No country found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {countries.map((country) => (
                                                        <CommandItem
                                                            value={country.name}
                                                            key={country.code}
                                                            onSelect={() => {
                                                            form.setValue("nationality", country.name)
                                                            }}
                                                        >
                                                            <Check className={cn("mr-2 h-4 w-4", country.name === field.value ? "opacity-100" : "opacity-0")} />
                                                            {country.name}
                                                        </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                        />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <FormField control={form.control} name="numberOfDependents" render={({ field }) => (<FormItem><FormLabel>No. of Dependents</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                  <FormField control={form.control} name="idType" render={({ field }) => (<FormItem><FormLabel>ID Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select ID type" /></SelectTrigger></FormControl><SelectContent><SelectItem value="National ID">National ID</SelectItem><SelectItem value="Passport">Passport</SelectItem><SelectItem value="Driving Permit">Driving Permit</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                  <FormField control={form.control} name="idNumber" render={({ field }) => (<FormItem><FormLabel>ID Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                </div>
                          </CardContent>
                      </Card>
                  </TabsContent>

                   <TabsContent value="contact">
                      <Card>
                          <CardHeader><CardTitle>Contact Details</CardTitle></CardHeader>
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
                                      <FormField control={form.control} name="currentResidence.district" render={({ field }) => (<FormItem><FormLabel>District</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select district" /></SelectTrigger></FormControl><SelectContent>{malawiDistricts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                      <FormField control={form.control} name="currentResidence.area" render={({ field }) => (<FormItem><FormLabel>Area / Village</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                  </div>
                                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                                     <FormField control={form.control} name="residenceType" render={({ field }) => (<FormItem><FormLabel>Residence Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="Own">Own House</SelectItem><SelectItem value="Rented">Rented House</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                      <FormField control={form.control} name="monthlyRent" render={({ field }) => (<FormItem><FormLabel>Monthly Rent (if rented)</FormLabel><FormControl><CurrencyInput {...field} /></FormControl><FormMessage /></FormItem>)} />
                                      <FormField control={form.control} name="residenceStayInYears" render={({ field }) => (<FormItem><FormLabel>Years at Residence</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                   </div>
                              </div>
                               <div className="space-y-4 rounded-md border p-4">
                                  <h3 className="font-medium">Home Village</h3>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                      <FormField control={form.control} name="homeVillage.district" render={({ field }) => (<FormItem><FormLabel>District</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select district" /></SelectTrigger></FormControl><SelectContent>{malawiDistricts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
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
                                  <FormField control={form.control} name="occupationCategory" render={({ field }) => (<FormItem><FormLabel>Primary Occupation</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select occupation..." /></SelectTrigger></FormControl><SelectContent><SelectItem value="Salaried">Salaried Employee</SelectItem><SelectItem value="Business">Business / Self-Employed</SelectItem><SelectItem value="Farming">Farming</SelectItem><SelectItem value="Unemployed">Unemployed</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                  {occupationCategory === 'Salaried' ? (
                                     <FormField control={form.control} name="employerName" render={({ field }) => (
                                        <FormItem><FormLabel>Employer</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder={isEmployersLoading ? "Loading..." : "Select employer..."}/></SelectTrigger></FormControl>
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
                                  <FormField control={form.control} name="primaryIncome" render={({ field }) => (<FormItem><FormLabel>Net Salary / Monthly Income</FormLabel><FormControl><CurrencyInput {...field} /></FormControl><FormMessage /></FormItem>)} />
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
                                <h3 className="font-medium">Spouse&apos;s Details</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <FormField control={form.control} name="spouseDetails.name" render={({ field }) => (<FormItem><FormLabel>Spouse&apos;s Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="spouseDetails.phone" render={({ field }) => (<FormItem><FormLabel>Spouse&apos;s Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="spouseDetails.workplace" render={({ field }) => (<FormItem><FormLabel>Spouse&apos;s Work Place</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
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
                          <CardHeader><CardTitle>Account &amp; System Settings</CardTitle></CardHeader>
                          <CardContent className="space-y-6">
                              <FormField control={form.control} name="branchId" render={({ field }) => (
                                  <FormItem>
                                      <FormLabel>Assign to Branch</FormLabel>
                                      <Select onValueChange={field.onChange} value={field.value}>
                                          <FormControl>
                                              <SelectTrigger>
                                                  <SelectValue placeholder={institutionLoading ? "Loading..." : "Select a branch..."} />
                                              </SelectTrigger>
                                          </FormControl>
                                          <SelectContent>
                                              {allBranches.map((branch) => (
                                                  <SelectItem key={branch.code} value={branch.code}>{branch.name}</SelectItem>
                                              ))}
                                          </SelectContent>
                                      </Select>
                                      <FormMessage />
                                  </FormItem>
                              )} />
                              <FormField control={form.control} name="savingsProductId" render={({ field }) => (
                                  <FormItem>
                                      <FormLabel>Assign Savings Product</FormLabel>
                                      <Select onValueChange={field.onChange} value={field.value}>
                                          <FormControl>
                                              <SelectTrigger>
                                                  <SelectValue placeholder={isSavingsProductsLoading ? "Loading..." : "Select savings product"} />
                                              </SelectTrigger>
                                          </FormControl>
                                          <SelectContent>
                                              {savingsProducts?.map((product: any) => (
                                                  <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                                              ))}
                                          </SelectContent>
                                      </Select>
                                      <FormDescription>Every new customer must be assigned a savings product.</FormDescription>
                                      <FormMessage />
                                  </FormItem>
                              )} />
                              <FormField control={form.control} name="accountPurpose" render={({ field }) => (<FormItem><FormLabel>Purpose of Account</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
                              <FormField control={form.control} name="isPep" render={({ field }) => (
                                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                                      <div className="space-y-0.5"><FormLabel>Politically Exposed Person (PEP)</FormLabel><FormDescription>Is this customer a politically exposed person?</FormDescription></div>
                                      <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                  </FormItem>
                              )} />
                          </CardContent>
                      </Card>
                  </TabsContent>
              </Tabs>
        </form>
      </Form>
      
      <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Find a Customer</DialogTitle>
                  <DialogDescription>Search for an existing profile to check for duplicates.</DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2">
                  <Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  <Button onClick={handleSearch} disabled={isSearching || searchTerm.length < 3}>
                      {isSearching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Search"}
                  </Button>
              </div>
              <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
                {searchResults.map(c => (
                    <div key={c.id} onClick={() => handleSelectCustomer(c)} className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer">
                        <Avatar className="h-8 w-8"><AvatarImage src={c.photoUrl} /><AvatarFallback>{c.name.charAt(0)}</AvatarFallback></Avatar>
                        <div><p className="text-sm font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.accountNumber}</p></div>
                    </div>
                ))}
              </div>
          </DialogContent>
      </Dialog>
    </>
  );
}

export default function AddNewCustomerPage() {
    return (
        <Suspense fallback={<Skeleton className="h-screen w-full" />}>
            <AddNewCustomerContent />
        </Suspense>
    )
}
