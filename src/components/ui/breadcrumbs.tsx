"use client";

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import React, { Fragment } from 'react';

type BreadcrumbProps = {
  capitalizeLinks?: boolean;
};

const Breadcrumbs = ({ capitalizeLinks = true }: BreadcrumbProps) => {
  const pathname = usePathname();
  const pathSegments = pathname.split('/').filter(segment => segment);

  const breadcrumbs = pathSegments.map((segment, index) => {
    const href = '/' + pathSegments.slice(0, index + 1).join('/');
    const isLast = index === pathSegments.length - 1;
    const linkText = capitalizeLinks
      ? segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')
      : segment.replace(/-/g, ' ');

    return { href, linkText, isLast };
  });

  return (
    <nav aria-label="Breadcrumb" className="text-sm font-medium">
      <ol className="flex items-center gap-1.5">
        {breadcrumbs.map((breadcrumb, index) => (
          <Fragment key={breadcrumb.href}>
            <li>
              {breadcrumb.isLast ? (
                <span className="font-semibold text-foreground">
                  {breadcrumb.linkText}
                </span>
              ) : (
                <Link href={breadcrumb.href} className="text-muted-foreground transition-colors hover:text-foreground">
                  {breadcrumb.linkText}
                </Link>
              )}
            </li>
            {!breadcrumb.isLast && (
              <li>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </li>
            )}
          </Fragment>
        ))}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
