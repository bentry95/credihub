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
import { Search, Download, ShieldCheck, FileWarning, Image as ImageIcon } from 'lucide-react';
import { format } from 'date-fns';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, query, where, getDocs, doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

interface CollateralItem {
  id: string;
  customerName: string;
  customerId: string;
  loanId: string;
  type: string;
  description: string;
  estimatedValue: number;
  photo?: string;
  loanStatus: string;
}

export default function CollateralRegisterPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [searchTerm, setSearchTerm] = useState('');
  const [collateral, setCollateral] = useState<CollateralItem[]>([]);
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
    
    async function fetchCollateral() {
        setIsLoading(true);
        const allCollateral: CollateralItem[] = [];

        try {
            const loanCollections = ['loanApplications', 'runningLoans'];
            const customerData: { [key: string]: string } = {};

            const customersSnap = await getDocs(collection(firestore, 'institutions', institutionId, 'customers'));
            customersSnap.forEach(doc => {
                customerData[doc.id] = doc.data().name;
            });
            
            for (const coll of loanCollections) {
                const loansRef = collection(firestore, 'institutions', institutionId, coll);
                const q = query(loansRef, where('collateral', '!=', null));
                const loansSnap = await getDocs(q);

                loansSnap.forEach(loanDoc => {
                    const loanData = loanDoc.data();
                    if (loanData.collateral && Array.isArray(loanData.collateral)) {
                        loanData.collateral.forEach((item: any, index: number) => {
                            allCollateral.push({
                                id: `${loanDoc.id}-${index}`,
                                customerId: loanData.customerId,
                                customerName: customerData[loanData.customerId] || 'Unknown Customer',
                                loanId: loanDoc.id,
                                type: item.type,
                                description: item.description,
                                estimatedValue: item.estimatedValue,
                                photo: item.photo,
                                loanStatus: loanData.status,
                            });
                        });
                    }
                });
            }
            setCollateral(allCollateral);
        } catch (error) {
            console.error("Error fetching collateral:", error);
        } finally {
            setIsLoading(false);
        }
    }

    fetchCollateral();
  }, [firestore, institutionId]);

  const filteredCollateral = useMemo(() => {
    if (!searchTerm) return collateral;
    const lowercasedFilter = searchTerm.toLowerCase();
    return collateral.filter(item =>
        item.customerName.toLowerCase().includes(lowercasedFilter) ||
        item.type.toLowerCase().includes(lowercasedFilter) ||
        item.description.toLowerCase().includes(lowercasedFilter)
    );
  }, [collateral, searchTerm]);
  
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Disbursed':
      case 'Overdue':
        return 'default';
      case 'Repaid':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Collateral Register</h1>
          <p className="text-muted-foreground mt-1">
            An inventory of all assets pledged as security for loans.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Pledged Assets</CardTitle>
          <CardDescription>
            Search and view all collateral held by the institution.
          </CardDescription>
          <div className="flex items-center justify-between pt-4">
             <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                    placeholder="Search by customer, type, description..."
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
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Estimated Value (MWK)</TableHead>
                <TableHead>Loan Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                          <TableCell><Skeleton className="h-5 w-32"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-24"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-48"/></TableCell>
                          <TableCell><Skeleton className="h-5 w-28"/></TableCell>
                          <TableCell><Skeleton className="h-6 w-20"/></TableCell>
                          <TableCell><Skeleton className="h-9 w-24"/></TableCell>
                      </TableRow>
                  ))
              ) : filteredCollateral.length > 0 ? (
                filteredCollateral.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.customerName}</TableCell>
                    <TableCell>{item.type}</TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="font-mono">
                      {item.estimatedValue.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(item.loanStatus)}>
                        {item.loanStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                        {item.photo ? (
                            <Button asChild variant="outline" size="sm">
                                <Link href={item.photo} target="_blank" rel="noopener noreferrer">
                                    <ImageIcon className="mr-2 h-4 w-4"/> View Photo
                                </Link>
                            </Button>
                        ) : (
                            <span className="text-xs text-muted-foreground">No photo</span>
                        )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center">
                     <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-muted rounded-full">
                        <FileWarning className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold">
                        No Collateral Pledged
                      </h3>
                      <p className="text-muted-foreground">
                        There are no loans with collateral attached in the system.
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