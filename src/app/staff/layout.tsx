
'use client';

import React, { useEffect } from 'react';
import { PanelLeft } from 'lucide-react';
import { usePathname } from 'next/navigation';
import {
  SidebarProvider
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { StaffSidebar } from '@/components/staff/sidebar';
import { BranchProvider, useBranch } from '@/context/BranchContext';
import { TellerProvider } from '@/context/TellerContext';
import { UserNav } from '@/components/staff/user-nav';
import Breadcrumbs from '@/components/ui/breadcrumbs';
import { useIdleTimer } from '@/hooks/use-idle-timer';
import { useUser, useFirestore, useDoc, useMemoFirebase, FirebaseClientProvider } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';


function StaffLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { selectedBranch, loading } = useBranch();
  const { user } = useUser();
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
  
  // The select-branch page is special and does not have the main layout.
  // We also want to avoid showing the layout while the context is loading and hasn't redirected yet.
  if (pathname === '/staff/select-branch' || loading) {
    return <>{children}</>;
  }
  
  // If no branch is selected and we are not on the selection page, the guard in BranchContext should redirect.
  // We render null here to avoid a flash of the layout before redirection.
  if (!selectedBranch) {
      return null;
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-gray-100">
        <StaffSidebar />
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
                <UserNav />
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


export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FirebaseClientProvider>
      <BranchProvider>
        <TellerProvider>
          <StaffLayoutContent>{children}</StaffLayoutContent>
        </TellerProvider>
      </BranchProvider>
    </FirebaseClientProvider>
  )
}
