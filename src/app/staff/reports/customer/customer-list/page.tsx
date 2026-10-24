
'use client';

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
import { Download, Users } from 'lucide-react';
import { format } from 'date-fns';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, query } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';

export default function CustomerListReportPage() {
    const { user } = useUser();
    const firestore = useFirestore();

    const userDocRef = useMemoFirebase(
      () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
      [firestore, user]
    );
    const { data: userData, isLoading: isUserLoading } = useDoc(userDocRef);
    const institutionId = userData?.institutionId;

    const customersQuery = useMemoFirebase(
        () => (firestore && institutionId ? query(collection(firestore, 'institutions', institutionId, 'customers')) : null),
        [firestore, institutionId]
    );
    const { data: customers, isLoading: isCustomersLoading } = useCollection(customersQuery);
    
    const institutionDocRef = useMemoFirebase(
        () => (firestore && institutionId ? doc(firestore, 'institutions', institutionId) : null),
        [firestore, institutionId]
    );
    const { data: institutionData, isLoading: isInstitutionLoading } = useDoc(institutionDocRef);

    const getBranchName = (branchId: string) => {
        if (!institutionData) return `Branch ${branchId}`;
        if (branchId === '01') return institutionData.hqBranch?.name || 'Headquarters';
        const branch = institutionData.branches?.find((b: any) => b.code === branchId);
        return branch?.name || `Branch ${branchId}`;
    }

    const getKycBadgeVariant = (status: string) => {
        switch (status) {
            case 'Verified': return 'default';
            case 'Pending': return 'secondary';
            case 'Expired':
            case 'Rejected': 
                return 'destructive';
            default: return 'outline';
        }
    }
    
    const isLoading = isUserLoading || isCustomersLoading || isInstitutionLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Customer List Report</h1>
          <p className="text-muted-foreground mt-1">
            A full KYC summary of all customers in the institution.
          </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export to Excel
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All Customers</CardTitle>
          <CardDescription>
            A complete directory of all customers with their KYC status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer Name</TableHead>
                <TableHead>Account Number</TableHead>
                <TableHead>Join Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>KYC Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({length: 5}).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    </TableRow>
                ))
              ) : customers && customers.length > 0 ? (
                customers.map((customer) => (
                  <TableRow key={customer.accountNumber}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>{customer.accountNumber}</TableCell>
                    <TableCell>{customer.createdAt ? format(customer.createdAt.toDate(), 'PPP') : 'N/A'}</TableCell>
                    <TableCell>{customer.status || 'Active'}</TableCell>
                    <TableCell>{getBranchName(customer.branchId)}</TableCell>
                    <TableCell><Badge variant={getKycBadgeVariant(customer.kycStatus)}>{customer.kycStatus}</Badge></TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-muted rounded-full">
                        <Users className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold">No Customers Found</h3>
                      <p className="text-muted-foreground">There is no customer data to display.</p>
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
