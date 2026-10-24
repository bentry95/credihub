

'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, doc, updateDoc } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Link as LinkIcon, Pencil, Loader2, Save, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const manageItemsSchema = z.object({
  linkedInventoryItems: z.array(z.string()).default([]),
});

export default function LoanAssetsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: userData } = useDoc(
    useMemoFirebase(() => (firestore && user ? doc(firestore, 'users', user.uid) : null), [firestore, user])
  );
  const institutionId = userData?.institutionId;

  const productsQuery = useMemoFirebase(
    () => (institutionId ? collection(firestore, 'institutions', institutionId, 'loanProducts') : null),
    [firestore, institutionId]
  );
  const { data: products, isLoading: isProductsLoading } = useCollection(productsQuery);
  
  const inventoryQuery = useMemoFirebase(
    () => (institutionId ? collection(firestore, 'institutions', institutionId, 'inventoryItems') : null),
    [firestore, institutionId]
  );
  const { data: inventoryItems, isLoading: isInventoryLoading } = useCollection(inventoryQuery);

  const loanableItems = useMemo(() => {
    return inventoryItems?.filter(item => item.itemType === 'Loanable Item') || [];
  }, [inventoryItems]);

  const form = useForm<z.infer<typeof manageItemsSchema>>({
    resolver: zodResolver(manageItemsSchema),
    defaultValues: {
      linkedInventoryItems: [],
    },
  });

  const handleManageClick = (product: any) => {
    setSelectedProduct(product);
    form.reset({ linkedInventoryItems: product.linkedInventoryItems || [] });
    setIsDialogOpen(true);
  };
  
  async function onSubmit(values: z.infer<typeof manageItemsSchema>) {
    if (!institutionId || !selectedProduct) return;
    setLoading(true);
    try {
      const productDocRef = doc(firestore, 'institutions', institutionId, 'loanProducts', selectedProduct.id);
      await updateDoc(productDocRef, {
        linkedInventoryItems: values.linkedInventoryItems,
      });
      toast({ title: 'Success', description: 'Linked items have been updated.' });
      setIsDialogOpen(false);
    } catch(e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to update linked items.' });
    } finally {
      setLoading(false);
    }
  }

  const getLinkedItemsNames = (itemIds: string[]) => {
    if (!itemIds || itemIds.length === 0 || !inventoryItems) return 'None';
    return itemIds.map(id => inventoryItems.find(item => item.id === id)?.name || 'Unknown Item').join(', ');
  }

  const isLoading = isProductsLoading || isInventoryLoading;

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Loanable Asset Bundles</h1>
            <p className="text-muted-foreground mt-1">
              Link specific inventory items to your loan products for asset financing.
            </p>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Product & Asset Links</CardTitle>
            <CardDescription>
              Manage which physical items are disbursed as part of each loan product.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loan Product</TableHead>
                  <TableHead>Linked Inventory Items</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-64" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-9 w-24 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : products && products.length > 0 ? (
                  products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {getLinkedItemsNames(product.linkedInventoryItems)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => handleManageClick(product)}>
                          <Pencil className="mr-2 h-4 w-4" /> Manage Items
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center">No loan products found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

       <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle>Manage Linked Items for: {selectedProduct?.name}</DialogTitle>
                <DialogDescription>
                    Select which inventory items should be associated with this loan product. Only items marked as 'Loanable Item' are shown.
                </DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="max-h-[60vh] overflow-y-auto p-1 pr-4">
                        <FormField
                            control={form.control}
                            name="linkedInventoryItems"
                            render={() => (
                                <FormItem>
                                    <FormMessage />
                                    <div className="space-y-2">
                                        {loanableItems.length > 0 ? loanableItems.map((item) => (
                                            <FormField
                                            key={item.id}
                                            control={form.control}
                                            name="linkedInventoryItems"
                                            render={({ field }) => {
                                                return (
                                                <FormItem key={item.id} className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 hover:bg-accent/50">
                                                    <FormControl>
                                                    <Checkbox
                                                        checked={field.value?.includes(item.id)}
                                                        onCheckedChange={(checked) => {
                                                        return checked
                                                            ? field.onChange([...(field.value || []), item.id])
                                                            : field.onChange(
                                                                field.value?.filter(
                                                                (value) => value !== item.id
                                                                )
                                                            )
                                                        }}
                                                    />
                                                    </FormControl>
                                                    <div className="w-full">
                                                        <FormLabel className="font-normal">{item.name}</FormLabel>
                                                        <p className="text-xs text-muted-foreground">{item.code}</p>
                                                    </div>
                                                </FormItem>
                                                )
                                            }}
                                            />
                                        )) : <p className="text-sm text-muted-foreground text-center py-4">No 'Loanable Items' found in your inventory. Go to Inventory &gt; Items to create some.</p>}
                                    </div>
                                </FormItem>
                            )}
                        />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                        <Button type="submit" disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                            Save Links
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

