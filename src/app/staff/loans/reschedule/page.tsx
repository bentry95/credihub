'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarClock, Gavel, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function RescheduleLoanLandingPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Loan Rescheduling</h1>
          <p className="text-muted-foreground mt-1">
            Modify the terms of an active loan for customers facing difficulties.
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-4">
                <div className="bg-primary/10 p-3 rounded-full">
                    <CalendarClock className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <CardTitle>Apply for Reschedule</CardTitle>
                    <CardDescription>Initiate a request to change the terms of an existing loan.</CardDescription>
                </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
                This process involves creating a new loan application with updated terms, which will then go through the standard appraisal and approval workflow.
            </p>
            <Button asChild>
                <Link href="/staff/loans/reschedule/apply">
                    Start Reschedule Application <ArrowRight className="ml-2 h-4 w-4" />
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
                    <CardTitle>Approve Reschedules</CardTitle>
                    <CardDescription>Review and approve pending loan reschedule applications.</CardDescription>
                </div>
            </div>
          </CardHeader>
          <CardContent>
             <p className="text-sm text-muted-foreground mb-4">
                Rescheduled loans appear in the standard loan approval queue for a final decision by authorized staff.
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
