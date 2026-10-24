
'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import {
  Bell,
  Home,
  Users,
  LineChart,
  Settings,
  HelpCircle,
  Briefcase,
  FileText,
  Building2,
  PanelLeft,
  GitBranch,
  Monitor,
  UserPlus,
} from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { AdminUserNav } from '@/components/auth/admin-user-nav';
import Breadcrumbs from '@/components/ui/breadcrumbs';
import { useUser, useFirestore, useDoc, useMemoFirebase, FirebaseClientProvider } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { doc } from 'firebase/firestore';
import { useIdleTimer } from '@/hooks/use-idle-timer';

function AdminLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  
  const firestore = useFirestore();
   const { data: userData } = useDoc(
    useMemoFirebase(() => (user && user.uid ? doc(firestore, 'users', user.uid) : null), [firestore, user])
  );
  const institutionId = userData?.institutionId;
  const { data: institutionData } = useDoc(
    useMemoFirebase(() => (institutionId ? doc(firestore, 'institutions', institutionId) : null), [institutionId])
  );
  
  const inactivityTimeout = institutionData?.securitySettings?.inactivityTimeout ?? 0;
  useIdleTimer(inactivityTimeout);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/');
    }
  }, [isUserLoading, user, router]);

  if (isUserLoading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-gray-100">
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">CrediHub</h1>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/admin/dashboard">
                    <Home />
                    Dashboard
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/admin/institutions">
                    <Building2 />
                    Institutions
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/admin/users">
                    <Users />
                    Users
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/admin/analytics">
                    <LineChart />
                    Analytics
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
               <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/admin/subscription">
                    <Briefcase />
                    Subscription
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/admin/invoicing">
                    <FileText />
                    Invoicing
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/admin/support">
                    <HelpCircle />
                    Support Center
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/admin/versions">
                    <GitBranch />
                    Versions
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/admin/settings">
                    <Settings />
                    System Settings
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/admin/logs">
                    <FileText />
                    Audit Logs
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>
        <div className="flex flex-1 flex-col">
          <header className="flex h-16 items-center justify-between border-b bg-white px-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" className="md:hidden">
                    <PanelLeft className="h-6 w-6" />
                    <span className="sr-only">Toggle sidebar</span>
                </Button>
                <Breadcrumbs />
            </div>
            <div className="flex items-center gap-4 ml-auto">
              <Button variant="ghost" size="icon">
                <Bell className="h-6 w-6" />
                <span className="sr-only">Notifications</span>
              </Button>
              <AdminUserNav />
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
          <footer className="p-4 text-center text-xs text-muted-foreground border-t">
            © {new Date().getFullYear()} Yangazu Incorporated | Version 1.0.0
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FirebaseClientProvider>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </FirebaseClientProvider>
  );
}
