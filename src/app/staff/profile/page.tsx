
'use client';

import { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  AtSign,
  User as UserIcon,
  Building,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle,
  Briefcase,
  Upload,
  Phone,
  Save,
  Hash,
} from 'lucide-react';
import {
  useUser,
  useFirestore,
  useDoc,
  useMemoFirebase,
  useStorage,
} from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { ref, uploadString, getDownloadURL } from "firebase/storage";

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


const profileFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required.'),
  lastName: z.string().min(1, 'Last name is required.'),
  phone: z.string().optional(),
});

const passwordFormSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required.'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters.'),
}).refine(data => data.currentPassword !== data.newPassword, {
    message: "New password must be different from the current one.",
    path: ["newPassword"],
});


export default function ProfilePage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();

  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);
  
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData, isLoading: isUserDataLoading } = useDoc(userDocRef);

  const institutionDocRef = useMemoFirebase(
    () => (firestore && userData?.institutionId ? doc(firestore, 'institutions', userData.institutionId) : null),
    [firestore, userData]
  );
  const { data: institutionData, isLoading: isInstitutionLoading } = useDoc(institutionDocRef);

  const profileForm = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    values: {
      firstName: userData?.firstName || '',
      lastName: userData?.lastName || '',
      phone: userData?.phone || '',
    },
  });

  const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
        currentPassword: '',
        newPassword: '',
    }
  });

  useEffect(() => {
      if (userData) {
          profileForm.reset({
              firstName: userData.firstName || '',
              lastName: userData.lastName || '',
              phone: userData.phone || '',
          });
          setPhotoPreview(userData.photoURL || null);
      }
  }, [userData, profileForm]);


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setPhotoPreview(reader.result as string);
          };
          reader.readAsDataURL(file);
      }
  };


  async function onProfileSubmit(values: z.infer<typeof profileFormSchema>) {
    setUpdateLoading(true);
    setUpdateError(null);
    setUpdateSuccess(null);
    try {
      if (!user || !userDocRef || !storage) throw new Error('User or configuration not found.');
      
      const fullName = `${values.firstName} ${values.lastName}`;
      let photoDownloadUrl = user.photoURL || '';

      if (photoPreview && photoPreview.startsWith('data:')) {
          const photoRef = ref(storage, `users/${user.uid}/profile.jpg`);
          const uploadResult = await uploadString(photoRef, photoPreview, 'data_url');
          photoDownloadUrl = await getDownloadURL(uploadResult.ref);
      }
      
      await updateProfile(user, { displayName: fullName, photoURL: photoDownloadUrl });
      await updateDoc(userDocRef, {
        firstName: values.firstName,
        lastName: values.lastName,
        name: fullName,
        phone: values.phone,
        photoURL: photoDownloadUrl,
      });

      setUpdateSuccess('Your profile has been updated successfully.');
    } catch (e) {
      console.error('Profile update error:', e);
      setUpdateError('Failed to update profile. Please try again.');
    } finally {
      setUpdateLoading(false);
    }
  }

  async function onPasswordSubmit(values: z.infer<typeof passwordFormSchema>) {
    setPasswordLoading(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    try {
        if (!user || !user.email) throw new Error('User not authenticated.');

        const credential = EmailAuthProvider.credential(user.email, values.currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, values.newPassword);

        setPasswordSuccess('Your password has been changed successfully.');
        passwordForm.reset();
    } catch (e: any) {
        console.error('Password change error:', e);
        if(e.code === 'auth/wrong-password') {
            setPasswordError('The current password you entered is incorrect.');
        } else {
            setPasswordError('Failed to change password. Please try again.');
        }
    } finally {
        setPasswordLoading(false);
    }
  }

  const isLoading = isUserLoading || isUserDataLoading || isInstitutionLoading;
  const userRole = userData?.role === 'institution-admin' ? 'Institution Admin' : 'Staff';
  const displayName = userData?.name || user?.displayName || 'Staff member';
  const initials = displayName.split(/\s+/).map((part: string) => part[0]).join('').slice(0, 2).toUpperCase();

  if (isLoading) {
      return (
          <div className="space-y-6">
              <div className="space-y-2"><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-72" /></div>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <Skeleton className="h-80 w-full" />
                <Skeleton className="h-96 w-full lg:col-span-2" />
              </div>
          </div>
      )
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-primary">Account</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">My profile</h1>
        <p className="mt-2 text-muted-foreground">Manage your personal information and sign-in security.</p>
      </header>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-1">
          <div className="h-2 bg-primary" />
          <CardHeader className="items-center px-6 pb-5 pt-7 text-center">
            <Avatar className="mb-2 h-24 w-24 ring-4 ring-primary/10">
              <AvatarImage src={photoPreview || user?.photoURL || ''} alt={displayName} />
              <AvatarFallback className="bg-primary/10 text-2xl font-semibold text-primary">{initials}</AvatarFallback>
            </Avatar>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> Change photo
            </Button>
            <CardTitle className="pt-2 text-xl">{displayName}</CardTitle>
            <CardDescription className="flex items-center gap-1.5"><AtSign className="h-3.5 w-3.5" />{user?.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 border-t bg-muted/20 px-6 py-5 text-sm">
            <div className="flex items-start gap-3"><Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><div><p className="text-xs text-muted-foreground">Role</p><p className="mt-0.5 font-medium">{userData?.customRoleName || userRole}</p></div></div>
            <div className="flex items-start gap-3"><Building className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><div><p className="text-xs text-muted-foreground">Institution</p><p className="mt-0.5 font-medium">{institutionData?.name || 'Not assigned'}</p></div></div>
            <div className="flex items-start gap-3"><Hash className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><div><p className="text-xs text-muted-foreground">Employee ID</p><p className="mt-0.5 font-medium">{userData?.employeeId || 'Not assigned'}</p></div></div>
            <div className="flex items-start gap-3"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><div><p className="text-xs text-muted-foreground">Phone</p><p className="mt-0.5 font-medium">{userData?.phone || 'Not provided'}</p></div></div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Tabs defaultValue="profile">
            <TabsList className="mb-4 grid h-auto w-full grid-cols-2 rounded-xl bg-muted p-1">
              <TabsTrigger className="rounded-lg py-2.5" value="profile"><UserIcon className="mr-2 h-4 w-4" />Personal details</TabsTrigger>
              <TabsTrigger className="rounded-lg py-2.5" value="password"><KeyRound className="mr-2 h-4 w-4" />Password & security</TabsTrigger>
            </TabsList>
            <TabsContent value="profile">
                <Card>
                    <CardHeader>
                        <CardTitle>Personal information</CardTitle>
                        <CardDescription>Keep your contact details up to date.</CardDescription>
                    </CardHeader>
                    <Form {...profileForm}>
                        <form onSubmit={profileForm.handleSubmit(onProfileSubmit)}>
                        <CardContent className="space-y-6">
                        {updateError && (
                            <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Update Failed</AlertTitle><AlertDescription>{updateError}</AlertDescription></Alert>
                        )}
                        {updateSuccess && (
                            <Alert variant="default" className="bg-green-100 border-green-300"><CheckCircle className="h-4 w-4 text-green-700" /><AlertTitle className="text-green-800">Success</AlertTitle><AlertDescription className="text-green-700">{updateSuccess}</AlertDescription></Alert>
                        )}
                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                          <FormField control={profileForm.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>First name</FormLabel><FormControl><Input autoComplete="given-name" placeholder="First name" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                          <FormField control={profileForm.control} name="lastName" render={({ field }) => (<FormItem><FormLabel>Last name</FormLabel><FormControl><Input autoComplete="family-name" placeholder="Last name" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </div>
                        <FormField control={profileForm.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone number</FormLabel><FormControl><Input type="tel" autoComplete="tel" placeholder="Add a phone number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        </CardContent>
                        <CardFooter className="justify-end">
                            <Button type="submit" disabled={updateLoading || !profileForm.formState.isDirty}>
                            {updateLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save changes
                            </Button>
                        </CardFooter>
                        </form>
                    </Form>
                </Card>
            </TabsContent>
            <TabsContent value="password">
                <Card>
                    <CardHeader>
                        <CardTitle>Change Password</CardTitle>
                        <CardDescription>Use your current password to confirm this change. Choose at least 6 characters.</CardDescription>
                    </CardHeader>
                    <Form {...passwordForm}>
                        <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}>
                            <CardContent className="space-y-6">
                            {passwordError && ( <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{passwordError}</AlertDescription></Alert> )}
                            {passwordSuccess && ( <Alert variant="default" className="bg-green-100 border-green-300"><CheckCircle className="h-4 w-4 text-green-700" /><AlertTitle className="text-green-800">Success</AlertTitle><AlertDescription className="text-green-700">{passwordSuccess}</AlertDescription></Alert> )}
                            <FormField control={passwordForm.control} name="currentPassword" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Current Password</FormLabel>
                                    <FormControl>
                                    <div className="relative">
                                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                        <Input type={showCurrentPassword ? 'text' : 'password'} {...field} className="pl-10" />
                                        <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowCurrentPassword(!showCurrentPassword)}>
                                            {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                             <FormField control={passwordForm.control} name="newPassword" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>New Password</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                            <Input type={showNewPassword ? 'text' : 'password'} {...field} className="pl-10" />
                                            <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowNewPassword(!showNewPassword)}>
                                                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            </CardContent>
                            <CardFooter className="justify-end">
                                <Button type="submit" disabled={passwordLoading}>
                                {passwordLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Change Password
                                </Button>
                            </CardFooter>
                        </form>
                    </Form>
                </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
