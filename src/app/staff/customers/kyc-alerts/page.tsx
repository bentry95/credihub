'use client';

import { useState, useMemo } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, UserRoundX } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { format, differenceInDays, addDays } from 'date-fns';

type AlertType = 'Expired' | 'Expiring Soon' | 'Missing Info';

interface KycAlert {
  customer: any;
  type: AlertType;
  details: string;
}

export default function KycAlertsPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);

  const customersQuery = useMemoFirebase(
    () =>
      firestore && userData?.institutionId
        ? collection(
            firestore,
            'institutions',
            userData.institutionId,
            'customers'
          )
        : null,
    [firestore, userData]
  );
  const { data: customers, isLoading: isCustomersLoading } = useCollection(customersQuery);

  const kycAlerts = useMemo(() => {
    if (!customers) return [];
    
    const alerts: KycAlert[] = [];
    const today = new Date();
    const thirtyDaysFromNow = addDays(today, 30);

    customers.forEach(customer => {
      if (!customer.idType || !customer.idNumber) {
        alerts.push({
          customer,
          type: 'Missing Info',
          details: 'Customer is missing an ID Type or ID Number.',
        });
      }

      if (customer.idExpiryDate) {
        const expiryDate = customer.idExpiryDate.toDate();
        if (expiryDate < today) {
          alerts.push({
            customer,
            type: 'Expired',
            details: `ID expired on ${format(expiryDate, 'PPP')}.`,
          });
        } else if (expiryDate <= thirtyDaysFromNow) {
          alerts.push({
            customer,
            type: 'Expiring Soon',
            details: `ID expires in ${differenceInDays(expiryDate, today)} days.`,
          });
        }
      }
    });

    return alerts;
  }, [customers]);

  const getBadgeVariant = (type: AlertType) => {
    switch (type) {
      case 'Expired': return 'destructive';
      case 'Expiring Soon': return 'secondary';
      case 'Missing Info': return 'outline';
      default: return 'outline';
    }
  };

  const filteredAlerts = (type: AlertType | 'All') => {
    if (type === 'All') return kycAlerts;
    return kycAlerts.filter(alert => alert.type === type);
  };
  
  const tabs = [
    { value: 'all', label: 'All Alerts', alerts: filteredAlerts('All') },
    { value: 'expired', label: 'ID Expired', alerts: filteredAlerts('Expired') },
    { value: 'expiring', label: 'ID Expiring Soon', alerts: filteredAlerts('Expiring Soon') },
    { value: 'missing', label: 'Missing Info', alerts: filteredAlerts('Missing Info') },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">KYC Alerts</h1>
          <p className="text-muted-foreground mt-1">
            A proactive compliance report to manage customer documentation.
          </p>
        </div>
         <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export to Excel
        </Button>
      </div>
      
      <Card>
          <CardHeader>
              <CardTitle>Customer KYC Status</CardTitle>
              <CardDescription>
                  This report automatically flags customers with expired, expiring, or incomplete KYC documents.
              </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all">
                <TabsList>
                    {tabs.map(tab => (
                        <TabsTrigger key={tab.value} value={tab.value}>
                            {tab.label} ({isCustomersLoading ? '...' : tab.alerts.length})
                        </TabsTrigger>
                    ))}
                </TabsList>
                {tabs.map(tab => (
                    <TabsContent key={tab.value} value={tab.value}>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Alert Reason</TableHead>
                                    <TableHead>Details</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                             <TableBody>
                                {isCustomersLoading ? (
                                     Array.from({ length: 3 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                                            <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-64" /></TableCell>
                                            <TableCell className="text-right"><Skeleton className="h-9 w-28" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : tab.alerts.length > 0 ? (
                                    tab.alerts.map(({ customer, type, details }, index) => (
                                        <TableRow key={`${customer.id}-${index}`}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar>
                                                        <AvatarImage src={customer.photoUrl} />
                                                        <AvatarFallback>{customer.name.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <div className="font-medium">{customer.name}</div>
                                                        <div className="text-xs text-muted-foreground">{customer.accountNumber}</div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={getBadgeVariant(type)}>{type}</Badge>
                                            </TableCell>
                                            <TableCell>{details}</TableCell>
                                            <TableCell className="text-right">
                                                <Button size="sm" variant="outline" disabled>Take Action</Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-48 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="p-4 bg-muted rounded-full">
                                                    <UserRoundX className="h-10 w-10 text-muted-foreground" />
                                                </div>
                                                <h3 className="text-lg font-semibold">No Alerts</h3>
                                                <p className="text-muted-foreground">There are no KYC alerts in this category.</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TabsContent>
                ))}
            </Tabs>
          </CardContent>
      </Card>
    </div>
  );
}