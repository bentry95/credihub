
'use client';

import { useBranch } from '@/context/BranchContext';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building, ArrowRight, ShieldAlert } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';

export default function SelectBranchPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { availableBranches, setSelectedBranch, loading } = useBranch();
  const router = useRouter();

  const userDocRef = useMemoFirebase(
    () => (firestore && user?.uid ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);
  const isInstitutionAdmin = userData?.role === 'institution-admin';

  const handleBranchSelect = (branchId: string) => {
    setSelectedBranch(branchId);
    router.push('/staff/dashboard');
  };

  if (loading) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
             <div className="w-full max-w-2xl space-y-6">
                <div className="text-center space-y-2">
                    <Skeleton className="h-8 w-64 mx-auto" />
                    <Skeleton className="h-5 w-80 mx-auto" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                </div>
             </div>
        </div>
      )
  }

  // This check is now more specific: only show error if not an admin and no branches are available.
  if (availableBranches.length === 0 && !isInstitutionAdmin) {
    return (
       <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
           <Card className="w-full max-w-md">
               <CardHeader>
                   <CardTitle>No Branches Assigned</CardTitle>
                   <CardDescription>Your account is not assigned to any branches.</CardDescription>
               </CardHeader>
               <CardContent>
                   <Alert variant="destructive">
                       <ShieldAlert className="h-4 w-4" />
                       <AlertTitle>Access Denied</AlertTitle>
                       <AlertDescription>
                           Please contact your administrator to be assigned to a branch. You cannot proceed until a branch has been assigned to your profile.
                       </AlertDescription>
                   </Alert>
               </CardContent>
           </Card>
       </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Select a Branch</CardTitle>
          <CardDescription>
            Choose the branch you want to work in for this session.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableBranches.map((branch) => (
              <Button
                key={branch.id}
                variant="outline"
                className="h-24 justify-start p-6 text-left"
                onClick={() => handleBranchSelect(branch.id)}
              >
                <div className="flex items-center gap-4">
                  <Building className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-semibold">{branch.name}</p>
                    {branch.id === 'all' && <p className="text-xs text-muted-foreground">View data across all branches.</p>}
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
