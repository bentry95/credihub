'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  useUser,
  useFirestore,
  useDoc,
  useMemoFirebase,
  useCollection,
} from '@/firebase';
import { collection, doc, query, where, getDocs, limit, setDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Users2, PlusCircle, CalendarIcon, Search, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useBranch } from '@/context/BranchContext';
import { Skeleton } from '@/components/ui/skeleton';


const groupMemberSchema = z.object({
    customerId: z.string(),
    name: z.string(),
    role: z.enum(['Chairperson', 'Secretary', 'Treasurer', 'Member']),
});

const groupFormSchema = z.object({
    name: z.string().min(1, 'Group name is required.'),
    branchId: z.string().min(1, 'Branch is required.'),
    formationDate: z.date({ required_error: 'Formation date is required.' }),
    meetingFrequency: z.enum(['Weekly', 'Bi-Weekly', 'Monthly']),
    contributionAmount: z.coerce.number().min(0),
    members: z.array(groupMemberSchema).min(1, 'At least one member is required.'),
});


export default function ManageGroupsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { availableBranches } = useBranch();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const userDocRef = useMemoFirebase(() => (firestore && user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
  const { data: userData } = useDoc(userDocRef);

  const institutionDocRef = useMemoFirebase(() => (firestore && userData?.institutionId ? doc(firestore, 'institutions', userData.institutionId) : null), [firestore, userData]);
  const { data: institutionData } = useDoc(institutionDocRef);
  
  const groupsQuery = useMemoFirebase(
    () => (firestore && userData?.institutionId ? query(collection(firestore, 'institutions', userData.institutionId, 'customers'), where('customerType', '==', 'Group')) : null),
    [firestore, userData]
  );
  const { data: groups, isLoading: isGroupsLoading } = useCollection(groupsQuery);


  const form = useForm<z.infer<typeof groupFormSchema>>({
    resolver: zodResolver(groupFormSchema),
    defaultValues: {
        members: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'members'
  });

  useEffect(() => {
    if (searchTerm.length < 2 || !firestore || !userData?.institutionId) {
      setSearchResults([]);
      return;
    }
    const performSearch = async () => {
      setIsSearching(true);
      const customersRef = collection(firestore, 'institutions', userData.institutionId, 'customers');
      const q = query(customersRef, where('customerType', '==', 'Individual'), where('name_lowercase', '>=', searchTerm.toLowerCase()), where('name_lowercase', '<=', searchTerm.toLowerCase() + '\uf8ff'), limit(5));
      const snap = await getDocs(q);
      setSearchResults(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setIsSearching(false);
    };
    const debounce = setTimeout(performSearch, 300);
    return () => clearTimeout(debounce);
  }, [searchTerm, firestore, userData?.institutionId]);

  const addMember = (customer: any) => {
    if (fields.some(field => field.customerId === customer.id)) {
        toast({
            variant: "destructive",
            title: "Member Already Added",
            description: `${customer.name} is already in the list.`
        })
        return;
    }
    append({ customerId: customer.id, name: customer.name, role: 'Member' });
    setSearchTerm('');
    setSearchResults([]);
  };

  async function onSubmit(values: z.infer<typeof groupFormSchema>) {
    if (!firestore || !userData?.institutionId || !institutionDocRef) return;

    setLoading(true);
    setError(null);
    try {
        await runTransaction(firestore, async (transaction) => {
            const instDoc = await transaction.get(institutionDocRef);
            if (!instDoc.exists()) throw "Institution not found!";

            let customerCounter = instDoc.data().customerCounter || 0;
            const shortName = instDoc.data().shortName || "INST";
            
            customerCounter++;
            const newAccountNumber = `${shortName}GRP${String(customerCounter).padStart(6, '0')}`;
            
            const newGroupRef = doc(collection(firestore, 'institutions', userData.institutionId, 'customers'), newAccountNumber);

            const groupData = {
                id: newGroupRef.id,
                institutionId: userData.institutionId,
                accountNumber: newAccountNumber,
                name: values.name,
                name_lowercase: values.name.toLowerCase(),
                branchId: values.branchId,
                customerType: 'Group',
                groupDetails: {
                    formationDate: values.formationDate,
                    meetingFrequency: values.meetingFrequency,
                    contributionAmount: values.contributionAmount,
                },
                groupMembers: values.members,
                kycStatus: 'Verified',
                createdAt: serverTimestamp(),
            };
            
            transaction.set(newGroupRef, groupData);
            transaction.update(institutionDocRef, { customerCounter });
        });

        toast({
            title: "Group Created",
            description: `Group "${values.name}" has been created and is pending approval.`
        });
        setLoading(false);
        setIsDialogOpen(false);
        form.reset();
    } catch (e) {
        console.error("Error creating group:", e);
        setError('Failed to create group. Please try again.');
        setLoading(false);
    }
  }
  
  const getBranchName = (branchId: string) => {
      const branch = availableBranches.find(b => b.id === branchId);
      return branch?.name || branchId;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Customer Groups</h1>
          <p className="text-muted-foreground mt-1">
            Create and oversee VSLAs and other customer groups.
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <PlusCircle className="mr-2 h-4 w-4" /> Create New Group
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Existing Groups</CardTitle>
          <CardDescription>
            A list of all customer groups in your institution.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Group Name</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>KYC Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isGroupsLoading ? (
                  Array.from({length: 3}).map((_, i) => (
                      <TableRow key={i}>
                          <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                      </TableRow>
                  ))
              ) : groups && groups.length > 0 ? (
                groups.map((group) => (
                    <TableRow key={group.id}>
                    <TableCell className="font-medium">{group.name}</TableCell>
                    <TableCell>{getBranchName(group.branchId)}</TableCell>
                    <TableCell>{group.groupMembers?.length || 0}</TableCell>
                    <TableCell>
                        <Badge variant={group.kycStatus === 'Verified' ? 'default' : 'secondary'}>
                        {group.kycStatus}
                        </Badge>
                    </TableCell>
                    </TableRow>
                ))
              ) : (
                <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">No groups found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Create New Customer Group</DialogTitle>
            <DialogDescription>
              Complete the steps below to form a new group.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                 {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /> <AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
                <Tabs defaultValue="details" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="details">Group Details</TabsTrigger>
                        <TabsTrigger value="members">Members</TabsTrigger>
                    </TabsList>
                    <TabsContent value="details" className="pt-4">
                        <div className="space-y-4 max-h-[50vh] overflow-y-auto p-1">
                            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Group Name</FormLabel><FormControl><Input placeholder="e.g., Tikondane VSLA" {...field} /></FormControl><FormMessage /></FormItem>)} />
                             <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="branchId" render={({ field }) => (
                                    <FormItem><FormLabel>Assign to Branch</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select branch..."/></SelectTrigger></FormControl>
                                        <SelectContent>{availableBranches.filter(b => b.id !== 'all').map((branch: any) => (<SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>))}</SelectContent>
                                    </Select><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="formationDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Formation Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date()} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="meetingFrequency" render={({ field }) => (<FormItem><FormLabel>Meeting Frequency</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select frequency..."/></SelectTrigger></FormControl><SelectContent><SelectItem value="Weekly">Weekly</SelectItem><SelectItem value="Bi-Weekly">Bi-Weekly</SelectItem><SelectItem value="Monthly">Monthly</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="contributionAmount" render={({ field }) => (<FormItem><FormLabel>Contribution Amount (per meeting)</FormLabel><FormControl><Input type="number" placeholder="e.g., 5000" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            </div>
                        </div>
                    </TabsContent>
                     <TabsContent value="members" className="pt-4">
                         <div className="space-y-4 max-h-[50vh] overflow-y-auto p-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input placeholder="Search for customers to add..." className="pl-10" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                                {searchResults.length > 0 && <Card className="absolute top-full mt-2 w-full z-10"><CardContent className="p-2">
                                    {isSearching ? <div className="p-2">Searching...</div> : searchResults.map(c => (
                                        <div key={c.id} onClick={() => addMember(c)} className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer">
                                            <Avatar className="h-8 w-8"><AvatarImage src={c.photoUrl} /><AvatarFallback>{c.name.charAt(0)}</AvatarFallback></Avatar>
                                            <div><p className="text-sm font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.accountNumber}</p></div>
                                        </div>
                                    ))}
                                </CardContent></Card>}
                            </div>
                            <FormField control={form.control} name="members" render={() => (
                                <FormItem><FormMessage className="mb-2" /></FormItem>
                            )}/>
                            <Table>
                                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead className="text-right"></TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {fields.length > 0 ? fields.map((field, index) => (
                                        <TableRow key={field.id}>
                                            <TableCell>{field.name}</TableCell>
                                            <TableCell>
                                                <FormField control={form.control} name={`members.${index}.role`} render={({ field }) => (
                                                    <FormItem><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>
                                                        <SelectItem value="Chairperson">Chairperson</SelectItem><SelectItem value="Secretary">Secretary</SelectItem><SelectItem value="Treasurer">Treasurer</SelectItem><SelectItem value="Member">Member</SelectItem>
                                                    </SelectContent></Select></FormItem>
                                                )}/>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4"/></Button>
                                            </TableCell>
                                        </TableRow>
                                    )) : <TableRow><TableCell colSpan={3} className="h-24 text-center">No members added yet.</TableCell></TableRow>}
                                </TableBody>
                            </Table>
                         </div>
                    </TabsContent>
                </Tabs>
                 <DialogFooter className="pt-4">
                    <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                    <Button type="submit" disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create Group</Button>
                </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

    </div>
  );
}