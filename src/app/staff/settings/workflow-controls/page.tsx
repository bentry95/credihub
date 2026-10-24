'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Save, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, serverTimestamp, writeBatch } from 'firebase/firestore';


const workflowComponents = [
  { id: 'journalEntries', label: 'Manual Journal Entries', description: 'Enforce approval for all manually created journal vouchers.' },
  { id: 'loanApproval', label: 'Loan Approval & Disbursement', description: 'Require a second user to approve a loan after the loan officer has appraised it.' },
  { id: 'loanRescheduling', label: 'Loan Rescheduling', description: 'Enforce approval for all loan rescheduling applications.' },
  { id: 'loanTopUp', label: 'Loan Top-Up / Refinancing', description: 'Require dual control for all loan top-up applications.' },
  { id: 'journalReversal', label: 'Journal & Transaction Reversals', description: 'Enforce approval for any transaction reversal request.' },
  { id: 'customerExit', label: 'Customer Exit & Account Closure', description: 'Require a supervisor to approve the closure of a customer account.' },
];

const defaultWorkflows = {
    journalEntries: true,
    loanApproval: true,
    loanRescheduling: false,
    loanTopUp: false,
    journalReversal: true,
    customerExit: false,
};

export default function WorkflowControlsPage() {
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();

    const [loading, setLoading] = useState(false);
    const [isReasonDialogOpen, setIsReasonDialogOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [error, setError] = useState<string | null>(null);

    const userDocRef = useMemoFirebase(
      () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
      [firestore, user]
    );
    const { data: userData } = useDoc(userDocRef);
    const institutionId = userData?.institutionId;
    
    const settingsDocRef = useMemoFirebase(() => (firestore && institutionId ? doc(firestore, 'institutions', institutionId, 'settings', 'workflows') : null), [firestore, institutionId]);
    const { data: workflowSettings, isLoading: isSettingsLoading } = useDoc(settingsDocRef);
    
    const [activeWorkflows, setActiveWorkflows] = useState<Record<string, boolean>>(defaultWorkflows);
    const [initialWorkflows, setInitialWorkflows] = useState<Record<string, boolean>>(defaultWorkflows);

    useEffect(() => {
        if (workflowSettings) {
            const settings = { ...defaultWorkflows, ...workflowSettings };
            setActiveWorkflows(settings);
            setInitialWorkflows(settings);
        }
    }, [workflowSettings]);

    const handleToggle = (id: string) => {
        setActiveWorkflows(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleSaveChanges = () => {
        setIsReasonDialogOpen(true);
    }
    
    const confirmSaveChanges = async () => {
        if (!reason.trim()) {
            setError("A reason is required to save changes.");
            return;
        }
        if (!user || !institutionId || !settingsDocRef) return;

        setLoading(true);
        setError(null);
        
        try {
            const batch = writeBatch(firestore);
            const auditsRef = collection(firestore, 'institutions', institutionId, 'workflowAudits');
            
            // Log changes
            for (const key in activeWorkflows) {
                if (activeWorkflows[key] !== initialWorkflows[key]) {
                    const auditDocRef = doc(auditsRef);
                    batch.set(auditDocRef, {
                        id: auditDocRef.id,
                        timestamp: serverTimestamp(),
                        userId: user.uid,
                        action: activeWorkflows[key] ? 'Activated' : 'Deactivated',
                        component: workflowComponents.find(c => c.id === key)?.label || key,
                        reason: reason,
                    });
                }
            }

            // Update settings
            batch.set(settingsDocRef, activeWorkflows, { merge: true });

            await batch.commit();

            setInitialWorkflows(activeWorkflows);
            setIsReasonDialogOpen(false);
            setReason('');

            toast({
                title: "Settings Saved",
                description: "Your maker-checker workflow settings have been updated.",
            });
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to save settings.'});
        } finally {
            setLoading(false);
        }
    }
    
    const isDirty = JSON.stringify(activeWorkflows) !== JSON.stringify(initialWorkflows);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Maker-Checker Controls</h1>
          <p className="text-muted-foreground mt-1">
            Activate or deactivate dual control (maker-checker) for key system processes.
          </p>
        </div>
        <Button onClick={handleSaveChanges} disabled={!isDirty}>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workflow Modules</CardTitle>
          <CardDescription>
            Enable the toggle for any process that should require a second person's approval.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {isSettingsLoading ? (
             Array.from({length: 6}).map((_, i) => <div key={i} className="flex items-center justify-between py-4"><div className="w-1/2 h-8 bg-muted rounded-md animate-pulse"></div><div className="w-12 h-6 bg-muted rounded-full animate-pulse"></div></div>)
          ) : (
            workflowComponents.map((component) => (
                <div key={component.id} className="flex items-center justify-between py-4">
                <div className="flex flex-col">
                    <Label htmlFor={component.id} className="text-base font-medium">
                    {component.label}
                    </Label>
                    <p className="text-sm text-muted-foreground">{component.description}</p>
                </div>
                <Switch
                    id={component.id}
                    checked={activeWorkflows[component.id]}
                    onCheckedChange={() => handleToggle(component.id)}
                />
                </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={isReasonDialogOpen} onOpenChange={setIsReasonDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Confirm Changes</DialogTitle>
                <DialogDescription>Please provide a reason for modifying the workflow controls. This will be recorded in the audit log.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
                {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>{error}</AlertTitle></Alert>}
                <Textarea placeholder="e.g., Activating loan approval workflow as per new policy..." value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setIsReasonDialogOpen(false)}>Cancel</Button>
                <Button onClick={confirmSaveChanges} disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                    Confirm & Save
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}