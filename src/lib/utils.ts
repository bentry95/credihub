import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const loanStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'Application': return 'secondary';
      case 'Appraisal': return 'outline';
      case 'Pending Approval': return 'outline';
      case 'Approved': return 'default';
      case 'Disbursed': return 'default';
      case 'Repaid': return 'default';
      case 'Overdue': return 'destructive';
      case 'Rejected': return 'destructive';
      default: return 'secondary';
    }
}

const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const thousands = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];

function numberToWords(num: number): string {
    if (num === 0) return 'Zero';

    let words = '';
    let i = 0;

    while (num > 0) {
        if (num % 1000 !== 0) {
            words = `${convertHundreds(num % 1000)} ${thousands[i]} ${words}`;
        }
        num = Math.floor(num / 1000);
        i++;
    }

    return words.trim();
}

function convertHundreds(num: number): string {
    let result = '';

    if (num >= 100) {
        result += `${ones[Math.floor(num / 100)]} Hundred `;
        num %= 100;
    }

    if (num >= 20) {
        result += `${tens[Math.floor(num / 10)]} `;
        num %= 10;
    }

    if (num >= 10) {
        return result + teens[num - 10];
    }

    if (num > 0) {
        result += ones[num];
    }

    return result.trim();
}

export function amountToWords(amount: number): string {
    if (typeof amount !== 'number') return '';

    const kwacha = Math.floor(amount);
    const tambala = Math.round((amount - kwacha) * 100);

    let words = '';

    if (kwacha > 0) {
        words += `${numberToWords(kwacha)} Kwacha`;
    }

    if (tambala > 0) {
        if (kwacha > 0) {
            words += ' and ';
        }
        words += `${numberToWords(tambala)} Tambala`;
    }

    if (!words) {
        return 'Zero Kwacha only';
    }

    return `${words} only`;
}
