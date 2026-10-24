'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, orderBy, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { HelpCircle, Eye, PlusCircle, Loader2, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';


const ticketSchema = z.object({
  subject: z.string().min(5, 'Subject must be at least 5 characters.'),
  category: z.enum(['Technical', 'Billing', 'Feature Request', 'General Inquiry']),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']),
  description: z.string().min(10, 'Please provide a detailed description.'),
});

const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Open': return 'default';
      case 'In Progress': return 'secondary';
      case 'Resolved':
      case 'Closed':
        return 'outline';
      default: return 'outline';
    }
};

const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'Urgent':
      case 'High':
        return 'destructive';
      case 'Medium':
        return 'secondary';
      case 'Low':
        return 'outline';
      default: return 'outline';
    }
};


export default function StaffSupportPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userDocRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'users', user.uid) : null),
    [firestore, user]
  );
  const { data: userData, isLoading: isUserLoading } = useDoc(userDocRef);
  const institutionId = userData?.institutionId;

  const ticketsQuery = useMemoFirebase(
    () => (firestore && institutionId ? query(collection(firestore, 'institutions', institutionId, 'tickets'), orderBy('updatedAt', 'desc')) : null),
    [firestore, institutionId]
  );
  const { data: tickets, isLoading: isTicketsLoading } = useCollection(ticketsQuery);

  const form = useForm<z.infer<typeof ticketSchema>>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
        priority: 'Medium',
    }
  });

  async function onSubmit(values: z.infer<typeof ticketSchema>) {
    if (!firestore || !institutionId || !user) {
        setError('Cannot submit ticket. User or institution context is missing.');
        return;
    }
    setLoading(true);
    setError(null);
    try {
        const ticketsRef = collection(firestore, 'institutions', institutionId, 'tickets');
        const newDocRef = doc(ticketsRef);

        await setDoc(newDocRef, {
            ...values,
            id: newDocRef.id,
            institutionId,
            status: 'Open',
            createdBy: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });

        toast({ title: "Ticket Created", description: "Your support ticket has been submitted."});
        setIsFormOpen(false);
        form.reset();
    } catch(e) {
        console.error(e);
        setError('Failed to create ticket. Please try again.');
    } finally {
        setLoading(false);
    }
  }


  const isLoading = isUserLoading || isTicketsLoading;

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Support Tickets</h1>
            <p className="text-muted-foreground mt-1">
              View your institution's support history and create new tickets.
            </p>
          </div>
          <Button onClick={() => setIsFormOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Create New Ticket
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>My Institution's Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                  ))
                ) : tickets && tickets.length > 0 ? (
                  tickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-medium">{ticket.subject}</TableCell>
                      <TableCell><Badge variant={getStatusBadgeVariant(ticket.status)}>{ticket.status}</Badge></TableCell>
                      <TableCell><Badge variant={getPriorityBadgeVariant(ticket.priority)}>{ticket.priority}</Badge></TableCell>
                      <TableCell>{ticket.updatedAt ? formatDistanceToNow(ticket.updatedAt.toDate(), { addSuffix: true }) : 'N/A'}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                           <Link href={`/staff/support/${ticket.id}`}><Eye className="mr-2 h-4 w-4"/> View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-48 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="p-4 bg-muted rounded-full"><HelpCircle className="h-10 w-10 text-muted-foreground" /></div>
                        <h3 className="text-lg font-semibold">No Tickets Found</h3>
                        <p className="text-muted-foreground">Click "Create New Ticket" to get started.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Create Support Ticket</DialogTitle>
            <DialogDescription>
                Describe your issue or request and our support team will get back to you.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /> <AlertTitle>{error}</AlertTitle></Alert>}
                 <FormField control={form.control} name="subject" render={({ field }) => (<FormItem><FormLabel>Subject</FormLabel><FormControl><Input placeholder="e.g., Error on loan disbursement page" {...field} /></FormControl><FormMessage /></FormItem>)} />
                 <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="category" render={({ field }) => (<FormItem><FormLabel>Category</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select category..."/></SelectTrigger></FormControl><SelectContent><SelectItem value="Technical">Technical Issue</SelectItem><SelectItem value="Billing">Billing Inquiry</SelectItem><SelectItem value="Feature Request">Feature Request</SelectItem><SelectItem value="General Inquiry">General Inquiry</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="priority" render={({ field }) => (<FormItem><FormLabel>Priority</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="Low">Low</SelectItem><SelectItem value="Medium">Medium</SelectItem><SelectItem value="High">High</SelectItem><SelectItem value="Urgent">Urgent</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                 </div>
                 <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="Please provide as much detail as possible, including steps to reproduce the issue." {...field} rows={6} /></FormControl><FormMessage /></FormItem>)} />
                 <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                    <Button type="submit" disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Submit Ticket</Button>
                </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
