
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  useUser,
  useFirestore,
  useDoc,
  useMemoFirebase,
  useStorage,
} from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Building,
  Briefcase,
  Hash,
  MapPin,
  Mail,
  Phone,
  Globe,
  Loader2,
  AlertCircle,
  CheckCircle,
  Upload,
  Pencil,
  Save,
  Home,
  CalendarIcon,
  Wallet,
} from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Switch } from '@/components/ui/switch';


const malawiDistricts = [
    "Balaka", "Blantyre", "Chikwawa", "Chiradzulu", "Chitipa",
    "Dedza", "Dowa", "Karonga", "Kasungu", "Likoma",
    "Lilongwe", "Machinga", "Mangochi", "Mchinji", "Mulanje",
    "Mwanza", "Mzimba", "Neno", "Nkhata Bay", "Nkhotakota",
    "Nsanje", "Ntcheu", "Ntchisi", "Phalombe", "Rumphi",
    "Salima", "Thyolo", "Zomba"
];

const profileSchema = z.object({
  name: z.string().min(1, 'Institution name is required.'),
  shortName: z.string().min(1, 'Short name is required.'),
  registrationNumber: z.string().min(1, 'Registration number is required.'),
  type: z.enum(['SACCO', 'MFI']),
  isDepositTaking: z.boolean(),
  location: z.string().min(1, 'District is required.'),
  physicalAddress: z.string().min(1, 'Physical address is required.'),
  hqBranch: z.object({
    name: z.string().min(1, 'HQ branch name is required.'),
    code: z.string(),
    id: z.string(),
    location: z.string(),
  }),
  contactEmail: z.string().email('Invalid email address.'),
  contactPhone: z.string().min(1, 'Phone number is required.'),
  website: z.string().url('Invalid URL.').optional().or(z.literal('')),
  systemDate: z.date({ required_error: 'Initial system date is required.' }),
  logoUrl: z.string().optional(),
});

function InstitutionProfileContent() {
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userDocRef = useMemoFirebase(
    () => (user && user.uid ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);

  const institutionDocRef = useMemoFirebase(
    () => (userData?.institutionId ? doc(firestore, 'institutions', userData.institutionId) : null),
    [firestore, userData]
  );
  const { data: institutionData, isLoading: isInstitutionLoading } = useDoc(institutionDocRef);

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
      shortName: '',
      registrationNumber: '',
      type: undefined,
      isDepositTaking: true,
      location: '',
      physicalAddress: '',
      hqBranch: { name: '', code: '01', id: '01', location: '' },
      contactEmail: '',
      contactPhone: '',
      website: '',
      logoUrl: '',
    }
  });

  useEffect(() => {
    if (institutionData) {
      form.reset({
        ...institutionData,
        systemDate: institutionData.systemDate?.toDate ? institutionData.systemDate.toDate() : new Date(),
        logoUrl: institutionData.logoUrl || '',
      });
      setLogoPreview(institutionData.logoUrl || null);
    }
  }, [institutionData, form]);
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setLogoPreview(dataUrl);
        form.setValue('logoUrl', dataUrl, { shouldDirty: true });
      };
      reader.readAsDataURL(file);
    }
  };


  async function onSubmit(values: z.infer<typeof profileSchema>) {
    if (!institutionDocRef || !storage || !userData?.institutionId) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      let finalLogoUrl = institutionData?.logoUrl || '';

      if (logoPreview && logoPreview.startsWith('data:')) {
        const storageRef = ref(storage, `institutions/${userData.institutionId}/logo`);
        const snapshot = await uploadString(storageRef, logoPreview, 'data_url');
        finalLogoUrl = await getDownloadURL(snapshot.ref);
      }

      const updatePayload = {
          ...values,
          logoUrl: finalLogoUrl,
      };

      await updateDoc(institutionDocRef, updatePayload);
      setSuccess('Institution profile updated successfully.');
      setIsEditing(false);
    } catch (e) {
      console.error(e);
      setError('Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (isInstitutionLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96 mt-2" />
          </div>
          <Skeleton className="h-10 w-24" />
        </CardHeader>
        <CardContent className="space-y-6">
            <Skeleton className="h-32 w-32 rounded-full" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Institution Profile</CardTitle>
              <CardDescription>
                Manage your institution's core details, branding, and contact information.
              </CardDescription>
            </div>
            {!isEditing && (
              <Button type="button" onClick={() => setIsEditing(true)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit Profile
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-8">
            {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
            {success && <Alert variant="default" className="bg-green-100 border-green-300"><CheckCircle className="h-4 w-4 text-green-700" /><AlertTitle className="text-green-800">Success</AlertTitle><AlertDescription className="text-green-700">{success}</AlertDescription></Alert>}
            
            <div className="flex items-center gap-6">
                <Avatar className="h-32 w-32">
                    <AvatarImage src={logoPreview || undefined} alt={`${institutionData?.name || ''} logo`} />
                    <AvatarFallback className="text-4xl">
                        {institutionData?.name?.charAt(0)}
                    </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                    <h3 className="text-lg font-medium">Institution Logo</h3>
                    <p className="text-sm text-muted-foreground">This logo will appear across the platform.</p>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                    <Button type="button" variant="outline" disabled={!isEditing} onClick={() => fileInputRef.current?.click()}>
                        <Upload className="mr-2 h-4 w-4" /> Upload Logo
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Institution Name</FormLabel>
                  <FormControl><div className="relative"><Building className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input {...field} className="pl-10" disabled={!isEditing}/></div></FormControl><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="shortName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Short Name</FormLabel>
                  <FormControl><div className="relative"><Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input {...field} className="pl-10" disabled={!isEditing}/></div></FormControl><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="registrationNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>Reg. Number</FormLabel>
                  <FormControl><div className="relative"><Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input {...field} className="pl-10" disabled={!isEditing}/></div></FormControl><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Institution Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!isEditing}>
                    <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        <SelectItem value="SACCO">SACCO</SelectItem>
                        <SelectItem value="MFI">MFI</SelectItem>
                    </SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="location" render={({ field }) => (
                <FormItem>
                  <FormLabel>District (HQ)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!isEditing}>
                    <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select district..." /></SelectTrigger>
                    </FormControl>
                    <SelectContent>{malawiDistricts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
               <FormField control={form.control} name="physicalAddress" render={({ field }) => (
                <FormItem>
                  <FormLabel>Physical Address (HQ)</FormLabel>
                  <FormControl><div className="relative"><MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input {...field} className="pl-10" disabled={!isEditing}/></div></FormControl><FormMessage />
                </FormItem>
              )} />
               <FormField control={form.control} name="hqBranch.name" render={({ field }) => (
                <FormItem>
                  <FormLabel>HQ Branch Name</FormLabel>
                  <FormControl><div className="relative"><Home className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input {...field} className="pl-10" disabled={!isEditing}/></div></FormControl><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="contactEmail" render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Email</FormLabel>
                  <FormControl><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input type="email" {...field} className="pl-10" disabled={!isEditing}/></div></FormControl><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="contactPhone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl><div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input {...field} className="pl-10" disabled={!isEditing}/></div></FormControl><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="website" render={({ field }) => (
                <FormItem>
                  <FormLabel>Website (Optional)</FormLabel>
                  <FormControl><div className="relative"><Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" /><Input {...field} className="pl-10" disabled={!isEditing}/></div></FormControl><FormMessage />
                </FormItem>
              )} />
               <FormField
                  control={form.control}
                  name="systemDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>System Date</FormLabel>
                       <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                              disabled={!isEditing}
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
                    name="isDepositTaking"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <FormLabel>Deposit-Taking?</FormLabel>
                        </div>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={!isEditing} /></FormControl>
                        </FormItem>
                    )}
                />
            </div>
          </CardContent>
          {isEditing && (
            <CardFooter className="justify-end space-x-2">
                <Button type="button" variant="ghost" onClick={() => { setIsEditing(false); form.reset({ ...institutionData, systemDate: institutionData?.systemDate.toDate() }); setLogoPreview(institutionData?.logoUrl || null); }}>Cancel</Button>
                <Button type="submit" disabled={loading || !form.formState.isDirty}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Changes
                </Button>
            </CardFooter>
          )}
        </Card>
      </form>
    </Form>
  );
}


export default function InstitutionProfilePage() {
    const [isClient, setIsClient] = useState(false)
 
    useEffect(() => {
        setIsClient(true)
    }, [])

    return isClient ? <InstitutionProfileContent /> : (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96 mt-2" />
          </div>
          <Skeleton className="h-10 w-24" />
        </CardHeader>
        <CardContent className="space-y-6">
            <Skeleton className="h-32 w-32 rounded-full" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
        </CardContent>
      </Card>
    );
}

    