
'use client';

import { useState, useMemo } from 'react';
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
  Search,
  PlusCircle,
  Eye,
  Pencil
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
import { collection, doc, query, where } from 'firebase/firestore';
import { useBranch } from '@/context/BranchContext';

export default function PayrollEmployeesPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { selectedBranch, availableBranches, loading: branchLoading } = useBranch();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: userData, isLoading: isUserDataLoading } = useDoc(
    useMemoFirebase(() => (user && user.uid ? doc(firestore, 'users', user.uid) : null), [firestore, user])
  );

  const institutionId = userData?.institutionId;
  
  const { data: allCustomers, isLoading: isCustomersLoading } = useCollection(
    useMemoFirebase(() => (firestore && institutionId ? query(collection(firestore, 'institutions', institutionId, 'customers'), where('customerType', '==', 'Individual')) : null), [firestore, institutionId])
  );
  
  const filteredCustomers = useMemo(() => {
    if (!allCustomers) return [];
    
    let customersByBranch = [];
    if (selectedBranch === 'all') {
      customersByBranch = allCustomers;
    } else {
      customersByBranch = allCustomers.filter(customer => customer.branchId === selectedBranch);
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

  }, [allCustomers, selectedBranch, searchTerm]);

  
  const getBranchName = (branchId: string) => {
      if(!availableBranches || availableBranches.length === 0) return `Branch ${branchId}`;
      const branch = availableBranches.find((b:any) => b.id === branchId);
      return branch?.name || `Branch ${branchId}`;
  }
  
  const finalIsLoading = isCustomersLoading || isUserDataLoading || branchLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Employee Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage the list of employees for payroll processing.
          </p>
        </div>
         <div className="flex gap-2">
            <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export List
            </Button>
             <Button asChild>
                <Link href="/staff/customers/new">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Employee
                </Link>
            </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employee Directory</CardTitle>
          <CardDescription>
            This list includes all individual customers who can be managed for payroll. To add an employee who is not a customer, first add them as a customer.
          </CardDescription>
           <div className="relative w-full max-w-sm pt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                  placeholder="Search by name, account no, phone..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
              />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee Name</TableHead>
                <TableHead>Account / Employee No.</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Payroll Status</TableHead>
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
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-9 w-9 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredCustomers && filteredCustomers.length > 0 ? (
                filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                            {customer.photoUrl && <AvatarImage src={customer.photoUrl} alt={customer.name} />}
                            <AvatarFallback>{customer.name?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{customer.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {customer.phone}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{customer.accountNumber}</TableCell>
                    <TableCell>{getBranchName(customer.branchId)}</TableCell>
                    <TableCell>
                      <Badge variant={customer.isEmployee ? 'default' : 'outline'}>
                        {customer.isEmployee ? 'On Payroll' : 'Eligible'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
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
                              <Pencil className="mr-2 h-4 w-4" /> Edit Details
                            </Link>
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
                        <Users className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold">
                        No Employees Found
                      </h3>
                      <p className="text-muted-foreground">
                        Get started by adding your first customer/employee.
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
  );
}
