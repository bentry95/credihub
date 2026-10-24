
'use client';

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { FileCheck } from 'lucide-react';

export default function GrnReportPage() {
  return (
    <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md text-center">
            <CardHeader>
                <div className="mx-auto bg-muted rounded-full p-4 w-fit">
                    <FileCheck className="h-12 w-12 text-muted-foreground" />
                </div>
                <CardTitle className="mt-4">Goods Received Report</CardTitle>
                <CardDescription>
                    This report is under construction. Check back later to see a log of all goods received from suppliers.
                </CardDescription>
            </CardHeader>
        </Card>
    </div>
  );
}
