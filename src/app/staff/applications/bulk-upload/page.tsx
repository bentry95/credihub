
'use client';

import { useState, useRef, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Upload, Briefcase, Users, Landmark, FileCheck, FileX, Loader2 } from 'lucide-react';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, doc, writeBatch, runTransaction, serverTimestamp, query, where, setDoc, getDocs } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Papa from 'papaparse';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBranch } from '@/context/BranchContext';
import { Input } from '@/components/ui/input';
import { normalizeNationalId } from '@/lib/customer-identification';

const loanProductHeaders = [
    "name", "description", "status", "loanType", "minAmount", "maxAmount",
    "interestRateType", "interestCalculationFrequency", "amortizationMethod",
    "annualInterestRate", "repaymentFrequency", "minTerm", "maxTerm", "tenureUnit",
    "gracePeriod", "disbursementMethods", "repaymentMethods",
    "loanPortfolioAccountId", "interestIncomeAccountId", "minMemberDuration",
    "minSavingsBalance", "allowMultipleActiveLoans", "allowLoanTopUp",
    "allowRescheduling", "allowEarlyRepayment", "linkedFees"
];

const customerTemplateHeaders = [
    "firstName", "middleName", "lastName", "dateOfBirth", "gender", "maritalStatus",
    "nationality", "numberOfDependents", "idType", "idNumber", "idExpiryDate",
    "phone", "alternatePhone", "email", "currentResidence.physicalAddress",
    "currentResidence.district", "currentResidence.area", "homeVillage.district",
    "homeVillage.traditionalAuthority", "homeVillage.village", "residenceType",
    "monthlyRent", "residenceStayInYears", "occupationCategory", "position",
    "employerName", "employerLocation", "officePhone", "yearsOfService",
    "primaryIncome", "spouseDetails.name", "spouseDetails.phone",
    "spouseDetails.workplace", "branchId", "savingsProductId", "isPep",
    "accountPurpose"
];


const loanUploadHeaders = [
    "Loan ID", "Customer ID", "Customer National ID", "Institution Code", "Branch Code", "Loan Product Code", "Loan Status",
    "Principal Amount", "Interest Rate (%)", "Interest Calculation Method", "Loan Tenure (Months)", "Repayment Frequency", "Grace Period (Days)",
    "Appraised By (Staff ID)", "Appraised Amount", "Approved By (Staff ID)", "Approval Date", "Approval Level",
    "Disbursement Date", "Disbursement Method", "Disbursement Account", "Disbursed Amount",
    "First Repayment Date", "Installment Amount", "Total Installments", "Loan Maturity Date",
    "Processing Fee", "Insurance Fee", "Other Charges", "Net Disbursed Amount",
    "Collateral Required", "Collateral Type", "Collateral Value", "Guarantor Name", "Guarantor Phone",
    "Outstanding Balance", "Arrears Amount", "Days in Arrears", "Last Payment Date",
    "Created By", "Created Date", "Upload Batch ID", "Validation Status", "Rejection Reason"
];


type UploadType = 'loanProducts' | 'customers' | 'loans';


export default function BulkUploadPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [uploadType, setUploadType] = useState<UploadType | null>(null);
    const [uploadedData, setUploadedData] = useState<any[]>([]);
    const [uploadErrors, setUploadErrors] = useState<string[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedSavingsProduct, setSelectedSavingsProduct] = useState<string | null>(null);
    const { availableBranches } = useBranch();


    const userDocRef = useMemoFirebase(
        () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
        [firestore, user]
    );
    const { data: userData } = useDoc(userDocRef);

    const productsQuery = useMemoFirebase(
        () =>
          firestore && userData?.institutionId
            ? collection(firestore, 'institutions', userData.institutionId, 'loanProducts')
            : null,
        [firestore, userData]
    );
    const { data: products, isLoading: isProductsLoading } = useCollection(productsQuery);
    
    const savingsProductsQuery = useMemoFirebase(
      () =>
        firestore && userData?.institutionId
          ? query(collection(firestore, 'institutions', userData.institutionId, 'savingsProducts'))
          : null,
      [firestore, userData]
    );
    const { data: savingsProducts, isLoading: isSavingsProductsLoading } = useCollection(savingsProductsQuery);

    const feesQuery = useMemoFirebase(
        () => (firestore && userData?.institutionId ? collection(firestore, 'institutions', userData.institutionId, 'fees') : null),
        [firestore, userData]
    );
    const { data: fees, isLoading: isFeesLoading } = useCollection(feesQuery);

    const handleDataChange = (index: number, key: string, value: string) => {
        const newData = [...uploadedData];
        newData[index][key] = value;
        setUploadedData(newData);
    };


    const handleDownload = (headers: string[], filename: string) => {
        let csvContent = `${headers.join(",")}\n`;
        if (filename.includes('customer_upload_template')) {
            const branchIndex = headers.indexOf('branchId');
            const branches = [...availableBranches].sort((a, b) => (a.code || a.id).localeCompare(b.code || b.id));
            branches.forEach(branch => {
                const row = new Array(headers.length).fill('');
                if (branchIndex !== -1) row[branchIndex] = branch.code || branch.id;
                csvContent += `${row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')}\n`;
            });
        } else {
          const exampleRow = new Array(headers.length).fill('');
          csvContent += `${exampleRow.join(",")}\n`;
        }
        const encodedUri = `data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`;
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && uploadType) {
            setIsUploading(true);
            setUploadedData([]);
            setUploadErrors([]);
            setSelectedSavingsProduct(null);

            let requiredHeaders: string[] = [];
            if (uploadType === 'loanProducts') {
                requiredHeaders = ["name", "loanType", "annualInterestRate"];
            } else if (uploadType === 'customers') {
                requiredHeaders = ["firstName", "lastName", "idNumber", "phone", "branchId", "savingsProductId"];
            } else if (uploadType === 'loans') {
                requiredHeaders = ["customerId", "loanProductId", "amount", "term"];
            }
            
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    const validationErrors: string[] = [];
                    const headers = results.meta.fields || [];
                    requiredHeaders.forEach(header => {
                        if (!headers.includes(header)) {
                            validationErrors.push(`Missing required column: ${header}`);
                        }
                    });

                    if (validationErrors.length > 0) {
                        setUploadErrors(validationErrors);
                    } else {
                        const rows = results.data as any[];
                        setUploadedData(uploadType === 'customers'
                            ? rows.filter(row => [row.firstName, row.lastName, row.idNumber, row.phone].some(value => String(value || '').trim()))
                            : rows);
                    }
                    setIsUploading(false);
                },
                error: (error: any) => {
                    setUploadErrors([`Failed to parse CSV: ${error.message}`]);
                    setIsUploading(false);
                }
            });
        }
    };
    
    const handleCancelUpload = () => {
        setUploadedData([]);
        setUploadErrors([]);
        setUploadType(null);
        setSelectedSavingsProduct(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }
    
    const handleSaveLoanProductsToDb = async () => {
        if (!firestore || !userData?.institutionId || uploadedData.length === 0) return;

        setIsSaving(true);
        try {
            const batch = writeBatch(firestore);
            const productsRef = collection(firestore, 'institutions', userData.institutionId, 'loanProducts');

            uploadedData.forEach(row => {
                const newDocRef = doc(productsRef); // Auto-generate ID
                const productData = {
                    id: newDocRef.id,
                    institutionId: userData.institutionId,
                    code: newDocRef.id.substring(0, 7).toUpperCase(),
                    name: row['name'],
                    description: row['description'] || '',
                    status: row['status'] || 'Active',
                    loanType: row['loanType'] || 'Personal',
                    minAmount: parseFloat(row['minAmount']) || 0,
                    maxAmount: parseFloat(row['maxAmount']) || 0,
                    interestRateType: row['interestRateType'] || 'Reducing Balance',
                    interestCalculationFrequency: row['interestCalculationFrequency'] || 'Monthly',
                    amortizationMethod: row['amortizationMethod'] || 'Equal Installments',
                    annualInterestRate: parseFloat(row['annualInterestRate']) || 0,
                    repaymentFrequency: row['repaymentFrequency'] || 'Monthly',
                    minTerm: parseInt(row['minTerm']) || 1,
                    maxTerm: parseInt(row['maxTerm']) || 12,
                    tenureUnit: row['tenureUnit'] || 'Months',
                    gracePeriod: parseInt(row['gracePeriod']) || 0,
                    loanPortfolioAccountId: row['loanPortfolioAccountId'] || '1210', 
                    interestIncomeAccountId: row['interestIncomeAccountId'] || '4110', 
                    allowMultipleActiveLoans: row['allowMultipleActiveLoans'] === 'TRUE',
                    allowLoanTopUp: row['allowLoanTopUp'] === 'TRUE',
                    allowRescheduling: row['allowRescheduling'] === 'TRUE',
                    allowEarlyRepayment: row['allowEarlyRepayment'] === 'TRUE',
                };
                batch.set(newDocRef, productData);
            });
            
            await batch.commit();

            toast({
                title: 'Upload Successful',
                description: `${uploadedData.length} loan products have been saved successfully.`
            });
            handleCancelUpload();

        } catch (error) {
            console.error("Error saving products:", error);
            toast({
                variant: 'destructive',
                title: 'Upload Failed',
                description: 'An error occurred while saving the products. Please check the data and try again.'
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveCustomersToDb = async () => {
        if (!firestore || !userData?.institutionId || uploadedData.length === 0 ) {
            toast({
                variant: 'destructive',
                title: 'Missing Information',
                description: 'Please ensure data is uploaded.',
            });
            return;
        }

        setIsSaving(true);
        const institutionRef = doc(firestore, 'institutions', userData.institutionId);
        const customersRef = collection(firestore, 'institutions', userData.institutionId, 'customers');

        let onboardingFee = 0;
        
        try {
            const seenNationalIds = new Set<string>();
            for (const [index, row] of uploadedData.entries()) {
                const nationalId = normalizeNationalId(row.idNumber);
                if (!nationalId) {
                    throw new Error(`Row ${index + 2} is missing a national ID.`);
                }
                if (seenNationalIds.has(nationalId)) {
                    throw new Error(`National ID ${row.idNumber} is repeated in the uploaded file.`);
                }
                seenNationalIds.add(nationalId);
            }

            // Check existing records too, including older records without a reservation document.
            const existingCustomers = await getDocs(customersRef);
            const existingNationalIds = new Set(
                existingCustomers.docs
                    .map(customerDoc => normalizeNationalId(customerDoc.data().idNumber))
                    .filter(Boolean)
            );
            const alreadyRegisteredId = [...seenNationalIds].find(id => existingNationalIds.has(id));
            if (alreadyRegisteredId) {
                throw new Error(`National ID ${alreadyRegisteredId} is already registered.`);
            }

            await runTransaction(firestore, async (transaction) => {
                const instDoc = await transaction.get(institutionRef);
                if (!instDoc.exists()) {
                    throw "Institution not found!";
                }

                let customerCounter = instDoc.data().customerCounter || 0;
                const shortName = instDoc.data().shortName || "INST";
                
                for (const row of uploadedData) {
                    const product = savingsProducts?.find(p => p.id === row.savingsProductId);
                    if (product && product.charges && fees) {
                        product.charges.forEach((chargeId: string) => {
                            const fee = fees.find(f => f.id === chargeId);
                            if (fee && (fee.trigger === 'On Deposit' || fee.trigger === 'On Account Opening') && fee.collectionMethod === 'Paid Separately') {
                                if (fee.calculationMethod === 'Flat Amount' && fee.amount) {
                                    onboardingFee += fee.amount;
                                }
                            }
                        });
                    }

                    customerCounter++;
                    const newAccountNumber = `${shortName}CUS${String(customerCounter).padStart(6, '0')}`;
                    const fullName = `${row['firstName']} ${row['lastName']}`;
                    
                    const newCustomerRef = doc(customersRef, newAccountNumber);
                    const normalizedNationalId = normalizeNationalId(row.idNumber);
                    const customerData = {
                        id: newCustomerRef.id,
                        institutionId: userData.institutionId,
                        accountNumber: newAccountNumber,
                        name: fullName,
                        name_lowercase: fullName.toLowerCase(),
                        firstName: row['firstName'],
                        lastName: row['lastName'],
                        middleName: row['middleName'] || '',
                        idType: row['idType'] || 'National ID',
                        idNumber: String(row['idNumber']).trim(),
                        idNumber_lowercase: normalizedNationalId,
                        dateOfBirth: row['dateOfBirth'] ? new Date(row['dateOfBirth']) : null,
                        gender: row['gender'] || '',
                        maritalStatus: row['maritalStatus'] || '',
                        phone: row['phone'],
                        phone_lowercase: row['phone'].toLowerCase(),
                        alternatePhone: row['alternatePhone'] || '',
                        email: row['email'] || '',
                        currentResidence: {
                            physicalAddress: row['currentResidence.physicalAddress'] || '',
                            district: row['currentResidence.district'] || '',
                            area: row['currentResidence.area'] || '',
                        },
                        homeVillage: {
                            district: row['homeVillage.district'] || '',
                            traditionalAuthority: row['homeVillage.traditionalAuthority'] || '',
                            village: row['homeVillage.village'] || '',
                        },
                        branchId: row['branchId'],
                        customerType: row['customerType'] || 'Individual',
                        groupName: row['groupName'] || '',
                        kycStatus: 'Verified',
                        employmentType: row['employmentType'] || '',
                        employerName: row['employerName'] || '',
                        primaryIncome: parseFloat(row['primaryIncome']) || 0,
                        incomeSource: row['incomeSource'] || '',
                        yearsOfService: parseInt(row['yearsOfService']) || 0,
                        nextOfKin: [{
                            fullName: row['nextOfKin.fullName'] || '',
                            relationship: row['nextOfKin.relationship'] || '',
                            phone: row['nextOfKin.phone'] || '',
                            residence: row['nextOfKin.residence'] || '',
                        }],
                        createdAt: serverTimestamp(),
                    };
                    transaction.set(newCustomerRef, customerData);

                    const newSavingsAccountRef = doc(collection(newCustomerRef, 'savingsAccounts'));
                    const savingsAccountData = {
                        id: newSavingsAccountRef.id,
                        productId: row.savingsProductId,
                        status: 'Active',
                        balance: -onboardingFee,
                        createdAt: serverTimestamp(),
                    };
                    transaction.set(newSavingsAccountRef, savingsAccountData);
                }
                
                transaction.update(institutionRef, { customerCounter: customerCounter });
            });

            toast({
                title: 'Upload Successful',
                description: `${uploadedData.length} customers and their savings accounts have been created.`
            });
            handleCancelUpload();

        } catch (error) {
            console.error("Error saving customers:", error);
            toast({
                variant: 'destructive',
                title: 'Upload Failed',
                description: error instanceof Error ? error.message : 'An error occurred while saving the customers. Please check the data and try again.'
            });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleSaveLoansToDb = async () => {
        // Placeholder for loan saving logic
        toast({ title: 'Functionality Pending', description: 'Saving loans to the database is not yet implemented.' });
    };

    const handleSaveToDb = () => {
        if (uploadType === 'loanProducts') {
            handleSaveLoanProductsToDb();
        } else if (uploadType === 'customers') {
            handleSaveCustomersToDb();
        } else if (uploadType === 'loans') {
            handleSaveLoansToDb();
        }
    }
    
    const handleUploadClick = (type: UploadType) => {
        setUploadType(type);
        fileInputRef.current?.click();
    };

    const uploadOptions = [
      {
        title: 'Loan Products Upload',
        description: 'Download the Excel template to bulk-create or update your institution\'s loan products. The template will be pre-populated with your existing products.',
        icon: Briefcase,
        onDownload: () => handleDownload(loanProductHeaders, 'loan_products_template.csv'),
        onUpload: () => handleUploadClick('loanProducts'),
        disabled: false,
      },
      {
        title: 'Customer Upload',
        description: 'Download the template to bulk-onboard new individual or group customers into the system.',
        icon: Users,
        onDownload: () => handleDownload(customerTemplateHeaders, 'customer_upload_template.csv'),
        onUpload: () => handleUploadClick('customers'),
        disabled: false,
      },
      {
        title: 'Loans Upload',
        description: 'Download the template to migrate existing or historical loan records into the system.',
        icon: Landmark,
        onDownload: () => handleDownload(loanUploadHeaders, 'customer_loans_template.csv'),
        onUpload: () => handleUploadClick('loans'),
        disabled: false,
      },
    ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Bulk Data Migration
        </h1>
        <p className="text-muted-foreground mt-1">
          Use the templates below to import your existing data into the platform efficiently.
        </p>
      </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {uploadOptions.map((option) => (
            <Card key={option.title} className="flex flex-col">
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-muted rounded-full">
                            <option.icon className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <CardTitle>{option.title}</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="flex-grow">
                    <CardDescription>{option.description}</CardDescription>
                </CardContent>
                <CardFooter className="grid grid-cols-2 gap-4">
                     <Button variant="outline" onClick={option.onDownload} disabled={option.disabled}>
                        <Download className="mr-2 h-4 w-4" />
                        Download Template
                    </Button>
                    <Button onClick={option.onUpload} disabled={isUploading}>
                         {isUploading && option.title.startsWith(uploadType || '') ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Upload className="mr-2 h-4 w-4" />}
                         Upload File
                    </Button>
                </CardFooter>
            </Card>
        ))}
       </div>
       
       <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileUpload} />

       {uploadedData.length > 0 && uploadType === 'loanProducts' && (
           <Card>
               <CardHeader>
                   <CardTitle>Review Uploaded Loan Products</CardTitle>
                   <CardDescription>
                       Review the loan products found in your file. If everything is correct, approve and save to the database.
                   </CardDescription>
               </CardHeader>
               <CardContent>
                   <Table>
                       <TableHeader>
                           <TableRow>
                               <TableHead>Product Name</TableHead>
                               <TableHead>Loan Type</TableHead>
                               <TableHead>Interest Rate (%)</TableHead>
                               <TableHead>Term (Months)</TableHead>
                           </TableRow>
                       </TableHeader>
                       <TableBody>
                           {uploadedData.map((row, index) => (
                               <TableRow key={index}>
                                   <TableCell>{row['name']}</TableCell>
                                   <TableCell>{row['loanType']}</TableCell>
                                   <TableCell>{row['annualInterestRate']}</TableCell>
                                   <TableCell>{row['minTerm']} - {row['maxTerm']}</TableCell>
                               </TableRow>
                           ))}
                       </TableBody>
                   </Table>
               </CardContent>
               <CardFooter className="justify-end gap-2">
                   <Button variant="ghost" onClick={handleCancelUpload}>Cancel</Button>
                   <Button onClick={handleSaveToDb} disabled={isSaving}>
                       {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCheck className="mr-2 h-4 w-4" />}
                       Approve & Save
                   </Button>
               </CardFooter>
           </Card>
       )}

       {uploadedData.length > 0 && uploadType === 'customers' && (
           <Card>
               <CardHeader>
                   <CardTitle>Review Uploaded Customers</CardTitle>
                   <CardDescription>
                       Review the customer data found in your file. If everything is correct, approve and save to the database.
                   </CardDescription>
               </CardHeader>
               <CardContent>
                    <div className="overflow-x-auto">
                        <Table className="min-w-full">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-40">First Name</TableHead>
                                <TableHead className="w-40">Last Name</TableHead>
                                <TableHead className="w-48">National ID</TableHead>
                                <TableHead className="w-40">Phone Number</TableHead>
                                <TableHead className="w-32">Branch Code</TableHead>
                                <TableHead className="w-48">Savings Product ID</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {uploadedData.map((row, index) => (
                                <TableRow key={index}>
                                    <TableCell><Input value={row['firstName']} onChange={(e) => handleDataChange(index, 'firstName', e.target.value)} /></TableCell>
                                    <TableCell><Input value={row['lastName']} onChange={(e) => handleDataChange(index, 'lastName', e.target.value)} /></TableCell>
                                    <TableCell><Input value={row['idNumber']} onChange={(e) => handleDataChange(index, 'idNumber', e.target.value)} /></TableCell>
                                    <TableCell><Input value={row['phone']} onChange={(e) => handleDataChange(index, 'phone', e.target.value)} /></TableCell>
                                    <TableCell>
                                        <Select value={row['branchId'] || undefined} onValueChange={(value) => handleDataChange(index, 'branchId', value)}>
                                            <SelectTrigger><SelectValue placeholder="Select branch..." /></SelectTrigger>
                                            <SelectContent>
                                                {availableBranches.map(branch => <SelectItem key={branch.id} value={branch.code || branch.id}>{branch.name} ({branch.code || branch.id})</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell>
                                        <Select
                                            onValueChange={(value) => handleDataChange(index, 'savingsProductId', value)}
                                            defaultValue={row['savingsProductId']}
                                        >
                                            <SelectTrigger>
                                            <SelectValue placeholder={isSavingsProductsLoading ? "Loading..." : "Select savings product..."} />
                                            </SelectTrigger>
                                            <SelectContent>
                                            {savingsProducts?.map(p => (
                                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                            ))}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        </Table>
                    </div>
               </CardContent>
               <CardFooter className="justify-end gap-4">
                   <Button variant="ghost" onClick={handleCancelUpload}>Cancel</Button>
                   <Button onClick={handleSaveToDb} disabled={isSaving}>
                       {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCheck className="mr-2 h-4 w-4" />}
                       Approve & Save Customers
                   </Button>
               </CardFooter>
           </Card>
       )}

        {uploadedData.length > 0 && uploadType === 'loans' && (
           <Card>
               <CardHeader>
                   <CardTitle>Review Uploaded Loans</CardTitle>
                   <CardDescription>
                       Review the loan records found in your file. If everything is correct, approve and save to the database.
                   </CardDescription>
               </CardHeader>
               <CardContent>
                   <Table>
                       <TableHeader>
                           <TableRow>
                               <TableHead>Customer ID</TableHead>
                               <TableHead>Product Code</TableHead>
                               <TableHead>Principal Amount</TableHead>
                               <TableHead>Tenure (Months)</TableHead>
                           </TableRow>
                       </TableHeader>
                       <TableBody>
                           {uploadedData.map((row, index) => (
                               <TableRow key={index}>
                                   <TableCell>{row['Customer ID']}</TableCell>
                                   <TableCell>{row['Loan Product Code']}</TableCell>
                                   <TableCell>{row['Principal Amount']}</TableCell>
                                   <TableCell>{row['Loan Tenure (Months)']}</TableCell>
                               </TableRow>
                           ))}
                       </TableBody>
                   </Table>
               </CardContent>
               <CardFooter className="justify-end gap-2">
                   <Button variant="ghost" onClick={handleCancelUpload}>Cancel</Button>
                   <Button onClick={handleSaveToDb} disabled={isSaving}>
                       {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCheck className="mr-2 h-4 w-4" />}
                       Approve & Save Loans
                   </Button>
               </CardFooter>
           </Card>
       )}


       {uploadErrors.length > 0 && (
           <Card>
               <CardHeader>
                   <CardTitle className="text-destructive">Upload Errors</CardTitle>
                   <CardDescription>
                       The following issues were found in your uploaded file. Please correct them and try again.
                   </CardDescription>
               </CardHeader>
               <CardContent>
                   <Alert variant="destructive">
                       <FileX className="h-4 w-4" />
                       <AlertTitle>Validation Failed</AlertTitle>
                       <AlertDescription>
                           <ul className="list-disc pl-5">
                               {uploadErrors.map((error, index) => (
                                   <li key={index}>{error}</li>
                               ))}
                           </ul>
                       </AlertDescription>
                   </Alert>
               </CardContent>
               <CardFooter className="justify-end">
                   <Button variant="outline" onClick={handleCancelUpload}>Clear Upload</Button>
               </CardFooter>
           </Card>
       )}
    </div>
  );
}
