
'use client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Settings2, Shapes, Layers, TrendingDown, Map } from "lucide-react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

const setupItems = [
    {
        title: "Asset Categories",
        description: "Group your assets into logical categories like 'Furniture', 'IT Equipment', or 'Vehicles'.",
        href: "/staff/inventory/categories",
        icon: Shapes,
    },
    {
        title: "Asset Classes",
        description: "Define classes for accounting purposes, which determine depreciation rules. (Coming Soon)",
        href: "#",
        icon: Layers,
        disabled: true,
    },
    {
        title: "Depreciation Methods",
        description: "Configure methods like 'Straight Line' or 'Reducing Balance'. (Coming Soon)",
        href: "#",
        icon: TrendingDown,
        disabled: true,
    },
    {
        title: "Asset Locations",
        description: "Manage the physical locations of your assets, such as branches or departments. (Coming Soon)",
        href: "#",
        icon: Map,
        disabled: true,
    },
];

export default function AssetSetupPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Fixed Asset Setup</h1>
        <p className="text-muted-foreground mt-1">
          Configure the foundational settings for your asset management module.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {setupItems.map((item) => (
            <Link href={item.href} key={item.title} className={`group ${item.disabled ? 'pointer-events-none' : ''}`}>
                <Card className={`h-full hover:shadow-lg transition-shadow duration-200 ${item.disabled ? 'bg-muted/50' : 'hover:border-primary/50'}`}>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span>{item.title}</span>
                            <item.icon className="h-6 w-6 text-muted-foreground" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <CardDescription>{item.description}</CardDescription>
                        {!item.disabled && (
                            <div className="flex items-center text-sm font-medium text-primary mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                Configure <ArrowRight className="ml-2 h-4 w-4" />
                            </div>
                        )}
                    </CardContent>
                </Card>
            </Link>
        ))}
      </div>
    </div>
  );
}
