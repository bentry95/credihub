
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { Input } from '@/components/ui/input';
import { Search, Download, ClipboardList, FileWarning, Package, PlusCircle, Loader2, Save, Pencil, MoreVertical } from 'lucide-react';
import { format } from 'date-fns';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface AssetRegisterItem {
  id: string;
  name: string;
  code: string;
  categoryName: string;
  costPrice: number;
  purchaseDate: Date;
  status: 'Available' | 'Issued';
  issuedTo?: string;
  issueDate?: Date;
  netBookValue: number;
}

const assetSchema = z.object({
  name: z.string().min(1, 'Asset name is required.'),
  code: z.string().min(1, 'Asset code/tag is required.'),
  categoryId: z.string().min(1, 'Category is required.'),
  costPrice: z.coerce.number().min(0, "Cost must be a positive number."),
  createdAt: z.date({ required_error: 'Purchase date is required.' }),
});

export default function AssetRegisterPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [assetData, setAssetData] = useState<AssetRegisterItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<any | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const { data: userData } = useDoc(
    useMemoFirebase(() => (firestore && user ? doc(firestore, 'users', user.uid) : null), [firestore, user])
  );
  const institutionId = userData?.institutionId;

  const { data: assetItems, isLoading: isItemsLoading } = useCollection(
    useMemoFirebase(() => (institutionId ? query(collection(firestore, 'institutions', institutionId, 'inventoryItems'), where('itemType', '==', 'Asset')) : null), [firestore, institutionId])
  );

  const { data: issuedAssets, isLoading: isIssuedLoading } = useCollection(
    useMemoFirebase(() => (institutionId ? collection(firestore, 'institutions', institutionId, 'staffAssets') : null), [firestore, institutionId])
  );
  
  const { data: categories, isLoading: isCategoriesLoading } = useCollection(
    useMemoFirebase(() => (institutionId ? collection(firestore, 'institutions', institutionId, 'inventoryCategories') : null), [firestore, institutionId])
  );

  useEffect(() => {
    if (isItemsLoading || isIssuedLoading || isCategoriesLoading) return;
    
    const getCategoryName = (id: string) => categories?.find(c => c.id === id)?.name || 'Unknown';

    const processedData: AssetRegisterItem[] = (assetItems || []).map(item => {
      const issuedRecord = (issuedAssets || []).find(issued => issued.inventoryItemId === item.id && issued.status === 'Issued');
      
      // Simple NBV calculation (cost - depreciation). Assuming 0 depreciation for now.
      const netBookValue = item.costPrice || 0;

      return {
        id: item.id,
        name: item.name,
        code: item.code,
        categoryName: getCategoryName(item.categoryId),
        costPrice: item.costPrice || 0,
        purchaseDate: item.createdAt.toDate(),
        status: issuedRecord ? 'Issued' : 'Available',
        issuedTo: issuedRecord ? issuedRecord.customerName : undefined,
        issueDate: issuedRecord ? issuedRecord.dateIssued.toDate() : undefined,
        netBookValue: netBookValue,
      };
    });

    setAssetData(processedData);
    setIsLoading(false);

  }, [assetItems, issuedAssets, categories, isItemsLoading, isIssuedLoading, isCategoriesLoading]);

  const form = useForm<z.infer<typeof assetSchema>>({
    resolver: zodResolver(assetSchema),
  });

  const handleCreate = () => {
    setEditingAsset(null);
    form.reset({ name: '', code: '', categoryId: '', costPrice: 0, createdAt: new Date() });
    setIsFormOpen(true);
  };
  
  const handleEdit = (asset: any) => {
    setEditingAsset(asset);
    const fullAsset = assetItems?.find(item => item.id === asset.id);
    if(fullAsset) {
        form.reset({
            ...fullAsset,
            createdAt: fullAsset.createdAt.toDate(),
        });
    }
    setIsFormOpen(true);
  };

  const onSubmit = async (values: z.infer<typeof assetSchema>) => {
    if (!institutionId) return;
    setFormLoading(true);
    try {
        const assetsRef = collection(firestore, 'institutions', institutionId, 'inventoryItems');
        if (editingAsset) {
            const assetDocRef = doc(assetsRef, editingAsset.id);
            await updateDoc(assetDocRef, values);
            toast({ title: "Asset Updated" });
        } else {
            const newDocRef = doc(assetsRef);
            await setDoc(newDocRef, {
                ...values,
                id: newDocRef.id,
                itemType: 'Asset', // Hardcode type for this form
                quantity: 1, // Fixed assets always have qty 1
                status: 'Active',
            });
            toast({ title: "Asset Created" });
        }
        setIsFormOpen(false);
    } catch(e) {
        console.error(e);
        toast({ variant: 'destructive', title: "Error", description: 'Failed to save asset.'});
    } finally {
        setFormLoading(false);
    }
  };


  const filteredAssets = useMemo(() => {
    if (!searchTerm) return assetData;
    const lowercasedFilter = searchTerm.toLowerCase();
    return assetData.filter(item =>
        item.name.toLowerCase().includes(lowercasedFilter) ||
        item.code.toLowerCase().includes(lowercasedFilter) ||
        item.categoryName.toLowerCase().includes(lowercasedFilter) ||
        item.issuedTo?.toLowerCase().includes(lowercasedFilter)
    );
  }, [assetData, searchTerm]);
  
  const getStatusBadgeVariant = (status: 'Available' | 'Issued') => {
    return status === 'Available' ? 'secondary' : 'default';
  };

  return (
    <>
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fixed Asset Register</h1>
          <p className="text-muted-foreground mt-1">
            A complete register of all fixed assets owned by the institution.
          </p>
        </div>
         <Button onClick={handleCreate}><PlusCircle className="mr-2 h-4 w-4"/> Add Asset</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Asset List</CardTitle>
          <CardDescription>
            Search and view all assets, their cost, and current assignment status.
          </CardDescription>
          <div className="flex items-center justify-between pt-4">
             <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                    placeholder="Search by name, code, user..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export to Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset Name</TableHead>
                <TableHead>Asset Code</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Cost Price (MWK)</TableHead>
                <TableHead>Net Book Value (MWK)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                          <TableCell><Skeleton className="h-5 w-32"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-20"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-24"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-24"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-24"/></TableCell>
                          <TableCell><Skeleton className="h-6 w-20"/></TableCell>
                          <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto"/></TableCell>
                      </TableRow>
                  ))
              ) : filteredAssets.length > 0 ? (
                filteredAssets.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.code}</TableCell>
                    <TableCell>{item.categoryName}</TableCell>
                    <TableCell className="font-mono">{item.costPrice.toLocaleString()}</TableCell>
                    <TableCell className="font-mono">{item.netBookValue.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(item.status)}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                       <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => handleEdit(item)}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                        </DropdownMenuContent>
                       </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center">
                     <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-muted rounded-full">
                        <ClipboardList className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold">
                        No Assets Found
                      </h3>
                      <p className="text-muted-foreground">
                        Get started by adding your first fixed asset.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
    
     <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
            <DialogHeader>
                <DialogTitle>{editingAsset ? 'Edit Asset' : 'Add New Asset'}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                    <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Asset Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="code" render={({ field }) => (<FormItem><FormLabel>Asset Code / Tag Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="categoryId" render={({ field }) => (<FormItem><FormLabel>Category</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select category..." /></SelectTrigger></FormControl><SelectContent>{categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="costPrice" render={({ field }) => (<FormItem><FormLabel>Purchase Cost (MWK)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="createdAt" render={({ field }) => (
                            <FormItem className="flex flex-col"><FormLabel>Purchase Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>
                        )}/>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                        <Button type="submit" disabled={formLoading}>{formLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Save</Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>
    </>
  );
}
