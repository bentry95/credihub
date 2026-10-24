
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
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
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, query, where, Timestamp, addDoc, serverTimestamp, doc, limit, orderBy, getDocs, setDoc } from 'firebase/firestore';
import {
  Wallet,
  ArrowRightLeft,
  ArrowDown,
  ArrowUp,
  CircleDollarSign,
  PlayCircle,
  Loader2,
  AlertCircle,
  LogOut,
  ShieldAlert,
  HandCoins,
  Printer,
} from 'lucide-react';
import { startOfDay, endOfDay, format } from 'date-fns';
import { useTeller } from '@/context/TellerContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TransactionReceipt, type ReceiptData } from '@/components/staff/transaction-receipt';
import { useReactToPrint } from 'react-to-print';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useRouter } from 'next/navigation';

const endDaySchema = z.object({
  actualCounted: z.coerce.number().min(0, 'Counted amount cannot be negative.'),
});

export default function TellerDashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { dayStarted, startDay, openingFloat, setOpeningFloat, endDay } = useTeller();
  const { toast } = useToast();
  
  const [isEndDayOpen, setIsEndDayOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tellerConfig, setTellerConfig] = useState<any>(null);
  const [todaysTransactions, setTodaysTransactions] = useState<any[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);

  const userDocRef = useMemoFirebase(
    () => (user && user.uid ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData, isLoading: isUserLoading } = useDoc(userDocRef);
  const institutionId = userData?.institutionId;
  
  useEffect(() => {
    async function fetchDashboardData() {
        if (!firestore || !user || !institutionId) {
            if (!isUserLoading) setIsDataLoading(false);
            return;
        }

        setIsDataLoading(true);

        try {
            // Fetch teller configuration for the current user
            const tellersQuery = query(
                collection(firestore, 'institutions', institutionId, 'tellers'), 
                where('userId', '==', user.uid), 
                limit(1)
            );
            const tellerSnap = await getDocs(tellersQuery);
            
            if (tellerSnap.empty) {
                setTellerConfig(null);
                setIsDataLoading(false);
                return;
            }
            const currentTellerConfig = { id: tellerSnap.docs[0].id, ...tellerSnap.docs[0].data() };
            setTellerConfig(currentTellerConfig);

            // Fetch today's transactions for this teller
            const todayStart = startOfDay(new Date());
            const todayEnd = endOfDay(new Date());

            const transactionsQuery = query(
                collection(firestore, `institutions/${institutionId}/journals`),
                where('createdBy', '==', user.uid),
                where('createdAt', '>=', Timestamp.fromDate(todayStart)),
                where('createdAt', '<=', Timestamp.fromDate(todayEnd)),
                orderBy('createdAt', 'desc')
            );
            
            const transactionsSnap = await getDocs(transactionsQuery);
            setTodaysTransactions(transactionsSnap.docs.map(d => ({id: d.id, ...d.data()})));

        } catch (e) {
            console.error("Error fetching teller dashboard data:", e);
            setError("Failed to load dashboard data. Please refresh the page.");
        } finally {
            setIsDataLoading(false);
        }
    }

    if (!isUserLoading && institutionId) {
      fetchDashboardData();
    }
  }, [firestore, user, institutionId, isUserLoading]);


  const { totalCashIn, totalCashOut, totalTransactions } = useMemo(() => {
    if (!todaysTransactions || !tellerConfig) return { totalCashIn: 0, totalCashOut: 0, totalTransactions: 0 };
    
    let cashIn = 0;
    let cashOut = 0;
    
    todaysTransactions.forEach(journal => {
      // Exclude Opening Float from transaction summary
      if (journal.description.includes('Opening Float')) {
        return;
      }
      
      journal.transactions.forEach((trans: any) => {
        if (trans.accountId === tellerConfig.tillAccountId) {
          if (trans.debit) cashIn += trans.debit;
          if (trans.credit) cashOut += trans.credit;
        }
      });
    });
    
    return { totalCashIn: cashIn, totalCashOut: cashOut, totalTransactions: todaysTransactions.filter(j => !j.description.includes('Opening Float')).length };
  }, [todaysTransactions, tellerConfig]);

  const expectedBalance = openingFloat + totalCashIn - totalCashOut;
  const isLoading = isUserLoading || isDataLoading;
  const isTeller = !!tellerConfig;

  const endDayForm = useForm<z.infer<typeof endDaySchema>>({
    resolver: zodResolver(endDaySchema),
    defaultValues: { actualCounted: 0 },
  });
  
  const handleStartDay = () => {
    startDay(0);
    toast({ title: "Day Started", description: "Your till is now open for transactions." });
  };
  
  const handleReprint = (journal: any) => {
      const receiptData = {
          transactionId: journal.id,
          date: journal.date.toDate(),
          // These are placeholders, a full solution would require fetching related data
          customerName: 'Customer Name',
          memberId: 'CUS-XXXXXX',
          customerPhone: '099XXXXXXX',
          amount: journal.transactions.find((t: any) => t.debit > 0)?.debit || 0,
          description: journal.description,
          tellerName: user?.displayName || 'N/A',
          branchName: 'Branch Name',
          institutionId: institutionId,
      };
      sessionStorage.setItem('lastReceiptData', JSON.stringify(receiptData));
      router.push(`/staff/tellers/receipt/${receiptData.transactionId}`);
  };
  
  const isReceiptableTransaction = (journalId: string) => {
    return ['TRDEP', 'TRWID', 'TRSID'].some(prefix => journalId.startsWith(prefix));
  }

  async function onEndDaySubmit(values: z.infer<typeof endDaySchema>) {
    if (!user || !userData?.institutionId || !tellerConfig) return;
    setLoading(true);
    setError(null);
    try {
        const eodRef = collection(firestore, 'institutions', userData.institutionId, 'eodSubmissions');
        
        await addDoc(eodRef, {
            tellerId: user.uid,
            tellerName: user.displayName,
            branchId: tellerConfig.branchId,
            date: serverTimestamp(),
            openingBalance: openingFloat,
            totalCashIn,
            totalCashOut,
            expectedBalance,
            actualCounted: values.actualCounted,
            variance: values.actualCounted - expectedBalance,
            status: 'Pending Approval',
        });

        endDay();
        setIsEndDayOpen(false);
        toast({ title: "Day Ended", description: "Your end-of-day report has been submitted for approval." });

    } catch (e) {
        console.error(e);
        setError("Failed to end the day. Please try again.");
    } finally {
        setLoading(false);
    }
  }

   if (!isTeller && !isLoading) {
    return (
        <Card className="max-w-2xl mx-auto">
             <CardHeader>
                <CardTitle>Access Denied</CardTitle>
                <CardDescription>
                    You do not have permission to access this page.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Alert variant="destructive">
                    <HandCoins className="h-4 w-4" />
                    <AlertTitle>Not a Configured Teller</AlertTitle>
                    <AlertDescription>
                        Your user account is not configured as a teller. Please contact your administrator.
                    </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Teller Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              A real-time overview of your till for today, {format(new Date(), 'PPP')}.
            </p>
          </div>
          {!dayStarted ? (
              <Button onClick={handleStartDay}>
                  <PlayCircle className="mr-2 h-4 w-4" /> Start Day
              </Button>
          ) : (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span tabIndex={0}>
                            <Button variant="destructive" onClick={() => setIsEndDayOpen(true)} disabled={expectedBalance !== 0}>
                                <LogOut className="mr-2 h-4 w-4" /> End My Day
                            </Button>
                        </span>
                    </TooltipTrigger>
                    {expectedBalance !== 0 && (
                        <TooltipContent>
                            <p>Your till balance must be zero. Transfer excess cash to treasury.</p>
                        </TooltipContent>
                    )}
                </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {!dayStarted ? (
            <Card className="flex items-center justify-center h-96">
                <CardHeader className="text-center">
                    <PlayCircle className="mx-auto h-12 w-12 text-muted-foreground" />
                    <CardTitle className="mt-4">Your Day Has Not Started</CardTitle>
                    <CardDescription>Click the "Start Day" button to begin your session.</CardDescription>
                </CardHeader>
            </Card>
        ) : (
          <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                   <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                          <CardTitle className="text-sm font-medium">Current Till Balance</CardTitle>
                          <Wallet className="h-5 w-5 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                          {isLoading ? <Skeleton className="h-8 w-3/4" /> : <div className="text-3xl font-bold">MWK {expectedBalance.toLocaleString()}</div>}
                          <p className="text-xs text-muted-foreground">Expected cash in your drawer.</p>
                      </CardContent>
                  </Card>
                  <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                          <CardTitle className="text-sm font-medium">Today's Transactions</CardTitle>
                          <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                          {isLoading ? <Skeleton className="h-8 w-1/4" /> : <div className="text-3xl font-bold">{totalTransactions}</div>}
                          <p className="text-xs text-muted-foreground">Total number of monetary transactions.</p>
                      </CardContent>
                  </Card>
                  <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                          <CardTitle className="text-sm font-medium">Max Till Holding</CardTitle>
                          <ShieldAlert className="h-5 w-5 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                          {isLoading ? <Skeleton className="h-8 w-3/4" /> : <div className="text-3xl font-bold">MWK {tellerConfig?.maxCashLimit?.toLocaleString() || 'N/A'}</div>}
                          <p className="text-xs text-muted-foreground">Your maximum allowed cash holding.</p>
                      </CardContent>
                  </Card>
                   <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                          <CardTitle className="text-sm font-medium">Max Withdrawal Limit</CardTitle>
                          <ArrowUp className="h-5 w-5 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                          {isLoading ? <Skeleton className="h-8 w-3/4" /> : <div className="text-3xl font-bold">MWK {tellerConfig?.maxWithdrawalLimit?.toLocaleString() || 'N/A'}</div>}
                          <p className="text-xs text-muted-foreground">Max cash withdrawal per transaction.</p>
                      </CardContent>
                  </Card>
              </div>

              <Card>
                  <CardHeader>
                  <CardTitle>My Till Summary & Recent Transactions</CardTitle>
                  <CardDescription>
                      A detailed breakdown of your cash movements for today.
                  </CardDescription>
                  </CardHeader>
                  <CardContent>
                  <Table>
                      <TableBody>
                        {isLoading ? (
                            Array.from({ length: 4 }).map((_, i) => (
                            <TableRow key={i}>
                                <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                <TableCell className="text-right"><Skeleton className="h-5 w-24 ml-auto" /></TableCell>
                            </TableRow>
                            ))
                        ) : (
                            <>
                            <TableRow>
                                <TableCell className="font-medium flex items-center gap-2"><CircleDollarSign className="h-5 w-5 text-muted-foreground" />Opening Float</TableCell>
                                <TableCell className="text-right font-mono">{openingFloat.toLocaleString()}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium flex items-center gap-2 text-green-600"><ArrowDown className="h-5 w-5" />Total Cash In (Debits)</TableCell>
                                <TableCell className="text-right font-mono text-green-600">+ {totalCashIn.toLocaleString()}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell className="font-medium flex items-center gap-2 text-red-600"><ArrowUp className="h-5 w-5" />Total Cash Out (Credits)</TableCell>
                                <TableCell className="text-right font-mono text-red-600">- {totalCashOut.toLocaleString()}</TableCell>
                            </TableRow>
                            <TableRow className="bg-muted hover:bg-muted font-bold"><TableCell className="flex items-center gap-2"><Wallet className="h-5 w-5" />Expected Cash in Drawer</TableCell><TableCell className="text-right font-mono text-lg">{expectedBalance.toLocaleString()}</TableCell>
                            </TableRow>
                            </>
                        )}
                      </TableBody>
                  </Table>
                  <Table className="mt-6">
                      <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Description</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                      <TableBody>
                          {isLoading ? (
                            <TableRow><TableCell colSpan={5}><Skeleton className="h-20 w-full" /></TableCell></TableRow>
                          ) : todaysTransactions && todaysTransactions.length > 0 ? (
                              todaysTransactions.map(journal => (
                                  <TableRow key={journal.id}>
                                      <TableCell>{format(journal.createdAt.toDate(), 'p')}</TableCell>
                                      <TableCell>{journal.description}</TableCell>
                                      <TableCell>MWK {(journal.transactions.find((t: any) => t.debit > 0)?.debit || 0).toLocaleString()}</TableCell>
                                      <TableCell><Badge variant={journal.status === 'Posted' ? 'default' : 'secondary'}>{journal.status}</Badge></TableCell>
                                      <TableCell className="text-right">
                                        {isReceiptableTransaction(journal.id) && (
                                            <Button variant="ghost" size="icon" onClick={() => handleReprint(journal)}><Printer className="h-4 w-4" /></Button>
                                        )}
                                      </TableCell>
                                  </TableRow>
                              ))
                          ) : (
                              <TableRow><TableCell colSpan={5} className="text-center h-24">No transactions yet today.</TableCell></TableRow>
                          )}
                      </TableBody>
                  </Table>
                  </CardContent>
              </Card>
          </>
        )}

        <Dialog open={isEndDayOpen} onOpenChange={setIsEndDayOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>End Your Day</DialogTitle>
                  <DialogDescription>
                      Confirm your final cash balance to close your day. This will submit your EOD report for supervisory approval.
                  </DialogDescription>
              </DialogHeader>
              <Form {...endDayForm}>
                  <form onSubmit={endDayForm.handleSubmit(onEndDaySubmit)} className="space-y-4">
                      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4"/><AlertTitle>{error}</AlertTitle></Alert>}
                      <div className="p-4 border rounded-md text-sm space-y-2">
                          <div className="flex justify-between"><span>Expected Balance:</span> <span className="font-bold">MWK {expectedBalance.toLocaleString()}</span></div>
                      </div>
                      <FormField
                          control={endDayForm.control}
                          name="actualCounted"
                          render={({ field }) => (
                          <FormItem>
                              <FormLabel>Actual Counted Cash (MWK)</FormLabel>
                              <FormControl>
                              <Input type="number" placeholder="Enter your final counted cash" {...field} />
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                          )}
                      />
                       <DialogFooter>
                          <Button type="button" variant="ghost" onClick={() => setIsEndDayOpen(false)}>Cancel</Button>
                          <Button type="submit" disabled={loading}>
                              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                              Submit EOD Report
                          </Button>
                      </DialogFooter>
                  </form>
              </Form>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
