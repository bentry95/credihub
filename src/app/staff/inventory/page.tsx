
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function InventoryPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/staff/inventory/dashboard');
  }, [router]);

  return null;
}
