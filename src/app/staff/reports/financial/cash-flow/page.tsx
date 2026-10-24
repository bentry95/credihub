
'use client';

import { useState, useMemo, useEffect } from 'react';
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
  TableFooter,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Download, Book, Calendar, FileWarning, ArrowUp, ArrowDown } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import Papa from 'papaparse';
import { format } from 'date-fns';

interface FlowItem {
  description: string;
  amount: number;
}

interface FlowCategory {
  title: string;
  items: FlowItem[];
  total: number;
}

export default function CashFlowReportPage() {
    const { user } = useUser();
    const firestore = useFirestore();

    const userDocRef = useMemoFirebase(
      () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
      [firestore, user]
    );
    const { data: userData } = useDoc(userDocRef);

    const coaQuery = useMemoFirebase(
        () => (firestore && userData?.institutionId ? collection(firestore, 'institutions', userData.institutionId, 'chartOfAccounts') : null),
        [firestore, userData]
    );
    const { data: accounts, isLoading: isCoaLoading } = useCollection(coaQuery);

    const journalsQuery = useMemoFirebase(
        () => (firestore && userData?.institutionId ? query(collection(firestore, 'institutions', userData.institutionId, 'journals'), where('status', '==', 'Posted')) : null),
        [firestore, userData]
    );
    const { data: journals, isLoading: isJournalsLoading } = useCollection(journalsQuery);
    
    const { cashFlowData, netCashFlow } = useMemo(() => {
        if (!accounts || !journals) return { cashFlowData: [], netCashFlow: 0 };
        
        const cashAccountIds = new Set(accounts.filter(a => a.accountType === 'Asset' && (a.glCode.startsWith('11') || a.glCode.startsWith('12') || a.glCode.startsWith('13'))).map(a => a.id));

        const operatingInflows: FlowItem[] = [];
        const operatingOutflows: FlowItem[] = [];
        const financingInflows: FlowItem[] = [];
        const financingOutflows: FlowItem[] = [];
        const investingInflows: FlowItem[] = [];
        const investingOutflows: FlowItem[] = [];

        journals.forEach(journal => {
            const cashTransaction = journal.transactions.find((t: any) => cashAccountIds.has(t.accountId));
            if (!cashTransaction) return;

            const cashAmount = (cashTransaction.debit || 0) - (cashTransaction.credit || 0);

            journal.transactions.forEach((t: any) => {
                if (cashAccountIds.has(t.accountId)) return;

                const account = accounts.find(a => a.id === t.accountId);
                if (!account) return;
                
                const item = { description: journal.description, amount: Math.abs(cashAmount) };

                if (account.accountType === 'Income') operatingInflows.push(item);
                if (account.accountType === 'Expense') operatingOutflows.push(item);
                if (account.accountType === 'Liability') financingInflows.push(item);
                // Loan disbursement is a financing outflow
                if (account.accountType === 'Asset' && account.glCode.startsWith('15')) financingOutflows.push(item);
                 // Investing activities simplified
                if (account.accountType === 'Asset' && account.glCode.startsWith('16')) investingOutflows.push(item);
            });
        });
        
        const totalOpInflows = operatingInflows.reduce((sum, item) => sum + item.amount, 0);
        const totalOpOutflows = operatingOutflows.reduce((sum, item) => sum + item.amount, 0);
        const totalFinInflows = financingInflows.reduce((sum, item) => sum + item.amount, 0);
        const totalFinOutflows = financingOutflows.reduce((sum, item) => sum + item.amount, 0);
        const totalInvInflows = investingInflows.reduce((sum, item) => sum + item.amount, 0);
        const totalInvOutflows = investingOutflows.reduce((sum, item) => sum + item.amount, 0);

        const netOperating = totalOpInflows - totalOpOutflows;
        const netFinancing = totalFinInflows - totalFinOutflows;
        const netInvesting = totalInvInflows - totalInvOutflows;
        
        const cashFlowData: FlowCategory[] = [
            { title: "Cash Flow from Operating Activities", items: [...operatingInflows, ...operatingOutflows.map(o => ({...o, amount: -o.amount}))], total: netOperating },
            { title: "Cash Flow from Investing Activities", items: [...investingInflows, ...investingOutflows.map(o => ({...o, amount: -o.amount}))], total: netInvesting },
            { title: "Cash Flow from Financing Activities", items: [...financingInflows, ...financingOutflows.map(o => ({...o, amount: -o.amount}))], total: netFinancing },
        ];

        return { cashFlowData, netCashFlow: netOperating + netInvesting + netFinancing };

    }, [accounts, journals]);


     const handleExport = () => {
        // Implement CSV export logic here
    };
    
    const isLoading = isCoaLoading || isJournalsLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cash Flow Statement</h1>
          <p className="text-muted-foreground mt-1">
            Tracks the movement of cash from operating, investing, and financing activities.
          </p>
        </div>
         <div className="flex items-center gap-2">
            <Button variant="outline"><Calendar className="mr-2 h-4 w-4" /> As of: Today</Button>
            <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4" /> Export</Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Statement of Cash Flows</CardTitle>
          <CardDescription>
            This report summarizes the sources and uses of cash for the period.
          </CardDescription>
        </CardHeader>
        <CardContent>
            {isLoading ? <Skeleton className="h-96 w-full" /> : 
                <div className="space-y-8">
                    {cashFlowData.map((section) => (
                        section.items.length > 0 && (
                            <div key={section.title}>
                            <h3 className="text-lg font-semibold mb-2 border-b pb-2">{section.title}</h3>
                            <Table>
                                <TableBody>
                                {section.items.map((item, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="pl-4">{item.description}</TableCell>
                                        <TableCell className="text-right font-mono">{item.amount.toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                                </TableBody>
                                <TableFooter>
                                <TableRow>
                                    <TableCell className="font-bold">Net Cash from {section.title.split('from ')[1]}</TableCell>
                                    <TableCell className="text-right font-bold font-mono">{section.total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
                                </TableRow>
                                </TableFooter>
                            </Table>
                            </div>
                        )
                    ))}

                    <div className="border-t-2 border-primary pt-4 mt-8">
                        <div className="flex justify-between items-center text-xl font-bold">
                            <span>Net Increase / (Decrease) in Cash</span>
                            <span className="font-mono">{netCashFlow.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                        </div>
                    </div>
                </div>
            }
        </CardContent>
      </Card>
    </div>
  );
}
