
'use client';

import { useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Package,
  Boxes,
  TriangleAlert,
  Archive,
} from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Bar, XAxis, YAxis, CartesianGrid, BarChart, PieChart as RechartsPieChart, Pie, Cell } from 'recharts';
import {
  useUser,
  useFirestore,
  useCollection,
  useMemoFirebase,
  useDoc,
} from '@/firebase';
import { collection, query, where, doc, orderBy, limit } from 'firebase/firestore';
import { format, formatDistanceToNow } from 'date-fns';

const formatCurrency = (value: number) => {
    if (value >= 1_000_000_000) {
        return `MWK ${(value / 1_000_000_000).toFixed(1)}B`;
    }
    if (value >= 1_000_000) {
        return `MWK ${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1_000) {
        return `MWK ${(value / 1_000)}k`;
    }
    return `MWK ${value}`;
};

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

export default function InventoryDashboardPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(
    () => (firestore && user?.uid ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData } = useDoc(userDocRef);
  const institutionId = userData?.institutionId;

  const itemsQuery = useMemoFirebase(
    () => (institutionId ? collection(firestore, 'institutions', institutionId, 'inventoryItems') : null),
    [firestore, institutionId]
  );
  const { data: items, isLoading: isItemsLoading } = useCollection(itemsQuery);

  const categoriesQuery = useMemoFirebase(
    () => (institutionId ? collection(firestore, 'institutions', institutionId, 'inventoryCategories') : null),
    [firestore, institutionId]
  );
  const { data: categories, isLoading: isCategoriesLoading } = useCollection(categoriesQuery);
  
  const { kpis, valueByCategory, itemsByType, lowStockItems, recentItems } = useMemo(() => {
    if (!items || !categories) return { kpis: {}, valueByCategory: [], itemsByType: [], lowStockItems: [], recentItems: [] };
    
    const totalValue = items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.costPrice || 0)), 0);
    const lowStock = items.filter(item => item.quantity < item.reorderLevel);
    const loanable = items.filter(item => item.itemType === 'Loanable Item');

    const valueByCategoryData = categories.map(category => {
      const categoryValue = items
        .filter(item => item.categoryId === category.id)
        .reduce((sum, item) => sum + ((item.quantity || 0) * (item.costPrice || 0)), 0);
      return { name: category.name, value: categoryValue };
    }).filter(c => c.value > 0);

    const itemsByTypeData = Object.entries(items.reduce((acc, item) => {
      acc[item.itemType] = (acc[item.itemType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)).map(([name, value]) => ({ name, value }));

    const sortedLowStock = [...lowStock].sort((a, b) => a.quantity - b.quantity).slice(0, 5);
    const sortedRecent = [...items].sort((a,b) => b.createdAt.toDate() - a.createdAt.toDate()).slice(0, 5);

    return {
      kpis: {
        totalItems: items.length,
        totalValue,
        lowStockItems: lowStock.length,
        loanableItems: loanable.length,
      },
      valueByCategory: valueByCategoryData,
      itemsByType: itemsByTypeData,
      lowStockItems: sortedLowStock,
      recentItems: sortedRecent,
    };
  }, [items, categories]);

  const kpiCards = [
    { title: 'Total Unique Items', value: kpis.totalItems, icon: Package },
    { title: 'Total Stock Value', value: formatCurrency(kpis.totalValue || 0), icon: Boxes },
    { title: 'Items Below Reorder Level', value: kpis.lowStockItems, icon: TriangleAlert },
    { title: 'Loanable Items', value: kpis.loanableItems, icon: Archive },
  ];
  
  const isLoading = isItemsLoading || isCategoriesLoading;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              <kpi.icon className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-8 w-3/4" /> : <div className="text-3xl font-bold">{kpi.value}</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Stock Value by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[250px] w-full" /> : (
              <ChartContainer config={{}} className="min-h-[250px] w-full">
                <BarChart data={valueByCategory} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickFormatter={(value) => formatCurrency(Number(value))} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={4} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Items by Type</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[250px] w-full" /> : (
              <ChartContainer config={{}} className="min-h-[250px] w-full">
                <RechartsPieChart>
                  <Pie data={itemsByType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {itemsByType.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                </RechartsPieChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Low Stock Items</CardTitle><CardDescription>Top 5 items at or below their reorder level.</CardDescription></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Qty</TableHead><TableHead>Reorder Lvl</TableHead></TableRow></TableHeader>
              <TableBody>
                {isLoading ? Array.from({length:3}).map((_,i) => <TableRow key={i}><TableCell colSpan={3}><Skeleton className="h-5 w-full"/></TableCell></TableRow>) :
                 lowStockItems.length > 0 ? lowStockItems.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-destructive font-bold">{item.quantity}</TableCell>
                    <TableCell>{item.reorderLevel}</TableCell>
                  </TableRow>
                 )) : <TableRow><TableCell colSpan={3} className="text-center h-24">No items are low on stock.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recently Added Items</CardTitle><CardDescription>The 5 most recently created items.</CardDescription></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Category</TableHead><TableHead>Added</TableHead></TableRow></TableHeader>
              <TableBody>
                {isLoading ? Array.from({length:3}).map((_,i) => <TableRow key={i}><TableCell colSpan={3}><Skeleton className="h-5 w-full"/></TableCell></TableRow>) :
                 recentItems.length > 0 ? recentItems.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{categories?.find(c => c.id === item.categoryId)?.name}</TableCell>
                    <TableCell>{formatDistanceToNow(item.createdAt.toDate(), { addSuffix: true })}</TableCell>
                  </TableRow>
                 )) : <TableRow><TableCell colSpan={3} className="text-center h-24">No items have been added yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
