
'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Settings,
  Save,
  Loader2,
  Bell,
  Monitor,
  ShieldCheck,
  Globe,
} from 'lucide-react';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

export default function PlatformSettingsPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const settingsRef = useMemoFirebase(() => firestore ? doc(firestore, 'platform', 'settings') : null, [firestore]);
  const { data: settings, isLoading } = useDoc(settingsRef);

  const [systemNotice, setSystemNotice] = useState('');
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  useEffect(() => {
    if (settings) {
      setSystemNotice(settings.systemNotice || '');
      setMaintenanceMode(settings.maintenanceMode || false);
    }
  }, [settings]);

  const handleSave = async () => {
    if (!settingsRef) return;
    setLoading(true);
    try {
      await setDoc(settingsRef, {
        systemNotice,
        maintenanceMode,
        updatedAt: new Date(),
      }, { merge: true });
      toast({ title: 'Settings Saved', description: 'Platform settings have been updated globally.' });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save settings.' });
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Platform Settings</h1>
          <p className="text-muted-foreground mt-1">
            Global configurations for the CrediHub platform.
          </p>
        </div>
        <Button onClick={handleSave} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Changes
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" /> System Announcements</CardTitle>
            <CardDescription>Broadcast a message to all users on their login screen or dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="notice">Notice Text</Label>
              <Textarea
                id="notice"
                placeholder="e.g., Scheduled maintenance this Sunday at 2 AM..."
                value={systemNotice}
                onChange={(e) => setSystemNotice(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Monitor className="h-5 w-5 text-primary" /> Global Status</CardTitle>
            <CardDescription>Control the general accessibility of the platform.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Maintenance Mode</Label>
                <p className="text-sm text-muted-foreground">Prevent all non-admin users from accessing the system.</p>
              </div>
              <Switch checked={maintenanceMode} onCheckedChange={setMaintenanceMode} />
            </div>
             <Separator />
             <div className="flex items-center justify-between opacity-50 pointer-events-none">
              <div className="space-y-0.5">
                <Label className="text-base">New Institutional Signups</Label>
                <p className="text-sm text-muted-foreground">Allow or block new financial institutions from registering.</p>
              </div>
              <Switch checked={true} />
            </div>
          </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5 text-primary" /> Region & Compliance</CardTitle>
                <CardDescription>Default regional settings for new institutions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-1">
                    <Label>Default Currency</Label>
                    <Input value="Malawian Kwacha (MWK)" disabled />
                </div>
                <div className="space-y-1">
                    <Label>System Locale</Label>
                    <Input value="en-MW" disabled />
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}

    