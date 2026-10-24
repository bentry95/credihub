
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
import {
  collection,
  doc,
  runTransaction,
} from 'firebase/firestore';
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PlusCircle, Loader2, AlertCircle, Package, ArrowRightLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const adjustmentSchema = z.object({
  inventoryItemId: z.string().min(1, 'Please select an item.'),
  adjustmentType: z.enum(['Addition', 'Subtraction']),
  quantity: z.coerce.number().positive('Quantity must be a positive number.'),
  reason: z.string().min(1, 'A reason for the adjustment is required.'),
});

export default function StockManagementPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);
  const institutionId = userData?.institutionId;

  const itemsQuery = useMemoFirebase(() => (institutionId ? collection(firestore, 'institutions', institutionId, 'inventoryItems') : null), [firestore, institutionId]);
  const { data: items, isLoading: isItemsLoading } = useCollection(itemsQuery);

  const categoriesQuery = useMemoFirebase(() => (institutionId ? collection(firestore, 'institutions', institutionId, 'inventoryCategories') : null), [firestore, institutionId]);
  const { data: categories, isLoading: isCategoriesLoading } = useCollection(categoriesQuery);

  const form = useForm<z.infer<typeof adjustmentSchema>>({
    resolver: zodResolver(adjustmentSchema),
  });

  const handleAdjustClick = (item: any) => {
    setSelectedItem(item);
    form.reset({ inventoryItemId: item?.id || '', adjustmentType: undefined, quantity: 0, reason: '' });
    setIsAdjustmentOpen(true);
  };

  async function onSubmit(values: z.infer<typeof adjustmentSchema>) {
    if (!institutionId) return;
    const itemId = selectedItem?.id || values.inventoryItemId;
    if (!itemId) return;
    
    setLoading(true);
    setError(null);
    try {
      const itemRef = doc(firestore, 'institutions', institutionId, 'inventoryItems', itemId);
      await runTransaction(firestore, async (transaction) => {
        const itemDoc = await transaction.get(itemRef);
        if (!itemDoc.exists()) {
          throw new Error("Item not found!");
        }
        const currentQuantity = itemDoc.data().quantity || 0;
        const adjustmentQuantity = values.quantity;
        let newQuantity;
        if (values.adjustmentType === 'Addition') {
          newQuantity = currentQuantity + adjustmentQuantity;
        } else {
          newQuantity = currentQuantity - adjustmentQuantity;
        }
        
        if (newQuantity < 0) {
          throw new Error("Adjustment would result in negative stock.");
        }
        
        transaction.update(itemRef, { quantity: newQuantity });
      });
      toast({ title: "Stock Adjusted", description: `Stock for the selected item has been updated.` });
      setIsAdjustmentOpen(false);
    } catch (e: any) {
      setError(e.message || 'Failed to adjust stock. Please try again.');
    } finally {
      setLoading(false);
    }
  }
  
  const getCategoryName = (id: string) => categories?.find(c => c.id === id)?.name || id;

  const isLoading = isItemsLoading || isCategoriesLoading;

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Stock Management</h1>
            <p className="text-muted-foreground mt-1">
              View current stock levels and make adjustments for damages, losses, or new stock.
            </p>
          </div>
          <Button onClick={handleAdjustClick}>
            <PlusCircle className="mr-2 h-4 w-4" /> New Adjustment
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Current Stock Levels</CardTitle>
            <CardDescription>
              A real-time overview of all items in your inventory.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Current Quantity</TableHead>
                  <TableHead>Reorder Level</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : items && items.length > 0 ? (
                  items.map((item) => (
                    <TableRow key={item.id} className={cn(item.quantity <= item.reorderLevel && 'bg-destructive/10')}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{getCategoryName(item.categoryId)}</TableCell>
                      <TableCell>
                        <Badge variant={item.quantity <= item.reorderLevel ? 'destructive' : 'outline'}>{item.quantity}</Badge>
                      </TableCell>
                      <TableCell>{item.reorderLevel}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => handleAdjustClick(item)}>
                          <ArrowRightLeft className="mr-2 h-4 w-4"/> Adjust Stock
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-48 text-center">
                       <div className="flex flex-col items-center gap-4">
                        <div className="p-4 bg-muted rounded-full"><Package className="h-10 w-10 text-muted-foreground" /></div>
                        <h3 className="text-lg font-semibold">No Inventory Items Found</h3>
                        <p className="text-muted-foreground">Go to 'Items' to add your first inventory item.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isAdjustmentOpen} onOpenChange={setIsAdjustmentOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Stock Adjustment</DialogTitle>
            <DialogDescription>
              Adjust the stock level for an inventory item. This will be recorded for auditing.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
              <FormField
                control={form.control}
                name="inventoryItemId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Inventory Item</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!!selectedItem}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select an item..." /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {items?.map(item => <SelectItem key={item.id} value={item.id}>{item.name} (Current: {item.quantity})</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="adjustmentType"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Adjustment Type</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex gap-4"
                      >
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl><RadioGroupItem value="Addition" /></FormControl>
                          <FormLabel className="font-normal">Addition (Stock In)</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                          <FormControl><RadioGroupItem value="Subtraction" /></FormControl>
                          <FormLabel className="font-normal">Subtraction (Stock Out)</FormLabel>
                        </FormItem>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="quantity" render={({ field }) => (<FormItem><FormLabel>Quantity</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="reason" render={({ field }) => (<FormItem><FormLabel>Reason</FormLabel><FormControl><Textarea placeholder="e.g., Physical stock count correction, damaged goods, initial stock take..." {...field} /></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                  Adjust Stock
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
