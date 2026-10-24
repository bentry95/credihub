

'use client';

import { LogOut, Sun, Moon, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';
import { useAuth, useUser } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTheme } from 'next-themes';


export function AdminUserNav() {
  const auth = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const { setTheme } = useTheme();

  const handleSignOut = async () => {
    try {
      if(auth) {
        await signOut(auth);
      }
      router.push('/');
    } catch (error) {
      console.error('Error signing out: ', error);
    }
  };

  return (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
            <AvatarImage src={user?.photoURL || ''} alt={user?.displayName || 'Admin'} />
            <AvatarFallback>{user?.displayName?.charAt(0)}</AvatarFallback>
            </Avatar>
        </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user?.displayName || 'Admin User'}</p>
            <p className="text-xs leading-none text-muted-foreground">
                {user?.email || 'admin@saile.com'}
            </p>
            </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Profile</DropdownMenuItem>
        <DropdownMenuItem>Settings</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Sign Out</span>
        </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>
  );
}

    