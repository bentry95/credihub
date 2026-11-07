"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep technical details available to developers without showing them to staff.
    console.error("Application page error:", error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-6 py-12">
      <section className="w-full max-w-lg space-y-4 rounded-2xl border bg-card p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold">This page couldn’t load</h1>
        <p className="text-sm text-muted-foreground">
          Something went wrong while loading this page. Please try again. If the problem continues, contact your administrator.
        </p>
        <Button onClick={() => reset()}>Try again</Button>
      </section>
    </main>
  );
}
