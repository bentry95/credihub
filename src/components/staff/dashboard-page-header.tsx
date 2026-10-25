import type { ReactNode } from 'react';

type DashboardPageHeaderProps = {
  title: string;
  description: string;
  children?: ReactNode;
};

export function DashboardPageHeader({ title, description, children }: DashboardPageHeaderProps) {
  return (
    <section className="relative isolate overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/80 px-6 py-6 text-primary-foreground shadow-md sm:px-8 sm:py-7">
      <div className="pointer-events-none absolute -right-12 -top-20 -z-10 h-56 w-56 rounded-full border-[28px] border-white/5" />
      <div className="pointer-events-none absolute -bottom-20 right-40 -z-10 h-44 w-44 rounded-full bg-white/5 blur-2xl" />
      <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-2xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">Dashboard overview</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-white/75 sm:text-base">{description}</p>
        </div>
        {children && <div className="relative flex flex-wrap items-center gap-3">{children}</div>}
      </div>
    </section>
  );
}
