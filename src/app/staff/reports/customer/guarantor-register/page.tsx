'use client';

import { useState, useMemo, useEffect } from 'react';
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
import { Search, Download, UserCheck, FileWarning } from 'lucide-react';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, query, where, getDocs, doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { loanStatusBadgeVariant } from '@/lib/utils';

interface GuarantorItem {
  id: string;
  guarantorName: string;
  guarantorIdNumber: string;
  guarantorPhone: string;
  customerName: string;
  loanId: string;
  loanStatus: string;
}

export default function GuarantorRegisterPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [searchTerm, setSearchTerm] = useState('');
  const [guarantors, setGuarantors] = useState<GuarantorItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);
  const institutionId = userData?.institutionId;

  useEffect(() => {
    if (!firestore || !institutionId) {
        setIsLoading(false);
        return;
    };
    
    async function fetchGuarantors() {
        setIsLoading(true);
        const allGuarantors: GuarantorItem[] = [];

        try {
            const loanCollections = ['loanApplications', 'runningLoans'];
            const customerData: { [key: string]: string } = {};

            const customersSnap = await getDocs(collection(firestore, 'institutions', institutionId, 'customers'));
            customersSnap.forEach(doc => {
                customerData[doc.id] = doc.data().name;
            });
            
            for (const coll of loanCollections) {
                const loansRef = collection(firestore, 'institutions', institutionId, coll);
                const loansSnap = await getDocs(loansRef);

                loansSnap.forEach(loanDoc => {
                    const loanData = loanDoc.data();
                    if (loanData.guarantors && Array.isArray(loanData.guarantors) && loanData.guarantors.length > 0) {
                        loanData.guarantors.forEach((guarantor: any, index: number) => {
                            allGuarantors.push({
                                id: `${loanDoc.id}-${index}`,
                                guarantorName: guarantor.name,
                                guarantorIdNumber: guarantor.idNumber,
                                guarantorPhone: guarantor.phone,
                                customerName: customerData[loanData.customerId] || 'Unknown Customer',
                                loanId: loanDoc.id,
                                loanStatus: loanData.status,
                            });
                        });
                    }
                });
            }
            setGuarantors(allGuarantors);
        } catch (error) {
            console.error("Error fetching guarantors:", error);
        } finally {
            setIsLoading(false);
        }
    }

    fetchGuarantors();
  }, [firestore, institutionId]);

  const filteredGuarantors = useMemo(() => {
    if (!searchTerm) return guarantors;
    const lowercasedFilter = searchTerm.toLowerCase();
    return guarantors.filter(item =>
        item.guarantorName.toLowerCase().includes(lowercasedFilter) ||
        item.customerName.toLowerCase().includes(lowercasedFilter) ||
        item.guarantorIdNumber.toLowerCase().includes(lowercasedFilter)
    );
  }, [guarantors, searchTerm]);
  
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Guarantor Register</h1>
          <p className="text-muted-foreground mt-1">
            An inventory of all individuals who have guaranteed loans.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Guarantors</CardTitle>
          <CardDescription>
            Search and view all guarantors and the loans they are associated with.
          </CardDescription>
          <div className="flex items-center justify-between pt-4">
             <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                    placeholder="Search by guarantor, customer, ID..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <Button variant="outline" className="ml-2">
                <Download className="mr-2 h-4 w-4" />
                Export to Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Guarantor Name</TableHead>
                <TableHead>Guarantor ID</TableHead>
                <TableHead>Guarantor Phone</TableHead>
                <TableHead>Customer Guaranteed</TableHead>
                <TableHead>Loan Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                          <TableCell><Skeleton className="h-5 w-32"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-24"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-24"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-32"/></TableCell>
                          <TableCell><Skeleton className="h-6 w-20"/></TableCell>
                      </TableRow>
                  ))
              ) : filteredGuarantors.length > 0 ? (
                filteredGuarantors.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.guarantorName}</TableCell>
                    <TableCell>{item.guarantorIdNumber}</TableCell>
                    <TableCell>{item.guarantorPhone}</TableCell>
                    <TableCell>{item.customerName}</TableCell>
                    <TableCell>
                        <Badge variant={loanStatusBadgeVariant(item.loanStatus)}>
                            {item.loanStatus}
                        </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-48 text-center">
                     <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-muted rounded-full">
                        <UserCheck className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold">
                        No Guarantors Found
                      </h3>
                      <p className="text-muted-foreground">
                        There are no loans with guarantors in the system.
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