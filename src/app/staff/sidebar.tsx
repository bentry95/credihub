
'use client';
import Link from 'next/link';
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
  Package,
  Shapes,
  Boxes,
  Warehouse,
  ShoppingCart,
  HelpCircle,
  Settings2,
  ClipboardList,
  TrendingDown,
  Truck,
  Wrench,
  Trash2,
} from 'lucide-react';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
  } from "@/components/ui/collapsible"
import React, { useMemo, useState } from 'react';
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
            { href: '/staff/inventory/dashboard', label: 'Dashboard', icon: LayoutDashboard, permissionId: 'inventory:read' },
            { href: '/staff/inventory/items', label: 'Items', icon: Package, permissionId: 'inventory:read' },
            { href: '/staff/inventory/categories', label: 'Categories & Units', icon: Shapes, permissionId: 'inventory:config' },
            { href: '/staff/inventory/stock', label: 'Stock Management', icon: Boxes, permissionId: 'inventory:manage' },
            { href: '/staff/inventory/warehouses', label: 'Warehouses', icon: Warehouse, permissionId: 'inventory:config' },
            { href: '/staff/inventory/procurement', label: 'Procurement', icon: ShoppingCart, permissionId: 'inventory:procure' },
            { href: '/staff/inventory/loan-assets', label: 'Loan Assets', icon: ArrowRightLeft, permissionId: 'inventory:loan' },
            { href: '/staff/inventory/staff-assets', label: 'Staff Assets', icon: User, permissionId: 'inventory:staff' },
            {
                label: 'Fixed Assets',
                icon: Package,
                permissionId: 'inventory:assets',
                subItems: [
                    { href: '/staff/inventory/fixed-assets/setup', label: 'Asset Setup', icon: Settings2, permissionId: 'inventory:assets:config' },
                    { href: '/staff/inventory/fixed-assets/register', label: 'Asset Register', icon: ClipboardList, permissionId: 'inventory:assets:read' },
                    { href: '/staff/inventory/fixed-assets/depreciation', label: 'Depreciation', icon: TrendingDown, permissionId: 'inventory:assets:manage' },
                    { href: '/staff/inventory/fixed-assets/transfers', label: 'Asset Transfers', icon: Truck, permissionId: 'inventory:assets:manage' },
                    { href: '/staff/inventory/fixed-assets/maintenance', label: 'Maintenance', icon: Wrench, permissionId: 'inventory:assets:manage' },
                    { href: '/staff/inventory/fixed-assets/disposal', label: 'Disposal', icon: Trash2, permissionId: 'inventory:assets:manage' },
                    { href: '/staff/inventory/fixed-assets/reports', label: 'Asset Reports', icon: FileText, permissionId: 'report:inventory' },
                ]
            },
            { href: '/staff/inventory/reports', label: 'Reports', icon: FileText, permissionId: 'report:inventory' },
            { href: '/staff/inventory/settings', label: 'Settings', icon: Settings, permissionId: 'inventory:config' },
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
        href: '/staff/support',
        icon: HelpCircle,
        label: 'Support',
        permissionId: 'support',
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

const CollapsibleSidebarItem = ({ item }: { item: any }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between w-full cursor-pointer">
                    <SidebarMenuButton className="w-full justify-start pointer-events-none">
                        <item.icon />
                        {item.label}
                    </SidebarMenuButton>
                    <ChevronDown className="h-4 w-4 mr-2" />
                </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div className="pl-8 pt-1 space-y-1">
                {item.subItems.map((subItem: any, subIndex: number) => (
                    subItem.subItems ? <CollapsibleSidebarItem key={subIndex} item={subItem} /> :
                    <SidebarMenuButton asChild variant="ghost" key={subIndex}>
                        <Link href={subItem.href}>{subItem.label}</Link>
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
      const baseStaffPermissions = ['dashboard', 'customers', 'loans', 'accounts', 'tellers', 'payroll', 'inventory', 'reports', 'profile', 'manual', 'support'];
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
  
  if (!userData) {
      return (
        <Sidebar>
            <SidebarHeader>
                <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">CrediHub</h1>
                </div>
            </SidebarHeader>
            <SidebarContent>
                {/* Render nothing or a skeleton, as we are waiting for user data */}
            </SidebarContent>
        </Sidebar>
      )
  }


  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight">CrediHub</h1>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {menuItems.map((item, index) => (
            <SidebarMenuItem key={index}>
              {item.subItems && item.subItems.length > 0 ? (
                 <CollapsibleSidebarItem item={item} />
              ) : item.href ? (
                <SidebarMenuButton asChild>
                  <Link href={item.href!}>
                    <item.icon />
                    {item.label}
                  </Link>
                </SidebarMenuButton>
              ) : null}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
       <SidebarFooter>
         <SidebarMenu>
             <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/staff/user-manual">
                    <BookUser />
                    User Manual
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/staff/profile">
                    <User />
                    Profile
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
          </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
    