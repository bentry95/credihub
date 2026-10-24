
import { reportsConfig } from "./reports";

// Flatten all reports into a single array for easier permission management
const allReportPermissions = reportsConfig.flatMap(category => 
  category.reports.map(report => ({
    id: report.permissionId,
    label: `Report: ${report.title}`
  }))
);

export const permissionsConfig = [
    {
      id: 'customers',
      label: 'Customers Module',
      permissions: [
        { id: 'customer:read', label: 'View Customer Details & Enquiries' },
        { id: 'customer:create', label: 'Create New Customers & Groups' },
        { id: 'customer:update', label: 'Edit Customer Information' },
        { id: 'customer:statement', label: 'Generate Customer Statements' },
        { id: 'customer:exit', label: 'Process Customer Exit' },
      ],
    },
    {
      id: 'loans',
      label: 'Loans Module',
      permissions: [
        { id: 'loan:read', label: 'View Loan Details & Dashboards' },
        { id: 'loan:create', label: 'Create New Loan Applications' },
        { id: 'loan:appraise', label: 'Appraise Loan Applications' },
        { id: 'loan:approve', label: 'Approve Loan Applications' },
        { id: 'loan:disburse', label: 'Disburse Approved Loans' },
        { id: 'loan:reschedule', label: 'Initiate Loan Reschedules & Top-Ups' },
        { id: 'loan:reversal', label: 'Request Loan Reversals' },
        { id: 'loan:write-off', label: 'Request Loan Write-Offs' },
      ],
    },
    {
      id: 'accounts',
      label: 'Accounts Module',
      permissions: [
        { id: 'account:read', label: 'View Accounts Dashboards & Ledgers' },
        { id: 'account:journal:create', label: 'Create Manual Journal Entries' },
        { id: 'account:journal:approve', label: 'Approve Manual Journal Entries' },
        { id: 'account:reversal', label: 'Request Transaction Reversals' },
        { id: 'account:eod', label: 'Run End-of-Day Process' },
      ],
    },
     {
      id: 'tellers',
      label: 'Tellers Module',
      permissions: [
        { id: 'teller:deposit', label: 'Process Deposits' },
        { id: 'teller:withdraw', label: 'Process Withdrawals & Payouts' },
        { id: 'teller:repayment', label: 'Process Loan Repayments' },
        { id: 'teller:requisition', label: 'Request/Send Cash' },
        { id: 'teller:eod', label: 'Manage End of Day for Till' },
      ],
    },
    {
      id: 'inventory',
      label: 'Inventory Module',
      permissions: [
        { id: 'inventory:read', label: 'View Inventory Items & Dashboard' },
        { id: 'inventory:config', label: 'Configure Inventory Settings (Categories, Warehouses)' },
        { id: 'inventory:stock:create', label: 'Make Stock Adjustments (Maker)' },
        { id: 'inventory:stock:approve', label: 'Approve Stock Adjustments (Checker)' },
        { id: 'inventory:procure:create', label: 'Create Purchase Orders (Maker)' },
        { id: 'inventory:procure:approve', label: 'Approve Purchase Orders (Checker)' },
        { id: 'inventory:loan', label: 'Manage Loan-Asset Integration' },
        { id: 'inventory:staff', label: 'Manage Staff-Issued Assets' },
      ],
    },
    {
        id: 'reports',
        label: 'Reports & Analytics',
        permissions: allReportPermissions,
    },
    {
      id: 'settings',
      label: 'Settings Module',
      permissions: [
        { id: 'setting:profile', label: 'Manage Institution Profile' },
        { id: 'setting:branches', label: 'Manage Branches' },
        { id: 'setting:users', label: 'Manage Staff Users' },
        { id: 'setting:roles', label: 'Manage Roles & Permissions' },
        { id: 'setting:products:loan', label: 'Manage Loan Products' },
        { id: 'setting:products:savings', label: 'Manage Savings Products' },
        { id: 'setting:fees', label: 'Manage Fees & Charges' },
        { id: 'setting:workflows', label: 'Manage Workflow Controls' },
        { id: 'setting:security', label: 'Manage Security Settings' },
      ],
    },
    {
      id: 'support',
      label: 'Support Module',
      permissions: [
        { id: 'support:read', label: 'View Support Tickets' },
        { id: 'support:create', label: 'Create Support Tickets' },
        { id: 'support:update', label: 'Reply to Support Tickets' },
      ],
    },
  ];
