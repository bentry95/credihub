
'use client';

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { settingsConfig, ReportCategory, SettingsCategory } from '@/lib/settings';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemo } from 'react';

export default function SettingsPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);

  const institutionId = userData?.institutionId;

  const institutionDocRef = useMemoFirebase(
    () =>
      firestore && institutionId
        ? doc(firestore, 'institutions', institutionId)
        : null,
    [firestore, institutionId]
  );
  const { data: institutionData, isLoading: isInstitutionLoading } =
    useDoc(institutionDocRef);

  const filteredSettingsConfig = useMemo(() => {
    if (!institutionData) {
      return settingsConfig;
    }

    if (institutionData.type === 'MFI') {
      return settingsConfig.map(category => ({
        ...category,
        items: category.items.filter(item => item.title !== 'Share Products'),
      })).filter(category => category.items.length > 0);
    }

    return settingsConfig;
  }, [institutionData]);


  if (isInstitutionLoading) {
      return (
        <div className="space-y-8">
            <div>
                <Skeleton className="h-9 w-1/3" />
                <Skeleton className="h-5 w-2/3 mt-2" />
            </div>
             <div className="space-y-10">
                {settingsConfig.map((category: SettingsCategory) => (
                    <div key={category.category}>
                        <h2 className="text-2xl font-semibold tracking-tight border-b pb-2 mb-6">
                            <Skeleton className="h-7 w-1/4" />
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {category.items.map((item) => (
                                <Card key={item.title} className="h-full">
                                    <CardHeader>
                                        <Skeleton className="h-6 w-1/2" />
                                    </CardHeader>
                                    <CardContent>
                                        <Skeleton className="h-4 w-full" />
                                        <Skeleton className="h-4 w-2/3 mt-2" />
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Institution Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Your control panel for configuring how your institution operates on
          the platform.
        </p>
      </div>

      <div className="space-y-10">
        {filteredSettingsConfig.map((category: SettingsCategory) => (
          <div key={category.category}>
            <h2 className="text-2xl font-semibold tracking-tight border-b pb-2 mb-6">
              {category.category}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {category.items.map((item) => (
                <Link href={item.href} key={item.title} className="group">
                  <Card className="h-full hover:shadow-lg transition-shadow duration-200 hover:border-primary/50">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{item.title}</span>
                        <item.icon className="h-6 w-6 text-muted-foreground" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription>{item.description}</CardDescription>
                      <div className="flex items-center text-sm font-medium text-primary mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        Configure <ArrowRight className="ml-2 h-4 w-4" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

    