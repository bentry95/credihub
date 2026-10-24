'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import {
  collection,
  query,
  where,
  doc,
  updateDoc,
  runTransaction,
  serverTimestamp,
  getDocs,
} from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  ArrowRight,
  HandCoins,
  Loader2,
  FileWarning,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export default function LoanPayoutAssignmentPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [loading, setLoading] = useState<string | null>(null);
  const [selectedTellers, setSelectedTellers] = useState<Record<string, string>>({});
  
  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);
  const institutionId = userData?.institutionId;

  const chiefCashierConfigQuery = useMemoFirebase(
    () =>
      firestore && user && institutionId
        ? query(
            collection(firestore, 'institutions', institutionId, 'tellers'),
            where('userId', '==', user.uid),
            where('role', '==', 'Chief Cashier')
          )
        : null,
    [firestore, user, institutionId]
  );
  const { data: chiefCashierConfigData } = useCollection(chiefCashierConfigQuery);
  const chiefCashierConfig = chiefCashierConfigData?.[0];

  const regularTellersQuery = useMemoFirebase(
    () =>
      firestore && institutionId
        ? query(
            collection(firestore, 'institutions', institutionId, 'tellers'),
            where('role', '==', 'Regular Cashier'),
            where('status', '==', 'Active')
          )
        : null,
    [firestore, institutionId]
  );
  const { data: regularTellers, isLoading: isTellersLoading } =
    useCollection(regularTellersQuery);
    
  const pendingPayoutsQuery = useMemoFirebase(() => {
    if (!firestore || !institutionId) return null;
    return query(
      collection(firestore, 'institutions', institutionId, 'loanApplications'),
      where('status', '==', 'Pending Payout')
    );
  }, [firestore, institutionId]);
  const { data: pendingPayouts, isLoading: isPayoutsLoading } = useCollection(pendingPayoutsQuery);


  const customersQuery = useMemoFirebase(
    () =>
      firestore && institutionId
        ? collection(firestore, 'institutions', institutionId, 'customers')
        : null,
    [firestore, institutionId]
  );
  const { data: customers, isLoading: isCustomersLoading } =
    useCollection(customersQuery);

  const staffQuery = useMemoFirebase(
    () =>
      firestore && institutionId
        ? query(
            collection(firestore, 'users'),
            where('institutionId', '==', institutionId)
          )
        : null,
    [firestore, institutionId]
  );
  const { data: staff, isLoading: isStaffLoading } = useCollection(staffQuery);

  const getCustomerName = (customerId: string) => customers?.find((c) => c.id === customerId)?.name || '...';
  const getStaffName = (userId: string) => staff?.find((s) => s.uid === userId)?.name || '...';

  const handleAssignTeller = async (loan: any) => {
    const tellerId = selectedTellers[loan.id];
    if (!tellerId || !firestore || !institutionId || !chiefCashierConfig || !user) return;
    setLoading(loan.id);

    const teller = regularTellers?.find(t => t.id === tellerId);
    
    if (!teller) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not find teller data.'});
        setLoading(null);
        return;
    }

    try {
        const institutionDocRef = doc(firestore, 'institutions', institutionId);

        await runTransaction(firestore, async (transaction) => {
            const instDoc = await transaction.get(institutionDocRef);
            if (!instDoc.exists()) throw "Institution not found";

            const journalBatchCounter = instDoc.data().journalBatchCounter || 0;
            const newBatchNumber = journalBatchCounter + 1;
            const newBatchId = `bat${String(newBatchNumber).padStart(7, '0')}`;

            // Create journal for vault to teller transfer
            const journalsRef = collection(firestore, 'institutions', institutionId, 'journals');
            const newJournalDocRef = doc(journalsRef, newBatchId);
            const journalData = {
                id: newBatchId,
                institutionId,
                branchId: teller.branchId,
                date: serverTimestamp(),
                description: `Cash push for loan payout ${loan.id} to ${getStaffName(teller.userId)}`,
                transactions: [
                    { accountId: teller.tillAccountId, debit: loan.netDisbursementAmount, credit: 0 },
                    { accountId: chiefCashierConfig.tillAccountId, debit: 0, credit: loan.netDisbursementAmount },
                ],
                status: 'Posted', // Auto-approved as it's an internal transfer by an authorized user
                createdBy: user.uid,
                createdAt: serverTimestamp(),
            };
            transaction.set(newJournalDocRef, journalData);
            
            // Update loan status and assign teller
            const loanRef = doc(firestore, 'institutions', institutionId, 'loanApplications', loan.id);
            transaction.update(loanRef, {
                status: 'Ready for Payout',
                assignedTellerId: teller.userId,
            });

            transaction.update(institutionDocRef, { journalBatchCounter: newBatchNumber });
        });

        toast({ title: 'Payout Assigned', description: `Loan for ${getCustomerName(loan.customerId)} assigned to ${getStaffName(teller.userId)}.` });
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to assign payout.' });
    } finally {
        setLoading(null);
    }
  };
  
  const isLoading = isTellersLoading || isCustomersLoading || isStaffLoading || isPayoutsLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Loan Payout Assignment</h1>
          <p className="text-muted-foreground mt-1">
            Assign loan payouts to tellers and push the required cash to their tills.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Payout Queue</CardTitle>
          <CardDescription>
            These loans have been funded and are waiting to be assigned to a teller for cash payout.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Net Payout Amount</TableHead>
                <TableHead>Assign To Teller</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-9 w-48" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-9 w-32 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : pendingPayouts && pendingPayouts.length > 0 ? (
                pendingPayouts.map((loan) => (
                  <TableRow key={loan.id}>
                    <TableCell className="font-medium">{getCustomerName(loan.customerId)}</TableCell>
                    <TableCell>MWK {loan.netDisbursementAmount.toLocaleString()}</TableCell>
                    <TableCell>
                      <Select
                        value={selectedTellers[loan.id] || ''}
                        onValueChange={(value) => setSelectedTellers(prev => ({...prev, [loan.id]: value}))}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Select a teller..." />
                        </SelectTrigger>
                        <SelectContent>
                          {regularTellers
                            ?.filter(t => t.branchId === loan.branchId)
                            .map(teller => (
                              <SelectItem key={teller.id} value={teller.id}>
                                {getStaffName(teller.userId)}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => handleAssignTeller(loan)}
                        disabled={!selectedTellers[loan.id] || loading === loan.id}
                      >
                        {loading === loan.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ArrowRight className="mr-2 h-4 w-4" />}
                        Assign & Push Cash
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="p-4 bg-muted rounded-full">
                            <FileWarning className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold">No Payouts Pending</h3>
                        <p className="text-muted-foreground">
                            There are no funded loans waiting to be assigned for payout.
                        </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
