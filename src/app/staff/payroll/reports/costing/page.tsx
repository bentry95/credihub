
'use client';
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Briefcase } from "lucide-react";

export default function CostingReportPage() {
  return (
    <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md text-center">
            <CardHeader>
                <div className="mx-auto bg-muted rounded-full p-4 w-fit">
                    <Briefcase className="h-12 w-12 text-muted-foreground" />
                </div>
                <CardTitle className="mt-4">Department Payroll Costing</CardTitle>
                <CardDescription>
                    This report is under construction. Check back later to analyze payroll costs by branch, department, or cost center.
                </CardDescription>
            </CardHeader>
        </Card>
    </div>
  );
}
