
'use client';

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { History } from 'lucide-react';

export default function InventoryMovementReportPage() {
  return (
    <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md text-center">
            <CardHeader>
                <div className="mx-auto bg-muted rounded-full p-4 w-fit">
                    <History className="h-12 w-12 text-muted-foreground" />
                </div>
                <CardTitle className="mt-4">Inventory Movement Report</CardTitle>
                <CardDescription>
                    This report is under construction. Check back later to see a detailed audit trail of all stock movements.
                </CardDescription>
            </CardHeader>
        </Card>
    </div>
  );
}
