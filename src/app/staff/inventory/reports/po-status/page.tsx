
'use client';

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Receipt } from 'lucide-react';

export default function PoStatusReportPage() {
  return (
    <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md text-center">
            <CardHeader>
                <div className="mx-auto bg-muted rounded-full p-4 w-fit">
                    <Receipt className="h-12 w-12 text-muted-foreground" />
                </div>
                <CardTitle className="mt-4">Purchase Order Status Report</CardTitle>
                <CardDescription>
                    This report is under construction. Check back later to track the status of all your purchase orders.
                </CardDescription>
            </CardHeader>
        </Card>
    </div>
  );
}
