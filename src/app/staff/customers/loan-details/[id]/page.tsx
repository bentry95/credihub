
'use client';

import { useState, useMemo, Suspense, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useReactToPrint } from 'react-to-print';
import {
    useUser,
    useFirestore,
    useCollection,
    useMemoFirebase,
    useDoc,
} from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
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
    TrendingUp,
    FileWarning,
    CalendarClock,
    User,
    ShieldCheck,
    History,
    FileText,
    Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { calculateAmortization } from '@/lib/finance';


function LoanDetailsPageContent() {
    const params = useParams();
    const loanId = params.id as string;
    const { user } = useUser();
    const firestore = useFirestore();

    const printRef = useRef(null);
    const handlePrint = useReactToPrint({
        content: () => printRef.current,
    });

    const userDocRef = useMemoFirebase(() => (firestore && user ? doc(firestore, 'users', user.uid) : null), [firestore, user]);
    const { data: userData } = useDoc(userDocRef);

    const institutionId = userData?.institutionId;

    const loanDocRef = useMemoFirebase(
        () => (firestore && institutionId && loanId ? doc(firestore, 'institutions', institutionId, 'loanApplications', loanId) : null),
        [firestore, institutionId, loanId]
    );
    const { data: loan, isLoading: isLoanLoading } = useDoc(loanDocRef);

    const { data: customer, isLoading: isCustomerLoading } = useDoc(
        useMemoFirebase(() => (firestore && institutionId && loan?.customerId ? doc(firestore, 'institutions', institutionId, 'customers', loan.customerId) : null), [firestore, institutionId, loan])
    );

    const { data: loanProduct, isLoading: isProductLoading } = useDoc(
        useMemoFirebase(() => (firestore && institutionId && loan?.loanProductId ? doc(firestore, 'institutions', institutionId, 'loanProducts', loan.loanProductId) : null), [firestore, institutionId, loan])
    );
    
    const { data: submittedBy, isLoading: isSubmittedByLoading } = useDoc(useMemoFirebase(() => (firestore && loan?.submittedBy ? doc(firestore, 'users', loan.submittedBy) : null), [firestore, loan]));
    const { data: appraisedBy, isLoading: isAppraisedByLoading } = useDoc(useMemoFirebase(() => (firestore && loan?.appraisedBy ? doc(firestore, 'users', loan.appraisedBy) : null), [firestore, loan]));
    const { data: approvedBy, isLoading: isApprovedByLoading } = useDoc(useMemoFirebase(() => (firestore && loan?.approvedBy ? doc(firestore, 'users', loan.approvedBy) : null), [firestore, loan]));
    
    const isLoading = isLoanLoading || isCustomerLoading || isProductLoading || isSubmittedByLoading || isAppraisedByLoading || isApprovedByLoading;

    // Repayments would be fetched from a subcollection on the loan in a real app.
    // For now, we'll use an empty array.
    const repayments: any[] = [];

    const { schedule, monthlyInstallment } = useMemo(() => {
        if (!loanProduct || !loan) {
          return { schedule: [], totalInterest: 0, totalPayment: 0, monthlyInstallment: 0 };
        }
        return calculateAmortization({
          principal: loan.amount,
          annualInterestRate: loanProduct.annualInterestRate,
          termInMonths: loan.term,
          interestRateType: loanProduct.interestRateType,
          startDate: loan.disbursalDate?.toDate(),
        });
    }, [loan, loanProduct]);
    
    const historyEvents = [
        { date: loan?.dateApplied?.toDate(), event: 'Application Submitted', user: submittedBy?.name },
        { date: loan?.appraisalDate?.toDate(), event: 'Appraisal Completed', user: appraisedBy?.name },
        { date: loan?.approvalDate?.toDate(), event: 'Loan Approved', user: approvedBy?.name },
        { date: loan?.disbursalDate?.toDate(), event: 'Loan Disbursed', user: approvedBy?.name },
    ].filter(e => e.date);


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
        <div className="space-y-6" ref={printRef}>
            <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Loan 360° View</h1>
                    <p className="text-muted-foreground mt-1">
                        Comprehensive overview for loan <span className="font-mono">{loanId.substring(0,8)}...</span> for {customer?.name}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" asChild><Link href="/staff/loans/all-applications"><ArrowLeft className="mr-2 h-4 w-4"/> Back to All Loans</Link></Button>
                    <Button onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Print</Button>
                </div>
            </div>

             <Tabs defaultValue="details">
                <TabsList className="print:hidden">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="repayment-plan">Repayment Plan</TabsTrigger>
                    <TabsTrigger value="loan-position">Loan Position</TabsTrigger>
                    <TabsTrigger value="repayment-history">Repayment History</TabsTrigger>
                    <TabsTrigger value="collateral">Collateral</TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>
                <TabsContent value="details">
                    <Card>
                        <CardHeader>
                            <CardTitle>Loan Details</CardTitle>
                            <CardDescription>A high-level summary of the loan's current financial status.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Outstanding Principal</CardTitle><Wallet className="h-4 w-4 text-muted-foreground"/></CardHeader>
                                <CardContent><p className="text-2xl font-bold">MWK {loan.amount.toLocaleString()}</p></CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Arrears</CardTitle><FileWarning className="h-4 w-4 text-muted-foreground"/></CardHeader>
                                <CardContent><p className="text-2xl font-bold">MWK 0.00</p></CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Next Installment Date</CardTitle><CalendarClock className="h-4 w-4 text-muted-foreground"/></CardHeader>
                                <CardContent><p className="text-2xl font-bold">{schedule[0] ? format(schedule[0].paymentDate, 'PPP') : 'N/A'}</p></CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Next Installment Amount</CardTitle><Landmark className="h-4 w-4 text-muted-foreground"/></CardHeader>
                                <CardContent><p className="text-2xl font-bold">MWK {monthlyInstallment.toLocaleString()}</p></CardContent>
                            </Card>
                        </CardContent>
                    </Card>
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
                                            <TableCell><Badge variant="secondary">Due</Badge></TableCell>
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
                            <CardDescription>A detailed breakdown of any amounts that are past due.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow><TableCell>Principal in Arrears</TableCell><TableCell>MWK 0.00</TableCell></TableRow>
                                    <TableRow><TableCell>Interest in Arrears</TableCell><TableCell>MWK 0.00</TableCell></TableRow>
                                    <TableRow className="font-bold"><TableCell>Total Outstanding Balance</TableCell><TableCell>MWK {loan.amount.toLocaleString()}</TableCell></TableRow>
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
                                        <TableHead>Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {repayments.length > 0 ? (
                                        repayments.map((p, i) => (
                                            <TableRow key={i}>
                                                <TableCell>{format(p.date, 'PPP')}</TableCell>
                                                <TableCell>MWK {p.amount.toLocaleString()}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={2} className="text-center h-24">
                                                No repayments have been recorded for this loan yet.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="collateral">
                     <Card>
                        <CardHeader>
                            <CardTitle>Collateral</CardTitle>
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
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {historyEvents.map((event, index) => (
                                        <TableRow key={index}>
                                            <TableCell>{format(event.date, 'PPP p')}</TableCell>
                                            <TableCell>{event.event}</TableCell>
                                            <TableCell>{event.user}</TableCell>
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
