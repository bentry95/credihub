
'use client';
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileWarning } from "lucide-react";

export default function ExceptionsReportPage() {
  return (
    <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md text-center">
            <CardHeader>
                <div className="mx-auto bg-muted rounded-full p-4 w-fit">
                    <FileWarning className="h-12 w-12 text-muted-foreground" />
                </div>
                <CardTitle className="mt-4">Payroll Exceptions Report</CardTitle>
                <CardDescription>
                    This report is under construction. Check back later to view unpaid payroll, failed payments, or employees with missing bank details.
                </CardDescription>
            </CardHeader>
        </Card>
    </div>
  );
}
