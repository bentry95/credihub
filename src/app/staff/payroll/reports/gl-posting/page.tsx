
'use client';
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowRightLeft } from "lucide-react";

export default function GlPostingReportPage() {
  return (
    <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md text-center">
            <CardHeader>
                <div className="mx-auto bg-muted rounded-full p-4 w-fit">
                    <ArrowRightLeft className="h-12 w-12 text-muted-foreground" />
                </div>
                <CardTitle className="mt-4">Payroll GL Posting Report</CardTitle>
                <CardDescription>
                    This report is under construction. Check back later to reconcile payroll runs with their General Ledger journal entries.
                </CardDescription>
            </CardHeader>
        </Card>
    </div>
  );
}
