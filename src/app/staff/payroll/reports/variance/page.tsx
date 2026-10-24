
'use client';
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChevronsRightLeft } from "lucide-react";

export default function VarianceReportPage() {
  return (
    <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md text-center">
            <CardHeader>
                <div className="mx-auto bg-muted rounded-full p-4 w-fit">
                    <ChevronsRightLeft className="h-12 w-12 text-muted-foreground" />
                </div>
                <CardTitle className="mt-4">Payroll Variance Report</CardTitle>
                <CardDescription>
                    This report is under construction. Check back later to detect unusual changes in payroll data versus a previous period.
                </CardDescription>
            </CardHeader>
        </Card>
    </div>
  );
}
