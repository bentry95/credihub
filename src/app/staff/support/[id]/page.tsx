
'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  useUser,
  useFirestore,
  useDoc,
  useMemoFirebase,
} from '@/firebase';
import { doc, updateDoc, arrayUnion, Timestamp, serverTimestamp } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Send, MessageSquare, Loader2, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

export default function StaffTicketDetailsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const ticketId = params.id as string;

  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: userData } = useDoc(
    useMemoFirebase(() => (firestore && user ? doc(firestore, 'users', user.uid) : null), [firestore, user])
  );
  const institutionId = userData?.institutionId;

  const ticketDocRef = useMemoFirebase(
    () => (firestore && institutionId && ticketId ? doc(firestore, 'institutions', institutionId, 'tickets', ticketId) : null),
    [firestore, institutionId, ticketId]
  );
  const { data: fullTicket, isLoading } = useDoc(ticketDocRef);

  const handleSendMessage = async () => {
    if (!message.trim() || !user || !ticketDocRef) return;

    setIsSubmitting(true);
    try {
      const newMessage = {
        senderId: user.uid,
        senderName: userData?.name || 'Staff User',
        text: message.trim(),
        timestamp: Timestamp.now(),
      };

      await updateDoc(ticketDocRef, {
        messages: arrayUnion(newMessage),
        updatedAt: serverTimestamp(),
      });

      setMessage('');
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to send message.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [fullTicket?.messages]);

  if (isLoading) return <Skeleton className="h-screen w-full" />;

  if (!fullTicket) return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
          <p>Ticket not found.</p>
          <Button onClick={() => router.back()} variant="link">Go Back</Button>
      </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Support
        </Button>
        <Badge className="text-sm px-3 py-1">{fullTicket.status}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Ticket Context</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
             <div className="flex items-start gap-3">
                <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div><p className="font-semibold">Subject</p><p>{fullTicket.subject}</p></div>
            </div>
             <div className="flex items-start gap-3">
                <div><p className="font-semibold">Category</p><p>{fullTicket.category}</p></div>
            </div>
             <div className="flex items-start gap-3">
                <div><p className="font-semibold">Priority</p><p>{fullTicket.priority}</p></div>
            </div>
            <Separator />
            <div>
                <p className="font-semibold mb-1">Description</p>
                <p className="text-muted-foreground">{fullTicket.description}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 flex flex-col h-[600px]">
          <CardHeader className="border-b">
            <CardTitle>Conversation</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full p-6" ref={scrollRef}>
              <div className="space-y-6">
                 {/* Original Description */}
                <div className="flex flex-col items-start">
                  <div className="max-w-[80%] rounded-lg p-3 bg-muted">
                    <p className="text-sm">{fullTicket.description}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1">
                    System Message • Ticket Opened
                  </span>
                </div>

                {(fullTicket.messages || []).map((msg: any, i: number) => (
                  <div key={i} className={`flex flex-col ${msg.senderId === user?.uid ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[80%] rounded-lg p-3 ${msg.senderId === user?.uid ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      <p className="text-sm">{msg.text}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1">
                      {msg.senderName} • {format(msg.timestamp.toDate(), 'HH:mm')}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
          <CardFooter className="border-t p-4">
            <form className="flex w-full items-center gap-2" onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}>
              <Input
                placeholder="Type your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={isSubmitting || fullTicket.status === 'Closed'}
              />
              <Button type="submit" size="icon" disabled={!message.trim() || isSubmitting || fullTicket.status === 'Closed'}>
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

    