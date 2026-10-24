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
    TrendingUp,
    FileWarning,
    CalendarClock,
    User,
    ShieldCheck,
    History,
    FileText,
    Wallet,
    Users2,
} from 'lucide-react';
import Link from 'next/link';
import { format, isPast } from 'date-fns';
import { calculateAmortization } from '@/lib/finance';


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
        return [...repaymentsData].sort((a,b) => b.date.toDate() - a.date.toDate());
    }, [repaymentsData]);


    const totalRepaid = useMemo(() => {
      if (!repayments) return 0;
      return repayments.reduce((sum, journal) => sum + (journal.repaymentAmount || 0), 0);
    }, [repayments]);

    
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

    const { principalInArrears, interestInArrears } = useMemo(() => {
        if (!schedule.length || !systemDate) {
            return { principalInArrears: 0, interestInArrears: 0 };
        }

        const installmentsDue = schedule.filter(row => isPast(row.paymentDate) || row.paymentDate.toDateString() === systemDate.toDateString());
        
        const totalPrincipalDue = installmentsDue.reduce((sum, row) => sum + row.principal, 0);
        const totalInterestDue = installmentsDue.reduce((sum, row) => sum + row.interest, 0);

        let principalPaid = 0;
        let interestPaid = 0;
        
        let remainingRepayment = totalRepaid;

        // Allocate payments first to interest due, then principal due.
        interestPaid = Math.min(remainingRepayment, totalInterestDue);
        remainingRepayment -= interestPaid;

        principalPaid = Math.min(remainingRepayment, totalPrincipalDue);

        return {
            principalInArrears: Math.max(0, totalPrincipalDue - principalPaid),
            interestInArrears: Math.max(0, totalInterestDue - interestPaid),
        };

    }, [schedule, systemDate, totalRepaid]);

    const getInstallmentStatus = (installmentPeriod: number, paymentDate: Date) => {
        const cumulativeExpected = schedule.slice(0, installmentPeriod).reduce((sum, row) => sum + row.totalPayment, 0);
        
        if (totalRepaid >= cumulativeExpected) {
            return <Badge variant="default">Paid</Badge>;
        }
        
        if (systemDate && isPast(paymentDate, systemDate)) {
            return <Badge variant="destructive">Overdue</Badge>;
        }
        
        return <Badge variant="secondary">Due</Badge>;
    };

    
    const historyEvents = loan?.auditHistory?.map((event: any) => ({
      ...event,
      date: event.timestamp?.toDate(),
      userName: getUserName(event.userId),
    })).sort((a: any, b: any) => b.date - a.date) || [];


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
                        Comprehensive overview for loan <span className="font-mono">{loanId.substring(0,8)}...</span> for {customer?.name}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" asChild><Link href="/staff/loans/all-applications"><ArrowLeft className="mr-2 h-4 w-4"/> Back to All Loans</Link></Button>
                    <Button onClick={() => handlePrint()}><Printer className="mr-2 h-4 w-4" /> Print</Button>
                </div>
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
                    <Card className="print:border-none print:shadow-none">
                        <CardHeader>
                            <CardTitle>Loan Details</CardTitle>
                            <CardDescription>A high-level summary of the loan's current financial status.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Outstanding Principal</CardTitle><Wallet className="h-4 w-4 text-muted-foreground"/></CardHeader>
                                <CardContent><p className="text-2xl font-bold">MWK {loan.outstandingPrincipal?.toLocaleString() || loan.amount.toLocaleString()}</p></CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Total Arrears</CardTitle><FileWarning className="h-4 w-4 text-muted-foreground"/></CardHeader>
                                <CardContent><p className="text-2xl font-bold">MWK {(principalInArrears + interestInArrears).toLocaleString()}</p></CardContent>
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
                            <CardDescription>A detailed breakdown of any amounts that are past due as of the current system date.</CardDescription>
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
                                    <TableRow><TableCell>Principal in Arrears</TableCell><TableCell className="text-right">MWK {principalInArrears.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell></TableRow>
                                    <TableRow><TableCell>Interest in Arrears</TableCell><TableCell className="text-right">MWK {interestInArrears.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell></TableRow>
                                    <TableRow className="font-bold"><TableCell>Total Outstanding Balance</TableCell><TableCell className="text-right">MWK {(loan.outstandingPrincipal + interestInArrears).toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell></TableRow>
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
                                        <TableHead>Description</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {repayments && repayments.length > 0 ? (
                                        repayments.map((p, i) => (
                                            <TableRow key={i}>
                                                <TableCell>{format(p.date.toDate(), 'PPP')}</TableCell>
                                                <TableCell>{p.description}</TableCell>
                                                <TableCell className="text-right font-mono">MWK {p.repaymentAmount?.toLocaleString() || 0}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center h-24">
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
