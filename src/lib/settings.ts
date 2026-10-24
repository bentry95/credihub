
import {
  User,
  Users,
  Shield,
  Building,
  HandCoins,
  Landmark,
  Wallet,
  Coins,
  CircleDollarSign,
  Ban,
  KeyRound,
  FileCheck,
  Workflow,
  LucideIcon,
  History,
  Timer,
  ShieldAlert,
  Briefcase,
  Package,
  Shapes,
  Warehouse,
  Truck,
  Settings2,
  MailPlus,
} from 'lucide-react';

export interface SettingsItem {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

export interface SettingsCategory {
  category: string;
  items: SettingsItem[];
}

export const settingsConfig: SettingsCategory[] = [
  {
    category: 'General Settings',
    items: [
      {
        title: 'Institution Profile',
        description:
          "Manage your institution's core details like name, logo, address, and contact information.",
        href: '/staff/settings/profile',
        icon: Building,
      },
      {
        title: 'Staff Invitations',
        description: 'Generate secure invitation codes for new staff members to sign up.',
        href: '/staff/settings/invitations',
        icon: MailPlus,
      },
      {
        title: 'Users',
        description: 'Manage staff member accounts and activate new signups.',
        href: '/staff/settings/users',
        icon: Users,
      },
      {
        title: 'Roles & Permissions',
        description:
          'Define staff roles and assign granular permissions to control what each role can do.',
        href: '/staff/settings/roles',
        icon: KeyRound,
      },
      {
        title: 'Branches',
        description: "Define and manage your institution's physical branch network.",
        href: '/staff/settings/branches',
        icon: Building,
      },
      {
        title: 'Employers',
        description: 'Manage a central directory of employers for customer KYC.',
        href: '/staff/settings/employers',
        icon: Briefcase,
      },
    ],
  },
  {
    category: 'Product & Service Configuration',
    items: [
      {
        title: 'Loan Products',
        description:
          'Create and configure all the details of the loan products you offer.',
        href: '/staff/settings/loan-products',
        icon: Landmark,
      },
      {
        title: 'Savings Products',
        description: 'Define the various savings schemes, rules, and interest rates.',
        href: '/staff/settings/savings-products',
        icon: Wallet,
      },
      {
        title: 'Share Products',
        description:
          '(For SACCOs/Cooperatives) Manage share classes, values, and dividend settings.',
        href: '/staff/settings/share-products',
        icon: Coins,
      },
      {
        title: 'Fees & Charges',
        description:
          'Create a central library of all possible fees that can be linked to your products.',
        href: '/staff/settings/fees',
        icon: CircleDollarSign,
      },
      {
        title: 'Penalties',
        description: 'Configure the rules for applying penalties on overdue loans.',
        href: '/staff/settings/penalties',
        icon: Ban,
      },
    ],
  },
  {
    category: 'Financial Management',
    items: [
       {
        title: 'Loan Loss Provisioning',
        description: 'Set the rules for automatically provisioning for potential bad debt.',
        href: '/staff/settings/loan-loss-provision',
        icon: ShieldAlert,
      },
    ]
  },
  {
      category: 'Inventory Management',
      items: [
        {
          title: 'Items',
          description: 'Manage your catalog of items, including consumables, assets, and loanable goods.',
          href: '/staff/inventory/items',
          icon: Package,
        },
        {
          title: 'Categories & Units',
          description: 'Define item categories and standard units of measure for consistency.',
          href: '/staff/inventory/categories',
          icon: Shapes,
        },
        {
          title: 'Warehouses',
          description: 'Set up and manage your physical storage locations and warehouses.',
          href: '/staff/inventory/warehouses',
          icon: Warehouse,
        },
        {
          title: 'Suppliers',
          description: 'Manage a directory of suppliers for procurement.',
          href: '/staff/inventory/procurement',
          icon: Truck,
        },
        {
          title: 'Inventory Settings',
          description: 'Configure global settings for valuation, reordering, and integrations.',
          href: '/staff/inventory/settings',
          icon: Settings2,
        },
      ],
    },
  {
    category: 'System & Security Controls',
    items: [
       {
        title: 'Security',
        description: 'Configure system-wide security settings, such as inactivity timeouts.',
        href: '/staff/settings/security',
        icon: Shield,
      },
      {
        title: 'Report Permissions',
        description: 'Control which user roles have access to view specific financial reports.',
        href: '/staff/settings/report-permissions',
        icon: FileCheck,
      },
      {
        title: 'Maker-Checker',
        description: 'Manage system-wide internal controls, like "Maker-Checker" approvals.',
        href: '/staff/settings/workflow-controls',
        icon: Workflow,
      },
      {
        title: 'Maker-Checker History',
        description: 'View the history of all maker-checker actions and approvals.',
        href: '/staff/settings/workflow-controls/history',
        icon: History,
      },
       {
        title: 'Tellering',
        description: 'Set up cashiers, link their tills to GL accounts, and define transaction limits.',
        href: '/staff/settings/tellering',
        icon: HandCoins,
      },
    ],
  },
];
