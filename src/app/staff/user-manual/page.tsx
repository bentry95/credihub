
'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { BookUser, LayoutDashboard, ListChecks, ArrowRight, Search, FilePlus2, Landmark, Users, Gavel, Wallet, FileText, AppWindow, CreditCard, Settings, HandCoins } from "lucide-react";

export default function UserManualPage() {
  return (
    <div className="space-y-8">
       <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Manual</h1>
          <p className="text-muted-foreground mt-1">
            A comprehensive guide to using the CrediHub platform.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6" />
            The Dashboard
          </CardTitle>
          <CardDescription>
            The dashboard is your main landing page after signing in. It provides a real-time overview of your tasks and gives you quick access to common actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                    <h3 className="font-semibold mb-2">Key Components</h3>
                    <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
                        <li><strong>Branch Switcher:</strong> If you are assigned to multiple branches, you can switch your view to see data for a specific branch or all branches combined.</li>
                        <li><strong>System Date:</strong> Displays the current operational date for the entire institution, which is advanced by the End-of-Day process.</li>
                        <li><strong>My Tasks:</strong> A dynamic list of items assigned to you or requiring your attention.</li>
                        <li><strong>Quick Actions:</strong> Shortcuts to the most frequently performed actions in the system.</li>
                        <li><strong>Recent Activity:</strong> A feed of your most recent actions, such as submitting an application or approving a transaction.</li>
                    </ul>
                </div>
                <div className="p-4 bg-muted rounded-md">
                    <h4 className="font-semibold mb-2 text-center">My Tasks</h4>
                    <p className="text-xs text-muted-foreground text-center mb-4">This section highlights pending items. Each task has a counter and a button to take you directly to the relevant page.</p>
                     <Accordion type="single" collapsible className="w-full bg-background rounded-md px-4">
                        <AccordionItem value="item-1">
                            <AccordionTrigger>
                                <div className="flex items-center gap-2">
                                    <FilePlus2 className="h-4 w-4" /> New Applications
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                A count of newly submitted loan applications from your branch that are ready to be assigned for appraisal.
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="item-2">
                             <AccordionTrigger>
                                <div className="flex items-center gap-2">
                                    <ListChecks className="h-4 w-4" /> My Appraisals
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                Loan applications that have been assigned specifically to you for appraisal.
                            </AccordionContent>
                        </AccordionItem>
                         <AccordionItem value="item-3">
                             <AccordionTrigger>
                                <div className="flex items-center gap-2">
                                    <ListChecks className="h-4 w-4" /> Pending Approvals
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                Appraised loans that are now waiting for final approval from a user with the appropriate permissions.
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>
            </div>
             <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Quick Actions</CardTitle>
                    <CardDescription>Shortcuts to start common workflows immediately.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card className="p-4 flex flex-col items-center justify-center text-center">
                        <Landmark className="h-8 w-8 text-primary mb-2" />
                        <h4 className="font-semibold">New Loan Application</h4>
                        <p className="text-xs text-muted-foreground">Start the loan origination process for a new or existing customer.</p>
                    </Card>
                     <Card className="p-4 flex flex-col items-center justify-center text-center">
                        <Users className="h-8 w-8 text-primary mb-2" />
                        <h4 className="font-semibold">New Customer</h4>
                        <p className="text-xs text-muted-foreground">Onboard a new individual or group customer by filling out their KYC details.</p>
                    </Card>
                     <Card className="p-4 flex flex-col items-center justify-center text-center">
                        <Search className="h-8 w-8 text-primary mb-2" />
                        <h4 className="font-semibold">Search Customer</h4>
                        <p className="text-xs text-muted-foreground">Quickly find a customer's 360° profile by searching their name, ID, or account number.</p>
                    </Card>
                </CardContent>
            </Card>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-6 w-6" />
            Customers Module
          </CardTitle>
          <CardDescription>
            This module contains all functionalities related to customer relationship management, from onboarding to account maintenance.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <Accordion type="multiple" className="w-full space-y-2">
                <AccordionItem value="all-customers">
                    <AccordionTrigger>All Customers</AccordionTrigger>
                    <AccordionContent>View a complete, searchable directory of every customer in your institution. From this master list, you can initiate a new loan application or access a customer's detailed profile.</AccordionContent>
                </AccordionItem>
                <AccordionItem value="enquiry">
                    <AccordionTrigger>Customer Enquiry (360° View)</AccordionTrigger>
                    <AccordionContent>Search for a specific customer to see a comprehensive dashboard of their personal information, contact details, financial profile, active loans, and savings accounts. This provides a complete overview of the customer's relationship with the institution.</AccordionContent>
                </AccordionItem>
                 <AccordionItem value="new-customer">
                    <AccordionTrigger>Add New Customer</AccordionTrigger>
                    <AccordionContent>Use the multi-step form to onboard new individual customers. This workflow guides you through capturing KYC details, contact information, financial profiles, and system-specific settings. You can also capture a live photo using your device's camera.</AccordionContent>
                </AccordionItem>
                 <AccordionItem value="unfinalised">
                    <AccordionTrigger>Unfinalised Onboarding</AccordionTrigger>
                    <AccordionContent>This queue holds customer applications that were saved as drafts or failed automatic processing (e.g., due to a duplicate ID number). You can review these entries, correct any issues, and finalize the customer creation process.</AccordionContent>
                </AccordionItem>
                 <AccordionItem value="statements">
                    <AccordionTrigger>Customer Statements</AccordionTrigger>
                    <AccordionContent>Generate and print detailed statements for any of a customer's loan or savings accounts for a specified date range.</AccordionContent>
                </AccordionItem>
                 <AccordionItem value="groups">
                    <AccordionTrigger>Manage Groups</AccordionTrigger>
                    <AccordionContent>Create and manage customer groups, such as VSLAs. You can form a new group, add existing individual customers as members, and assign roles like Chairperson, Secretary, and Treasurer.</AccordionContent>
                </AccordionItem>
                <AccordionItem value="kyc-alerts">
                    <AccordionTrigger>KYC Alerts</AccordionTrigger>
                    <AccordionContent>A proactive compliance report that automatically flags customers whose identification documents have expired or will expire soon, as well as those with incomplete KYC information. This helps ensure your records remain up-to-date.</AccordionContent>
                </AccordionItem>
            </Accordion>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-6 w-6" />
            Loans Module
          </CardTitle>
          <CardDescription>
            Handles the entire loan lifecycle from application and appraisal to disbursement and collections.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <Accordion type="multiple" className="w-full space-y-2">
                <AccordionItem value="loans-dashboard">
                    <AccordionTrigger>Loans Dashboard</AccordionTrigger>
                    <AccordionContent>Provides a high-level analytical overview of the entire loan portfolio, including key metrics like Gross Loan Portfolio, Portfolio at Risk (PAR), and new loans disbursed over time.</AccordionContent>
                </AccordionItem>
                <AccordionItem value="loan-calculator">
                    <AccordionTrigger>Loan Calculator</AccordionTrigger>
                    <AccordionContent>A powerful tool to generate loan quotations and detailed amortization schedules. You can calculate based on an existing loan product or enter parameters manually for what-if analysis.</AccordionContent>
                </AccordionItem>
                <AccordionItem value="all-applications">
                    <AccordionTrigger>All Applications</AccordionTrigger>
                    <AccordionContent>The master list for every loan application in the system, regardless of its current status. This is the central hub for tracking the progress of all loans.</AccordionContent>
                </AccordionItem>
                <AccordionItem value="origination">
                    <AccordionTrigger>Start New Application</AccordionTrigger>
                    <AccordionContent>A multi-step workflow to create a new loan application for a customer. It guides you through selecting the customer, adding collateral or guarantors, uploading documents, and specifying the loan details.</AccordionContent>
                </AccordionItem>
                 <AccordionItem value="appraisal">
                    <AccordionTrigger>Loan Appraisal</AccordionTrigger>
                    <AccordionContent>Review loan applications assigned to you. Assess customer financials, collateral, and compliance, then make a recommendation to approve or reject the loan before sending it to the next stage.</AccordionContent>
                </AccordionItem>
                <AccordionItem value="approvals">
                    <AccordionTrigger>Approvals</AccordionTrigger>
                    <AccordionContent>This section contains several queues for supervisors to provide the final decision on various loan requests, including new applications, top-ups, reschedules, reversals, and write-offs. This is the "checker" step in the dual control process.</AccordionContent>
                </AccordionItem>
                <AccordionItem value="reschedule">
                    <AccordionTrigger>Reschedule & Top-Up</AccordionTrigger>
                    <AccordionContent>Allows you to modify the terms of an existing active loan (Reschedule) or add new funds to it (Top-Up). Both actions create a new, consolidated loan application that goes through the approval workflow.</AccordionContent>
                </AccordionItem>
                <AccordionItem value="reversal-writeoff">
                    <AccordionTrigger>Reversal & Write-Off</AccordionTrigger>
                    <AccordionContent>Initiate requests to either reverse a disbursed loan (e.g., if funds were sent in error) or write-off a loan that has been deemed uncollectible. Both actions require supervisory approval.</AccordionContent>
                </AccordionItem>
            </Accordion>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-6 w-6" />
            Accounts Module
          </CardTitle>
          <CardDescription>
            Core accounting functions, including General Ledger management, journal entries, and disbursements.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <Accordion type="multiple" className="w-full space-y-2">
                <AccordionItem value="acct-dashboard">
                    <AccordionTrigger>Accounts Dashboard</AccordionTrigger>
                    <AccordionContent>View a real-time summary of your institution's key financial indicators, including Total Assets, Liabilities, Equity, and Net Profit/Loss.</AccordionContent>
                </AccordionItem>
                <AccordionItem value="acct-codes">
                    <AccordionTrigger>Account Codes Guide</AccordionTrigger>
                    <AccordionContent>A reference guide explaining the standard accounting structure, including GL code ranges for office accounts and how customer sub-accounts are managed.</AccordionContent>
                </AccordionItem>
                 <AccordionItem value="acct-statements">
                    <AccordionTrigger>GL Account Statements</AccordionTrigger>
                    <AccordionContent>Generate and print detailed transaction logs (statements) for any General Ledger account for a specific period.</AccordionContent>
                </AccordionItem>
                 <AccordionItem value="coa">
                    <AccordionTrigger>Chart of Accounts</AccordionTrigger>
                    <AccordionContent>View and manage your institution's General Ledger. You can create new accounts, but system-critical accounts are non-editable.</AccordionContent>
                </AccordionItem>
                 <AccordionItem value="financial-year">
                    <AccordionTrigger>Financial Year</AccordionTrigger>
                    <AccordionContent>Define and close your accounting periods. Only one financial year can be open at a time, and this function can only be accessed from the HQ branch.</AccordionContent>
                </AccordionItem>
                <AccordionItem value="journal-vouchers">
                    <AccordionTrigger>Journal Vouchers</AccordionTrigger>
                    <AccordionContent>Create manual double-entry journal vouchers to record financial transactions. Entries are submitted to an approval queue for a supervisor to post.</AccordionContent>
                </AccordionItem>
                <AccordionItem value="loan-disbursement">
                    <AccordionTrigger>Loan Disbursement</AccordionTrigger>
                    <AccordionContent>The queue for all approved loans waiting to be funded. From here, you can select the disbursement method (e.g., Bank, Teller) and process the payment, which automatically creates the necessary accounting entries.</AccordionContent>
                </AccordionItem>
                 <AccordionItem value="reversals">
                    <AccordionTrigger>Transaction Reversals</AccordionTrigger>
                    <AccordionContent>Initiate and approve requests to reverse posted journal entries, for example, in case of an error. This requires supervisory approval.</AccordionContent>
                </AccordionItem>
            </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HandCoins className="h-6 w-6" />
            Tellers Module
          </CardTitle>
          <CardDescription>
            This module is for managing cash operations, including deposits, withdrawals, and teller balancing.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <Accordion type="multiple" className="w-full space-y-2">
                <AccordionItem value="teller-dashboard">
                    <AccordionTrigger>Teller Dashboards</AccordionTrigger>
                    <AccordionContent>The dashboard provides a real-time overview of a teller's till, including current balance, transaction summaries, and quick access to start or end the day. Chief Cashiers get a consolidated view of all tellers.</AccordionContent>
                </AccordionItem>
                <AccordionItem value="teller-transactions">
                    <AccordionTrigger>Cash Transactions</AccordionTrigger>
                    <AccordionContent>Process customer transactions including Cash Deposits into savings accounts, Loan Repayments, and Cash Withdrawals. You can also record bank deposits made by customers via the Direct Receipt function.</AccordionContent>
                </AccordionItem>
                 <AccordionItem value="teller-cash-management">
                    <AccordionTrigger>Till & Vault Management</AccordionTrigger>
                    <AccordionContent>Tellers can request additional funds from the vault using Cash Requisition or return excess cash using Cash to Treasury. Chief Cashiers can approve these requests and also push cash directly to a teller's till.</AccordionContent>
                </AccordionItem>
                 <AccordionItem value="teller-payouts">
                    <AccordionTrigger>Loan Payouts</AccordionTrigger>
                    <AccordionContent>After a loan is funded, it may be assigned to a teller for cash payout. Chief cashiers assign these payouts, and regular tellers execute them from the "Cash Withdrawal & Payouts" screen.</AccordionContent>
                </AccordionItem>
                 <AccordionItem value="teller-eod">
                    <AccordionTrigger>End of Day for Tellers</AccordionTrigger>
                    <AccordionContent>At the end of each day, tellers must balance their physical cash with the system's expected balance and submit an End of Day (EOD) report. This report must be approved by a supervisor before the main system EOD process can be run.</AccordionContent>
                </AccordionItem>
            </Accordion>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Reports Module
          </CardTitle>
          <CardDescription>
            Your central hub for business intelligence and data analysis.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <Accordion type="multiple" className="w-full space-y-2">
                <AccordionItem value="report-loan">
                    <AccordionTrigger>Loan Reports</AccordionTrigger>
                    <AccordionContent>Generate detailed reports on your loan portfolio, including disbursement logs, repayment tracking, arrears analysis, and loan officer performance.</AccordionContent>
                </AccordionItem>
                <AccordionItem value="report-savings">
                    <AccordionTrigger>Savings & Cash Reports</AccordionTrigger>
                    <AccordionContent>Analyze savings product performance, view customer balances, and track teller transactions.</AccordionContent>
                </AccordionItem>
                 <AccordionItem value="report-financial">
                    <AccordionTrigger>Financial Reports</AccordionTrigger>
                    <AccordionContent>Access key financial statements such as the Trial Balance, Balance Sheet, and Income Statement (P&L) for a complete picture of the institution's financial health.</AccordionContent>
                </AccordionItem>
                 <AccordionItem value="report-customer">
                    <AccordionTrigger>Customer & Compliance Reports</AccordionTrigger>
                    <AccordionContent>Generate KYC reports, collateral registers, and other compliance-related documents.</AccordionContent>
                </AccordionItem>
            </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AppWindow className="h-6 w-6" />
            Applications Module
          </CardTitle>
          <CardDescription>
            System-wide operational tools and utilities.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <Accordion type="multiple" className="w-full space-y-2">
                <AccordionItem value="eod">
                    <AccordionTrigger>End-of-Day</AccordionTrigger>
                    <AccordionContent>The End-of-Day (EOD) process is a critical daily procedure that closes the current business day and prepares the system for the next. It automates tasks like interest accrual, penalty application, and advances the system date. This process ensures all financial calculations are up-to-date.</AccordionContent>
                </AccordionItem>
                <AccordionItem value="bulk-upload">
                    <AccordionTrigger>Bulk Upload</AccordionTrigger>
                    <AccordionContent>The Bulk Upload feature allows you to migrate existing data into the platform efficiently using CSV templates. You can bulk-create loan products, onboard customers, and import historical loan records. This is essential for initial system setup and data migration projects.</AccordionContent>
                </AccordionItem>
            </Accordion>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-6 w-6" />
            Subscription Module
          </CardTitle>
          <CardDescription>
            Manage your institution's subscription, view billing history, and process payments.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
                <li><strong>Billing Dashboard:</strong> View your current month's estimated commission, total disbursed loan value, and other key billing metrics.</li>
                <li><strong>Invoice History:</strong> Access and download all past monthly invoices for your records.</li>
                <li><strong>Make Payment:</strong> Record a payment made towards an outstanding invoice. Payments are submitted for confirmation by the platform administrators.</li>
                <li><strong>Invoice Generation:</strong> Manually generate or rebuild an invoice for a specific period, which is useful for previews or after correcting historical data.</li>
            </ul>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Settings Module
          </CardTitle>
          <CardDescription>
            Your control panel for configuring how your institution operates on the platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <Accordion type="multiple" className="w-full space-y-2">
                <AccordionItem value="settings-general">
                    <AccordionTrigger>General Settings</AccordionTrigger>
                    <AccordionContent>Manage your institution's core details (Profile), create and manage staff accounts (Users), configure system security like session timeouts (Security), and define your branch network (Branches).</AccordionContent>
                </AccordionItem>
                <AccordionItem value="settings-products">
                    <AccordionTrigger>Product & Service Configuration</AccordionTrigger>
                    <AccordionContent>Define all the financial products you offer, including Loan Products, Savings Products, and Share Products. You can also create a central library of all possible Fees & Charges and configure rules for Penalties on overdue loans.</AccordionContent>
                </AccordionItem>
                 <AccordionItem value="settings-financial">
                    <AccordionTrigger>Financial Management</AccordionTrigger>
                    <AccordionContent>Set the rules for Loan Loss Provisioning, which determines how the system automatically provisions for potential bad debt based on Portfolio at Risk (PAR) buckets.</AccordionContent>
                </AccordionItem>
                 <AccordionItem value="settings-controls">
                    <AccordionTrigger>System & Security Controls</AccordionTrigger>
                    <AccordionContent>This section is for administrators to manage internal controls. Define staff Roles & Permissions, control which roles can see which reports with Report Permissions, enable or disable dual control with Maker-Checker settings, and set up your tellers, their tills, and transaction limits under Tellering.</AccordionContent>
                </AccordionItem>
            </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
