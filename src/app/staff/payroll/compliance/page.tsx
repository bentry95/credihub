
'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, ShieldCheck, Settings } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function CompliancePage() {
  // Mock data for display purposes
  const taxBrackets = [
    { from: 0, to: 100000, rate: 0 },
    { from: 100001, to: 1000000, rate: 25 },
    { from: 1000001, to: 6000000, rate: 30 },
    { from: 6000001, to: 'Infinity', rate: 35 },
  ];

  const pensionRates = { employee: 5, employer: 10 };
  
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Statutory & Compliance</h1>
          <p className="text-muted-foreground mt-1">
            Manage tax, pension, and other statutory deduction rules.
          </p>
        </div>
        <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Compliance Reports
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <Card>
            <CardHeader>
                <CardTitle>Pay As You Earn (PAYE) Tax Rules</CardTitle>
                <CardDescription>
                    These are the current tax brackets used for payroll calculation.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>From (MWK)</TableHead>
                            <TableHead>To (MWK)</TableHead>
                            <TableHead className="text-right">Rate (%)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {taxBrackets.map((bracket, index) => (
                             <TableRow key={index}>
                                <TableCell>{bracket.from.toLocaleString()}</TableCell>
                                <TableCell>{typeof bracket.to === 'number' ? bracket.to.toLocaleString() : bracket.to}</TableCell>
                                <TableCell className="text-right">{bracket.rate}%</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle>Pension Contribution Rules</CardTitle>
                <CardDescription>
                    Contribution rates for employee and employer pension schemes.
                </CardDescription>
            </CardHeader>
             <CardContent className="space-y-4">
                <div className="flex justify-between items-center border p-4 rounded-md">
                    <span className="font-medium">Employee Contribution Rate</span>
                    <span className="text-xl font-bold">{pensionRates.employee}%</span>
                </div>
                 <div className="flex justify-between items-center border p-4 rounded-md">
                    <span className="font-medium">Employer Contribution Rate</span>
                    <span className="text-xl font-bold">{pensionRates.employer}%</span>
                </div>
                 <Button variant="outline" className="w-full" disabled>
                    <Settings className="mr-2 h-4 w-4" />
                    Configure Pension Rules (Coming Soon)
                </Button>
            </CardContent>
        </Card>
      </div>
       <Card>
            <CardHeader>
                <CardTitle>Other Statutory Deductions</CardTitle>
                <CardDescription>
                    Configure any other mandatory deductions. This feature is coming soon.
                </CardDescription>
            </CardHeader>
            <CardContent className="text-center py-12 text-muted-foreground">
                <p>Configuration for other statutory items will be available here.</p>
            </CardContent>
        </Card>
    </div>
  );
}
