
'use client';

import { useState, useMemo } from 'react';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, doc, deleteDoc, query, where, getDocs, limit, collectionGroup } from 'firebase/firestore';
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
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  PlusCircle,
  Wallet,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

export default function SavingsProductsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);

  const productsQuery = useMemoFirebase(
    () =>
      firestore && userData?.institutionId
        ? collection(firestore, 'institutions', userData.institutionId, 'savingsProducts')
        : null,
    [firestore, userData]
  );
  const { data: products, isLoading: isProductsLoading } = useCollection(productsQuery);
  
  const handleDeleteClick = async (product: any) => {
    if (!firestore || !userData?.institutionId) return;
    setLoading(product.id);
    try {
        const savingsAccountsQuery = query(
            collectionGroup(firestore, 'savingsAccounts'),
            where('institutionId', '==', userData.institutionId),
            where('productId', '==', product.id),
            limit(1)
        );

        const savingsAccountsSnap = await getDocs(savingsAccountsQuery);

        if (!savingsAccountsSnap.empty) {
            toast({
                variant: 'destructive',
                title: 'Deletion Blocked',
                description: `This product cannot be deleted as it is linked to active savings accounts.`,
            });
            setLoading(null);
            return;
        }

        setSelectedProduct(product);
        setIsDeleteDialogOpen(true);
    } catch (e) {
        console.error("Error checking product usage:", e);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to check product usage.'});
    } finally {
        setLoading(null);
    }
  }

  const confirmDelete = async () => {
    if (!selectedProduct || !firestore || !userData?.institutionId) return;

    setLoading(selectedProduct.id);
    try {
        const productDocRef = doc(firestore, 'institutions', userData.institutionId, 'savingsProducts', selectedProduct.id);
        await deleteDoc(productDocRef);
        toast({
            title: 'Product Deleted',
            description: `The savings product "${selectedProduct.name}" has been deleted.`,
        });
    } catch(e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete product.'});
    } finally {
        setLoading(null);
        setIsDeleteDialogOpen(false);
        setSelectedProduct(null);
    }
  }

  const getBadgeVariant = (status: string) => (status === 'Active' ? 'default' : 'secondary');

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Savings Products</h1>
            <p className="text-muted-foreground mt-1">
              Create, view, and manage your institution's savings products.
            </p>
          </div>
          <Button asChild>
            <Link href="/staff/settings/savings-products/new">
              <PlusCircle className="mr-2 h-4 w-4" /> Create New Savings Product
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Existing Savings Products</CardTitle>
            <CardDescription>
              A list of all savings products configured for your institution.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Scheme Type</TableHead>
                  <TableHead>Interest Rate (p.a.)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isProductsLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : products && products.length > 0 ? (
                  products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.schemeType}</TableCell>
                      <TableCell>{product.interestRate}%</TableCell>
                      <TableCell>
                        <Badge variant={getBadgeVariant(product.status)}>{product.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" disabled={loading === product.id}>
                                  {loading === product.id ? <Loader2 className="h-5 w-5 animate-spin"/> : <MoreVertical className="h-5 w-5" />}
                              </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                  <DropdownMenuItem asChild>
                                      <Link href={`#`}><Pencil className="mr-2 h-4 w-4" /> Edit</Link>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDeleteClick(product)} className="text-destructive">
                                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                                  </DropdownMenuItem>
                              </DropdownMenuContent>
                          </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-48 text-center">
                      <div className="flex flex-col items-center gap-4">
                          <div className="p-4 bg-muted rounded-full">
                              <Wallet className="h-10 w-10 text-muted-foreground" />
                          </div>
                          <h3 className="text-lg font-semibold">No Savings Products Found</h3>
                          <p className="text-muted-foreground">Get started by creating your first savings product.</p>
                          <Button asChild>
                            <Link href="/staff/settings/savings-products/new">
                                  <PlusCircle className="mr-2 h-4 w-4" /> Create Product
                            </Link>
                          </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the savings product "{selectedProduct?.name}".
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
                    Yes, delete product
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
