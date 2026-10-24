
'use client';

import React from 'react';
import { format } from 'date-fns';
import { useDoc, useMemoFirebase, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { amountToWords } from '@/lib/utils';
import Image from 'next/image';

export type ReceiptType = 'deposit' | 'withdrawal' | 'payout' | 'direct-deposit' | 'repayment';

export interface ReceiptData {
  transactionId: string;
  date: Date;
  type: ReceiptType;
  customerName?: string;
  memberId?: string;
  customerPhone?: string;
  amount: number;
  description?: string;
  tellerName?: string;
  branchName?: string;
  paymentMethod?: string;
  bankName?: string;
  depositSlipNumber?: string;
  depositDate?: Date;
  fee?: number;
  totalDeduction?: number;
  institutionId?: string;
  institutionBankAccountName?: string;
}

interface TransactionReceiptProps {
  receiptData: ReceiptData | null;
}

const receiptTitles: Record<ReceiptType, string> = {
    deposit: 'Cash Deposit Receipt',
    withdrawal: 'Cash Withdrawal Receipt',
    payout: 'Loan Payout Voucher',
    'direct-deposit': 'Bank Deposit Acknowledgment',
    repayment: 'Loan Repayment Receipt',
};


export const TransactionReceipt = React.forwardRef<HTMLDivElement, TransactionReceiptProps>(({ receiptData }, ref) => {
    
    const firestore = useFirestore(); 

    const institutionDocRef = useMemoFirebase(
      () => (receiptData?.institutionId && firestore ? doc(firestore, 'institutions', receiptData.institutionId) : null),
      [receiptData?.institutionId, firestore]
    );
    const { data: institutionData } = useDoc(institutionDocRef);

    if (!receiptData) {
        return null;
    }

    const {
        transactionId,
        date,
        type,
        customerName,
        memberId,
        customerPhone,
        amount,
        description,
        tellerName,
        branchName,
        paymentMethod,
        bankName,
        depositSlipNumber,
        depositDate,
        fee,
        totalDeduction,
        institutionBankAccountName,
    } = receiptData;

    return (
        <div ref={ref} className="p-8 bg-white text-black font-sans text-sm max-w-2xl mx-auto border shadow-md">
            <div className="text-center space-y-2">
                {institutionData?.logoUrl ? (
                    <Image src={institutionData.logoUrl} alt={`${institutionData.name} logo`} width={80} height={80} className="mx-auto" />
                ) : (
                    <div className="h-20 w-20 bg-gray-200 mx-auto rounded-full" />
                )}
                <h2 className="text-xl font-bold">{institutionData?.name || 'Financial Institution'}</h2>
                <p className="font-semibold text-gray-500 uppercase">{receiptTitles[type] || 'Transaction Receipt'}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-6 border-b pb-4">
                <div><strong>Receipt No:</strong> {transactionId}</div>
                <div className="text-right"><strong>Date:</strong> {format(date, 'dd/MM/yyyy HH:mm')}</div>
                <div><strong>Branch:</strong> {branchName || 'N/A'}</div>
                <div className="text-right"><strong>Teller:</strong> {tellerName}</div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-4 border-b pb-4">
                <div><strong>Received From/Paid To:</strong></div><div>{customerName}</div>
                <div><strong>Member ID:</strong></div><div>{memberId || 'N/A'}</div>
                <div><strong>Phone:</strong></div><div>{customerPhone || 'N/A'}</div>
            </div>
            
            {(paymentMethod === 'Bank' || type === 'direct-deposit') && (
                <div className="mt-4 rounded-md bg-gray-100 p-4">
                    <h4 className="font-semibold mb-2 text-center">Bank Deposit Details</h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <div><strong>Receiving Account:</strong></div><div>{institutionBankAccountName || 'N/A'}</div>
                        <div><strong>Depositor's Bank:</strong></div><div>{bankName}</div>
                        <div><strong>Slip No./Ref:</strong></div><div>{depositSlipNumber}</div>
                        <div><strong>Deposit Date:</strong></div><div>{depositDate && format(depositDate, 'MMMM do, yyyy')}</div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-4 border-b pb-4">
                <div><strong>The Sum of:</strong></div><div>{amountToWords(amount)}</div>
                <div><strong>In Payment of:</strong></div><div>{description || 'N/A'}</div>
            </div>
            
            {fee !== undefined ? (
                 <div className="mt-4 space-y-2">
                    <div className="flex justify-between"><span>Amount:</span> <span>MWK {amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
                    <div className="flex justify-between"><span>Fee:</span> <span>MWK {fee.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
                    <div className="flex justify-between font-bold border-t pt-2"><span>Total:</span> <span>MWK {totalDeduction?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span></div>
                 </div>
            ) : (
                 <div className="flex justify-between items-center mt-4">
                    <h3 className="text-lg font-bold">TOTAL AMOUNT:</h3>
                    <p className="text-lg font-bold">MWK {amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
            )}

            <div className="grid grid-cols-2 gap-4 mt-16">
                <div className="border-t pt-2 text-center text-xs">Customer's Signature</div>
                <div className="border-t pt-2 text-center text-xs">Teller's Signature</div>
            </div>
            <p className="text-center text-xs text-gray-500 mt-6">This receipt is valid only when captured in the system</p>
        </div>
    );
});

TransactionReceipt.displayName = 'TransactionReceipt';
