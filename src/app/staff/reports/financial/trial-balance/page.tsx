
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
import { Download, Scale, Calendar } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import Papa from 'papaparse';
import { format } from 'date-fns';


export default function TrialBalanceReportPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const [trialBalanceData, setTrialBalanceData] = useState<any[]>([]);
    const [totals, setTotals] = useState({ debit: 0, credit: 0 });

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
    
    useEffect(() => {
        if (accounts && journals) {
            const accountBalances = new Map<string, number>();

            // Initialize all accounts with 0 balance
            accounts.forEach(acc => accountBalances.set(acc.id, 0));

            // Calculate final balance for each account from all posted journals
            journals.forEach(journal => {
                journal.transactions.forEach((transaction: any) => {
                    const account = accounts.find(a => a.id === transaction.accountId);
                    if (account) {
                        const currentBalance = accountBalances.get(transaction.accountId) || 0;
                        let newBalance = currentBalance;
                        
                        const debit = transaction.debit || 0;
                        const credit = transaction.credit || 0;

                        // Assets and Expenses increase with debits
                        if (account.accountType === 'Asset' || account.accountType === 'Expense') {
                            newBalance += (debit - credit);
                        } 
                        // Liabilities, Equity, and Income increase with credits
                        else {
                            newBalance += (credit - debit);
                        }
                        accountBalances.set(transaction.accountId, newBalance);
                    }
                });
            });

            let totalDebits = 0;
            let totalCredits = 0;
            
            const tbData = accounts.map(account => {
                const balance = accountBalances.get(account.id) || 0;
                let debit = 0;
                let credit = 0;

                // For Asset and Expense accounts, a positive balance is a debit.
                if (account.accountType === 'Asset' || account.accountType === 'Expense') {
                    if (balance >= 0) {
                        debit = balance;
                    } else {
                        credit = -balance; // Negative balance becomes a credit
                    }
                } 
                // For Liability, Equity, and Income accounts, a positive balance is a credit.
                else {
                     if (balance >= 0) {
                        credit = balance;
                    } else {
                        debit = -balance; // Negative balance becomes a debit
                    }
                }
                
                totalDebits += debit;
                totalCredits += credit;
                
                return {
                    glCode: account.glCode,
                    accountName: account.accountName,
                    debit,
                    credit,
                };
            }).sort((a, b) => a.glCode.localeCompare(b.glCode));
            
            setTrialBalanceData(tbData);
            setTotals({ debit: totalDebits, credit: totalCredits });
        }
    }, [accounts, journals]);

    const handleExport = () => {
        const dataToExport = trialBalanceData.map(item => ({
            'GL Code': item.glCode,
            'Account Name': item.accountName,
            'Debit (MWK)': item.debit.toFixed(2),
            'Credit (MWK)': item.credit.toFixed(2),
        }));

        dataToExport.push({
            'GL Code': 'Total',
            'Account Name': '',
            'Debit (MWK)': totals.debit.toFixed(2),
            'Credit (MWK)': totals.credit.toFixed(2),
        });

        const csv = Papa.unparse(dataToExport);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `Trial_Balance_${format(new Date(), 'yyyy-MM-dd')}.csv`);
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
          <h1 className="text-3xl font-bold tracking-tight">Trial Balance</h1>
          <p className="text-muted-foreground mt-1">
            Lists all ledger accounts to ensure total debits equal total credits.
          </p>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline"><Calendar className="mr-2 h-4 w-4" /> As of: Today</Button>
            <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4" /> Export</Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Trial Balance Report</CardTitle>
          <CardDescription>
            A list of all accounts with their closing balances.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>GL Code</TableHead>
                <TableHead>Account Name</TableHead>
                <TableHead className="text-right">Debit (MWK)</TableHead>
                <TableHead className="text-right">Credit (MWK)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({length: 5}).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-16"/></TableCell>
                    <TableCell><Skeleton className="h-5 w-48"/></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-24 ml-auto"/></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-24 ml-auto"/></TableCell>
                  </TableRow>
                ))
              ) : trialBalanceData.map((item) => (
                <TableRow key={item.glCode}>
                  <TableCell>{item.glCode}</TableCell>
                  <TableCell className="font-medium">{item.accountName}</TableCell>
                  <TableCell className="text-right font-mono">{item.debit > 0 ? item.debit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</TableCell>
                  <TableCell className="text-right font-mono">{item.credit > 0 ? item.credit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
                <TableRow>
                    <TableCell colSpan={2} className="font-bold">Totals</TableCell>
                    <TableCell className="text-right font-bold font-mono">{totals.debit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
                    <TableCell className="text-right font-bold font-mono">{totals.credit.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</TableCell>
                </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
