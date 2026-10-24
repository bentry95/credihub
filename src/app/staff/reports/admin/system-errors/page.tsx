'use client';

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Download } from 'lucide-react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from '@/components/ui/table';

export default function SystemErrorsReportPage() {
    // In a real implementation, this data would be fetched from a logging service or Firestore collection.
    const errors: any[] = [];
    const isLoading = false;

  return (
    <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
            <h1 className="text-3xl font-bold tracking-tight">System Errors Report</h1>
            <p className="text-muted-foreground mt-1">
                A log of all technical errors that have occurred within the application.
            </p>
            </div>
            <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export to Excel
            </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Error Log</CardTitle>
          <CardDescription>
            This table shows any system errors that have been recorded automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Error Type</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>User Affected</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    Loading errors...
                  </TableCell>
                </TableRow>
              ) : errors.length > 0 ? (
                errors.map((error) => (
                  <TableRow key={error.id}>
                    <TableCell>{error.timestamp}</TableCell>
                    <TableCell>{error.type}</TableCell>
                    <TableCell>{error.message}</TableCell>
                    <TableCell>{error.user}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-48 text-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="p-4 bg-muted rounded-full">
                            <AlertTriangle className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-semibold">No System Errors Found</h3>
                        <p className="text-muted-foreground">The system has not recorded any errors recently.</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}