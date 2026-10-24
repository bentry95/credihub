
'use client';

import {
  Bell,
  LogOut,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth, useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';
import { doc } from 'firebase/firestore';


export function UserNav() {
  const auth = useAuth();
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const { data: userData } = useDoc(
    useMemoFirebase(() => (user && firestore ? doc(firestore, 'users', user.uid) : null), [user, firestore])
  );

  const handleSignOut = async () => {
    try {
      if (auth) {
        await signOut(auth);
      }
      router.push('/');
    } catch (error) {
      console.error('Error signing out: ', error);
    }
  };

  const displayName = userData?.name || user?.displayName || 'Staff User';

  return (
    <>
        <Button variant="ghost" size="icon">
            <Bell className="h-6 w-6" />
            <span className="sr-only">Notifications</span>
        </Button>
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
            <Button
                variant="ghost"
                className="relative h-8 w-8 rounded-full"
            >
                <Avatar className="h-8 w-8">
                <AvatarImage src={userData?.photoURL || user?.photoURL || ''} alt={displayName} />
                <AvatarFallback>{displayName.charAt(0)}</AvatarFallback>
                </Avatar>
            </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">
                    {displayName}
                </p>
                <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                </p>
                </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
                <Link href="/staff/profile">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign Out</span>
            </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    </>
  );
}
