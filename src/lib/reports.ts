
import {
    BarChart3,
    FileText,
    Users,
    Landmark,
    Briefcase,
    ShieldAlert,
    FileX,
    UserCog,
    FilePieChart,
    Banknote,
    Receipt,
    HandCoins,
    Book,
    Scale,
    CandlestickChart,
    ArrowRightLeft,
    TrendingUp,
    ShieldCheck,
    ClipboardList,
    FileSearch,
    Building,
    UserCheck,
    Settings2,
    DatabaseZap,
    KeySquare,
    AlertTriangle,
    List,
    History,
    FileCheck,
    ChevronsRightLeft,
    FileWarning,
    TrendingDown,
  } from 'lucide-react';
  import { LucideIcon } from 'lucide-react';
  
  export interface Report {
    title: string;
    description: string;
    href: string;
    icon: LucideIcon;
    permissionId: string;
  }
  
  export interface ReportCategory {
    category: string;
    reports: Report[];
  }
  
  export const reportsConfig: ReportCategory[] = [
    {
      category: 'Loan Reports',
      reports: [
        {
          title: 'Loan Portfolio Summary',
          description: 'Overview of active loans, outstanding balances, and growth rates.',
          href: '/staff/reports/loans/portfolio-summary',
          icon: FilePieChart,
          permissionId: 'report:loan:portfolio',
        },
        {
          title: 'Loan Disbursement Report',
          description: 'Details all disbursed loans, filterable by date, officer, and product.',
          href: '/staff/reports/loans/disbursement',
          icon: Landmark,
          permissionId: 'report:loan:disbursement',
        },
        {
          title: 'Loan Repayment Report',
          description: 'Tracks expected vs. actual repayments to monitor collections.',
          href: '/staff/reports/loans/repayment',
          icon: Receipt,
          permissionId: 'report:loan:repayment',
        },
        {
          title: 'Arrears & Delinquency Report',
          description: 'Critical Portfolio at Risk (PAR) report, showing overdue loans and aging analysis.',
          href: '/staff/reports/loans/arrears',
          icon: ShieldAlert,
          permissionId: 'report:loan:arrears',
        },
        {
          title: 'Written-off Loans Report',
          description: 'A list of all loans that have been declared uncollectible and written off.',
          href: '/staff/reports/loans/written-off',
          icon: FileX,
          permissionId: 'report:loan:write-off',
        },
        {
          title: 'Loan Officer Performance',
          description: 'Compares loan officers based on disbursement volume, collections, and portfolio quality.',
          href: '/staff/reports/loans/officer-performance',
          icon: UserCog,
          permissionId: 'report:loan:performance',
        },
        {
          title: 'Loan Application Funnel',
          description: 'Tracks the conversion rate of applications through each stage of the loan cycle.',
          href: '/staff/reports/loans/application-funnel',
          icon: FileSearch,
          permissionId: 'report:loan:funnel',
        },
      ],
    },
    {
      category: 'Payroll Reports - Core',
      reports: [
        {
          title: 'Payroll Summary',
          description: 'High-level payroll totals per run or period: Gross Pay, Deductions, and Net Pay.',
          href: '/staff/payroll/reports/summary',
          icon: BarChart3,
          permissionId: 'report:payroll:summary',
        },
        {
          title: 'Payslips',
          description: 'View and download individual employee payslips for any payroll run.',
          href: '/staff/payroll/payslips',
          icon: Receipt,
          permissionId: 'report:payroll:payslip',
        },
        {
          title: 'Payroll Register',
          description: 'A detailed, line-by-line audit report of all earnings and deductions for each employee in a run.',
          href: '/staff/payroll/reports/register',
          icon: FileText,
          permissionId: 'report:payroll:register',
        },
        {
          title: 'Bank Transfer Report',
          description: 'Generate a file containing all net pay amounts and employee bank details for payment processing.',
          href: '/staff/payroll/reports/bank-transfer',
          icon: Landmark,
          permissionId: 'report:payroll:bank',
        },
      ],
    },
    {
        category: 'Payroll Reports - Finance & Compliance',
        reports: [
             {
              title: 'Statutory Deductions',
              description: 'View breakdowns of PAYE, Pension, and other statutory deductions.',
              href: '/staff/payroll/reports/statutory',
              icon: ShieldCheck,
              permissionId: 'report:payroll:compliance:statutory',
            },
            {
              title: 'Employer Contributions',
              description: 'Report on employer pension contributions and other liabilities.',
              href: '/staff/payroll/reports/contributions',
              icon: Building,
              permissionId: 'report:payroll:compliance:contributions',
            },
            {
              title: 'Payroll GL Posting Report',
              description: 'Reconcile payroll runs with their General Ledger entries.',
              href: '/staff/payroll/reports/gl-posting',
              icon: ArrowRightLeft,
              permissionId: 'report:payroll:finance:gl',
            },
            {
              title: 'Payroll Variance Report',
              description: 'Detect unusual changes in payroll data vs a previous period.',
              href: '/staff/payroll/reports/variance',
              icon: ChevronsRightLeft,
              permissionId: 'report:payroll:finance:variance',
            },
            {
              title: 'Department Payroll Costing',
              description: 'Shows payroll cost allocation by branch, department, or cost center.',
              href: '/staff/payroll/reports/costing',
              icon: Briefcase,
              permissionId: 'report:payroll:finance:costing',
            },
            {
              title: 'Exceptions Report',
              description: 'Highlights unpaid payroll, failed payments, or employees with missing bank details.',
              href: '/staff/payroll/reports/exceptions',
              icon: FileWarning,
              permissionId: 'report:payroll:exceptions',
            },
        ]
    },
    {
      category: 'Savings & Cash Operations',
      reports: [
        {
          title: 'Deposit Summary',
          description: 'Tracks total deposits, withdrawals, and net savings balances over a period.',
          href: '/staff/reports/savings/deposit-summary',
          icon: TrendingUp,
          permissionId: 'report:savings:summary',
        },
        {
          title: 'Customer Account Balances',
          description: 'A complete list of all customer savings accounts, useful for identifying dormant accounts.',
          href: '/staff/reports/savings/customer-balances',
          icon: Banknote,
          permissionId: 'report:savings:balances',
        },
        {
          title: 'Savings Product Performance',
          description: 'Shows which savings products are most popular and tracks their growth.',
          href: '/staff/reports/savings/product-performance',
          icon: Briefcase,
          permissionId: 'report:savings:performance',
        },
        {
          title: 'Teller Transactions Report',
          description: 'Provides daily activity logs and balancing sheets for tellers.',
          href: '/staff/reports/savings/teller-transactions',
          icon: HandCoins,
          permissionId: 'report:savings:teller',
        },
      ],
    },
    {
      category: 'Financial Reports',
      reports: [
        {
          title: 'Trial Balance',
          description: 'The master list of all General Ledger accounts with their debit and credit balances.',
          href: '/staff/reports/financial/trial-balance',
          icon: Scale,
          permissionId: 'report:financial:trial-balance',
        },
        {
          title: 'Balance Sheet',
          description: "A snapshot of your institution's financial health, showing Assets, Liabilities, and Equity.",
          href: '/staff/reports/financial/balance-sheet',
          icon: Book,
          permissionId: 'report:financial:balance-sheet',
        },
        {
          title: 'Income Statement (P&L)',
          description: 'Summarizes revenues, expenses, and calculates the net profit or loss for a period.',
          href: '/staff/reports/financial/income-statement',
          icon: BarChart3,
          permissionId: 'report:financial:income-statement',
        },
        {
          title: 'General Ledger Report',
          description: 'A detailed, transaction-by-transaction audit trail for any GL account.',
          href: '/staff/reports/financial/general-ledger',
          icon: FileText,
          permissionId: 'report:financial:general-ledger',
        },
        {
          title: 'Cash Flow Report',
          description: 'Tracks the movement of cash from operating, investing, and financing activities.',
          href: '/staff/reports/financial/cash-flow',
          icon: ArrowRightLeft,
          permissionId: 'report:financial:cash-flow',
        },
      ],
    },
    {
      category: 'Customer & Compliance Reports',
      reports: [
        {
          title: 'Customer List Report',
          description: 'A full KYC summary of all customers.',
          href: '/staff/reports/customer/customer-list',
          icon: Users,
          permissionId: 'report:customer:list',
        },
        {
          title: 'Collateral Register',
          description: 'A detailed list of all assets pledged as security for loans.',
          href: '/staff/reports/customer/collateral-register',
          icon: ShieldCheck,
          permissionId: 'report:customer:collateral',
        },
        {
          title: 'Guarantor Register',
          description: 'A register of all individuals who have guaranteed loans.',
          href: '/staff/reports/customer/guarantor-register',
          icon: UserCheck,
          permissionId: 'report:customer:guarantor',
        },
        {
          title: 'Document Compliance Report',
          description: 'Flags customers with missing or expired ID documents to ensure KYC compliance.',
          href: '/staff/reports/customer/document-compliance',
          icon: ClipboardList,
          permissionId: 'report:customer:compliance',
        },
      ],
    },
    {
      category: 'Operational Reports',
      reports: [
        {
          title: 'Branch Performance Report',
          description: 'Compares key metrics like disbursements and PAR across all branches.',
          href: '/staff/reports/operational/branch-performance',
          icon: Building,
          permissionId: 'report:operational:branch',
        },
        {
          title: 'User Activity & Audit Trail',
          description: 'A log of all significant staff actions, such as approvals and record changes.',
          href: '/staff/reports/operational/audit-trail',
          icon: FileSearch,
          permissionId: 'report:operational:audit',
        },
        {
          title: 'End-of-Day Reports',
          description: 'Summaries of the daily closing process, including teller balancing and system-wide transactions.',
          href: '/staff/reports/operational/eod-reports',
          icon: CandlestickChart,
          permissionId: 'report:operational:eod',
        },
      ],
    },
    {
      category: 'Inventory Reports',
      reports: [
        {
          title: "Stock on Hand Report",
          description: "A real-time snapshot of current inventory levels across all locations.",
          icon: List,
          href: "/staff/inventory/reports/stock-on-hand",
          permissionId: 'report:inventory:stock'
        },
        {
          title: "Inventory Movement Report",
          description: "A detailed audit trail of all inventory movements.",
          icon: History,
          href: "/staff/inventory/reports/inventory-movement",
          permissionId: 'report:inventory:movement'
        },
        {
          title: "Low Stock Alerts",
          description: "Lists all items that have fallen below their configured reorder level.",
          icon: AlertTriangle,
          href: "/staff/inventory/reports/low-stock",
          permissionId: 'report:inventory:low-stock'
        },
        {
          title: "Asset Register",
          description: "A complete register of all fixed assets owned by the institution.",
          icon: ClipboardList,
          href: "/staff/inventory/reports/asset-register",
          permissionId: 'report:inventory:assets'
        },
        {
          title: "Purchase Order Status Report",
          description: "Track the status of all purchase orders sent to suppliers.",
          icon: Receipt,
          href: "/staff/inventory/reports/po-status",
          permissionId: 'report:inventory:procurement:po'
        },
        {
          title: "Goods Received Report",
          description: "View a log of all goods received from suppliers against purchase orders.",
          icon: FileCheck,
          href: "/staff/inventory/reports/grn-report",
          permissionId: 'report:inventory:procurement:grn'
        },
      ],
    },
    {
      category: 'Administrative Reports',
      reports: [
        {
          title: 'Data Quality Report',
          description: 'Identifies customer profiles with incomplete information.',
          href: '/staff/reports/admin/data-quality',
          icon: DatabaseZap,
          permissionId: 'report:admin:quality',
        },
        {
          title: 'Role & Permission Audit',
          description: 'An overview of all configured roles and their assigned user counts.',
          href: '/staff/reports/admin/role-audit',
          icon: KeySquare,
          permissionId: 'report:admin:roles',
        },
        {
          title: 'System Errors & Process Failures',
          description: 'Logs any technical errors that occur in the system.',
          href: '/staff/reports/admin/system-errors',
          icon: AlertTriangle,
          permissionId: 'report:admin:errors',
        },
      ],
    },
  ];
  
