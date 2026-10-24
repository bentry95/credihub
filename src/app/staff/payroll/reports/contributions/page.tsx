
'use client';
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Building } from "lucide-react";

export default function ContributionsReportPage() {
  return (
    <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md text-center">
            <CardHeader>
                <div className="mx-auto bg-muted rounded-full p-4 w-fit">
                    <Building className="h-12 w-12 text-muted-foreground" />
                </div>
                <CardTitle className="mt-4">Employer Contributions Report</CardTitle>
                <CardDescription>
                    This report is under construction. Check back later to track employer pension contributions and other liabilities.
                </CardDescription>
            </CardHeader>
        </Card>
    </div>
  );
}
