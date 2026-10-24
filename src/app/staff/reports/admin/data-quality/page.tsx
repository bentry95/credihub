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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, doc, query } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DatabaseZap, FileWarning, Pencil, User, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

// Define which fields are considered essential for a complete profile
const essentialFields: { key: keyof any; label: string }[] = [
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'dateOfBirth', label: 'Date of Birth' },
  { key: 'gender', label: 'Gender' },
  { key: 'idType', label: 'ID Type' },
  { key: 'idNumber', label: 'ID Number' },
  { key: 'phone', label: 'Primary Phone' },
  { key: 'currentResidence.physicalAddress', label: 'Physical Address' },
  { key: 'currentResidence.district', label: 'Current District' },
  { key: 'homeVillage.village', label: 'Home Village' },
  { key: 'occupationCategory', label: 'Occupation' },
];

const getNestedValue = (obj: any, path: string) => {
    return path.split('.').reduce((o, key) => (o && o[key] !== undefined ? o[key] : null), obj);
}

export default function DataQualityReportPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(
    () => (user && user.uid ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData, isLoading: isUserLoading } = useDoc(userDocRef);
  const institutionId = userData?.institutionId;

  const customersQuery = useMemoFirebase(
    () =>
      firestore && institutionId
        ? query(collection(firestore, 'institutions', institutionId, 'customers'))
        : null,
    [firestore, institutionId]
  );
  const { data: customers, isLoading: isCustomersLoading } = useCollection(customersQuery);
  
  const incompleteProfiles = useMemo(() => {
      if (!customers) return [];
      
      return customers.map(customer => {
          const missingFields = essentialFields.filter(field => {
              const value = getNestedValue(customer, field.key as string);
              return value === null || value === undefined || value === '';
          });
          
          return { customer, missingFields };
      }).filter(profile => profile.missingFields.length > 0);

  }, [customers]);

  const isLoading = isUserLoading || isCustomersLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Data Quality Report</h1>
          <p className="text-muted-foreground mt-1">
            Identifies customer profiles with missing or incomplete information.
          </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Incomplete Customer Profiles</CardTitle>
          <CardDescription>
            The following customers have missing information in their profiles. Keeping this data complete is crucial for compliance and risk assessment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : incompleteProfiles.length > 0 ? (
            <Accordion type="multiple" className="w-full">
              {incompleteProfiles.map(({ customer, missingFields }) => (
                <AccordionItem value={customer.id} key={customer.id}>
                  <AccordionTrigger>
                    <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex flex-col text-left">
                            <span className="font-semibold">{customer.name}</span>
                            <span className="text-sm text-muted-foreground">{customer.accountNumber}</span>
                        </div>
                         <div className="flex items-center gap-2 text-destructive">
                            <FileWarning className="h-4 w-4" />
                            <span>{missingFields.length} missing fields</span>
                        </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="p-4 bg-muted/50 rounded-md">
                        <h4 className="font-semibold mb-2">Missing Information:</h4>
                        <ul className="list-disc pl-5 space-y-1 text-sm">
                            {missingFields.map(field => (
                                <li key={field.key}>{field.label}</li>
                            ))}
                        </ul>
                         <Button asChild size="sm" className="mt-4">
                            <Link href={`/staff/customers/edit?id=${customer.id}`}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit Customer
                            </Link>
                        </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div className="flex flex-col items-center gap-4 text-center py-10">
                <div className="p-4 bg-green-100 dark:bg-green-900/20 rounded-full">
                    <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-semibold">All Profiles Complete</h3>
                <p className="text-muted-foreground">
                    Congratulations! All customer profiles have the essential information filled out.
                </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}