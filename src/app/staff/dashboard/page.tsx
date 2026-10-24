
'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    ArrowRight,
    FilePlus2,
    Users,
    Search,
    Landmark,
    Gavel,
    ClipboardCheck,
    ListChecks,
    ChevronsUpDown,
    HandCoins,
    AlertTriangle,
} from 'lucide-react';
import {
  useUser,
  useFirestore,
  useDoc,
  useMemoFirebase,
  useCollection,
} from '@/firebase';
import { collection, doc, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { format, isPast } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { useBranch } from '@/context/BranchContext';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';


function BranchSwitcher() {
  const { selectedBranch, setSelectedBranch, availableBranches, loading } = useBranch();
  
  const currentBranchName = useMemo(() => {
      if (loading) return 'Loading...';
      if (!selectedBranch) return 'Select Branch';
      const branch = availableBranches.find(b => b.id === selectedBranch);
      return branch?.name || 'Select Branch';
  }, [selectedBranch, availableBranches, loading]);
  
  if (availableBranches.length <= 1 && !availableBranches.some(b => b.id === 'all')) {
    return null; 
  }

  return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-[200px] justify-between">
            {currentBranchName}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[200px]">
          <DropdownMenuLabel>Switch Branch</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {availableBranches.map((branch) => (
            <DropdownMenuItem key={branch.id} onSelect={() => setSelectedBranch(branch.id)}>
              {branch.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
  )
}


export default function StaffDashboard() {
  const { user } = useUser();
  const { selectedBranch } = useBranch();
  const firestore = useFirestore();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const userDocRef = useMemoFirebase(
    () => (firestore && user?.uid ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData, isLoading: isUserLoading } = useDoc(userDocRef);
  const institutionId = userData?.institutionId;
  const userRole = userData?.role;
  
  const customRoleDocRef = useMemoFirebase(() => {
      if (!firestore || !institutionId || !userData?.customRoleId) return null;
      return doc(firestore, 'institutions', institutionId, 'roles', userData.customRoleId);
  }, [firestore, institutionId, userData]);

  const { data: customRoleData } = useDoc(customRoleDocRef);

  const userPermissions = useMemo(() => {
      if (!userData) return new Set();
      if (userData.role === 'institution-admin') return new Set(['all']);
      
      const permissions = new Set<string>();
      const baseStaffPermissions = ['dashboard', 'customers', 'loans', 'profile', 'manual'];
      baseStaffPermissions.forEach(p => permissions.add(p));
      
      if (customRoleData?.permissions) {
          customRoleData.permissions.forEach((p: string) => permissions.add(p));
      }
      
      return permissions;
  }, [userData, customRoleData]);


  const institutionDocRef = useMemoFirebase(
    () => (firestore && institutionId ? doc(firestore, 'institutions', institutionId) : null),
    [firestore, institutionId]
  );
  const { data: institutionData, isLoading: isInstitutionLoading } = useDoc(institutionDocRef);

  const newApplicationsQuery = useMemoFirebase(
    () => (firestore && institutionId ? query(collection(firestore, 'institutions', institutionId, 'loanApplications'), where('status', '==', 'Application')) : null),
    [firestore, institutionId]
  );
  const { data: newApplications, isLoading: isNewAppsLoading } = useCollection(newApplicationsQuery);

  const pendingApprovalQuery = useMemoFirebase(
    () => (firestore && institutionId ? query(collection(firestore, 'institutions', institutionId, 'loanApplications'), where('status', '==', 'Pending Approval')) : null),
    [firestore, institutionId]
  );
  const { data: pendingApprovals, isLoading: isApprovalsLoading } = useCollection(pendingApprovalQuery);

  const pendingJournalsQuery = useMemoFirebase(
    () => (firestore && institutionId ? query(collection(firestore, 'institutions', institutionId, 'journals'), where('status', '==', 'Pending')) : null),
    [firestore, institutionId]
  );
  const { data: pendingJournals, isLoading: isJournalsLoading } = useCollection(pendingJournalsQuery);
  
  const myAppraisalsQuery = useMemoFirebase(
    () => (firestore && institutionId && user ? query(collection(firestore, 'institutions', institutionId, 'loanApplications'), where('status', '==', 'Appraisal'), where('appraisedBy', '==', user.uid)) : null),
    [firestore, institutionId, user]
  );
  const { data: myAppraisals, isLoading: isMyAppraisalsLoading } = useCollection(myAppraisalsQuery);
  
  const pendingPayoutsQuery = useMemoFirebase(
    () => (firestore && institutionId && user ? query(collection(firestore, 'institutions', institutionId, 'loanApplications'), where('status', '==', 'Pending Payout'), where('assignedTellerId', '==', user.uid)) : null),
    [firestore, institutionId, user]
  );
  const { data: pendingPayouts, isLoading: isPayoutsLoading } = useCollection(pendingPayoutsQuery);
  
  const invoicesQuery = useMemoFirebase(
    () => (firestore && institutionId ? query(collection(firestore, 'institutions', institutionId, 'invoices'), where('status', 'in', ['Pending', 'Partially Paid', 'Overdue'])) : null),
    [firestore, institutionId]
  );
  const { data: unpaidInvoices, isLoading: isInvoicesLoading } = useCollection(invoicesQuery);

  const overdueInvoices = useMemo(() => {
    return unpaidInvoices?.filter(invoice => isPast(invoice.dueDate.toDate())) || [];
  }, [unpaidInvoices]);


  const filteredNewApps = useMemo(() => {
    if (!newApplications) return [];
    if (selectedBranch === 'all') return newApplications;
    return newApplications.filter(app => app.branchId === selectedBranch);
  }, [newApplications, selectedBranch]);
  
  const filteredPendingApprovals = useMemo(() => {
    if (!pendingApprovals) return [];
    if (selectedBranch === 'all') return pendingApprovals;
    return pendingApprovals.filter(app => app.branchId === selectedBranch);
  }, [pendingApprovals, selectedBranch]);

  const taskList = [
    {
      title: 'New Applications',
      count: filteredNewApps?.length,
      href: '/staff/loans/all-applications',
      icon: FilePlus2,
      permission: 'loan:appraise',
    },
     {
      title: 'My Appraisals',
      count: myAppraisals?.length,
      href: '/staff/loans/appraisal',
      icon: ClipboardCheck,
      permission: 'loan:appraise',
    },
    {
      title: 'Pending Loan Approvals',
      count: filteredPendingApprovals?.length,
      href: '/staff/loans/approvals',
      icon: Gavel,
      permission: 'loan:approve',
    },
    {
      title: 'Loan Payouts',
      count: pendingPayouts?.length,
      href: '/staff/tellers/withdrawals',
      icon: HandCoins,
      permission: 'teller:withdraw', 
    },
    {
      title: 'Pending Journal Approvals',
      count: pendingJournals?.length,
      href: '/staff/accounts/journal-vouchers?tab=approve',
      icon: ListChecks,
      permission: 'account:journal:approve',
    },
  ].filter(task => userPermissions.has('all') || userPermissions.has(task.permission));


  const quickActions = [
    { title: 'New Loan Application', href: '/staff/loans/origination', icon: Landmark },
    { title: 'New Customer', href: '/staff/customers/new', icon: Users },
    { title: 'Search Customer', href: '/staff/customers/enquiries', icon: Search },
  ];

  const isLoading = isUserLoading || isInstitutionLoading || isNewAppsLoading || isApprovalsLoading || isJournalsLoading || isMyAppraisalsLoading || isPayoutsLoading || isInvoicesLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            Welcome, {userData?.firstName || 'User'}!
          </h1>
          <p className="text-muted-foreground">
            Here's what's happening at your branch today.
          </p>
        </div>
        <div className="flex items-center gap-4">
            <BranchSwitcher />
            <div className="text-right min-w-[200px]">
                <div className="font-semibold">System Date: <span className="font-mono text-primary">{institutionData?.systemDate ? format(institutionData.systemDate.toDate(), 'PPP') : 'N/A'}</span></div>
                <div className="text-xs text-muted-foreground font-mono">{format(new Date(), 'pp')}</div>
            </div>
        </div>
      </div>
      
      {overdueInvoices.length > 0 && userRole === 'institution-admin' && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Overdue Invoices</AlertTitle>
          <AlertDescription>
            You have {overdueInvoices.length} overdue invoice(s). Please make a payment to ensure uninterrupted service.
            <Button asChild variant="link" className="p-0 h-auto ml-2">
              <Link href="/staff/subscription">Go to Billing</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
            <Card>
                <CardHeader>
                    <CardTitle>My Tasks</CardTitle>
                    <CardDescription>
                        Items that require your immediate attention.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Skeleton className="h-24 w-full" />
                            <Skeleton className="h-24 w-full" />
                         </div>
                    ) : taskList.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {taskList.map((item) => (
                                <Card key={item.title} className="flex flex-col">
                                <CardHeader className="flex flex-row items-center gap-4 pb-4">
                                    <div className="p-3 bg-primary/10 rounded-full">
                                    <item.icon className="h-6 w-6 text-primary" />
                                    </div>
                                    <CardTitle className="text-lg">{item.title}</CardTitle>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                    <p className="text-4xl font-bold">{item.count || 0}</p>
                                </CardContent>
                                <CardFooter>
                                     <Button asChild variant={item.count && item.count > 0 ? 'default' : 'secondary'}>
                                        <Link href={item.href}>
                                            <Badge className="mr-2">{item.count || 0}</Badge>
                                            View
                                            <ArrowRight className="ml-2 h-4 w-4"/>
                                        </Link>
                                    </Button>
                                </CardFooter>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <p className="text-muted-foreground">You have no pending tasks.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col space-y-2">
                    {quickActions.map(action => (
                         <Button key={action.title} asChild variant="outline">
                            <Link href={action.href}>
                                <action.icon className="mr-2 h-4 w-4"/> {action.title}
                            </Link>
                         </Button>
                    ))}
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent className="text-center text-sm text-muted-foreground py-10">
                    Your recent activity will appear here.
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
