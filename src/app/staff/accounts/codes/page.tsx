
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BookCopy, Users } from 'lucide-react';

export default function AccountCodesPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Account Codes Guide</h1>
        <p className="text-muted-foreground mt-1">
          A read-only reference for your institution's General Ledger account code structure.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Understanding Account Codes</CardTitle>
          <CardDescription>
            A reference guide to the standard accounting structure.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <Card>
                <CardHeader>
                <div className="flex items-start gap-4">
                    <div className="bg-muted p-3 rounded-lg">
                        <BookCopy className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                        <CardTitle className="text-xl">Office Accounts (General Ledger)</CardTitle>
                        <CardDescription>
                        The 4-digit codes for your institution's internal accounts.
                        </CardDescription>
                    </div>
                </div>
                </CardHeader>
                <CardContent>
                <p className="text-muted-foreground mb-4">
                    Each General Ledger account is assigned a unique 4-digit code. The first digit signifies the major account type, ensuring a structured and organized Chart of Accounts.
                </p>
                <div className="border rounded-lg">
                    <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead className="w-1/3">Account Type</TableHead>
                        <TableHead className="w-1/3">Code Range</TableHead>
                        <TableHead>Description</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow>
                        <TableCell className="font-medium">Assets</TableCell>
                        <TableCell className="font-mono">1000 - 1999</TableCell>
                        <TableCell>What the institution owns (e.g., Cash, Loans, Equipment).</TableCell>
                        </TableRow>
                        <TableRow>
                        <TableCell className="font-medium">Liabilities</TableCell>
                        <TableCell className="font-mono">2000 - 2999</TableCell>
                        <TableCell>What the institution owes (e.g., Member Deposits, External Loans).</TableCell>
                        </TableRow>
                        <TableRow>
                        <TableCell className="font-medium">Equity</TableCell>
                        <TableCell className="font-mono">3000 - 3999</TableCell>
                        <TableCell>The net worth of the institution (e.g., Member Shares, Retained Earnings).</TableCell>
                        </TableRow>
                        <TableRow>
                        <TableCell className="font-medium">Income</TableCell>
                        <TableCell className="font-mono">4000 - 4999</TableCell>
                        <TableCell>Revenue earned by the institution (e.g., Interest on Loans, Fees).</TableCell>
                        </TableRow>
                        <TableRow>
                        <TableCell className="font-medium">Expenses</TableCell>
                        <TableCell className="font-mono">5000 - 5999</TableCell>
                        <TableCell>Costs incurred by the institution (e.g., Salaries, Rent).</TableCell>
                        </TableRow>
                    </TableBody>
                    </Table>
                </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                <div className="flex items-start gap-4">
                    <div className="bg-muted p-3 rounded-lg">
                        <Users className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                        <CardTitle className="text-xl">Customer Accounts</CardTitle>
                        <CardDescription>
                            How individual accounts for your members and clients are handled by the system.
                        </CardDescription>
                    </div>
                </div>
                </CardHeader>
                <CardContent>
                <div className="space-y-4 text-muted-foreground">
                    <p>
                    Unlike internal GL accounts, customer accounts are generated
                    automatically by the system to ensure uniqueness and prevent manual
                    errors.
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                    <li>
                        <span className="font-semibold text-foreground">
                        Main Account Number:
                        </span>{' '}
                        When a new customer is created, the system generates a unique account number (e.g., <code className="font-mono bg-muted px-1.5 py-0.5 rounded">
                        USCUS000001
                        </code>). This number serves as their primary identifier across the entire
                        platform.
                    </li>
                    <li>
                        <span className="font-semibold text-foreground">
                        Product Sub-Accounts:
                        </span>{' '}
                        Each specific product a customer uses (e.g., a "Personal Loan"
                        or a "Regular Savings" account) is given its own unique account
                        number. This sub-account is always linked back to the
                        customer's main system account number, allowing for a complete
                        360-degree view of their portfolio.
                    </li>
                    </ul>
                </div>
                </CardContent>
            </Card>
        </CardContent>
      </Card>
    </div>
  );
}
