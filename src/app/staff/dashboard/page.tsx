
'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
    ArrowUpRight,
    CalendarDays,
    Clock3,
    Sparkles,
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
          <Button variant="outline" className="w-full sm:w-[220px] justify-between rounded-xl bg-background/80 shadow-sm">
            {currentBranchName}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-[220px]">
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

  const totalPendingTasks = taskList.reduce((total, task) => total + (task.count || 0), 0);

  return (
    <div className="space-y-8 pb-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 px-6 py-7 text-primary-foreground shadow-lg sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full border-[36px] border-white/5" />
        <div className="pointer-events-none absolute -bottom-28 right-36 h-56 w-56 rounded-full bg-white/5 blur-2xl" />
        <div className="relative flex flex-col gap-7 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium tracking-wide text-white/90">
              <Sparkles className="h-3.5 w-3.5" /> STAFF OVERVIEW
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Welcome back, {userData?.firstName || 'User'}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/75 sm:text-base">
              Here’s what needs your attention today. Your branch work and shortcuts are all in one place.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[470px]">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/70">
                <CalendarDays className="h-4 w-4" /> System date
              </div>
              <p className="mt-2 text-lg font-semibold">
                {institutionData?.systemDate ? format(institutionData.systemDate.toDate(), 'PPP') : 'Not set'}
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/70">
                <Clock3 className="h-4 w-4" /> Local time
              </div>
              <p className="mt-2 text-lg font-semibold tabular-nums">{format(currentTime, 'p')}</p>
            </div>
            <div className="sm:col-span-2">
              <BranchSwitcher />
            </div>
          </div>
        </div>
      </section>

      {overdueInvoices.length > 0 && userRole === 'institution-admin' && (
        <Alert variant="destructive" className="rounded-2xl">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Overdue invoices</AlertTitle>
          <AlertDescription>
            You have {overdueInvoices.length} overdue invoice(s). Please make a payment to ensure uninterrupted service.
            <Button asChild variant="link" className="ml-2 h-auto p-0 text-destructive underline">
              <Link href="/staff/subscription">Go to billing</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3 px-1">
            <div>
              <p className="text-sm font-medium text-primary">WORK QUEUE</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">My tasks</h2>
              <p className="mt-1 text-sm text-muted-foreground">Items that need your attention.</p>
            </div>
            {!isLoading && (
              <div className="rounded-xl border bg-card px-4 py-2 text-sm shadow-sm">
                <span className="font-semibold tabular-nums">{totalPendingTasks}</span>
                <span className="ml-1.5 text-muted-foreground">pending items</span>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Skeleton className="h-40 w-full rounded-2xl" />
              <Skeleton className="h-40 w-full rounded-2xl" />
              <Skeleton className="h-40 w-full rounded-2xl" />
              <Skeleton className="h-40 w-full rounded-2xl" />
            </div>
          ) : taskList.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {taskList.map((item) => {
                const count = item.count || 0;
                return (
                  <Card key={item.title} className="group overflow-hidden rounded-2xl border-border/70 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
                    <CardContent className="flex h-full min-h-[170px] flex-col p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                          <item.icon className="h-5 w-5" />
                        </div>
                        <Badge variant={count > 0 ? 'default' : 'secondary'} className="rounded-full px-2.5 tabular-nums">{count}</Badge>
                      </div>
                      <div className="mt-5 flex flex-1 items-end justify-between gap-3">
                        <div>
                          <h3 className="font-semibold leading-snug">{item.title}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {count > 0 ? `${count} item${count === 1 ? '' : 's'} waiting` : 'Nothing waiting right now'}
                          </p>
                        </div>
                        <Button asChild variant="ghost" size="icon" className="shrink-0 rounded-full text-muted-foreground group-hover:text-primary" aria-label={`View ${item.title}`}>
                          <Link href={item.href}>
                            <ArrowUpRight className="h-5 w-5" />
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="rounded-2xl border-dashed shadow-none">
              <CardContent className="flex min-h-56 flex-col items-center justify-center px-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                  <ClipboardCheck className="h-6 w-6" />
                </div>
                <h3 className="mt-4 font-semibold">You’re all caught up</h3>
                <p className="mt-1 text-sm text-muted-foreground">There are no pending tasks for your role right now.</p>
              </CardContent>
            </Card>
          )}
        </section>

        <aside className="space-y-5">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Quick actions</CardTitle>
              <CardDescription>Start a common task.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {quickActions.map(action => (
                <Button key={action.title} asChild variant="outline" className="h-auto w-full justify-between rounded-xl px-3.5 py-3 text-left hover:border-primary/30 hover:bg-primary/[0.03]">
                  <Link href={action.href}>
                    <span className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-primary">
                        <action.icon className="h-4 w-4" />
                      </span>
                      <span className="whitespace-normal">{action.title}</span>
                    </span>
                    <ArrowRight className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70 bg-muted/30 shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Recent activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-dashed bg-background/70 px-4 py-5 text-sm text-muted-foreground">
                Recent activity will appear here when activity tracking is available.
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
