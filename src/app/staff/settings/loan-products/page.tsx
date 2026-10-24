
'use client';

import { useState, useMemo } from 'react';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, doc, deleteDoc, query, where, getDocs, limit } from 'firebase/firestore';
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
  Landmark,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
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

export default function LoanProductsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);

  const productsQuery = useMemoFirebase(
    () =>
      firestore && userData?.institutionId
        ? collection(firestore, 'institutions', userData.institutionId, 'loanProducts')
        : null,
    [firestore, userData]
  );
  const { data: products, isLoading: isProductsLoading } = useCollection(productsQuery);
  
  const paginatedProducts = useMemo(() => {
    if (!products) return [];
    const startIndex = (currentPage - 1) * itemsPerPage;
    return products.slice(startIndex, startIndex + itemsPerPage);
  }, [products, currentPage, itemsPerPage]);

  const totalPages = products ? Math.ceil(products.length / itemsPerPage) : 0;

  const handleDeleteClick = async (product: any) => {
    if (!firestore || !userData?.institutionId) return;
    setLoading(product.id);
    try {
        const loanAppsRef = collection(firestore, 'institutions', userData.institutionId, 'loanApplications');
        const runningLoansRef = collection(firestore, 'institutions', userData.institutionId, 'runningLoans');

        const loanAppsQuery = query(loanAppsRef, where('loanProductId', '==', product.id), limit(1));
        const runningLoansQuery = query(runningLoansRef, where('loanProductId', '==', product.id), limit(1));

        const [loanAppsSnap, runningLoansSnap] = await Promise.all([
            getDocs(loanAppsQuery),
            getDocs(runningLoansQuery),
        ]);

        if (!loanAppsSnap.empty || !runningLoansSnap.empty) {
            toast({
                variant: 'destructive',
                title: 'Deletion Blocked',
                description: `This product cannot be deleted because it is currently linked to one or more loans.`,
            });
            setLoading(null);
            return;
        }

        setSelectedProduct(product);
        setIsDeleteDialogOpen(true);
    } catch(e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to check product usage.'});
    } finally {
        setLoading(null);
    }
  }

  const confirmDelete = async () => {
    if (!selectedProduct || !firestore || !userData?.institutionId) return;

    setLoading(selectedProduct.id);
    try {
        const productDocRef = doc(firestore, 'institutions', userData.institutionId, 'loanProducts', selectedProduct.id);
        await deleteDoc(productDocRef);
        toast({
            title: 'Product Deleted',
            description: `The loan product "${selectedProduct.name}" has been deleted.`,
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
            <h1 className="text-3xl font-bold tracking-tight">Loan Products</h1>
            <p className="text-muted-foreground mt-1">
              Create, view, and manage your institution's loan products.
            </p>
          </div>
          <Button asChild>
            <Link href="/staff/settings/loan-products/new">
              <PlusCircle className="mr-2 h-4 w-4" /> Create New Loan Product
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Existing Loan Products</CardTitle>
            <CardDescription>
              A list of all loan products configured for your institution.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Loan Type</TableHead>
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
                ) : paginatedProducts && paginatedProducts.length > 0 ? (
                  paginatedProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.loanType}</TableCell>
                      <TableCell>{product.annualInterestRate}%</TableCell>
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
                                      <Link href={`/staff/settings/loan-products/edit/${product.id}`}><Pencil className="mr-2 h-4 w-4" /> Edit</Link>
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
                              <Landmark className="h-10 w-10 text-muted-foreground" />
                          </div>
                          <h3 className="text-lg font-semibold">No Loan Products Found</h3>
                          <p className="text-muted-foreground">Get started by creating your first loan product.</p>
                          <Button asChild>
                            <Link href="/staff/settings/loan-products/new">
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
          {paginatedProducts && paginatedProducts.length > 0 && (
            <CardFooter className="flex items-center justify-between border-t py-4">
                <div className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 mr-1"/> Prev</Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next <ChevronRight className="h-4 ml-1"/></Button>
                </div>
            </CardFooter>
          )}
        </Card>
      </div>
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the loan product "{selectedProduct?.name}".
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
