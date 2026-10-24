
'use client';
import { useState, useEffect } from 'react';
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
import {
  Building2,
  Users,
  TrendingUp,
  CircleCheck,
  MoreVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, getDocs, where, collectionGroup } from 'firebase/firestore';

const kpiData = [
  {
    title: 'Total Institutions',
    icon: Building2,
    dataKey: 'totalInstitutions',
  },
  {
    title: 'Total Customers',
    icon: Users,
    dataKey: 'totalCustomers',
  },
  {
    title: 'Platform Loan Volume (MWK)',
    icon: TrendingUp,
    dataKey: 'loanVolume',
  },
  {
    title: 'Active Institutions',
    icon: CircleCheck,
    dataKey: 'activeInstitutions',
  },
];


export default function AdminDashboard() {
  const firestore = useFirestore();
  const [kpiValues, setKpiValues] = useState({
    totalInstitutions: 0,
    totalCustomers: 0,
    loanVolume: 0,
    activeInstitutions: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const institutionsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'institutions') : null),
    [firestore]
  );
  const { data: institutions, isLoading: institutionsLoading } = useCollection(institutionsQuery);

  const recentInstitutionsQuery = useMemoFirebase(
    () =>
      firestore
        ? query(
            collection(firestore, 'institutions'),
            orderBy('createdAt', 'desc'),
            limit(5)
          )
        : null,
    [firestore]
  );
  const { data: recentInstitutions, isLoading: recentInstitutionsLoading } = useCollection(recentInstitutionsQuery);


  useEffect(() => {
    async function calculateStats() {
        if (!firestore || !institutions) return;

        setIsLoading(true);

        let totalCustomers = 0;
        let totalLoanVolume = 0;

        for (const inst of institutions) {
            const customersRef = collection(firestore, 'institutions', inst.id, 'customers');
            const runningLoansRef = collection(firestore, 'institutions', inst.id, 'runningLoans');
            const loanAppsRef = collection(firestore, 'institutions', inst.id, 'loanApplications');

            const [customersSnap, runningLoansSnap, loanAppsSnap] = await Promise.all([
                getDocs(customersRef),
                getDocs(query(runningLoansRef, where('status', 'in', ['Disbursed', 'Repaid', 'Overdue']))),
                getDocs(query(loanAppsRef, where('status', 'in', ['Disbursed', 'Repaid', 'Overdue'])))
            ]);

            totalCustomers += customersSnap.size;
            totalLoanVolume += runningLoansSnap.docs.reduce((sum, doc) => sum + doc.data().amount, 0);
            totalLoanVolume += loanAppsSnap.docs.reduce((sum, doc) => sum + doc.data().amount, 0);
        }
        
        setKpiValues({
            totalInstitutions: institutions.length,
            activeInstitutions: institutions.length,
            totalCustomers,
            loanVolume: totalLoanVolume,
        });
        
        setIsLoading(false);
    }
    
    if (!institutionsLoading) {
        calculateStats();
    }
  }, [firestore, institutions, institutionsLoading]);
  
  const pageIsLoading = isLoading || institutionsLoading || recentInstitutionsLoading;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {kpiData.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {kpi.title}
              </CardTitle>
              <kpi.icon className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {pageIsLoading ? (
                <>
                  <Skeleton className="h-8 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-1" />
                </>
              ) : (
                <>
                  <div className="text-3xl font-bold">
                    {kpi.dataKey === 'loanVolume' ? `MWK ${kpiValues[kpi.dataKey as keyof typeof kpiValues].toLocaleString()}` : kpiValues[kpi.dataKey as keyof typeof kpiValues]}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {kpi.dataKey === 'totalInstitutions' && institutions?.length > 0 ? `${institutions.length} institutions registered` : 'No data available'}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recently Added Institutions</CardTitle>
          <CardDescription>
            The latest financial institutions to join the platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Institution Name</TableHead>
                <TableHead>District</TableHead>
                <TableHead>Contact Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentInstitutionsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-5 w-8 ml-auto" /></TableCell>
                    </TableRow>
                ))
              ) : recentInstitutions && recentInstitutions.length > 0 ? (
                recentInstitutions.map(inst => (
                  <TableRow key={inst.id}>
                    <TableCell className="font-medium">{inst.name}</TableCell>
                    <TableCell>{inst.location}</TableCell>
                    <TableCell>{inst.contactEmail}</TableCell>
                    <TableCell>
                      <Badge variant="outline">Active</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No recent institutions found.
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
