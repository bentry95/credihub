
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { reportsConfig, ReportCategory } from "@/lib/reports";
import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function PayrollReportsPage() {
    const { user } = useUser();
    const firestore = useFirestore();
  
    const userDocRef = useMemoFirebase(
      () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
      [firestore, user]
    );
    const { data: userData, isLoading: isUserLoading } = useDoc(userDocRef);
  
    const institutionId = userData?.institutionId;
    const customRoleId = userData?.customRoleId;
  
    const customRoleDocRef = useMemoFirebase(() => {
      if (!firestore || !institutionId || !customRoleId) return null;
      return doc(firestore, 'institutions', institutionId, 'roles', customRoleId);
    }, [firestore, institutionId, customRoleId]);
    const { data: customRoleData, isLoading: isRoleLoading } = useDoc(customRoleDocRef);
  
    const userPermissions = useMemo(() => {
      if (!userData) return new Set();
      if (userData.role === 'institution-admin') return new Set(['all']);
      
      const permissions = new Set<string>();
      const baseStaffPermissions = ['dashboard', 'customers', 'loans', 'accounts', 'tellers', 'payroll', 'inventory', 'reports', 'profile', 'manual', 'support'];
      baseStaffPermissions.forEach(p => permissions.add(p));
        
      if (customRoleData?.permissions) {
        customRoleData.permissions.forEach((p: string) => permissions.add(p));
      }
      return permissions;
    }, [userData, customRoleData]);
  
    const filteredReportsConfig = useMemo(() => {
        // Filter specifically for Payroll Report categories
        const payrollCategories = reportsConfig.filter(cat => cat.category.startsWith('Payroll Reports'));

        if (userPermissions.has('all')) {
          return payrollCategories;
        }
    
        return payrollCategories.map(category => ({
            ...category,
            reports: category.reports.filter(report => userPermissions.has(report.permissionId))
        })).filter(category => category.reports.length > 0);
    
    }, [userPermissions]);

  if (isUserLoading || isRoleLoading) {
      return (
          <div className="space-y-6">
              <Skeleton className="h-10 w-1/4" />
              <Skeleton className="h-6 w-1/2" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
              </div>
          </div>
      )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payroll Reports</h1>
        <p className="text-muted-foreground mt-1">
          Generate detailed reports for payroll analysis, compliance, and payment processing.
        </p>
      </div>

      <div className="space-y-10">
        {filteredReportsConfig.length > 0 ? filteredReportsConfig.map((category: ReportCategory) => (
          <div key={category.category}>
             <h2 className="text-2xl font-semibold tracking-tight border-b pb-2 mb-6">
              {category.category}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {category.reports.map((report) => (
                <Link href={report.href} key={report.title} className="group">
                  <Card className="h-full hover:shadow-lg transition-shadow duration-200 hover:border-primary/50">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{report.title}</span>
                        <report.icon className="h-6 w-6 text-muted-foreground" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription>{report.description}</CardDescription>
                      <div className="flex items-center text-sm font-medium text-primary mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        View Report <ArrowRight className="ml-2 h-4 w-4" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )) : (
            <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="p-4 bg-muted rounded-full mb-4">
                    <FileText className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">No Payroll Reports Assigned</h3>
                <p className="text-muted-foreground max-w-sm">
                    You do not have permission to view any payroll reports.
                </p>
            </div>
        )}
      </div>
    </div>
  );
}
