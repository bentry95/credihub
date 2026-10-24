

'use client';

import React, { useState, useMemo, useEffect, useRef, Suspense } from 'react';
import { useForm, useFieldArray, FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
  useStorage,
} from '@/firebase';
import {
  collection,
  doc,
  serverTimestamp,
  query,
  where,
  getDocs,
  setDoc,
  runTransaction,
  limit,
  getDoc,
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Search,
  FilePlus2,
  Loader2,
  AlertCircle,
  PlusCircle,
  Trash2,
  Paperclip,
  CalendarIcon,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { AnimatePresence, motion } from 'framer-motion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { findCustomerWithNationalId } from '@/lib/customer-identification';

const MAX_STEPS = 4;

const collateralSchema = z.object({
  type: z.string().min(1, 'Type is required.'),
  estimatedValue: z.coerce.number().positive(),
  description: z.string().min(1, 'Description is required.'),
  photo: z.string().optional(),
});

const guarantorSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  idNumber: z.string().min(1, 'ID is required.'),
  phone: z.string().min(1, 'Phone is required.'),
  relationship: z.string().optional(),
});

const documentSchema = z.object({
  type: z.string().min(1, 'Type is required.'),
  file: z.string().min(1, 'File is required.'),
  fileName: z.string().optional(),
});

const loanApplicationSchema = z.object({
  customerId: z.string().min(1, 'A customer must be selected to proceed.'),
  customerName: z.string().optional(),
  branchId: z.string().min(1, 'Customer branch is required.'),
  loanProductId: z.string().min(1, 'Please select a loan product.'),
  amount: z.coerce.number().positive('Loan amount must be a positive number.'),
  term: z.coerce.number().int().positive('Term must be a positive integer.'),
  purpose: z.string().min(10, 'Please provide a brief purpose for the loan.'),
  dateApplied: z.date({ required_error: 'Application date is required.' }),
  collateral: z.array(collateralSchema).optional(),
  guarantors: z.array(guarantorSchema).optional(),
  documents: z.array(documentSchema).optional(),
});

type LoanApplicationFormValues = z.infer<typeof loanApplicationSchema>;

const CurrencyInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<'input'>
>(({ value, onChange, ...props }, ref) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const numValue = rawValue.replace(/,/g, '');
    if (!isNaN(Number(numValue)) && onChange) {
      e.target.value = numValue;
      onChange(e);
    }
  };

  const formattedValue = value ? Number(value).toLocaleString() : '';

  return (
    <Input
      ref={ref}
      value={formattedValue}
      onChange={handleChange}
      onFocus={(e) => (e.target.value = e.target.value.replace(/,/g, ''))}
      onBlur={(e) => {
        const num = parseFloat(e.target.value);
        if (!isNaN(num)) {
          e.target.value = num.toLocaleString();
        }
      }}
      {...props}
    />
  );
});
CurrencyInput.displayName = 'CurrencyInput';

function LoanOriginationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const customerIdFromUrl = searchParams.get('customerId');

  const [currentStep, setCurrentStep] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeLoans, setActiveLoans] = useState<any[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData, isLoading: isUserDataLoading } = useDoc(userDocRef);
  const institutionId = userData?.institutionId;
  
  const institutionDocRef = useMemoFirebase(
    () => (firestore && institutionId ? doc(firestore, 'institutions', institutionId) : null),
    [firestore, institutionId]
  );
  
  const isLoading = isAuthLoading || isUserDataLoading;


  const form = useForm<LoanApplicationFormValues>({
    resolver: zodResolver(loanApplicationSchema),
    defaultValues: {
      collateral: [],
      guarantors: [],
      documents: [],
      customerId: '',
      customerName: '',
      branchId: '',
      loanProductId: '',
      amount: 0,
      term: 0,
      purpose: '',
      dateApplied: new Date(),
    },
  });

  const selectedCustomer = {
    id: form.watch('customerId'),
    name: form.watch('customerName'),
  };

  const selectedProductId = form.watch('loanProductId');

  const loanProductsQuery = useMemoFirebase(
    () =>
      firestore && institutionId
        ? query(
            collection(
              firestore,
              'institutions',
              institutionId,
              'loanProducts'
            ),
            where('status', '==', 'Active')
          )
        : null,
    [firestore, institutionId]
  );
  const { data: loanProducts, isLoading: isProductsLoading } =
    useCollection(loanProductsQuery);

  const selectedProduct = useMemo(() => {
    if (!selectedProductId || !loanProducts) return null;
    return loanProducts.find(p => p.id === selectedProductId);
  }, [selectedProductId, loanProducts]);

  const canProceedWithApplication = useMemo(() => {
      if (!selectedProduct || activeLoans.length === 0) return true;
      return selectedProduct.allowMultipleActiveLoans;
  }, [selectedProduct, activeLoans]);
    
  const handleSearch = async () => {
    if (!firestore || !institutionId) {
      setSearchError("System not ready. Please try again in a moment.");
      return;
    }
    if (!searchTerm.trim()) {
        setSearchError("Please enter an account number to search.");
        return;
    }

    setIsSearching(true);
    setSearchError(null);
    const customersRef = collection(firestore, 'institutions', institutionId, 'customers');
    const lowercasedSearchTerm = searchTerm.trim().toLowerCase();

    const nameQuery = query(customersRef, where('name_lowercase', '>=', lowercasedSearchTerm), where('name_lowercase', '<=', lowercasedSearchTerm + '\uf8ff'), limit(5));
    const idNumberQuery = query(customersRef, where('idNumber_lowercase', '==', lowercasedSearchTerm), limit(5));
    const phoneQuery = query(customersRef, where('phone_lowercase', '==', lowercasedSearchTerm), limit(5));
    const accountNumberQuery = query(customersRef, where('accountNumber_lowercase', '==', lowercasedSearchTerm), limit(5));

    try {
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

      if (resultsMap.size > 0) {
          handleSelectCustomer(Array.from(resultsMap.values())[0]);
      } else {
        setSearchError('No customer found matching the search criteria.');
      }
    } catch (error) {
      console.error("Search failed:", error);
      setSearchError('An error occurred during the search.');
    } finally {
      setIsSearching(false);
    }
  };
  
  const handleSelectCustomer = async (customer: any) => {
    form.setValue('customerId', customer.id);
    form.setValue('customerName', customer.name);
    form.setValue('branchId', customer.branchId);
    setCurrentStep(1);

    if (firestore && institutionId) {
        setLoadingAccounts(true);
        const loanAppsRef = collection(firestore, 'institutions', institutionId, 'loanApplications');
        const runningLoansRef = collection(firestore, 'institutions', institutionId, 'runningLoans');

        const activeStatuses = ['Disbursed', 'Overdue'];
        const loanAppsQuery = query(loanAppsRef, where('customerId', '==', customer.id), where('status', 'in', activeStatuses));
        const runningLoansQuery = query(runningLoansRef, where('customerId', '==', customer.id), where('status', 'in', activeStatuses));
        
        const [loanAppsSnap, runningLoansSnap] = await Promise.all([getDocs(loanAppsQuery), getDocs(runningLoansQuery)]);

        const allActiveLoans = [...loanAppsSnap.docs, ...runningLoansSnap.docs].map(doc => ({ id: doc.id, ...doc.data() }));
        setActiveLoans(allActiveLoans);
        setLoadingAccounts(false);
    }
  };


  useEffect(() => {
    if (customerIdFromUrl && firestore && institutionId) {
        const fetchCustomer = async () => {
             const customerDocRef = doc(firestore, 'institutions', institutionId, 'customers', customerIdFromUrl);
             const docSnap = await getDoc(customerDocRef);
             if (docSnap.exists()) {
                 const customerData = {id: docSnap.id, ...docSnap.data()};
                 handleSelectCustomer(customerData);
             }
        }
        fetchCustomer();
    }
  }, [customerIdFromUrl, firestore, institutionId]);

  const {
    fields: collateralFields,
    append: appendCollateral,
    remove: removeCollateral,
  } = useFieldArray({ control: form.control, name: 'collateral' });
  const {
    fields: guarantorFields,
    append: appendGuarantor,
    remove: removeGuarantor,
  } = useFieldArray({ control: form.control, name: 'guarantors' });
  const {
    fields: documentFields,
    append: appendDocument,
    remove: removeDocument,
  } = useFieldArray({ control: form.control, name: 'documents' });

  const nextStep = () =>
    setCurrentStep((prev) => Math.min(prev + 1, MAX_STEPS - 1));
  const prevStep = () => setCurrentStep((prev) => Math.max(prev - 1, 0));

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'collateral' | 'document',
    index?: number
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        if (field === 'collateral' && index !== undefined) {
          form.setValue(`collateral.${index}.photo`, dataUrl);
        } else if (field === 'document' && index !== undefined) {
          form.setValue(`documents.${index}.file`, dataUrl);
          form.setValue(`documents.${index}.fileName`, file.name);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFormErrors = (errors: FieldErrors) => {
    const errorFields = Object.keys(errors);

    const fieldToStep: Record<string, number> = {
      loanProductId: 3,
      amount: 3,
      term: 3,
      purpose: 3,
      dateApplied: 3,
    };

    for (const field of errorFields) {
      if (fieldToStep[field] !== undefined) {
        setCurrentStep(fieldToStep[field]);
        return;
      }
      if (field === 'customerId') {
        setCurrentStep(0);
        return;
      }
    }
  };

  async function onSubmit(values: LoanApplicationFormValues) {
    if (!user || !institutionId || !storage || !values.customerId || !institutionDocRef) return;
  
    setIsSubmitting(true);
  
    try {
        const customerSnapshot = await getDoc(doc(firestore, 'institutions', institutionId, 'customers', values.customerId));
        if (!customerSnapshot.exists()) throw new Error('The selected customer no longer exists.');
        const customerData = customerSnapshot.data();
        const duplicate = await findCustomerWithNationalId(firestore, institutionId, customerData.idNumber, values.customerId);
        if (duplicate) throw new Error(`Loan applications are blocked: this national ID is also used by customer ${duplicate.id}. Resolve the duplicate ID in KYC Alerts first.`);
        await runTransaction(firestore, async (transaction) => {
            const instDoc = await transaction.get(institutionDocRef);
            if (!instDoc.exists()) {
                throw "Institution not found!";
            }
            const currentCounter = instDoc.data().loanCounter || 0;
            const newCounter = currentCounter + 1;
            const loanId = String(newCounter).padStart(7, '0');

            const uploadedCollateral = await Promise.all(
              (values.collateral || []).map(async (item, index) => {
                let downloadUrl = item.photo || null;
                if (item.photo && item.photo.startsWith('data:')) {
                  const storageRef = ref(
                    storage,
                    `institutions/${institutionId}/loanApplications/${loanId}/collateral_${index}`
                  );
                  const snapshot = await uploadString(
                    storageRef,
                    item.photo,
                    'data_url'
                  );
                  downloadUrl = await getDownloadURL(snapshot.ref);
                }
                return {
                  type: item.type,
                  estimatedValue: item.estimatedValue,
                  description: item.description,
                  photo: downloadUrl,
                };
              })
            );
    
            const uploadedDocuments = await Promise.all(
              (values.documents || []).map(async (docItem, index) => {
                let downloadUrl = docItem.file || null;
                if (docItem.file && docItem.file.startsWith('data:')) {
                  const storageRef = ref(
                    storage,
                    `institutions/${institutionId}/loanApplications/${loanId}/document_${
                      docItem.fileName || index
                    }`
                  );
                  const snapshot = await uploadString(
                    storageRef,
                    docItem.file,
                    'data_url'
                  );
                  downloadUrl = await getDownloadURL(snapshot.ref);
                }
                return {
                  type: docItem.type,
                  file: downloadUrl,
                  fileName: docItem.fileName || null,
                };
              })
            );
    
            const newLoanData = {
              id: loanId,
              institutionId: institutionId,
              branchId: values.branchId,
              customerId: values.customerId,
              loanProductId: values.loanProductId,
              amount: values.amount,
              outstandingPrincipal: values.amount,
              originalAmount: values.amount,
              term: values.term,
              purpose: values.purpose,
              dateApplied: values.dateApplied,
              collateral: uploadedCollateral,
              documents: uploadedDocuments,
              guarantors: values.guarantors || [],
              status: 'Application',
              submittedBy: user.uid,
              auditHistory: [
                {
                  userId: user.uid,
                  timestamp: new Date(),
                  action: 'Application Submitted',
                  details: 'Loan application created and submitted by staff.',
                },
              ],
            };
    
            const loanAppsRef = collection(
              firestore,
              'institutions',
              institutionId,
              'loanApplications'
            );
            const newDocRef = doc(loanAppsRef, loanId); 
            transaction.set(newDocRef, newLoanData);
            transaction.update(institutionDocRef, { loanCounter: newCounter });
        });
  
      toast({
        title: 'Application Submitted',
        description: `Loan application for ${values.customerName} has been created.`,
      });
      form.reset();
      setCurrentStep(0);
      router.push('/staff/loans/all-applications');
    } catch (e) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to submit application.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit, handleFormErrors)}
          className="space-y-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Loan Origination
              </h1>
              <p className="text-muted-foreground mt-1">
                Start a new loan application for a customer.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {['Customer', 'Security', 'Documents', 'Details'].map(
              (label, index) => (
                <React.Fragment key={index}>
                  <div
                    className={`flex items-center gap-2 ${
                      currentStep >= index
                        ? 'text-primary'
                        : 'text-muted-foreground'
                    }`}
                  >
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center border-2 ${
                        currentStep >= index ? 'border-primary' : ''
                      }`}
                    >
                      {currentStep > index ? '✓' : index + 1}
                    </div>
                    <span>{label}</span>
                  </div>
                  {index < MAX_STEPS - 1 && (
                    <div
                      className={`flex-1 h-0.5 ${
                        currentStep > index ? 'bg-primary' : 'bg-border'
                      }`}
                    ></div>
                  )}
                </React.Fragment>
              )
            )}
          </div>
          <FormField
            control={form.control}
            name="customerId"
            render={() => <FormMessage />}
          />

          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {currentStep === 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Step 1: Find the Customer</CardTitle>
                    <CardDescription>
                      Search for the customer by their account number, name, phone, or ID.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 max-w-sm">
                      <Input
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                      <Button
                        type="button"
                        onClick={handleSearch}
                        disabled={isSearching || !searchTerm || isLoading}
                      >
                        {isSearching || isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Search className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {searchError && (
                      <Alert variant="destructive" className="mt-4">
                        <AlertCircle className="h-4 w-4" />{' '}
                        <AlertTitle>Search Failed</AlertTitle>
                        <AlertDescription>{searchError}</AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              )}
              {currentStep === 1 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Step 2: Collateral & Guarantors</CardTitle>
                    <CardDescription>
                      Capture any security for the loan. This step is optional.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h3 className="font-semibold mb-2">Collateral</h3>
                      {collateralFields.map((field, index) => (
                        <div
                          key={field.id}
                          className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end border p-4 rounded-md mb-4"
                        >
                          <FormField
                            control={form.control}
                            name={`collateral.${index}.type`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Type</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`collateral.${index}.estimatedValue`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Value (MWK)</FormLabel>
                                <FormControl>
                                  <CurrencyInput {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`collateral.${index}.description`}
                            render={({ field }) => (
                              <FormItem className="md:col-span-2">
                                <FormLabel>Description / Serial No.</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`collateral.${index}.photo`}
                            render={() => (
                              <FormItem className="md:col-span-3">
                                <FormLabel>Photo</FormLabel>
                                <FormControl>
                                  <Input
                                    type="file"
                                    onChange={(e) =>
                                      handleFileChange(e, 'collateral', index)
                                    }
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            onClick={() => removeCollateral(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          appendCollateral({
                            type: '',
                            estimatedValue: 0,
                            description: '',
                          })
                        }
                      >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Collateral
                      </Button>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Guarantors</h3>
                      {guarantorFields.map((field, index) => (
                        <div
                          key={field.id}
                          className="flex gap-4 items-end border p-4 rounded-md mb-4"
                        >
                          <FormField
                            control={form.control}
                            name={`guarantors.${index}.name`}
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Name</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`guarantors.${index}.idNumber`}
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>ID Number</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`guarantors.${index}.phone`}
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                <FormLabel>Phone</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            onClick={() => removeGuarantor(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          appendGuarantor({
                            name: '',
                            idNumber: '',
                            phone: '',
                          })
                        }
                      >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Guarantor
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
              {currentStep === 2 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Step 3: Upload Documents</CardTitle>
                    <CardDescription>
                      Attach any required supporting documents. This step is
                      optional.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {documentFields.map((field, index) => (
                      <div
                        key={field.id}
                        className="flex gap-4 items-end border p-4 rounded-md mb-4"
                      >
                        <FormField
                          control={form.control}
                          name={`documents.${index}.type`}
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormLabel>Document Type</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select type..." />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="National ID">
                                    National ID
                                  </SelectItem>
                                  <SelectItem value="Payslip">Payslip</SelectItem>
                                  <SelectItem value="Business Permit">
                                    Business Permit
                                  </SelectItem>
                                  <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`documents.${index}.file`}
                          render={() => (
                            <FormItem className="flex-1">
                              <FormLabel>File</FormLabel>
                              <FormControl>
                                <Input
                                  type="file"
                                  onChange={(e) =>
                                    handleFileChange(e, 'document', index)
                                  }
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          onClick={() => removeDocument(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        appendDocument({ type: '', file: '', fileName: '' })
                      }
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Document
                    </Button>
                  </CardContent>
                </Card>
              )}
              {currentStep === 3 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Step 4: Application Details</CardTitle>
                    <CardDescription>
                      Select the product and enter the details for the loan
                      request.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {!canProceedWithApplication && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Multiple Loans Not Allowed</AlertTitle>
                            <AlertDescription>
                                This customer already has an active loan, and the selected product does not permit multiple concurrent loans.
                            </AlertDescription>
                        </Alert>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="loanProductId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Loan Product</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue
                                    placeholder={
                                      isProductsLoading
                                        ? 'Loading...'
                                        : 'Select a product'
                                    }
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {loanProducts?.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                          control={form.control}
                          name="dateApplied"
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel>Application Date</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant={"outline"}
                                      className={cn(
                                        "w-full pl-3 text-left font-normal",
                                        !field.value && "text-muted-foreground"
                                      )}
                                    >
                                      {field.value ? (
                                        format(field.value, "PPP")
                                      ) : (
                                        <span>Pick a date</span>
                                      )}
                                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Amount Requested</FormLabel>
                            <FormControl>
                              <CurrencyInput {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="term"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Term (months)</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="purpose"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Purpose of Loan</FormLabel>
                          <FormControl>
                            <Textarea {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 0}
            >
              Previous
            </Button>
            <div>
              {currentStep < MAX_STEPS - 1 ? (
                <Button
                  type="button"
                  onClick={nextStep}
                  disabled={!selectedCustomer.id}
                >
                  Next
                </Button>
              ) : (
                <Button type="submit" disabled={isSubmitting || !canProceedWithApplication}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Application'
                  )}
                </Button>
              )}
            </div>
          </div>
        </form>
      </Form>
    </>
  );
}

export default function LoanOriginationPage() {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <LoanOriginationContent />
    </React.Suspense>
  );
}
