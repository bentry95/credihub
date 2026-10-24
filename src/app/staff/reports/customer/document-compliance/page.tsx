
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
import { Download, FileWarning, CheckCircle2 } from 'lucide-react';
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

interface ComplianceIssue {
  loanId: string;
  customerName: string;
  productName: string;
  missingDocuments: string[];
}

export default function DocumentComplianceReportPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const [complianceIssues, setComplianceIssues] = useState<ComplianceIssue[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { data: userData } = useDoc(
    useMemoFirebase(() => (firestore && user ? doc(firestore, 'users', user.uid) : null), [firestore, user])
  );
  const institutionId = userData?.institutionId;

  useEffect(() => {
    if (!firestore || !institutionId) {
      setIsLoading(false);
      return;
    }

    const fetchComplianceData = async () => {
      setIsLoading(true);
      try {
        const loanCollections = ['loanApplications', 'runningLoans'];
        const productsRef = collection(firestore, 'institutions', institutionId, 'loanProducts');
        const customersRef = collection(firestore, 'institutions', institutionId, 'customers');

        const [productsSnap, customersSnap] = await Promise.all([
            getDocs(productsRef),
            getDocs(customersRef),
        ]);

        const products = productsSnap.docs.map(d => ({id: d.id, ...d.data()}));
        const customers = customersSnap.docs.map(d => ({id:d.id, ...d.data()}));
        const customerMap = new Map(customers.map(c => [c.id, c.name]));

        const issues: ComplianceIssue[] = [];

        for (const coll of loanCollections) {
          const loansRef = collection(firestore, 'institutions', institutionId, coll);
          const q = query(loansRef, where('status', 'in', ['Disbursed', 'Overdue']));
          const loansSnap = await getDocs(q);

          loansSnap.forEach(loanDoc => {
            const loanData = loanDoc.data();
            const product = products.find(p => p.id === loanData.loanProductId);
            
            // Assume for now that 'requiredDocuments' is a property on the loan product
            const requiredDocs = product?.requiredDocuments || []; 
            const uploadedDocs = loanData.documents?.map((d: any) => d.type) || [];
            
            const missingDocuments = requiredDocs.filter((docType: string) => !uploadedDocs.includes(docType));

            if (missingDocuments.length > 0) {
              issues.push({
                loanId: loanDoc.id,
                customerName: customerMap.get(loanData.customerId) || 'Unknown Customer',
                productName: product?.name || 'Unknown Product',
                missingDocuments,
              });
            }
          });
        }
        
        setComplianceIssues(issues);

      } catch (error) {
        console.error("Error fetching compliance data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchComplianceData();
  }, [firestore, institutionId]);
  
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Document Compliance Report</h1>
          <p className="text-muted-foreground mt-1">
            Identifies active loans that are missing required supporting documents.
          </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export to Excel
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Non-Compliant Loans</CardTitle>
          <CardDescription>
            The following loans are missing one or more required documents as per their product configuration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Loan Product</TableHead>
                <TableHead>Missing Documents</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-9 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : complianceIssues.length > 0 ? (
                complianceIssues.map((issue) => (
                  <TableRow key={issue.loanId}>
                    <TableCell className="font-medium">{issue.customerName}</TableCell>
                    <TableCell>{issue.productName}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {issue.missingDocuments.map((doc, i) => (
                          <Badge key={i} variant="destructive">{doc}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/staff/loans/loan-details/${issue.loanId}`}>
                          View Loan
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-muted rounded-full">
                        <CheckCircle2 className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold">
                        All Loans are Compliant
                      </h3>
                      <p className="text-muted-foreground">
                        No loans with missing required documents were found.
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
