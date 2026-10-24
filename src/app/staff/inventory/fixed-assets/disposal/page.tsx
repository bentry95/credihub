
'use client';
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Trash2 } from "lucide-react";

export default function DisposalPage() {
  return (
    <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md text-center">
            <CardHeader>
                <div className="mx-auto bg-muted rounded-full p-4 w-fit">
                    <Trash2 className="h-12 w-12 text-muted-foreground" />
                </div>
                <CardTitle className="mt-4">Asset Disposal</CardTitle>
                <CardDescription>
                    This page is under construction. Check back later to process the sale or disposal of assets.
                </CardDescription>
            </CardHeader>
        </Card>
    </div>
  );
}
