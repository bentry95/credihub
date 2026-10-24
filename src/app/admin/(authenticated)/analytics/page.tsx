
'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Building2,
  Users,
  TrendingUp,
  FileCheck2,
  FileX2,
  PieChart,
  Activity,
  LineChart,
  Landmark,
} from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, collectionGroup, getDocs, query, where } from 'firebase/firestore';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Bar, XAxis, YAxis, CartesianGrid, BarChart, Pie as RechartsPie, Cell } from 'recharts';

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8424D3", "#D42483"];

const formatCurrency = (value: number) => {
    if (value >= 1_000_000_000) {
        return `MWK ${(value / 1_000_000_000).toFixed(1)}B`;
    }
    if (value >= 1_000_000) {
        return `MWK ${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1_000) {
        return `MWK ${(value / 1_000)}k`;
    }
    return `MWK ${value}`;
};

export default function AnalyticsPage() {
  const firestore = useFirestore();
  const [selectedInstitutionId, setSelectedInstitutionId] = useState<string>('all');
  const [stats, setStats] = useState<any>({
      totalInstitutions: 0,
      totalUsers: 0,
      totalLoans: 0,
      totalLoanVolume: 0,
      approvedLoans: 0,
      rejectedLoans: 0,
  });
  const [institutionTypes, setInstitutionTypes] = useState<any[]>([]);
  const [loanStatusData, setLoanStatusData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const institutionsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'institutions') : null),
    [firestore]
  );
  const { data: institutions, isLoading: institutionsLoading } = useCollection(institutionsQuery);

  const usersQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'users'), ...(selectedInstitutionId !== 'all' ? [where('institutionId', '==', selectedInstitutionId)] : [])) : null),
    [firestore, selectedInstitutionId]
  );
  const { data: users, isLoading: usersLoading } = useCollection(usersQuery);

  useEffect(() => {
    async function fetchLoanData() {
        if (!firestore) return;
        setIsLoading(true);

        let loanAppsQuery, runningLoansQuery;
        if (selectedInstitutionId === 'all') {
            loanAppsQuery = query(collectionGroup(firestore, 'loanApplications'));
            runningLoansQuery = query(collectionGroup(firestore, 'runningLoans'));
        } else {
            loanAppsQuery = query(collection(firestore, `institutions/${selectedInstitutionId}/loanApplications`));
            runningLoansQuery = query(collection(firestore, `institutions/${selectedInstitutionId}/runningLoans`));
        }

        const [loanAppsSnap, runningLoansSnap] = await Promise.all([
            getDocs(loanAppsQuery),
            getDocs(runningLoansQuery),
        ]);

        const allLoans = [
            ...loanAppsSnap.docs.map(doc => doc.data()),
            ...runningLoansSnap.docs.map(doc => doc.data())
        ];

        const totalLoans = allLoans.length;
        const totalLoanVolume = allLoans.reduce((sum, loan) => sum + (loan.amount || 0), 0);
        const approvedLoans = allLoans.filter(l => ['Approved', 'Disbursed', 'Repaid', 'Overdue'].includes(l.status)).length;
        const rejectedLoans = allLoans.filter(l => l.status === 'Rejected').length;

        const statusCounts: Record<string, number> = allLoans.reduce((acc, loan) => {
            acc[loan.status] = (acc[loan.status] || 0) + 1;
            return acc;
        }, {});

        setLoanStatusData(Object.entries(statusCounts).map(([name, value]) => ({ name, value })));

        setStats(prev => ({
            ...prev,
            totalLoans,
            totalLoanVolume,
            approvedLoans,
            rejectedLoans,
        }));
        
        setIsLoading(false);
    }
    fetchLoanData();
  }, [firestore, selectedInstitutionId]);

  useEffect(() => {
    if (institutions) {
      setStats(prev => ({ ...prev, totalInstitutions: institutions.length }));
      const types = institutions.reduce((acc, inst) => {
          acc[inst.type] = (acc[inst.type] || 0) + 1;
          return acc;
      }, {} as Record<string, number>);
      setInstitutionTypes(Object.entries(types).map(([name, value]) => ({ name, value })));
    }
  }, [institutions]);

  useEffect(() => {
    if (users) {
      setStats(prev => ({ ...prev, totalUsers: users.length }));
    }
  }, [users]);
  
  const pageLoading = isLoading || institutionsLoading || usersLoading;

  const kpiData = [
    { title: 'Total Institutions', value: stats.totalInstitutions, icon: Landmark, global: true },
    { title: 'Total Users', value: stats.totalUsers, icon: Users },
    { title: 'Total Loans', value: stats.totalLoans, icon: Activity },
    { title: 'Total Loan Volume', value: formatCurrency(stats.totalLoanVolume), icon: TrendingUp },
    { title: 'Approved Loans', value: stats.approvedLoans, icon: FileCheck2 },
    { title: 'Rejected Loans', value: stats.rejectedLoans, icon: FileX2 },
  ];

  const filteredKpiData = kpiData.filter(kpi => selectedInstitutionId === 'all' || !kpi.global);

  return (
    <div className="space-y-6">
        <div className="flex justify-end">
            <Select value={selectedInstitutionId} onValueChange={setSelectedInstitutionId}>
                <SelectTrigger className="w-[280px]">
                    <SelectValue placeholder="Select an institution..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Institutions</SelectItem>
                    {institutions?.map(inst => (
                        <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredKpiData.map(kpi => (
                <Card key={kpi.title}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
                        <kpi.icon className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        {pageLoading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-3xl font-bold">{kpi.value}</div>}
                    </CardContent>
                </Card>
            ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Institutions by Type</CardTitle>
                </CardHeader>
                <CardContent>
                     {pageLoading ? <Skeleton className="h-[250px] w-full" /> : (
                        <ChartContainer config={{}} className="min-h-[250px] w-full">
                            <RechartsPie data={institutionTypes} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                {institutionTypes.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </RechartsPie>
                            <ChartTooltip content={<ChartTooltipContent />} />
                        </ChartContainer>
                     )}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Loans by Status</CardTitle>
                </CardHeader>
                <CardContent>
                     {pageLoading ? <Skeleton className="h-[250px] w-full" /> : (
                        <ChartContainer config={{}} className="min-h-[250px] w-full">
                            <BarChart data={loanStatusData}>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="name" tickLine={false} tickMargin={10} axisLine={false} angle={-45} textAnchor="end" height={60} />
                                <YAxis />
                                <ChartTooltip content={<ChartTooltipContent />} />
                                <Bar dataKey="value" fill="hsl(var(--primary))" radius={4} />
                            </BarChart>
                        </ChartContainer>
                     )}
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
