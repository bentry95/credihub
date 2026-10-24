
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
import { Download, Book, Calendar, FileWarning } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import Papa from 'papaparse';
import { format } from 'date-fns';

export default function BalanceSheetReportPage() {
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

    const { assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity } = useMemo(() => {
        if (!accounts || !journals) return { assets: [], liabilities: [], equity: [], totalAssets: 0, totalLiabilities: 0, totalEquity: 0 };

        const accountBalances = new Map<string, number>();
        accounts.forEach(acc => accountBalances.set(acc.id, 0));
        
        let netProfitLoss = 0;

        journals.forEach(journal => {
            journal.transactions.forEach((transaction: any) => {
                const account = accounts.find(a => a.id === transaction.accountId);
                if (account) {
                    const currentBalance = accountBalances.get(transaction.accountId) || 0;
                    let newBalance = currentBalance;
                    
                    const debit = transaction.debit || 0;
                    const credit = transaction.credit || 0;

                    if (account.accountType === 'Asset' || account.accountType === 'Expense') {
                        newBalance += (debit - credit);
                    } else { // Liability, Equity, Income
                        newBalance += (credit - debit);
                    }
                    accountBalances.set(transaction.accountId, newBalance);

                    if (account.accountType === 'Income') {
                        netProfitLoss += (credit - debit);
                    } else if (account.accountType === 'Expense') {
                        netProfitLoss -= (debit - credit);
                    }
                }
            });
        });

        const assets: any[] = [], liabilities: any[] = [], equity: any[] = [];
        let totalAssets = 0, totalLiabilities = 0, totalEquity = 0;

        accounts.forEach(account => {
            let balance = accountBalances.get(account.id) || 0;
            
            // Add net income to retained earnings
            if (account.glCode === '3200') { // Retained Earnings GL Code
                balance += netProfitLoss;
            }

            const accountData = { ...account, balance };
            
            if (account.accountType === 'Asset') {
                assets.push(accountData);
                totalAssets += balance;
            } else if (account.accountType === 'Liability') {
                liabilities.push(accountData);
                totalLiabilities += balance;
            } else if (account.accountType === 'Equity') {
                equity.push(accountData);
                totalEquity += balance;
            }
        });
        
        return { assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity };
    }, [accounts, journals]);

     const handleExport = () => {
        const dataToExport: any[] = [];
        dataToExport.push(['Assets', '']);
        dataToExport.push(['Account', 'Balance (MWK)']);
        assets.forEach(a => dataToExport.push([a.accountName, a.balance.toFixed(2)]));
        dataToExport.push(['Total Assets', totalAssets.toFixed(2)]);
        dataToExport.push([]); // Spacer

        dataToExport.push(['Liabilities', '']);
        dataToExport.push(['Account', 'Balance (MWK)']);
        liabilities.forEach(l => dataToExport.push([l.accountName, l.balance.toFixed(2)]));
        dataToExport.push(['Total Liabilities', totalLiabilities.toFixed(2)]);
        dataToExport.push([]); // Spacer

        dataToExport.push(['Equity', '']);
        dataToExport.push(['Account', 'Balance (MWK)']);
        equity.forEach(e => dataToExport.push([e.accountName, e.balance.toFixed(2)]));
        dataToExport.push(['Total Equity', totalEquity.toFixed(2)]);
        dataToExport.push([]); // Spacer

        dataToExport.push(['Total Liabilities & Equity', (totalLiabilities + totalEquity).toFixed(2)]);

        const csv = Papa.unparse(dataToExport);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `Balance_Sheet_${format(new Date(), 'yyyy-MM-dd')}.csv`);
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
          <h1 className="text-3xl font-bold tracking-tight">Balance Sheet</h1>
          <p className="text-muted-foreground mt-1">
            A snapshot of your institution's financial health as of a specific date.
          </p>
        </div>
         <div className="flex items-center gap-2">
            <Button variant="outline"><Calendar className="mr-2 h-4 w-4" /> As of: Today</Button>
            <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4" /> Export</Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Statement of Financial Position</CardTitle>
          <CardDescription>
            This report shows the balance of Assets, Liabilities, and Equity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Assets</h3>
              {isLoading ? <Skeleton className="h-48 w-full" /> : assets.length > 0 ? (
                <Table>
                    <TableHeader><TableRow><TableHead>Account</TableHead><TableHead className="text-right">Balance (MWK)</TableHead></TableRow></TableHeader>
                    <TableBody>
                    {assets.map((item, i) => <TableRow key={i}><TableCell>{item.accountName}</TableCell><TableCell className="text-right font-mono">{item.balance.toLocaleString()}</TableCell></TableRow>)}
                    </TableBody>
                    <TableFooter><TableRow><TableCell className="font-bold">Total Assets</TableCell><TableCell className="text-right font-bold font-mono">{totalAssets.toLocaleString()}</TableCell></TableRow></TableFooter>
                </Table>
               ) : (
                <p className="text-sm text-muted-foreground">No asset accounts found.</p>
               )}
            </div>
            <div className="space-y-4">
                <h3 className="text-lg font-semibold">Liabilities & Equity</h3>
                 {isLoading ? <Skeleton className="h-48 w-full" /> : liabilities.length > 0 ? (
                    <Table>
                        <TableHeader><TableRow><TableHead>Account</TableHead><TableHead className="text-right">Balance (MWK)</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {liabilities.map((item, i) => <TableRow key={i}><TableCell>{item.accountName}</TableCell><TableCell className="text-right font-mono">{item.balance.toLocaleString()}</TableCell></TableRow>)}
                        </TableBody>
                        <TableFooter><TableRow><TableCell className="font-bold">Total Liabilities</TableCell><TableCell className="text-right font-bold font-mono">{totalLiabilities.toLocaleString()}</TableCell></TableRow></TableFooter>
                    </Table>
                 ) : <p className="text-sm text-muted-foreground">No liability accounts found.</p>}
                 {isLoading ? <Skeleton className="h-32 w-full mt-4" /> : equity.length > 0 ? (
                    <Table>
                        <TableBody>
                            {equity.map((item, i) => <TableRow key={i}><TableCell>{item.accountName}</TableCell><TableCell className="text-right font-mono">{item.balance.toLocaleString()}</TableCell></TableRow>)}
                        </TableBody>
                        <TableFooter><TableRow><TableCell className="font-bold">Total Equity</TableCell><TableCell className="text-right font-bold font-mono">{totalEquity.toLocaleString()}</TableCell></TableRow></TableFooter>
                    </Table>
                 ) : <p className="text-sm text-muted-foreground">No equity accounts found.</p>}
                 {isLoading ? <Skeleton className="h-12 w-full mt-4" /> : (
                    <Table>
                        <TableFooter><TableRow><TableCell className="font-bold">Total Liabilities & Equity</TableCell><TableCell className="text-right font-bold font-mono">{(totalLiabilities + totalEquity).toLocaleString()}</TableCell></TableRow></TableFooter>
                    </Table>
                 )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
