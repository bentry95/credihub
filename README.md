# CrediHub: All-in-One Core Banking Platform

CrediHub is a core banking platform designed for Savings and Credit Co-operative Organisations (SACCOs) and Microfinance Institutions (MFIs). It brings together customer onboarding, financial operations, and reporting in one system.

## Key modules

### Customer management (KYC)

- **360-degree customer view:** Maintain personal, contact, financial, and account history details.
- **Secure onboarding:** Use a multi-step workflow with live photo capture and document management.
- **Group management:** Support VSLAs and other solidarity groups with role-based member assignment.
- **Compliance alerts:** Track expiring identity documents and missing information.

### Loan management

- **Origination and appraisal:** Configure application steps and track collateral and guarantors.
- **Workflow controls:** Apply maker-checker controls to appraisals and approvals.
- **Loan actions:** Support top-ups (refinancing), rescheduling, reversals, and write-offs.
- **Portfolio analytics:** Track Gross Loan Portfolio and Portfolio at Risk (PAR).

### Savings and shares

- **Product configuration:** Define flexible, recurring, and fixed-term savings products with custom interest rules.
- **Dividend management:** Manage share capital and dividend eligibility for SACCOs.
- **Automatic recovery:** Link savings accounts for automated loan repayment recovery.

### Financial accounting (GL)

- **Chart of accounts:** Use a standardized COA template with automated posting from sub-ledgers.
- **Journal management:** Create manual journal entries with supervisory approval.
- **Financial reporting:** Generate trial balances, balance sheets, income statements (P&L), and cash flow statements.
- **Period control:** Run end-of-day (EOD) processing and manage financial years.

### Teller and cash operations

- **Till management:** Manage teller opening and closing floats and transaction limits.
- **Vault control:** Handle cash pushes and requisitions between tellers and the Chief Cashier.
- **Receipts:** Generate receipts for cash transactions, with print and save options.

### Payroll and inventory

- **Payroll engine:** Manage salary structures, statutory deductions (PAYE and pension), and loan-linked salary deductions.
- **Inventory control:** Track consumables, loanable items for asset financing, and fixed assets.

## Security and administration

- **Invite-only onboarding:** Let administrators generate secure, one-time invitation codes for new staff.
- **Role-based access control (RBAC):** Define roles and assign module-specific permissions.
- **Maker-checker controls:** Require dual control for sensitive operations such as loan approvals and reversals.
- **Audit trail:** Log significant user actions for accountability and compliance.
- **Session management:** Configure inactivity timeouts to protect sensitive data.
- **Password policy:** Institution administrators can set a minimum password length and require uppercase letters, numbers, or symbols for staff onboarding.
- **Email notifications:** Staff invitations and loan application stage changes are delivered through the configured SMTP server.

### Configure SMTP for Firebase Functions

SMTP credentials are stored as Firebase Functions secrets and are never written to Firestore or exposed to the browser. From the project root, set the five values below (Firebase prompts for each secret):

```sh
firebase functions:secrets:set SMTP_HOST
firebase functions:secrets:set SMTP_PORT
firebase functions:secrets:set SMTP_USER
firebase functions:secrets:set SMTP_PASSWORD
firebase functions:secrets:set SMTP_FROM
npm run deploy:functions
```

Use port `587` for STARTTLS or `465` for implicit TLS. `SMTP_FROM` should be a verified sender address such as `CrediHub <no-reply@example.com>`. The invitation page can email a generated code when an invitee address is entered. Loan stage emails are sent when a loan application's status changes and the linked customer has an email address.

## Technology stack

- **Frontend:** Next.js (App Router), React, Tailwind CSS, and shadcn/ui
- **Backend:** Firebase (Firestore, Authentication, and Storage)
- **State management:** React Context for branch- and teller-specific state
- **Utilities:** date-fns, Zod, and Recharts

---

© 2024 Yangazu Incorporated · Enterprise Financial Solutions
