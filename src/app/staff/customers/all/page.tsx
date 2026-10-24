
'use client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  MoreVertical,
  Download,
  Eye,
  Pencil,
  Landmark,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import {
  useUser,
  useFirestore,
  useMemoFirebase,
  useDoc,
  useCollection,
} from '@/firebase';
import { collection, doc, query, getDocs } from 'firebase/firestore';
import { useBranch } from '@/context/BranchContext';
import { useMemo, useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AllCustomersPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { selectedBranch, setSelectedBranch, availableBranches, loading: branchLoading } = useBranch();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { data: userData, isLoading: isUserDataLoading } = useDoc(
    useMemoFirebase(() => (user && user.uid ? doc(firestore, 'users', user.uid) : null), [firestore, user])
  );

  const institutionId = userData?.institutionId;
  
  const { data: allCustomers, isLoading: isCustomersLoading, error: customersError } = useCollection(
    useMemoFirebase(() => (firestore && institutionId ? collection(firestore, 'institutions', institutionId, 'customers') : null), [firestore, institutionId])
  );
  
  const filteredCustomers = useMemo(() => {
    if (!allCustomers) return [];
    
    let customersByBranch = [];
    if (selectedBranch === 'all') {
      customersByBranch = allCustomers;
    } else {
      const activeBranch = availableBranches.find(branch => branch.id === selectedBranch);
      const selectedBranchIds = new Set(
        [selectedBranch, activeBranch?.id, activeBranch?.code]
          .filter((branchId): branchId is string => Boolean(branchId))
          .map(branchId => branchId.trim().toLowerCase())
      );
      customersByBranch = allCustomers.filter(customer =>
        selectedBranchIds.has(String(customer.branchId ?? '').trim().toLowerCase())
      );
    }

    if (!searchTerm) {
        return customersByBranch;
    }

    const lowercasedFilter = searchTerm.toLowerCase();
    return customersByBranch.filter(customer => 
        customer.name?.toLowerCase().includes(lowercasedFilter) ||
        customer.accountNumber?.toLowerCase().includes(lowercasedFilter) ||
        customer.phone?.toLowerCase().includes(lowercasedFilter)
    );

  }, [allCustomers, selectedBranch, availableBranches, searchTerm]);

  const isFiltered = searchTerm.length > 0 || selectedBranch !== 'all';
  
  const paginatedCustomers = useMemo(() => {
    if (isFiltered) return filteredCustomers;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredCustomers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredCustomers, currentPage, itemsPerPage, isFiltered]);

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);

  const getKycBadgeVariant = (status: string) => {
    switch (status) {
      case 'Verified':
        return 'default';
      case 'Pending':
        return 'secondary';
      case 'Rejected':
        return 'destructive';
      default:
        return 'outline';
    }
  };
  
  const getBranchName = (branchId: string) => {
      if(!availableBranches || availableBranches.length === 0) return `Branch ${branchId}`;
      const branch = availableBranches.find((b:any) => b.id === branchId || b.code === branchId);
      return branch?.name || `Branch ${branchId}`;
  }
  
  const finalIsLoading = isCustomersLoading || isUserDataLoading || branchLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">All Customers</h1>
          <p className="text-muted-foreground mt-1">
            The master list of every customer registered with your institution.
            {selectedBranch !== 'all' && ` Currently viewing ${availableBranches.find(branch => branch.id === selectedBranch)?.name || `branch ${selectedBranch}`}.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {availableBranches.length > 1 && selectedBranch && (
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-52" aria-label="Filter customers by branch">
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {availableBranches.map(branch => (
                  <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export to Excel
          </Button>
        </div>
      </div>

      {customersError && (
        <Alert variant="destructive">
          <AlertTitle>Could not load customers</AlertTitle>
          <AlertDescription>
            {customersError.message} Check that your account has access to this institution&apos;s customer records, then refresh the page.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Customer Directory</CardTitle>
          <CardDescription>
            A complete directory of all individual and group customers.
          </CardDescription>
           <div className="relative w-full max-w-sm pt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                  placeholder="Search by name, account no, phone..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
              />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>KYC Status</TableHead>
                <TableHead>Phone Number</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {finalIsLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-28" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell className="text-right">
                       <div className="flex justify-end gap-2">
                        <Skeleton className="h-9 w-24" />
                        <Skeleton className="h-9 w-9" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : paginatedCustomers && paginatedCustomers.length > 0 ? (
                paginatedCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                            {customer.photoUrl && <AvatarImage src={customer.photoUrl} alt={customer.name} />}
                            <AvatarFallback>{customer.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{customer.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {customer.accountNumber}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getKycBadgeVariant(customer.kycStatus)}>
                        {customer.kycStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>{customer.phone}</TableCell>
                    <TableCell>{getBranchName(customer.branchId)}</TableCell>
                    <TableCell>{customer.customerType}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button asChild size="sm">
                        <Link href={`/staff/loans/origination?customerId=${customer.id}`}>
                          <Landmark className="mr-2 h-4 w-4" /> Apply for Loan
                        </Link>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/staff/customers/enquiries?id=${customer.id}`}>
                              <Eye className="mr-2 h-4 w-4" /> View Profile
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/staff/customers/edit?id=${customer.id}`}>
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-muted rounded-full">
                        <Users className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold">
                        No Customers Found
                      </h3>
                      <p className="text-muted-foreground">
                        {isFiltered ? "No customers match your search filters." : "Get started by adding your first customer."}
                      </p>
                      {!isFiltered && (
                        <Button asChild>
                          <Link href="/staff/customers/new">Add New Customer</Link>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        {!isFiltered && paginatedCustomers && paginatedCustomers.length > 0 && (
          <CardFooter className="flex items-center justify-between border-t py-4">
            <div className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
