
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { GitBranch, CheckCircle } from "lucide-react";

const features = [
    "User authentication for Admins and Staff.",
    "Multi-branch management for institutions.",
    "Role-based access control for staff users.",
    "Dynamic dashboard with branch filtering.",
    "Customer onboarding and management (KYC).",
    "Loan product creation and configuration.",
    "Savings product creation and configuration.",
    "End-to-end loan application workflow (Origination, Appraisal, Approval, Disbursement).",
    "Chart of Accounts (COA) and General Ledger (GL) setup.",
    "Manual journal entries with an approval queue.",
    "Teller management and daily cash operations.",
    "Comprehensive reporting module for loans, savings, and financials.",
    "Institution settings for profile, branches, users, and products.",
];

export default function VersionsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="bg-muted rounded-full p-3">
            <GitBranch className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Application Version</h1>
            <p className="text-muted-foreground mt-1">
                Current Version: 1.0.0 - Initial Release
            </p>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Core Features</CardTitle>
          <CardDescription>
            A summary of the key functionalities included in this version of the application.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <ul className="space-y-3">
                {features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                        <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                    </li>
                ))}
            </ul>
        </CardContent>
      </Card>
    </div>
  );
}
