
'use client';
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Wrench } from "lucide-react";

export default function MaintenancePage() {
  return (
    <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md text-center">
            <CardHeader>
                <div className="mx-auto bg-muted rounded-full p-4 w-fit">
                    <Wrench className="h-12 w-12 text-muted-foreground" />
                </div>
                <CardTitle className="mt-4">Asset Maintenance</CardTitle>
                <CardDescription>
                    This page is under construction. Check back later to log and track asset maintenance schedules and costs.
                </CardDescription>
            </CardHeader>
        </Card>
    </div>
  );
}
