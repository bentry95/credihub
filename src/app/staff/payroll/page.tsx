
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PayrollPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/staff/payroll/dashboard');
  }, [router]);

  return null;
}
