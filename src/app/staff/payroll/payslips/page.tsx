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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Download, Search, Receipt, FileWarning } from 'lucide-react';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, query, where, collectionGroup, doc, limit } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';

export default function PayslipsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('all');

  const { user } = useUser();
  const firestore = useFirestore();
  const { data: userData, isLoading: isUserLoading } = useDoc(useMemoFirebase(() => (user ? doc(firestore, 'users', user.uid) : null), [user, firestore]));
  const institutionId = userData?.institutionId;
  
  // 1. Identify the Customer record for the logged-in user by email
  const customersByEmailQuery = useMemoFirebase(() => (
    firestore && institutionId && user?.email 
      ? query(collection(firestore, 'institutions', institutionId, 'customers'), where('email', '==', user.email), limit(1))
      : null
  ), [firestore, institutionId, user?.email]);
  const { data: customerDocs, isLoading: isCustomerSearching } = useCollection(customersByEmailQuery);
  const myCustomerId = customerDocs?.[0]?.id;

  // 2. Query payslips (collection group) filtered by institutionId AND customerId
  // This ensures everyone only sees their own payslips as per instruction.
  const payslipsQuery = useMemoFirebase(() => {
    if (!firestore || !institutionId || !myCustomerId) return null;
    
    return query(
        collectionGroup(firestore, 'payslips'), 
        where('institutionId', '==', institutionId),
        where('customerId', '==', myCustomerId)
    );
  }, [firestore, institutionId, myCustomerId]);

  const { data: allPayslips, isLoading: isPayslipsLoading } = useCollection(payslipsQuery);

  const { data: allCustomers, isLoading: isCustomersLoading } = useCollection(useMemoFirebase(() => (
    firestore && institutionId ? collection(firestore, 'institutions', institutionId, 'customers') : null
  ), [firestore, institutionId]));
  
  const { data: allPayrolls, isLoading: isPayrollsLoading } = useCollection(useMemoFirebase(() => (
    firestore && institutionId ? collection(firestore, 'institutions', institutionId, 'payrolls') : null
  ), [firestore, institutionId]));

  const combinedData = useMemo(() => {
    if (!allPayslips || !allCustomers || !allPayrolls) return [];
    
    const customerMap = new Map(allCustomers.map(c => [c.id, c.name]));
    const payrollMap = new Map(allPayrolls.map(p => [p.id, p.period]));

    return allPayslips.map(payslip => ({
      ...payslip,
      employeeName: customerMap.get(payslip.customerId) || 'Unknown Employee',
      period: payrollMap.get(payslip.payrollId) || 'Unknown Period',
      totalDeductions: (payslip.deductions || []).reduce((sum: number, d: any) => sum + d.amount, 0),
    }));
  }, [allPayslips, allCustomers, allPayrolls]);
  
  const filteredPayslips = useMemo(() => {
    return combinedData.filter(p => {
        const periodMatch = selectedPeriod === 'all' || p.period === selectedPeriod;
        const searchMatch = searchTerm === '' || p.employeeName.toLowerCase().includes(searchTerm.toLowerCase());
        return periodMatch && searchMatch;
    });
  }, [combinedData, selectedPeriod, searchTerm]);
  
  const payrollPeriods = useMemo(() => {
      if (!allPayrolls) return [];
      return [...new Set(allPayrolls.map(p => p.period))].sort((a,b) => b.localeCompare(a));
  }, [allPayrolls]);

  const isLoading = isPayslipsLoading || isCustomersLoading || isPayrollsLoading || isUserLoading || isCustomerSearching;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Payslips</h1>
          <p className="text-muted-foreground mt-1">
            View and download your historical payslips.
          </p>
        </div>
        <Button variant="outline" disabled={filteredPayslips.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Export All My Payslips
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payslip History</CardTitle>
          <CardDescription>
            A record of all your earnings and deductions.
          </CardDescription>
          <div className="flex flex-wrap items-center gap-4 pt-4">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by period..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Periods</SelectItem>
                {payrollPeriods.map(period => (
                    <SelectItem key={period} value={period}>{period}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Gross Pay</TableHead>
                <TableHead>Total Deductions</TableHead>
                <TableHead>Net Pay</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                 Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-9 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredPayslips.length > 0 ? (
                filteredPayslips.map((payslip) => (
                  <TableRow key={payslip.id}>
                    <TableCell className="font-medium">{payslip.period}</TableCell>
                    <TableCell>{payslip.employeeName}</TableCell>
                    <TableCell>MWK {payslip.grossPay.toLocaleString()}</TableCell>
                    <TableCell>MWK {payslip.totalDeductions.toLocaleString()}</TableCell>
                    <TableCell className="font-bold">MWK {payslip.netPay.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm">View Payslip</Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-muted rounded-full">
                        <Receipt className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold">No Payslips Found</h3>
                      <p className="text-muted-foreground">
                        {myCustomerId ? "You have no payslips recorded for the selected period." : "We couldn't find a customer record associated with your account. Please contact HR."}
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
