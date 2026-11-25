'use client';

import { useState, useMemo, Suspense, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useReactToPrint } from 'react-to-print';
import {
    useUser,
    useFirestore,
    useCollection,
    useMemoFirebase,
    useDoc,
} from '@/firebase';
import { collection, doc, query, where, getDoc, getDocs, collectionGroup, orderBy } from 'firebase/firestore';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Printer,
    ArrowLeft,
    Landmark,
    FileWarning,
    CalendarClock,
    ShieldCheck,
    Wallet,
    Users2,
    Hash,
    CircleDollarSign,
    Building2,
    Phone,
    Mail,
    Percent,
    CalendarCheck,
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { calculateAmortization } from '@/lib/finance';
import { Progress } from '@/components/ui/progress';

const asDate = (value: any): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value.toDate === 'function') return value.toDate();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};
const money = (value: number) => `MWK ${(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const titleCase = (value?: string) => value ? value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ').replace(/\b\w/g, character => character.toUpperCase()) : '—';


function LoanDetailsPageContent() {
    const params = useParams();
    const loanId = params.id as string;
    const { user } = useUser();
    const firestore = useFirestore();

    const printRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        contentRef: printRef,
    });

    const userDocRef = useMemoFirebase(() => (firestore && user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
    const { data: userData } = useDoc(userDocRef);

    const institutionId = userData?.institutionId;

    const [loan, setLoan] = useState<any>(null);
    const [isLoanLoading, setIsLoanLoading] = useState(true);

    const { data: institutionData, isLoading: isInstitutionLoading } = useDoc(
        useMemoFirebase(() => (firestore && institutionId ? doc(firestore, 'institutions', institutionId) : null), [firestore, institutionId])
    );
    const systemDate = institutionData?.systemDate?.toDate();

    useEffect(() => {
        async function fetchLoan() {
            if (!loanId || !firestore || !institutionId) {
                setIsLoanLoading(false);
                return;
            };
            setIsLoanLoading(true);

            let loanData = null;
            let loanDocSnap;
            
            // Check in loanApplications
            const loanAppRef = doc(firestore, 'institutions', institutionId, 'loanApplications', loanId);
            loanDocSnap = await getDoc(loanAppRef);
            if (loanDocSnap.exists()) {
                loanData = { id: loanDocSnap.id, ...loanDocSnap.data() };
            } else {
                // If not found, check in runningLoans
                const runningLoanRef = doc(firestore, 'institutions', institutionId, 'runningLoans', loanId);
                loanDocSnap = await getDoc(runningLoanRef);
                if (loanDocSnap.exists()) {
                    loanData = { id: loanDocSnap.id, ...loanDocSnap.data() };
                }
            }
            
            setLoan(loanData);
            setIsLoanLoading(false);
        }
        fetchLoan();
    }, [loanId, firestore, institutionId]);


    const { data: customer, isLoading: isCustomerLoading } = useDoc(
        useMemoFirebase(() => (firestore && institutionId && loan?.customerId ? doc(firestore, 'institutions', institutionId, 'customers', loan.customerId) : null), [firestore, institutionId, loan])
    );

    const { data: loanProduct, isLoading: isProductLoading } = useDoc(
        useMemoFirebase(() => (firestore && institutionId && loan?.loanProductId ? doc(firestore, 'institutions', institutionId, 'loanProducts', loan.loanProductId) : null), [firestore, institutionId, loan])
    );
    
    const allUsersQuery = useMemoFirebase(() => (firestore && institutionId ? query(collection(firestore, 'users'), where('institutionId', '==', institutionId)) : null), [firestore, institutionId]);
    const { data: allUsers, isLoading: areUsersLoading } = useCollection(allUsersQuery);

    const getUserName = (userId: string) => {
        if (!allUsers) return '...';
        return allUsers.find(u => u.uid === userId)?.name || 'System';
    }
    
    const repaymentsQuery = useMemoFirebase(
      () => (firestore && institutionId && loanId ? query(collection(firestore, 'institutions', institutionId, 'journals'), where('loanId', '==', loanId), where('status', '==', 'Posted')) : null),
      [firestore, institutionId, loanId]
    );
    const { data: repaymentsData, isLoading: areRepaymentsLoading } = useCollection(repaymentsQuery);

    const repayments = useMemo(() => {
        if (!repaymentsData) return [];
        return [...repaymentsData].map(journal => ({ ...journal, dateObject: asDate(journal.date) || asDate(journal.createdAt) }))
            .sort((a, b) => (b.dateObject?.getTime() || 0) - (a.dateObject?.getTime() || 0));
    }, [repaymentsData]);


    const totalRepaid = useMemo(() => {
      if (!repayments) return 0;
      return repayments.reduce((sum, journal) => sum + (Number(journal.repaymentAmount) || 0), 0);
    }, [repayments]);

    const totalPrincipalPaid = useMemo(() => repayments.reduce((sum, item: any) => sum + (Number(item.principalPaid) || (item.transactions || []).filter((entry: any) => entry.accountId === loanProduct?.loanPortfolioAccountId).reduce((value: number, entry: any) => value + (Number(entry.credit) || 0), 0)), 0), [repayments, loanProduct]);
    const totalInterestPaid = useMemo(() => repayments.reduce((sum, item: any) => sum + (Number(item.interestPaid) || (item.transactions || []).filter((entry: any) => entry.accountId === loanProduct?.interestIncomeAccountId).reduce((value: number, entry: any) => value + (Number(entry.credit) || 0), 0)), 0), [repayments, loanProduct]);
    const isLoading = isLoanLoading || isCustomerLoading || isProductLoading || areUsersLoading || isInstitutionLoading || areRepaymentsLoading;

    const { schedule, monthlyInstallment } = useMemo(() => {
        if (!loanProduct || !loan) {
          return { schedule: [], totalInterest: 0, totalPayment: 0, monthlyInstallment: 0 };
        }
        return calculateAmortization({
          principal: loan.amount,
          annualInterestRate: loanProduct.annualInterestRate,
          term: loan.term,
          tenureUnit: loan.tenureUnit,
          interestRateType: loanProduct.interestRateType,
          startDate: loan.firstRepaymentDate?.toDate() || loan.disbursalDate?.toDate(),
        });
    }, [loan, loanProduct]);

    const outstandingPrincipal = Number(loan?.outstandingPrincipal ?? loan?.amount ?? 0);
    const asOfDate = systemDate || new Date();
    const dueSchedule = schedule.filter(row => row.paymentDate <= asOfDate);
    const duePrincipal = dueSchedule.reduce((sum, row) => sum + row.principal, 0);
    const dueInterest = dueSchedule.reduce((sum, row) => sum + row.interest, 0);
    const principalInArrears = Math.max(0, duePrincipal - totalPrincipalPaid);
    const interestInArrears = Math.max(0, dueInterest - totalInterestPaid);
    const totalArrears = principalInArrears + interestInArrears;
    const totalScheduled = schedule.reduce((sum, row) => sum + row.totalPayment, 0);
    const repaymentProgress = totalScheduled > 0 ? Math.min(100, (totalRepaid / totalScheduled) * 100) : 0;
    const nextInstallment = schedule.find(row => schedule.slice(0, row.period).reduce((sum, item) => sum + item.totalPayment, 0) > totalRepaid);

    const getInstallmentStatus = (installmentPeriod: number, paymentDate: Date) => {
        const cumulativeExpected = schedule.slice(0, installmentPeriod).reduce((sum, row) => sum + row.totalPayment, 0);
        
        if (totalRepaid >= cumulativeExpected) {
            return <Badge variant="default">Paid</Badge>;
        }
        
        if (paymentDate < asOfDate) {
            return <Badge variant="destructive">Overdue</Badge>;
        }
        
        return <Badge variant="secondary">Due</Badge>;
    };

    
    const historyEvents = [
      ...(loan?.auditHistory || []).map((event: any) => ({
      ...event,
      action: event.action || 'Loan updated',
      date: asDate(event.timestamp),
      userName: getUserName(event.userId),
      })),
      ...[
        ['Application submitted', loan?.dateApplied, loan?.submittedBy],
        ['Appraisal completed', loan?.appraisalDate, loan?.appraisedBy],
        ['Loan approved', loan?.approvalDate, loan?.approvedBy],
        ['Loan disbursed', loan?.disbursalDate, loan?.disbursedBy || loan?.approvedBy],
      ].filter(([, dateValue]) => asDate(dateValue)).map(([action, dateValue, userId]: any) => ({ action, date: asDate(dateValue), userName: userId ? getUserName(userId) : 'System', details: '' })),
    ].sort((a: any, b: any) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));


    if (isLoading) {
        return <Skeleton className="h-screen w-full" />;
    }

    if (!loan) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Loan not found</CardTitle>
                    <CardDescription>The requested loan could not be found or you do not have permission to view it.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button asChild variant="outline"><Link href="/staff/loans/all-applications"><ArrowLeft className="mr-2 h-4 w-4"/> Back to All Loans</Link></Button>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Loan 360° View</h1>
                    <p className="text-muted-foreground mt-1">
                        {customer?.name || 'Customer'} · Loan <span className="font-mono">{loan.accountNumber || loanId}</span>
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" asChild><Link href="/staff/loans/all-applications"><ArrowLeft className="mr-2 h-4 w-4"/> Back to All Loans</Link></Button>
                    {['Disbursed', 'Overdue'].includes(loan.status) && <Button asChild><Link href="/staff/tellers/loan-repayment"><CircleDollarSign className="mr-2 h-4 w-4"/>Record Repayment</Link></Button>}
                    <Button onClick={() => handlePrint()}><Printer className="mr-2 h-4 w-4" /> Print</Button>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <Badge variant={loan.status === 'Overdue' ? 'destructive' : loan.status === 'Disbursed' ? 'default' : 'secondary'} className="px-3 py-1 text-sm">{titleCase(loan.status)}</Badge>
                {loanProduct?.name && <span className="text-sm text-muted-foreground">{loanProduct.name}</span>}
                {loan.branchId && <span className="flex items-center gap-1 text-sm text-muted-foreground"><Building2 className="h-4 w-4"/>Branch {loan.branchId}</span>}
                <span className="flex items-center gap-1 text-sm text-muted-foreground"><Hash className="h-4 w-4"/>ID: {loan.id}</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Outstanding principal</p><p className="mt-1 text-2xl font-semibold">{money(outstandingPrincipal)}</p><p className="mt-1 text-xs text-muted-foreground">Original principal {money(Number(loan.amount) || 0)}</p></CardContent></Card>
                <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Total repaid</p><p className="mt-1 text-2xl font-semibold">{money(totalRepaid)}</p><p className="mt-1 text-xs text-muted-foreground">{repayments.length} posted payment{repayments.length === 1 ? '' : 's'}</p></CardContent></Card>
                <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Arrears</p><p className={`mt-1 text-2xl font-semibold ${totalArrears > 0 ? 'text-destructive' : ''}`}>{money(totalArrears)}</p><p className="mt-1 text-xs text-muted-foreground">As of {format(asOfDate, 'PPP')}</p></CardContent></Card>
                <Card><CardContent className="p-5"><div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">Repayment progress</p><span className="text-sm font-medium">{repaymentProgress.toFixed(1)}%</span></div><Progress value={repaymentProgress} className="mt-3"/><p className="mt-2 text-xs text-muted-foreground">{money(totalRepaid)} of {money(totalScheduled)} scheduled</p></CardContent></Card>
            </div>

             <Tabs defaultValue="details">
                <TabsList className="print:hidden">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="repayment-plan">Repayment Plan</TabsTrigger>
                    <TabsTrigger value="loan-position">Loan Position</TabsTrigger>
                    <TabsTrigger value="repayment-history">Repayment History</TabsTrigger>
                    <TabsTrigger value="collateral">Security</TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>
                <TabsContent value="details" ref={printRef} className="bg-white text-black p-4 rounded-md">
                    <div className="space-y-6 print:text-black">
                        <Card className="print:border-none print:shadow-none">
                            <CardHeader><CardTitle>Borrower Profile</CardTitle><CardDescription>Customer details linked to this loan account.</CardDescription></CardHeader>
                            <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                                <div><p className="text-sm text-muted-foreground">Customer name</p><p className="font-medium">{customer?.name || '—'}</p></div>
                                <div><p className="text-sm text-muted-foreground">Customer number</p><p className="font-mono">{customer?.accountNumber || loan.customerId || '—'}</p></div>
                                <div><p className="flex items-center gap-1 text-sm text-muted-foreground"><Phone className="h-3.5 w-3.5"/>Phone</p><p>{customer?.phone || '—'}</p></div>
                                <div><p className="flex items-center gap-1 text-sm text-muted-foreground"><Mail className="h-3.5 w-3.5"/>Email</p><p className="break-all">{customer?.email || '—'}</p></div>
                                <div><p className="text-sm text-muted-foreground">National ID</p><p>{customer?.idNumber || '—'}</p></div>
                                <div><p className="text-sm text-muted-foreground">Branch</p><p>{loan.branchName || loan.branchId || '—'}</p></div>
                                <div><p className="text-sm text-muted-foreground">Loan officer</p><p>{getUserName(loan.submittedBy)}</p></div>
                                <div><p className="text-sm text-muted-foreground">Product</p><p>{loanProduct?.name || loan.loanProductId || '—'}</p></div>
                            </CardContent>
                        </Card>
                        <div className="grid gap-6 lg:grid-cols-2">
                            <Card className="print:border-none print:shadow-none">
                                <CardHeader><CardTitle>Loan Terms</CardTitle><CardDescription>Approved facility terms and repayment settings.</CardDescription></CardHeader>
                                <CardContent className="grid gap-4 sm:grid-cols-2">
                                    <div><p className="text-sm text-muted-foreground">Approved principal</p><p className="font-semibold">{money(Number(loan.amount) || 0)}</p></div>
                                    <div><p className="flex items-center gap-1 text-sm text-muted-foreground"><Percent className="h-3.5 w-3.5"/>Annual interest rate</p><p className="font-semibold">{Number(loanProduct?.annualInterestRate || loan.interestRate || 0).toLocaleString()}%</p></div>
                                    <div><p className="text-sm text-muted-foreground">Interest calculation</p><p>{loanProduct?.interestRateType || loan.interestCalculationMethod || '—'}</p></div>
                                    <div><p className="text-sm text-muted-foreground">Repayment frequency</p><p>{titleCase(loan.repaymentFrequency || loanProduct?.repaymentFrequency)}</p></div>
                                    <div><p className="text-sm text-muted-foreground">Term</p><p>{loan.term ? `${loan.term} ${titleCase(loan.tenureUnit || 'months')}` : '—'}</p></div>
                                    <div><p className="text-sm text-muted-foreground">Installment</p><p>{monthlyInstallment ? money(monthlyInstallment) : '—'}</p></div>
                                    <div><p className="text-sm text-muted-foreground">Next unpaid installment</p><p>{nextInstallment ? `${format(nextInstallment.paymentDate, 'PPP')} · ${money(nextInstallment.totalPayment)}` : 'No remaining scheduled installments'}</p></div>
                                    <div><p className="text-sm text-muted-foreground">Total scheduled</p><p>{totalScheduled ? money(totalScheduled) : '—'}</p></div>
                                    <div><p className="text-sm text-muted-foreground">Maturity date</p><p>{asDate(loan.maturityDate) ? format(asDate(loan.maturityDate)!, 'PPP') : (schedule.length ? format(schedule[schedule.length - 1].paymentDate, 'PPP') : '—')}</p></div>
                                </CardContent>
                            </Card>
                            <Card className="print:border-none print:shadow-none">
                                <CardHeader><CardTitle>Key Dates &amp; Decisions</CardTitle><CardDescription>Origination and approval milestones.</CardDescription></CardHeader>
                                <CardContent className="space-y-4">
                                    {[
                                        ['Application submitted', loan.dateApplied, loan.submittedBy],
                                        ['Appraised', loan.appraisalDate, loan.appraisedBy],
                                        ['Approved', loan.approvalDate, loan.approvedBy],
                                        ['Disbursed', loan.disbursalDate, loan.disbursedBy || loan.approvedBy],
                                        ['First repayment due', loan.firstRepaymentDate, null],
                                    ].map(([label, dateValue, userId]: any) => <div key={label} className="flex items-start justify-between gap-4 border-b pb-3 last:border-0"><div className="flex items-center gap-2"><CalendarCheck className="h-4 w-4 text-muted-foreground"/><span className="text-sm font-medium">{label}</span></div><div className="text-right text-sm"><p>{asDate(dateValue) ? format(asDate(dateValue)!, 'PPP') : '—'}</p>{userId && <p className="text-xs text-muted-foreground">{getUserName(userId)}</p>}</div></div>)}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>
                <TabsContent value="repayment-plan">
                     <Card>
                        <CardHeader>
                            <CardTitle>Repayment Plan</CardTitle>
                            <CardDescription>The full amortization schedule for this loan.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Due Date</TableHead>
                                        <TableHead>Principal</TableHead>
                                        <TableHead>Interest</TableHead>
                                        <TableHead>Total Payment</TableHead>
                                        <TableHead>Remaining Loan Balance</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {schedule.map((row) => (
                                        <TableRow key={row.period}>
                                            <TableCell>{format(row.paymentDate, 'PPP')}</TableCell>
                                            <TableCell>MWK {row.principal.toLocaleString()}</TableCell>
                                            <TableCell>MWK {row.interest.toLocaleString()}</TableCell>
                                            <TableCell>MWK {row.totalPayment.toLocaleString()}</TableCell>
                                            <TableCell>MWK {row.closingLoanBalance?.toLocaleString()}</TableCell>
                                            <TableCell>{getInstallmentStatus(row.period, row.paymentDate)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="loan-position">
                     <Card>
                        <CardHeader>
                            <CardTitle>Loan Position</CardTitle>
                            <CardDescription>Amounts due through {format(asOfDate, 'PPP')}, compared with repayments recorded against the loan.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow><TableCell>Principal due to date</TableCell><TableCell className="text-right">{money(duePrincipal)}</TableCell></TableRow>
                                    <TableRow><TableCell>Principal repaid</TableCell><TableCell className="text-right">{money(totalPrincipalPaid)}</TableCell></TableRow>
                                    <TableRow><TableCell>Principal in arrears</TableCell><TableCell className="text-right">{money(principalInArrears)}</TableCell></TableRow>
                                    <TableRow><TableCell>Interest due to date</TableCell><TableCell className="text-right">{money(dueInterest)}</TableCell></TableRow>
                                    <TableRow><TableCell>Interest repaid</TableCell><TableCell className="text-right">{money(totalInterestPaid)}</TableCell></TableRow>
                                    <TableRow><TableCell>Interest in arrears</TableCell><TableCell className="text-right">{money(interestInArrears)}</TableCell></TableRow>
                                    <TableRow><TableCell>Current principal balance</TableCell><TableCell className="text-right">{money(outstandingPrincipal)}</TableCell></TableRow>
                                    <TableRow className="font-bold"><TableCell>Total arrears</TableCell><TableCell className="text-right">{money(totalArrears)}</TableCell></TableRow>
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="repayment-history">
                     <Card>
                        <CardHeader>
                            <CardTitle>Repayment History</CardTitle>
                            <CardDescription>A log of all payments made against this loan.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Receipt / Reference</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Method</TableHead>
                                        <TableHead className="text-right">Principal</TableHead>
                                        <TableHead className="text-right">Interest</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {repayments && repayments.length > 0 ? (
                                        repayments.map((p, i) => (
                                            <TableRow key={i}>
                                                <TableCell>{p.dateObject ? format(p.dateObject, 'PPP p') : '—'}</TableCell>
                                                <TableCell className="font-mono">{p.externalReference || p.id || '—'}</TableCell>
                                                <TableCell>{p.description || 'Loan repayment'}</TableCell>
                                                <TableCell>{p.paymentMethod || '—'}</TableCell>
                                                <TableCell className="text-right">{money(Number(p.principalPaid) || 0)}</TableCell>
                                                <TableCell className="text-right">{money(Number(p.interestPaid) || 0)}</TableCell>
                                                <TableCell className="text-right font-mono">{money(Number(p.repaymentAmount) || 0)}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center h-24">
                                                No repayments have been recorded for this loan yet.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="collateral" className="space-y-6">
                     <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Collateral</CardTitle>
                            <CardDescription>Assets pledged as security for this loan.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Estimated Value</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                     {loan.collateral && loan.collateral.length > 0 ? (
                                        loan.collateral.map((item: any, index: number) => (
                                            <TableRow key={index}>
                                                <TableCell>{item.description}</TableCell>
                                                <TableCell>MWK {item.estimatedValue.toLocaleString()}</TableCell>
                                            </TableRow>
                                        ))
                                     ) : (
                                        <TableRow><TableCell colSpan={2} className="text-center h-24">No collateral was pledged for this loan.</TableCell></TableRow>
                                     )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Users2 className="h-5 w-5" /> Guarantors</CardTitle>
                            <CardDescription>Individuals who have guaranteed this loan.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>ID Number</TableHead>
                                        <TableHead>Phone</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loan.guarantors && loan.guarantors.length > 0 ? (
                                        loan.guarantors.map((guarantor: any, index: number) => (
                                            <TableRow key={index}>
                                                <TableCell>{guarantor.name}</TableCell>
                                                <TableCell>{guarantor.idNumber}</TableCell>
                                                <TableCell>{guarantor.phone}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow><TableCell colSpan={3} className="text-center h-24">No guarantors were provided for this loan.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
                 <TabsContent value="history">
                     <Card>
                        <CardHeader>
                            <CardTitle>Loan History</CardTitle>
                            <CardDescription>A complete audit trail of the loan's lifecycle.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Event</TableHead>
                                        <TableHead>User</TableHead>
                                        <TableHead>Details</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {historyEvents.map((event: any, index: number) => (
                                        <TableRow key={index}>
                                            <TableCell>{event.date ? format(event.date, 'PPP p') : 'N/A'}</TableCell>
                                            <TableCell>{event.action || 'Status Change'}</TableCell>
                                            <TableCell>{event.userName}</TableCell>
                                            <TableCell>{event.details || `Status changed`}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}


export default function LoanDetailsPage() {
    return (
        <Suspense fallback={<Skeleton className="h-screen w-full" />}>
            <LoanDetailsPageContent />
        </Suspense>
    )
}
