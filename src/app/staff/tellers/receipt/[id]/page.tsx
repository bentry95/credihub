'use client';

import React, { Suspense, useRef, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useMemoFirebase, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { TransactionReceipt, type ReceiptData } from '@/components/staff/transaction-receipt';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useReactToPrint } from 'react-to-print';

// A wrapper component required for PDF generation to work with functional components.
const PrintableReceipt = React.forwardRef<HTMLDivElement, { receiptData: ReceiptData | null }>(
    ({ receiptData }, ref) => {
        if (!receiptData) return null;
        // The component being printed MUST be the only thing returned.
        // The wrapping div is found by the ref and its entire contents are printed.
        return <div ref={ref}><TransactionReceipt receiptData={receiptData} /></div>;
    }
);
PrintableReceipt.displayName = 'PrintableReceipt';

function ReceiptPageContent() {
    const params = useParams();
    const router = useRouter();
    const receiptId = params.id as string;
    
    const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const receiptRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Data is passed via sessionStorage to avoid complex URL state
        // and to handle page reloads gracefully.
        const dataFromStorage = sessionStorage.getItem('lastReceiptData');
        if (dataFromStorage) {
            const parsedData = JSON.parse(dataFromStorage);
            // Ensure date strings are converted back to Date objects
            if (parsedData.date) parsedData.date = new Date(parsedData.date);
            if (parsedData.depositDate) parsedData.depositDate = new Date(parsedData.depositDate);
            setReceiptData(parsedData);
        }
        setIsLoading(false);

    }, []);

    const handlePrint = useReactToPrint({
        contentRef: receiptRef,
    });
    
    const handleSave = async () => {
        const input = receiptRef.current;
        if (!input || !receiptData) return;
    
        const canvas = await html2canvas(input, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
    
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'px',
          format: [canvas.width, canvas.height]
        });
    
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save(`Receipt_${receiptData.transactionId}.pdf`);
    };

    if (isLoading) {
        return <Skeleton className="h-screen w-full max-w-3xl mx-auto" />;
    }

    if (!receiptData) {
        return (
            <div className="text-center p-8">
                <p>Receipt data not found. It may have expired.</p>
                <Button onClick={() => router.back()} className="mt-4">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
                </Button>
            </div>
        );
    }

    return (
        <div className="bg-gray-100 dark:bg-gray-800 min-h-screen p-4 sm:p-8">
            <div className="max-w-3xl mx-auto">
                 <div className="flex justify-between items-center mb-4 print:hidden">
                    <Button variant="outline" onClick={() => router.back()}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
                    </Button>
                    <div className="flex gap-2">
                        <Button onClick={() => handlePrint()} variant="outline">
                            <Printer className="mr-2 h-4 w-4" /> Print
                        </Button>
                        <Button onClick={handleSave}>
                            <Download className="mr-2 h-4 w-4" /> Save Receipt
                        </Button>
                    </div>
                </div>
                {/* The ref is attached to the wrapper div here */}
                <PrintableReceipt ref={receiptRef} receiptData={receiptData} />
            </div>
        </div>
    );
}


export default function ReceiptPage() {
    return (
        <Suspense fallback={<Skeleton className="h-screen w-full max-w-3xl mx-auto" />}>
            <ReceiptPageContent />
        </Suspense>
    );
}