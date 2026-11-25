'use client';

import { useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { collection, doc, getDocs, query, runTransaction, serverTimestamp, where } from 'firebase/firestore';
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload, XCircle } from 'lucide-react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const headers = ['loanId', 'amount', 'paymentDate', 'paymentMethod', 'debitAccountId', 'reference'];
type ImportRow = { loanId: string; amount: string; paymentDate: string; paymentMethod: string; debitAccountId: string; reference: string; rowNumber: number; errors: string[] };

export default function CollectionsBulkUploadPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pageError, setPageError] = useState('');

  const userRef = useMemoFirebase(() => firestore && user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userData } = useDoc(userRef);
  const institutionId = userData?.institutionId;
  const validRows = useMemo(() => rows.filter(row => row.errors.length === 0), [rows]);
  const invalidCount = rows.length - validRows.length;

  const downloadTemplate = () => {
    const csv = [headers.join(','), 'LN-000123,15000,2026-11-24,Cash,TILL-01,DEP-1001'].join('\n');
    const link = document.createElement('a');
    link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    link.download = 'loan_collections_template.csv';
    link.click();
  };

  const parseFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setRows([]);
    setPageError('');
    setIsParsing(true);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: value => value.trim(),
      complete: result => {
        const missing = headers.filter(header => !result.meta.fields?.includes(header));
        if (missing.length) {
          setPageError(`Missing required columns: ${missing.join(', ')}`);
          setIsParsing(false);
          return;
        }
        const seen = new Set<string>();
        const mapped = result.data.map((data, index) => {
          const row: ImportRow = {
            loanId: String(data.loanId || '').trim(), amount: String(data.amount || '').trim(),
            paymentDate: String(data.paymentDate || '').trim(), paymentMethod: String(data.paymentMethod || '').trim(),
            debitAccountId: String(data.debitAccountId || '').trim(), reference: String(data.reference || '').trim(),
            rowNumber: index + 2, errors: [],
          };
          if (!row.loanId) row.errors.push('Loan ID is required');
          const amount = Number(row.amount);
          if (!row.amount || !Number.isFinite(amount) || amount <= 0) row.errors.push('Amount must be greater than 0');
          if (!row.paymentDate || Number.isNaN(Date.parse(row.paymentDate))) row.errors.push('Payment date must be a valid date (YYYY-MM-DD)');
          if (!['Cash', 'Bank'].includes(row.paymentMethod)) row.errors.push('Payment method must be Cash or Bank');
          if (!row.debitAccountId) row.errors.push('Debit account ID is required');
          if (row.loanId && seen.has(row.loanId + ':' + row.reference)) row.errors.push('Duplicate loan and reference in this file');
          if (row.loanId) seen.add(row.loanId + ':' + row.reference);
          return row;
        });
        setRows(mapped);
        setIsParsing(false);
      },
      error: error => { setPageError(`Could not read CSV: ${error.message}`); setIsParsing(false); },
    });
  };

  const clear = () => { setRows([]); setFileName(''); setPageError(''); if (fileRef.current) fileRef.current.value = ''; };

  const importCollections = async () => {
    if (!firestore || !user || !institutionId || validRows.length === 0) return;
    setIsSaving(true);
    setPageError('');
    try {
      const institutionRef = doc(firestore, 'institutions', institutionId);
      const loansRef = collection(firestore, 'institutions', institutionId, 'runningLoans');
      const [runningSnap, overdueSnap, productsSnap] = await Promise.all([
        getDocs(query(loansRef, where('status', '==', 'Disbursed'))),
        getDocs(query(loansRef, where('status', '==', 'Overdue'))),
        getDocs(collection(firestore, 'institutions', institutionId, 'loanProducts')),
      ]);
      const loans = new Map([...runningSnap.docs, ...overdueSnap.docs].map(snapshot => [snapshot.id, { id: snapshot.id, ...snapshot.data() }]));
      const products = new Map(productsSnap.docs.map(snapshot => [snapshot.id, snapshot.data()]));
      const unresolved = validRows.flatMap(row => loans.has(row.loanId) ? [] : [`Row ${row.rowNumber}: loan ${row.loanId} is not an active running loan`]);
      if (unresolved.length) throw new Error(unresolved.slice(0, 8).join('\n'));

      await runTransaction(firestore, async transaction => {
        const institution = await transaction.get(institutionRef);
        if (!institution.exists()) throw new Error('Institution record not found.');
        const initialCounter = institution.data().transactionReceiptCounter || 0;
        transaction.update(institutionRef, { transactionReceiptCounter: initialCounter + validRows.length });
        validRows.forEach((row, index) => {
          const loan = loans.get(row.loanId)!;
          const product = products.get(loan.loanProductId);
          if (!product) throw new Error(`Loan ${row.loanId} refers to a missing loan product.`);
          const journalId = `COLL${String(initialCounter + index + 1).padStart(10, '0')}`;
          const journalRef = doc(firestore, 'institutions', institutionId, 'journals', journalId);
          const amount = Number(row.amount);
          const principalPaid = Math.min(amount, Number(loan.outstandingPrincipal || 0));
          transaction.set(journalRef, {
            id: journalId, institutionId, branchId: loan.branchId || userData.branchId || null,
            date: new Date(`${row.paymentDate}T12:00:00`),
            description: `Bulk loan collection${row.reference ? ` (${row.reference})` : ''} for ${loan.customerName || loan.customerId || row.loanId}`,
            transactions: [
              { accountId: row.debitAccountId, debit: amount, credit: 0 },
              { accountId: product.loanPortfolioAccountId || 'MISSING_LOAN_PORTFOLIO_GL', debit: 0, credit: principalPaid },
              ...(amount > principalPaid ? [{ accountId: product.interestIncomeAccountId || 'MISSING_INTEREST_INCOME_GL', debit: 0, credit: amount - principalPaid }] : []),
            ],
            status: 'Pending', createdBy: user.uid, createdAt: serverTimestamp(), loanId: row.loanId,
            repaymentAmount: amount, principalPaid, interestPaid: amount - principalPaid, paymentMethod: row.paymentMethod,
            externalReference: row.reference || null, source: 'bulk-collections-upload',
          });
        });
      });
      toast({ title: 'Collections submitted', description: `${validRows.length} repayment${validRows.length === 1 ? '' : 's'} sent for approval.` });
      clear();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'The collections could not be imported.');
    } finally { setIsSaving(false); }
  };

  return <div className="space-y-6">
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Collections Bulk Upload</h1>
      <p className="mt-1 text-muted-foreground">Import loan repayments from a CSV file and send them to the teller approval queue.</p>
    </div>
    <Card>
      <CardHeader><CardTitle>Upload collection file</CardTitle><CardDescription>Use the template, then add one repayment per row. Imported repayments remain pending until approved.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={downloadTemplate}><Download className="mr-2 h-4 w-4"/>Download CSV template</Button>
          <Button onClick={() => fileRef.current?.click()} disabled={isParsing || isSaving}><Upload className="mr-2 h-4 w-4"/>Choose CSV file</Button>
          <Input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={parseFile}/>
          {rows.length > 0 && <Button variant="ghost" onClick={clear}><XCircle className="mr-2 h-4 w-4"/>Clear</Button>}
        </div>
        <p className="text-sm text-muted-foreground">Required columns: {headers.join(', ')}. Loan IDs must refer to active running loans. Debit account IDs must identify the cash or bank account used for collection.</p>
        {fileName && <div className="flex items-center gap-2 text-sm"><FileSpreadsheet className="h-4 w-4"/>{fileName}</div>}
        {isParsing && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Reading CSV…</div>}
        {pageError && <Alert variant="destructive"><AlertCircle className="h-4 w-4"/><AlertTitle>Import needs attention</AlertTitle><AlertDescription className="whitespace-pre-line">{pageError}</AlertDescription></Alert>}
      </CardContent>
    </Card>
    {rows.length > 0 && <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4"><div><CardTitle>Review repayments</CardTitle><CardDescription>{validRows.length} valid · {invalidCount} with errors</CardDescription></div><Button onClick={importCollections} disabled={validRows.length === 0 || invalidCount > 0 || isSaving || !institutionId}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Submit for approval</Button></CardHeader>
      <CardContent className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>CSV row</TableHead><TableHead>Loan ID</TableHead><TableHead>Amount</TableHead><TableHead>Date</TableHead><TableHead>Method</TableHead><TableHead>Debit account</TableHead><TableHead>Reference</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>
        {rows.map(row => <TableRow key={row.rowNumber}><TableCell>{row.rowNumber}</TableCell><TableCell className="font-mono">{row.loanId || '—'}</TableCell><TableCell>{row.amount || '—'}</TableCell><TableCell>{row.paymentDate || '—'}</TableCell><TableCell>{row.paymentMethod || '—'}</TableCell><TableCell className="font-mono">{row.debitAccountId || '—'}</TableCell><TableCell>{row.reference || '—'}</TableCell><TableCell>{row.errors.length ? <Badge variant="destructive" title={row.errors.join('; ')}><XCircle className="mr-1 h-3 w-3"/>Error</Badge> : <Badge variant="secondary"><CheckCircle2 className="mr-1 h-3 w-3"/>Ready</Badge>}{row.errors.length > 0 && <p className="mt-1 max-w-56 text-xs text-destructive">{row.errors.join('; ')}</p>}</TableCell></TableRow>)}
      </TableBody></Table></CardContent>
    </Card>}
  </div>;
}
