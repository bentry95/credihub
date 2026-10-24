

'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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
  limit,
  doc,
  getDocs,
  getDoc,
} from 'firebase/firestore';
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
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  User,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  Wallet,
  Calendar,
  Heart,
  Landmark,
  Eye,
  CreditCard,
  BadgeCent,
  TrendingUp,
  FileWarning,
  Loader2,
  Users2,
  Building,
  Home,
  FileSignature,
  Coins,
} from 'lucide-react';
import { format, differenceInYears, isPast } from 'date-fns';
import Link from 'next/link';
import { loanStatusBadgeVariant } from '@/lib/utils';
import { calculateAmortization } from '@/lib/finance';


function CustomerEnquiriesPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const searchParams = useSearchParams();

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);


  useEffect(() => {
    async function fetchInitialData() {
      if (user && firestore) {
        const userDocRef = doc(firestore, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const instId = userDocSnap.data().institutionId;
          setInstitutionId(instId);

          const customerIdFromUrl = searchParams.get('id');
          if (customerIdFromUrl) {
            const customerDocRef = doc(firestore, 'institutions', instId, 'customers', customerIdFromUrl);
            const customerSnap = await getDoc(customerDocRef);
            if (customerSnap.exists()) {
              setSelectedCustomer({ id: customerSnap.id, ...customerSnap.data() });
            }
          }
        }
      }
      setIsLoading(false);
    }
    if (!isUserLoading) {
      fetchInitialData();
    }
  }, [isUserLoading, user, firestore, searchParams]);


  const customerId = selectedCustomer?.id;
  
  const { data: institutionData, isLoading: isInstitutionLoading } = useDoc(
    useMemoFirebase(() => (firestore && institutionId ? doc(firestore, 'institutions', institutionId) : null), [firestore, institutionId])
  );
  const systemDate = institutionData?.systemDate?.toDate();

  const loanApplicationsQuery = useMemoFirebase(
      () => firestore && institutionId && customerId
          ? query(collection(firestore, 'institutions', institutionId, 'loanApplications'), where('customerId', '==', customerId))
          : null,
      [firestore, institutionId, customerId]
  );
  const { data: loanApplications, isLoading: isLoanAppsLoading } = useCollection(loanApplicationsQuery);

  const runningLoansQuery = useMemoFirebase(
      () => firestore && institutionId && customerId
          ? query(collection(firestore, 'institutions', institutionId, 'runningLoans'), where('customerId', '==', customerId))
          : null,
      [firestore, institutionId, customerId]
  );
  const { data: runningLoans, isLoading: isRunningLoansLoading } = useCollection(runningLoansQuery);

  const loanProductsQuery = useMemoFirebase(
      () => firestore && institutionId ? collection(firestore, 'institutions', institutionId, 'loanProducts') : null,
      [firestore, institutionId]
  );
  const { data: loanProducts, isLoading: isProductsLoading } = useCollection(loanProductsQuery);
  
  const allCustomerLoans = useMemo(() => {
      const apps = loanApplications || [];
      const running = runningLoans || [];
      return [...apps, ...running];
  }, [loanApplications, runningLoans]);
  
  const activeLoans = allCustomerLoans.filter(l => l.status === 'Disbursed' || l.status === 'Overdue');
  const totalOutstandingBalance = activeLoans.reduce((sum, loan) => sum + (loan.outstandingPrincipal || 0), 0);
  
  const { loansInArrears } = useMemo(() => {
    if (!activeLoans || !loanProducts || !systemDate) return { loansInArrears: 0 };
    
    const overdueLoans = activeLoans.filter(loan => {
      const product = loanProducts.find(p => p.id === loan.loanProductId);
      if (!product || !loan.disbursalDate) return false;
      
      const { schedule } = calculateAmortization({
        principal: loan.amount,
        annualInterestRate: product.annualInterestRate,
        term: loan.term,
        tenureUnit: loan.tenureUnit,
        interestRateType: product.interestRateType,
        startDate: loan.disbursalDate.toDate(),
      });

      const totalPaid = (loan.amount || 0) - (loan.outstandingPrincipal || 0);
      const installmentsDue = schedule.filter(row => isPast(row.paymentDate, systemDate));
      const totalAmountDue = installmentsDue.reduce((sum, row) => sum + row.totalPayment, 0);

      return totalPaid < totalAmountDue;
    });

    return { loansInArrears: overdueLoans.length };
  }, [activeLoans, loanProducts, systemDate]);

  const savingsAccountsQuery = useMemoFirebase(
      () => firestore && customerId && institutionId
          ? collection(firestore, 'institutions', institutionId, 'customers', customerId, 'savingsAccounts')
          : null,
      [firestore, institutionId, customerId]
  );
  const { data: savingsAccounts, isLoading: isSavingsAccountsLoading } = useCollection(savingsAccountsQuery);

  const savingsProductsQuery = useMemoFirebase(
      () => firestore && institutionId ? collection(firestore, 'institutions', institutionId, 'savingsProducts') : null,
      [firestore, institutionId]
  );
  const { data: savingsProducts, isLoading: isSavingsProductsLoading } = useCollection(savingsProductsQuery);

  const shareProductsQuery = useMemoFirebase(
      () => firestore && institutionId ? collection(firestore, 'institutions', institutionId, 'shareProducts') : null,
      [firestore, institutionId]
  );
  const { data: shareProducts, isLoading: isShareProductsLoading } = useCollection(shareProductsQuery);

  const shareAccountsQuery = useMemoFirebase(
      () => firestore && customerId && institutionId
          ? collection(firestore, 'institutions', institutionId, 'customers', customerId, 'shareAccounts')
          : null,
      [firestore, institutionId, customerId]
  );
  const { data: shareAccounts, isLoading: isShareAccountsLoading } = useCollection(shareAccountsQuery);

  const totalShareCapital = shareAccounts?.reduce((sum, acc) => sum + (acc.totalValue || 0), 0) || 0;


  const performSearch = async () => {
    if (searchTerm.length < 3 || !firestore || !institutionId) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const customersRef = collection(firestore, 'institutions', institutionId, 'customers');
    const lowercasedSearchTerm = searchTerm.toLowerCase();
    
    const nameQuery = query(customersRef, where('name_lowercase', '>=', lowercasedSearchTerm), where('name_lowercase', '<=', lowercasedSearchTerm + '\uf8ff'), limit(5));
    const idNumberQuery = query(customersRef, where('idNumber_lowercase', '==', lowercasedSearchTerm), limit(5));
    const phoneQuery = query(customersRef, where('phone_lowercase', '==', lowercasedSearchTerm), limit(5));
    const accountNumberQuery = query(customersRef, where('accountNumber_lowercase', '==', lowercasedSearchTerm), limit(5));

    const [nameSnap, idNumberSnap, phoneSnap, accountNumberSnap] = await Promise.all([
      getDocs(nameQuery),
      getDocs(idNumberQuery),
      getDocs(phoneQuery),
      getDocs(accountNumberQuery),
    ]);

    const resultsMap = new Map();
    nameSnap.forEach(doc => resultsMap.set(doc.id, { id: doc.id, ...doc.data() }));
    idNumberSnap.forEach(doc => resultsMap.set(doc.id, { id: doc.id, ...doc.data() }));
    phoneSnap.forEach(doc => resultsMap.set(doc.id, { id: doc.id, ...doc.data() }));
    accountNumberSnap.forEach(doc => resultsMap.set(doc.id, { id: doc.id, ...doc.data() }));
    
    setSearchResults(Array.from(resultsMap.values()));
    setIsSearching(false);
  };

  const handleSelectCustomer = (customer: any) => {
    setSelectedCustomer(customer);
    setSearchTerm('');
    setSearchResults([]);
  };

  const getAge = (dob: any) => {
    if (!dob) return 'N/A';
    return differenceInYears(new Date(), dob.toDate()).toString();
  }

  const kycBadgeVariant = (status: string) => {
    switch (status) {
        case 'Verified': return 'default';
        case 'Pending': return 'secondary';
        case 'Rejected': return 'destructive';
        default: return 'outline';
    }
  }

  const getLoanProductName = (productId: string) => loanProducts?.find(p => p.id === productId)?.name || 'Unknown Product';
  const getSavingsProductName = (productId: string) => savingsProducts?.find(p => p.id === productId)?.name || 'Unknown Product';
  const getShareProductName = (productId: string) => shareProducts?.find(p => p.id === productId)?.name || 'Unknown Product';
  
  const savingsStatusBadgeVariant = (status: string) => {
    switch (status) {
        case 'Active': return 'default';
        case 'Dormant': return 'secondary';
        case 'Closed': return 'destructive';
        default: return 'outline';
    }
  }

  const isDataFullyLoading = isLoading || isLoanAppsLoading || isRunningLoansLoading || isProductsLoading || isSavingsAccountsLoading || isSavingsProductsLoading || isInstitutionLoading || isShareProductsLoading || isShareAccountsLoading;

  if (isLoading) {
      return (
          <div className="space-y-6">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-80 w-full" />
          </div>
      )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Customer Enquiries</CardTitle>
          <CardDescription>
            Search for a customer by name, account number, phone number, or national ID to
            view their 360° profile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative max-w-lg">
            <div className="flex items-center gap-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                placeholder="Search by Name, ID, Phone, or Account No..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                />
              <Button onClick={performSearch} disabled={isSearching}>
                  {isSearching && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                  Search
              </Button>
            </div>
            {searchResults.length > 0 && (
              <Card className="absolute top-full mt-2 w-full z-10 max-w-lg">
                <CardContent className="p-2">
                  {isSearching ? (
                    <div className="p-4 text-center">Loading...</div>
                  ) : (
                    searchResults.map((customer) => (
                      <div
                        key={customer.id}
                        className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer"
                        onClick={() => handleSelectCustomer(customer)}
                      >
                        <Avatar>
                          <AvatarImage src={customer.photoUrl} />
                          <AvatarFallback>{customer.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{customer.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {customer.accountNumber}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>

      {isDataFullyLoading && selectedCustomer ? (
          <Skeleton className="h-96 w-full" />
      ) : selectedCustomer ? (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center gap-4">
               <Avatar className="h-20 w-20">
                  <AvatarImage src={selectedCustomer.photoUrl || `https://picsum.photos/seed/${selectedCustomer.id}/80/80`} />
                  <AvatarFallback className="text-3xl">{selectedCustomer.name.charAt(0)}</AvatarFallback>
                </Avatar>
              <div>
                <CardTitle className="text-3xl">{selectedCustomer.name}</CardTitle>
                <CardDescription className="text-base">{selectedCustomer.accountNumber} &bull; {selectedCustomer.createdAt ? `Joined on ${format(selectedCustomer.createdAt.toDate(), 'PPP')}` : ''}</CardDescription>
              </div>
            </CardHeader>
          </Card>
          
          <Tabs defaultValue="personal-info">
            <TabsList>
              <TabsTrigger value="personal-info">Personal Information</TabsTrigger>
              <TabsTrigger value="loan-info">Loan Information</TabsTrigger>
              <TabsTrigger value="account-info">Savings Accounts</TabsTrigger>
              <TabsTrigger value="shares">Shares</TabsTrigger>
            </TabsList>
            <TabsContent value="personal-info" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                     <Card>
                        <CardHeader><CardTitle className="text-base">Personal Info</CardTitle></CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /> <span>{selectedCustomer.gender}</span></div>
                            <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /> <span>{getAge(selectedCustomer.dateOfBirth)} years old</span></div>
                            <div className="flex items-center gap-2"><Heart className="h-4 w-4 text-muted-foreground" /> <span>{selectedCustomer.maritalStatus}</span></div>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader><CardTitle className="text-base">Contact Details</CardTitle></CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> <span>{selectedCustomer.phone}</span></div>
                            <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> <span>{selectedCustomer.email || 'N/A'}</span></div>
                            <div className="flex items-start gap-2"><MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" /> <span>{selectedCustomer.currentResidence.physicalAddress}</span></div>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader><CardTitle className="text-base">Identification</CardTitle></CardHeader>
                        <CardContent className="space-y-3 text-sm">
                           <div className="flex items-center gap-2">KYC Status: <Badge variant={kycBadgeVariant(selectedCustomer.kycStatus)}>{selectedCustomer.kycStatus}</Badge></div>
                           <div className="flex items-start gap-2"><CreditCard className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" /> <span>{selectedCustomer.idType}: {selectedCustomer.idNumber}</span></div>
                           <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /> <span>Expires: {selectedCustomer.idExpiryDate ? format(selectedCustomer.idExpiryDate.toDate(), 'PPP') : 'N/A'}</span></div>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader><CardTitle className="text-base">Loan Snapshot</CardTitle></CardHeader>
                        <CardContent className="space-y-3 text-sm">
                           <div className="flex items-center gap-2"><Landmark className="h-4 w-4 text-muted-foreground" /> <span>{activeLoans.length} Active Loans</span></div>
                           <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-muted-foreground" /> <span>MWK {totalOutstandingBalance.toLocaleString()} Outstanding</span></div>
                           <div className="flex items-center gap-2"><FileWarning className="h-4 w-4 text-muted-foreground" /> <span>{loansInArrears} Loans in Arrears</span></div>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Coins className="h-5 w-5 text-muted-foreground"/> Share Capital</CardTitle></CardHeader>
                        <CardContent className="space-y-3 text-sm">
                           <div className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-muted-foreground" /> <span>{shareAccounts?.length || 0} Share Accounts</span></div>
                           <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-muted-foreground" /> <span>MWK {totalShareCapital.toLocaleString()} Total Value</span></div>
                        </CardContent>
                    </Card>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5 text-muted-foreground" /> Financial Profile</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div><p className="font-medium text-muted-foreground">Occupation</p><p>{selectedCustomer.occupationCategory}</p></div>
                                <div><p className="font-medium text-muted-foreground">Employer</p><p>{selectedCustomer.employerName || 'N/A'}</p></div>
                                <div><p className="font-medium text-muted-foreground">Position</p><p>{selectedCustomer.position || 'N/A'}</p></div>
                                <div><p className="font-medium text-muted-foreground">Monthly Income</p><p>MWK {selectedCustomer.primaryIncome?.toLocaleString()}</p></div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Home className="h-5 w-5 text-muted-foreground" /> Address Details</CardTitle>
                        </CardHeader>
                         <CardContent className="space-y-4">
                             <div>
                                <h4 className="font-medium mb-2 text-sm">Current Residence</h4>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                    <div><p className="text-muted-foreground">District</p><p>{selectedCustomer.currentResidence?.district}</p></div>
                                    <div><p className="text-muted-foreground">Area</p><p>{selectedCustomer.currentResidence?.area}</p></div>
                                    <div className="col-span-2"><p className="text-muted-foreground">Physical Address</p><p>{selectedCustomer.currentResidence?.physicalAddress}</p></div>
                                </div>
                            </div>
                             <div>
                                <h4 className="font-medium mb-2 text-sm">Home Village</h4>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                    <div><p className="text-muted-foreground">District</p><p>{selectedCustomer.homeVillage?.district}</p></div>
                                    <div><p className="text-muted-foreground">T/A</p><p>{selectedCustomer.homeVillage?.traditionalAuthority}</p></div>
                                    <div className="col-span-2"><p className="text-muted-foreground">Village</p><p>{selectedCustomer.homeVillage?.village}</p></div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
                 {(selectedCustomer.nextOfKin?.length > 0 || selectedCustomer.workmates?.length > 0 || selectedCustomer.spouseDetails?.name) && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Users2 className="h-5 w-5 text-muted-foreground" /> References</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                             {selectedCustomer.spouseDetails?.name && (
                                <div>
                                    <h4 className="font-medium mb-2">Spouse Details</h4>
                                    <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Workplace</TableHead></TableRow></TableHeader>
                                        <TableBody><TableRow><TableCell>{selectedCustomer.spouseDetails.name}</TableCell><TableCell>{selectedCustomer.spouseDetails.phone}</TableCell><TableCell>{selectedCustomer.spouseDetails.workplace}</TableCell></TableRow></TableBody>
                                    </Table>
                                </div>
                            )}
                            {selectedCustomer.nextOfKin?.length > 0 && (
                                <div>
                                    <h4 className="font-medium mb-2">Next of Kin</h4>
                                    <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Relationship</TableHead><TableHead>Phone</TableHead><TableHead>Residence</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {selectedCustomer.nextOfKin.map((kin: any, index: number) => <TableRow key={index}><TableCell>{kin.fullName}</TableCell><TableCell>{kin.relationship}</TableCell><TableCell>{kin.phone}</TableCell><TableCell>{kin.residence}</TableCell></TableRow>)}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                            {selectedCustomer.workmates?.length > 0 && (
                                <div>
                                    <h4 className="font-medium mb-2">Workmates</h4>
                                    <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Position</TableHead><TableHead>Contacts</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {selectedCustomer.workmates.map((mate: any, index: number) => <TableRow key={index}><TableCell>{mate.fullName}</TableCell><TableCell>{mate.position}</TableCell><TableCell>{mate.contacts}</TableCell></TableRow>)}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                 )}

            </TabsContent>
            <TabsContent value="loan-info">
              <Card>
                <CardHeader><CardTitle>Loan Accounts</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow><TableHead>Loan Product</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                            {isDataFullyLoading ? (
                                <TableRow><TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                            ) : allCustomerLoans.length > 0 ? (
                                allCustomerLoans.map(loan => (
                                    <TableRow key={loan.id}>
                                        <TableCell>{getLoanProductName(loan.loanProductId)}</TableCell>
                                        <TableCell>MWK {loan.amount.toLocaleString()}</TableCell>
                                        <TableCell><Badge variant={loanStatusBadgeVariant(loan.status)}>{loan.status}</Badge></TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="outline" size="sm" asChild>
                                                <Link href={`/staff/loans/loan-details/${loan.id}`}>View</Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={4} className="h-24 text-center">No loan accounts found.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="account-info">
              <Card>
                <CardHeader><CardTitle>Savings Accounts</CardTitle></CardHeader>
                 <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow><TableHead>Product</TableHead><TableHead>Balance</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
                        </TableHeader>
                        <TableBody>
                             {isDataFullyLoading ? (
                                <TableRow><TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                            ) : savingsAccounts && savingsAccounts.length > 0 ? (
                                savingsAccounts.map(account => (
                                    <TableRow key={account.id}>
                                        <TableCell>{getSavingsProductName(account.productId)}</TableCell>
                                        <TableCell>MWK {account.balance.toLocaleString()}</TableCell>
                                        <TableCell><Badge variant={savingsStatusBadgeVariant(account.status)}>{account.status}</Badge></TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="outline" size="sm">View</Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={4} className="h-24 text-center">No savings accounts found.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="shares">
                <Card>
                    <CardHeader><CardTitle>Share Accounts</CardTitle></CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow><TableHead>Product</TableHead><TableHead>Shares Held</TableHead><TableHead className="text-right">Total Value</TableHead></TableRow>
                            </TableHeader>
                            <TableBody>
                                {isDataFullyLoading ? (
                                    <TableRow><TableCell colSpan={3}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                                ) : shareAccounts && shareAccounts.length > 0 ? (
                                    shareAccounts.map(account => (
                                        <TableRow key={account.id}>
                                            <TableCell>{getShareProductName(account.productId)}</TableCell>
                                            <TableCell>{account.sharesHeld}</TableCell>
                                            <TableCell className="text-right">MWK {account.totalValue.toLocaleString()}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={3} className="h-24 text-center">No share accounts found.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>
          </Tabs>
        </>
      ) : (
         <div className="flex h-64 items-center justify-center">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <div className="mx-auto bg-muted rounded-full p-4 w-fit">
                        <Search className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <CardTitle className="mt-4">Search for a Customer</CardTitle>
                    <CardDescription>
                        Use the search bar above to find a customer and view their profile.
                    </CardDescription>
                </CardHeader>
            </Card>
        </div>
      )}
    </div>
  );
}

export default function CustomerEnquiriesWrapper() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CustomerEnquiriesPage />
    </Suspense>
  );
}
