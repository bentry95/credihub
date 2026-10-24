
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ObsoletePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/staff/payroll/payroll-runs');
  }, [router]);

  return null;
}

    