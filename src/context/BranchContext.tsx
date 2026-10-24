
'use client';

import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { usePathname, useRouter } from 'next/navigation';

interface BranchContextType {
  selectedBranch: string | null;
  setSelectedBranch: (branchId: string) => void;
  availableBranches: { id: string; name: string }[];
  loading: boolean;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

function BranchGuard({ children }: { children: ReactNode }) {
    const { user, isUserLoading } = useUser();
    const { selectedBranch, loading: branchContextLoading, availableBranches } = useBranch();
    const router = useRouter();
    const pathname = usePathname();

    const isLoading = isUserLoading || branchContextLoading;

    useEffect(() => {
        if (isLoading) {
            return;
        }

        if (user && !selectedBranch && pathname !== '/staff/select-branch') {
            // Redirect to selection page if no branch is selected and we are not already there
            router.replace('/staff/select-branch');
        } else if (user && selectedBranch && pathname === '/staff/select-branch') {
            // If a branch is selected but user lands on the selection page, redirect them away
            router.replace('/staff/dashboard');
        }
        
    }, [isLoading, user, selectedBranch, availableBranches, pathname, router]);

    // Show a global loading skeleton for staff pages while context initializes
    if (isLoading && pathname.startsWith('/staff') && pathname !== '/staff/select-branch') {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Skeleton className="h-full w-full" />
            </div>
        );
    }
    
    // Render nothing while redirecting to avoid flashing the wrong page
    if (!isLoading && !selectedBranch && pathname !== '/staff/select-branch') {
        return null; 
    }

    return <>{children}</>;
}


export function BranchProvider({ children }: { children: ReactNode }) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      const storedBranch = sessionStorage.getItem('selectedBranchId');
      if (storedBranch) {
        setSelectedBranch(storedBranch);
      }
    } catch (e) {
      console.error("Could not access sessionStorage", e);
    }
    setIsInitialized(true);
  }, []);

  const userDocRef = useMemoFirebase(
    () => (firestore && user && user.email ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData, isLoading: isUserDataLoading } = useDoc(userDocRef);

  const institutionId = userData?.institutionId;

  const institutionDocRef = useMemoFirebase(
    () => (firestore && institutionId ? doc(firestore, 'institutions', institutionId) : null),
    [firestore, institutionId]
  );
  const { data: institutionData, isLoading: isInstitutionLoading } = useDoc(institutionDocRef);
  
  const contextIsLoading = !isInitialized || isUserLoading || (user && isUserDataLoading) || (user && institutionId && isInstitutionLoading);

  const availableBranches = useMemo(() => {
    if (!userData || !institutionData) return [];
    
    const hqBranch = { id: '01', name: institutionData.hqBranch?.name || 'Headquarters', code: '01' };
    const otherBranches = institutionData.branches || [];
    const allPhysicalBranches = [hqBranch, ...otherBranches].sort((a,b) => a.code.localeCompare(b.code));

    if (userData.role === 'institution-admin') {
        return [{ id: 'all', name: 'All Branches' }, ...allPhysicalBranches];
    }
    
    const userBranchIds = userData.branchIds || [];
    return allPhysicalBranches.filter(branch => userBranchIds.includes(branch.code));
  }, [userData, institutionData]);

  const handleSetSelectedBranch = (branchId: string) => {
    try {
        sessionStorage.setItem('selectedBranchId', branchId);
    } catch (error) {
        console.error("Could not write to sessionStorage", error);
    }
    setSelectedBranch(branchId);
  }
  
  // This effect will auto-select a branch if it's the only one available,
  // or default an admin to "All Branches"
  useEffect(() => {
    if (!contextIsLoading && !selectedBranch) {
      if (userData?.role === 'institution-admin') {
        handleSetSelectedBranch('all');
      } else if (availableBranches.length === 1) {
        handleSetSelectedBranch(availableBranches[0].id);
      }
    }
  }, [contextIsLoading, availableBranches, selectedBranch, userData]);


  const value = useMemo(() => ({
    selectedBranch,
    setSelectedBranch: handleSetSelectedBranch,
    availableBranches,
    loading: contextIsLoading,
  }), [selectedBranch, availableBranches, contextIsLoading]);

  return (
    <BranchContext.Provider value={value}>
      <BranchGuard>{children}</BranchGuard>
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const context = useContext(BranchContext);
  if (context === undefined) {
    throw new Error('useBranch must be used within a BranchProvider');
  }
  return context;
}
