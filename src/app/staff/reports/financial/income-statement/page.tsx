
'use client';

import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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
import { Download, BarChart3, Calendar } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import Papa from 'papaparse';
import { format } from 'date-fns';

interface AccountRow {
  glCode: string;
  accountName: string;
  balance: number;
}

interface StatementSection {
  title: string;
  accounts: AccountRow[];
  total: number;
}

export default function IncomeStatementReportPage() {
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
  
  const { incomeStatement, totalIncome, totalExpenses, netProfitLoss } = useMemo(() => {
    if (!accounts || !journals) return { incomeStatement: [], totalIncome: 0, totalExpenses: 0, netProfitLoss: 0 };

    const accountBalances = new Map<string, number>();
    accounts.forEach(acc => accountBalances.set(acc.id, 0));

    journals.forEach(journal => {
        journal.transactions.forEach((transaction: any) => {
            const account = accounts.find(a => a.id === transaction.accountId);
            if (account && (account.accountType === 'Income' || account.accountType === 'Expense')) {
                const currentBalance = accountBalances.get(transaction.accountId) || 0;
                let newBalance = currentBalance;
                
                const debit = transaction.debit || 0;
                const credit = transaction.credit || 0;

                if (account.accountType === 'Income') {
                    newBalance += (credit - debit);
                } else if (account.accountType === 'Expense') {
                    newBalance += (debit - credit);
                }
                accountBalances.set(transaction.accountId, newBalance);
            }
        });
    });

    const incomeAccounts = accounts.filter(acc => acc.accountType === 'Income');
    const expenseAccounts = accounts.filter(acc => acc.accountType === 'Expense');
    
    let totalIncome = 0;
    const incomeData = incomeAccounts.map(acc => {
        const balance = accountBalances.get(acc.id) || 0;
        totalIncome += balance;
        return { glCode: acc.glCode, accountName: acc.accountName, balance };
    });

    let totalExpenses = 0;
    const expenseData = expenseAccounts.map(acc => {
        const balance = accountBalances.get(acc.id) || 0;
        totalExpenses += balance;
        return { glCode: acc.glCode, accountName: acc.accountName, balance };
    });

    return {
      incomeStatement: [
        { title: 'Operating Income', accounts: incomeData, total: totalIncome },
        { title: 'Operating Expenses', accounts: expenseData, total: totalExpenses },
      ],
      totalIncome,
      totalExpenses,
      netProfitLoss: totalIncome - totalExpenses,
    };
  }, [accounts, journals]);


  const handleExport = () => {
    const dataToExport: any[] = [];
    incomeStatement.forEach(section => {
      dataToExport.push([section.title, '']);
      dataToExport.push(['Account', 'Balance (MWK)']);
      section.accounts.forEach(acc => dataToExport.push([`${acc.glCode} - ${acc.accountName}`, acc.balance.toFixed(2)]));
      dataToExport.push([`Total ${section.title}`, section.total.toFixed(2)]);
      dataToExport.push([]);
    });
    dataToExport.push(['Net Profit / (Loss)', netProfitLoss.toFixed(2)]);

    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Income_Statement_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const isLoading = isCoaLoading || isJournalsLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Income Statement (P&L)</h1>
          <p className="text-muted-foreground mt-1">
            A summary of your institution's revenues and expenses for a period.
          </p>
        </div>
         <div className="flex items-center gap-2">
            <Button variant="outline"><Calendar className="mr-2 h-4 w-4" /> As of: Today</Button>
            <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4" /> Export</Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Profit and Loss Statement</CardTitle>
          <CardDescription>
            This report summarizes the revenues, costs, and expenses incurred during a specific period.
          </CardDescription>
        </CardHeader>
        <CardContent>
            {isLoading ? <Skeleton className="h-96 w-full" /> : 
                <div className="space-y-8">
                    {incomeStatement.map((section) => (
                        <div key={section.title}>
                        <h3 className="text-lg font-semibold mb-2 border-b pb-2">{section.title}</h3>
                        <Table>
                            <TableBody>
                                {section.accounts.map(item => (
                                    <TableRow key={item.glCode}>
                                        <TableCell className="pl-4">{item.glCode} - {item.accountName}</TableCell>
                                        <TableCell className="text-right font-mono">{item.balance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter>
                                <TableRow>
                                    <TableCell className="font-bold">Total {section.title}</TableCell>
                                    <TableCell className="text-right font-bold font-mono">{section.total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                        </div>
                    ))}

                    <div className="border-t-2 border-primary pt-4 mt-8">
                        <div className="flex justify-between items-center text-xl font-bold">
                            <span>Net Profit / (Loss)</span>
                            <span className="font-mono">{netProfitLoss.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                        </div>
                    </div>
                </div>
            }
        </CardContent>
      </Card>
    </div>
  );
}
