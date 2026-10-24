'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  useFirestore,
  useCollection,
  useMemoFirebase,
} from '@/firebase';
import { collection, doc, updateDoc } from 'firebase/firestore';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Pencil, Loader2, AlertCircle, Percent, PlusCircle, Trash2, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function AdminSubscriptionPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const institutionsQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'institutions') : null),
    [firestore]
  );
  const { data: institutions, isLoading: institutionsLoading } = useCollection(institutionsQuery);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Subscription Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage billing models and standard charges for all institutions.
          </p>
        </div>
      </div>

      <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-800">
          <Info className="h-4 w-4" />
          <AlertTitle>Standard Billing Policy</AlertTitle>
          <AlertDescription>
              The platform is currently operating on a <strong>Flat Monthly Fee</strong> model. Every institution is charged <strong>MWK 2,500,000</strong> per month regardless of disbursement volume. Tiered commission management is currently disabled.
          </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Registered Institutions</CardTitle>
          <CardDescription>
            Overview of institutions and their billing status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Institution Name</TableHead>
                <TableHead>Contact Email</TableHead>
                <TableHead>Billing Model</TableHead>
                <TableHead className="text-right">Monthly Charge</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {institutionsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 mx-auto" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-9 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : institutions && institutions.length > 0 ? (
                institutions.map((inst) => (
                  <TableRow key={inst.id}>
                    <TableCell className="font-medium">{inst.name}</TableCell>
                    <TableCell>{inst.contactEmail}</TableCell>
                    <TableCell>Flat Monthly Fee</TableCell>
                    <TableCell className="text-right font-mono">
                        MWK 2,500,000
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    No institutions found.
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
