'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';

export function useIdleTimer(timeoutInMinutes: number) {
  const auth = useAuth();
  const router = useRouter();
  const timeoutId = useRef<NodeJS.Timeout | null>(null);

  const handleSignOut = useCallback(() => {
    if (auth) {
      signOut(auth)
        .then(() => {
          router.push('/?session_expired=true');
        })
        .catch((error) => {
          console.error('Error signing out after idle timeout:', error);
        });
    }
  }, [auth, router]);
  
  const resetTimer = useCallback(() => {
    if (timeoutId.current) {
      clearTimeout(timeoutId.current);
    }
    
    const timeoutMs = timeoutInMinutes * 60 * 1000;
    if (timeoutMs > 0) {
        timeoutId.current = setTimeout(handleSignOut, timeoutMs);
    }
  }, [timeoutInMinutes, handleSignOut]);

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];

    const handleActivity = () => {
      resetTimer();
    };

    if (timeoutInMinutes > 0) {
        events.forEach(event => {
            window.addEventListener(event, handleActivity);
        });
        resetTimer();
    }

    return () => {
      if (timeoutId.current) {
        clearTimeout(timeoutId.current);
      }
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [resetTimer, timeoutInMinutes]);

  return null;
}
