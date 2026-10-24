import { Sailboat } from 'lucide-react';

export function SaileLogo() {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex items-center justify-center">
        <div className="p-3 bg-primary/10 rounded-full">
            <Sailboat className="h-8 w-8 text-primary" />
        </div>
      </div>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50 font-headline">
          CrediHub
      </h1>
    </div>
  );
}
