
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  Users,
  Wallet,
  Landmark,
  HandCoins,
  AppWindow,
  Settings,
  User,
  FileText,
  BookUser,
  CreditCard,
  ChevronDown,
  BookOpen,
  Lock,
  Undo,
  Sun,
  Moon,
  Monitor,
  Bank,
  Gavel,
  History,
  Calculator,
  ArrowRightLeft,
  ChevronsRightLeft,
  UploadCloud,
  Briefcase,
  Album,
  PlayCircle,
  ShieldCheck,
  Send,
  Receipt,
  Clock,
  Archive,
} from 'lucide-react';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
  } from "@/components/ui/collapsible"
import React, { useEffect, useMemo, useState } from 'react';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';


export const allMenuItems = [
    {
        href: '/staff/dashboard',
        icon: LayoutDashboard,
        label: 'Dashboard',
        permissionId: 'dashboard',
    },
    {
        label: 'Customers',
        icon: Users,
        permissionId: 'customers',
        subItems: [
            { href: '/staff/customers/all', label: 'All Customers', permissionId: 'customer:read' },
            { href: '/staff/customers/enquiries', label: 'Customer Enquiry', permissionId: 'customer:read' },
            { href: '/staff/customers/new', label: 'Add New Customer', permissionId: 'customer:create' },
            { href: '/staff/customers/edit', label: 'Edit Customer', permissionId: 'customer:update' },
            { href: '/staff/customers/unfinalised', label: 'Unfinalised Onboarding', permissionId: 'customer:create' },
            { href: '/staff/customers/statements', label: 'Customer Statements', permissionId: 'customer:statement' },
            { href: '/staff/customers/exit', label: 'Customer Exit', permissionId: 'customer:update' },
            { href: '/staff/customers/groups', label: 'Manage Groups', permissionId: 'customer:create' },
            { href: '/staff/customers/collateral', label: 'Collateral Register', permissionId: 'customer:read' },
            { href: '/staff/customers/kyc-alerts', label: 'KYC Alerts', permissionId: 'customer:read' },
        ]
    },
    {
        label: 'Loans',
        icon: Landmark,
        permissionId: 'loans',
        subItems: [
            { href: '/staff/loans/dashboard', label: 'Loans Dashboard', permissionId: 'loan:read'},
            { href: '/staff/loans/calculator', label: 'Loan Calculator', permissionId: 'loan:read'},
            { href: '/staff/loans/all-applications', label: 'All Applications', permissionId: 'loan:read'},
            { href: '/staff/loans/origination', label: 'Start New Application', permissionId: 'loan:create'},
            { href: '/staff/loans/appraisal', label: 'Loan Appraisal', permissionId: 'loan:appraise'},
            {
                label: 'Approvals',
                icon: Gavel,
                permissionId: 'loan:approve',
                subItems: [
                    { href: '/staff/loans/approvals', label: 'Loan Applications', permissionId: 'loan:approve' },
                    { href: '/staff/loans/approvals/top-ups', label: 'Top-Up Approvals', permissionId: 'loan:approve' },
                    { href: '/staff/loans/approvals/reschedules', label: 'Reschedule Approvals', permissionId: 'loan:approve' },
                    { href: '/staff/loans/approvals/reversals', label: 'Reversal Approvals', permissionId: 'loan:reversal' },
                    { href: '/staff/loans/approvals/write-offs', label: 'Write-Off Approvals', permissionId: 'loan:write-off' },
                ]
            },
            { href: '/staff/loans/reschedule', label: 'Reschedule', permissionId: 'loan:reschedule'},
            { href: '/staff/loans/reversal', label: 'Reversal', permissionId: 'loan:reversal'},
            { href: '/staff/loans/top-up', label: 'Top-Up', permissionId: 'loan:reschedule'},
            { href: '/staff/loans/write-off', label: 'Write-Off', permissionId: 'loan:write-off'},
            { href: '/staff/loans/collections/bulk-upload', label: 'Collections Bulk Upload', icon: UploadCloud, permissionId: 'loan:collect'},
            { href: '/staff/settings/loan-loss-provision', label: 'Loan Loss Provision', permissionId: 'loan:write-off' },
        ]
    },
    {
        label: 'Accounts',
        icon: Wallet,
        permissionId: 'accounts',
        subItems: [
            { href: '/staff/accounts/dashboard', label: 'Accounts Dashboard', permissionId: 'account:read' },
            { href: '/staff/accounts/codes', label: 'Account Codes', permissionId: 'account:read' },
            { href: '/staff/accounts/statements', label: 'Account Statements', permissionId: 'account:read' },
            { href: '/staff/accounts/chart-of-accounts', label: 'Chart of Accounts', permissionId: 'account:read' },
            { href: '/staff/accounts/financial-year', label: 'Financial Year', permissionId: 'account:read' },
            { href: '/staff/accounts/journal-vouchers', label: 'Journal Vouchers', permissionId: 'account:journal:create' },
            { href: '/staff/accounts/loan-disbursement', label: 'Loan Disbursement', permissionId: 'loan:disburse' },
            { href: '/staff/accounts/transaction-reversal', label: 'Request Reversal', permissionId: 'account:reversal' },
            { href: '/staff/accounts/reversal-approvals', icon: Undo, label: 'Reversal Approvals', permissionId: 'account:reversal' },
        ]
    },
    {
        label: 'Tellers',
        icon: HandCoins,
        permissionId: 'tellers',
        subItems: [
            // Sub-items will be dynamically generated based on role
        ]
    },
    {
        label: 'Payroll',
        icon: Briefcase,
        permissionId: 'payroll',
        subItems: [
            { href: '/staff/payroll/dashboard', label: 'Dashboard', permissionId: 'payroll:read', icon: LayoutDashboard},
            { href: '/staff/payroll/employees', label: 'Employees', permissionId: 'payroll:read', icon: Users},
            { href: '/staff/payroll/salary-structures', label: 'Salary Structures', permissionId: 'payroll:config', icon: Album},
            { href: '/staff/payroll/payroll-runs', label: 'Payroll Runs', permissionId: 'payroll:run', icon: PlayCircle},
            { href: '/staff/payroll/loan-deductions', label: 'Loan Deductions', permissionId: 'payroll:read', icon: Landmark},
            { href: '/staff/payroll/payslips', label: 'Payslips', permissionId: 'payroll:read', icon: Receipt},
            { href: '/staff/payroll/compliance', label: 'Statutory & Compliance', permissionId: 'payroll:report', icon: ShieldCheck},
            { href: '/staff/payroll/time-attendance', label: 'Time & Attendance', permissionId: 'payroll:read', icon: Clock},
            { href: '/staff/payroll/reports', label: 'Reports', permissionId: 'payroll:report', icon: FileText},
            { href: '/staff/payroll/disbursements', label: 'Disbursements', permissionId: 'payroll:disburse', icon: Send},
            { href: '/staff/payroll/settings', label: 'Settings', permissionId: 'payroll:config', icon: Settings},
        ]
    },
    {
        label: 'Inventory',
        icon: Archive,
        permissionId: 'inventory',
        subItems: [
            { href: '/staff/inventory/dashboard', label: 'Dashboard', permissionId: 'inventory:read' },
            { href: '/staff/inventory/items', label: 'Items', permissionId: 'inventory:read' },
            { href: '/staff/inventory/categories', label: 'Categories & Units', permissionId: 'inventory:config' },
            { href: '/staff/inventory/stock', label: 'Stock Management', permissionId: 'inventory:manage' },
            { href: '/staff/inventory/warehouses', label: 'Warehouses', permissionId: 'inventory:config' },
            { href: '/staff/inventory/procurement', label: 'Procurement', permissionId: 'inventory:procure' },
            { href: '/staff/inventory/loan-assets', label: 'Loan Assets', permissionId: 'inventory:loan' },
            { href: '/staff/inventory/staff-assets', label: 'Staff Assets', permissionId: 'inventory:staff' },
            { href: '/staff/inventory/reports', label: 'Reports', permissionId: 'report:inventory' },
            { href: '/staff/inventory/settings', label: 'Settings', permissionId: 'inventory:config' },
        ]
    },
    {
        href: '/staff/reports',
        icon: FileText,
        label: 'Reports',
        permissionId: 'reports',
    },
    {
        label: 'Applications',
        icon: AppWindow,
        permissionId: 'applications',
        subItems: [
            { href: '/staff/applications/end-of-day', label: 'End-of-Day', permissionId: 'eod:run'},
            { href: '/staff/applications/bulk-upload', label: 'Bulk Upload', permissionId: 'settings'},
        ]
    },
    {
        href: '/staff/subscription',
        icon: CreditCard,
        label: 'Subscription',
        permissionId: 'subscription',
    },
    {
        href: '/staff/settings',
        icon: Settings,
        label: 'Settings',
        permissionId: 'settings',
    },
];

const tellerSubMenus = {
    'Chief Cashier': [
        { href: '/staff/tellers/chief-cashier-dashboard', label: 'Chief Cashier Dashboard' },
        { href: '/staff/tellers/approvals', label: 'Approvals' },
        { href: '/staff/tellers/cash-to-teller', label: 'Cash to Teller', icon: ArrowRightLeft },
        { href: '/staff/tellers/loan-payout', label: 'Loan Payout Assignment' },
        { href: '/staff/tellers/transactions', label: 'View Transactions' },
        { href: '/staff/tellers/eod-reports', label: 'End of Day Reports' },
    ],
    'Regular Cashier': [
        { href: '/staff/tellers/teller-dashboard', label: 'My Dashboard' },
        { href: '/staff/tellers/deposits', label: 'Cash Deposit' },
        { href: '/staff/tellers/loan-repayment', label: 'Loan Repayment' },
        { href: '/staff/tellers/withdrawals', label: 'Cash Withdrawal & Payouts' },
        { href: '/staff/tellers/direct-receipt', label: 'Direct Receipt' },
        { href: '/staff/tellers/cash-requisition', label: 'Cash Requisition' },
        { href: '/staff/tellers/cash-to-treasury', label: 'Cash to Treasury' },
    ],
}

const CollapsibleSidebarItem = ({ item, path, openPath, setOpenPath }: { item: any; path: string[]; openPath: string[]; setOpenPath: (path: string[]) => void }) => {
    const pathname = usePathname();
    const isOpen = openPath.length >= path.length && path.every((part, index) => openPath[index] === part);
    const hasActiveChild = item.subItems?.some((subItem: any) =>
        subItem.href
            ? pathname === subItem.href || pathname.startsWith(`${subItem.href}/`)
            : subItem.subItems?.some((nestedItem: any) => pathname === nestedItem.href || pathname.startsWith(`${nestedItem.href}/`))
    );
    return (
        <Collapsible open={isOpen} onOpenChange={(open) => setOpenPath(open ? path : openPath.slice(0, path.length - 1))}>
            <CollapsibleTrigger asChild>
                <SidebarMenuButton isActive={hasActiveChild} className="h-10 justify-start rounded-xl px-3 font-medium data-[active=true]:bg-primary/10 data-[active=true]:text-primary">
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                    <ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div className="ml-5 space-y-1 border-l border-sidebar-border py-1 pl-3">
                {item.subItems.map((subItem: any, subIndex: number) => (
                    subItem.subItems ? <CollapsibleSidebarItem key={subIndex} item={subItem} path={[...path, subItem.label]} openPath={openPath} setOpenPath={setOpenPath} /> :
                    <SidebarMenuButton asChild variant="ghost" key={subIndex} isActive={pathname === subItem.href || pathname.startsWith(`${subItem.href}/`)} className="h-9 rounded-lg px-3 text-[13px] font-normal data-[active=true]:bg-primary/10 data-[active=true]:font-medium data-[active=true]:text-primary">
                        <Link href={subItem.href}><span className="truncate">{subItem.label}</span></Link>
                    </SidebarMenuButton>
                ))}
                </div>
            </CollapsibleContent>
        </Collapsible>
    )
}

function deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (obj instanceof Date) {
        return new Date(obj.getTime()) as any;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => deepClone(item)) as any;
    }
    
    if (React.isValidElement(obj) || typeof obj === 'function') {
        return obj;
    }

    const newObj = {} as T;
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            newObj[key] = deepClone(obj[key]);
        }
    }
    return newObj;
}

export function StaffSidebar() {
  const [openPath, setOpenPath] = useState<string[]>([]);
  const pathname = usePathname();
  const { user } = useUser();
  const firestore = useFirestore();
  const { setTheme } = useTheme();

  const userDocRef = useMemoFirebase(
    () => (firestore && user && user.email ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);

  const institutionId = userData?.institutionId;
  const customRoleId = userData?.customRoleId;

  const customRoleDocRef = useMemoFirebase(() => {
      // Guard against running the query before necessary IDs are available.
      if (!firestore || !institutionId || !customRoleId) return null;
      return doc(firestore, 'institutions', institutionId, 'roles', customRoleId);
  }, [firestore, institutionId, customRoleId]);

  const { data: customRoleData } = useDoc(customRoleDocRef);

  const tellerConfigQuery = useMemoFirebase(
    () => {
        // Guard against running the query before necessary IDs are available.
        if (!firestore || !user || !institutionId) return null;
        return query(collection(firestore, 'institutions', institutionId, 'tellers'), where('userId', '==', user.uid), where('status', '==', 'Active'));
    },
    [firestore, user, institutionId]
  );
  const { data: tellerConfigData } = useCollection(tellerConfigQuery);
  const tellerRole = tellerConfigData?.[0]?.role;

  const userPermissions = useMemo(() => {
      if (!userData) return new Set();
      if (userData.role === 'institution-admin') return new Set(['all']); 
      
      const permissions = new Set<string>();

      // Base permissions for all staff
      const baseStaffPermissions = ['dashboard', 'customers', 'loans', 'accounts', 'tellers', 'payroll', 'inventory', 'reports', 'profile', 'manual'];
      baseStaffPermissions.forEach(p => permissions.add(p));
      
      if (customRoleData?.permissions) {
          customRoleData.permissions.forEach((p: string) => permissions.add(p));
      }

      permissions.forEach(p => {
          const mainModule = p.split(':')[0];
          if (mainModule) {
              permissions.add(mainModule);
          }
      });
      
      if (tellerRole) {
          permissions.add('tellers');
      }
      
      return permissions;
  }, [userData, customRoleData, tellerRole]);

  const menuItems = useMemo(() => {
    if (!userData) return [];

    const filterItems = (items: any[]) => {
      return items.filter(item => {
        if (userPermissions.has('all')) return true;
        if (!item.permissionId) return true;
        
        const hasPermission = userPermissions.has(item.permissionId);
        if (item.subItems) {
          item.subItems = filterItems(item.subItems);
          return item.subItems.length > 0;
        }
        return hasPermission;
      });
    };

    const finalMenuItems = allMenuItems.map(item => {
      if (item.label === 'Tellers') {
        if (tellerRole && tellerSubMenus[tellerRole as keyof typeof tellerSubMenus]) {
          return { ...item, subItems: tellerSubMenus[tellerRole as keyof typeof tellerSubMenus] };
        }
        return { ...item, subItems: [] };
      }
      return item;
    });

    return filterItems(deepClone(finalMenuItems));

  }, [tellerRole, userPermissions, userData]);

  useEffect(() => {
    const findExpandedPath = (items: any[], parents: string[] = []): string[] | null => {
      for (const item of items) {
        const currentPath = [...parents, item.label];
        if (item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`))) return parents;
        if (item.subItems?.length) {
          const foundPath = findExpandedPath(item.subItems, currentPath);
          if (foundPath) return foundPath;
        }
      }
      return null;
    };

    const activePath = findExpandedPath(menuItems);
    if (activePath) setOpenPath(activePath);
  }, [menuItems, pathname]);
  
  if (!userData) {
      return (
        <Sidebar className="border-r border-sidebar-border bg-sidebar">
            <SidebarHeader className="border-b border-sidebar-border/70 px-4 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"><Landmark className="h-5 w-5" /></div>
                  <div className="min-w-0"><h1 className="text-base font-bold tracking-tight">CrediHub</h1><p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Financial workspace</p></div>
                </div>
            </SidebarHeader>
            <SidebarContent className="px-3 py-4">
                {/* Render nothing or a skeleton, as we are waiting for user data */}
            </SidebarContent>
        </Sidebar>
      )
  }


  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="border-b border-sidebar-border/70 px-4 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Landmark className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold tracking-tight">CrediHub</h1>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Financial workspace</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="gap-1 px-3 py-4">
        <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground group-data-[collapsible=icon]:hidden">Workspace</p>
        <SidebarMenu className="gap-1">
          {menuItems.map((item, index) => (
            <SidebarMenuItem key={index}>
              {item.subItems && item.subItems.length > 0 ? (
                 <CollapsibleSidebarItem item={item} path={[item.label]} openPath={openPath} setOpenPath={setOpenPath} />
              ) : item.href ? (
                <SidebarMenuButton asChild isActive={pathname === item.href || pathname.startsWith(`${item.href}/`)} className="h-10 rounded-xl px-3 font-medium data-[active=true]:bg-primary/10 data-[active=true]:text-primary">
                  <Link href={item.href!}>
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              ) : null}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
       <SidebarFooter className="border-t border-sidebar-border/70 bg-muted/20 px-3 py-3">
         <SidebarMenu className="gap-1">
             <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/staff/user-manual' || pathname.startsWith('/staff/user-manual/')} className="h-10 rounded-xl px-3 font-medium data-[active=true]:bg-primary/10 data-[active=true]:text-primary">
                  <Link href="/staff/user-manual">
                    <BookUser className="h-4 w-4" />
                    <span>User Manual</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/staff/profile' || pathname.startsWith('/staff/profile/')} className="h-10 rounded-xl px-3 font-medium data-[active=true]:bg-primary/10 data-[active=true]:text-primary">
                  <Link href="/staff/profile">
                    <User className="h-4 w-4" />
                    <span>Profile</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
          </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

    
