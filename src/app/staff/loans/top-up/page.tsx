'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusSquare, Gavel, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function LoanTopUpLandingPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Loan Top-Up (Refinancing)</h1>
          <p className="text-muted-foreground mt-1">
            Add funds to an active loan by creating a new, consolidated loan application.
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-4">
                <div className="bg-primary/10 p-3 rounded-full">
                    <PlusSquare className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <CardTitle>Apply for Top-Up</CardTitle>
                    <CardDescription>Initiate a request to refinance an existing loan with additional funds.</CardDescription>
                </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
                This process creates a new loan application for the combined amount (outstanding balance + new funds), which will then go through the standard approval workflow.
            </p>
            <Button asChild>
                <Link href="/staff/loans/top-up/apply">
                    Start Top-Up Application <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
             <div className="flex items-center gap-4">
                <div className="bg-primary/10 p-3 rounded-full">
                    <Gavel className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <CardTitle>Approve Top-Ups</CardTitle>
                    <CardDescription>Review and approve pending loan top-up applications.</CardDescription>
                </div>
            </div>
          </CardHeader>
          <CardContent>
             <p className="text-sm text-muted-foreground mb-4">
                Top-up applications appear in the standard loan approval queue for a final decision by authorized staff.
            </p>
             <Button asChild variant="outline">
                <Link href="/staff/loans/approvals">
                    Go to Approval Queue <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
