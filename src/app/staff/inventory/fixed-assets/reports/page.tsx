
'use client';
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function AssetReportsPage() {
  return (
    <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md text-center">
            <CardHeader>
                <div className="mx-auto bg-muted rounded-full p-4 w-fit">
                    <FileText className="h-12 w-12 text-muted-foreground" />
                </div>
                <CardTitle className="mt-4">Asset Reports</CardTitle>
                <CardDescription>
                    This page is under construction. Check back later to generate various reports on your fixed assets.
                </CardDescription>
            </CardHeader>
        </Card>
    </div>
  );
}
