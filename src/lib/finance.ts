

import { addMonths, isPast, differenceInDays, addDays, addYears, startOfDay } from 'date-fns';

export interface AmortizationInput {
  principal: number;
  annualInterestRate: number;
  term: number;
  tenureUnit: 'Days' | 'Months' | 'Years';
  interestRateType: 'Flat' | 'Reducing Balance';
  startDate?: Date;
}

export interface AmortizationRow {
  period: number;
  paymentDate: Date;
  openingBalance: number;
  principal: number;
  interest: number;
  totalPayment: number;
  closingBalance: number;
  closingLoanBalance?: number;
}

export const calculateAmortization = (
  input: AmortizationInput
): { schedule: AmortizationRow[]; totalInterest: number; totalPayment: number; monthlyInstallment: number } => {
  const { principal, annualInterestRate, term, tenureUnit, interestRateType, startDate } = input;

  const termInMonths = tenureUnit === 'Years' ? term * 12 : tenureUnit === 'Days' ? term / 30 : term;
  
  const effectiveStartDate = startDate ? startOfDay(startDate) : addMonths(startOfDay(new Date()), 1);

  if (!principal || termInMonths <= 0 || annualInterestRate < 0) {
    return { schedule: [], totalInterest: 0, totalPayment: 0, monthlyInstallment: 0 };
  }

  const schedule: AmortizationRow[] = [];
  let openingBalance = principal;
  const monthlyRate = annualInterestRate / 100 / 12;

  let monthlyInstallment = 0;
  if (interestRateType === 'Reducing Balance') {
    if (monthlyRate > 0) {
      monthlyInstallment =
        (principal * (monthlyRate * Math.pow(1 + monthlyRate, termInMonths))) /
        (Math.pow(1 + monthlyRate, termInMonths) - 1);
    } else {
      monthlyInstallment = principal / termInMonths;
    }
  } else {
    // Flat Rate
    const totalFlatInterest = principal * (annualInterestRate / 100) * (termInMonths / 12);
    monthlyInstallment = (principal + totalFlatInterest) / termInMonths;
  }
  
  for (let i = 1; i <= termInMonths; i++) {
    let interestPayment = 0;
    let principalPayment = 0;
    
    // The first payment is on the start date, subsequent payments are monthly from there
    const paymentDate = addMonths(effectiveStartDate, i - 1);

    if (interestRateType === 'Reducing Balance') {
      interestPayment = openingBalance * monthlyRate;
      principalPayment = monthlyInstallment - interestPayment;
    } else {
      // Flat Rate
      interestPayment = principal * monthlyRate; // Interest is always on original principal
      principalPayment = monthlyInstallment - interestPayment;
    }
    
    // On the last payment, adjust to clear the balance
    if (i === termInMonths) {
        principalPayment = openingBalance;
        monthlyInstallment = principalPayment + interestPayment;
    }

    const closingBalance = Math.max(0, openingBalance - principalPayment);
    
    schedule.push({
      period: i,
      paymentDate,
      openingBalance,
      principal: principalPayment,
      interest: interestPayment,
      totalPayment: monthlyInstallment,
      closingBalance: closingBalance,
    });

    openingBalance = closingBalance;
  }

  // Recalculate totals from the generated schedule for accuracy
  const totalPayment = schedule.reduce((sum, row) => sum + row.totalPayment, 0);
  const totalInterest = schedule.reduce((sum, row) => sum + row.interest, 0);

  // Add closingLoanBalance to each row after totalPayment is calculated
  let cumulativePayment = 0;
  const finalSchedule = schedule.map(row => {
    cumulativePayment += row.totalPayment;
    return {
      ...row,
      closingLoanBalance: Math.max(0, totalPayment - cumulativePayment),
    };
  });


  return { schedule: finalSchedule, totalInterest, totalPayment, monthlyInstallment: schedule[0]?.totalPayment || 0 };
};

export function calculateRepaymentSplit(
  repaymentAmount: number,
  outstandingPrincipal: number,
  schedule: AmortizationRow[],
  systemDate: Date
) {
  const pastDueInstallments = schedule.filter(row => isPast(row.paymentDate, systemDate) && row.closingBalance > outstandingPrincipal);

  const interestDue = pastDueInstallments.reduce((sum, row) => sum + row.interest, 0);
  const principalDue = pastDueInstallments.reduce((sum, row) => sum + row.principal, 0);
  
  let interestPaid = Math.min(repaymentAmount, interestDue);
  let remainingAmount = repaymentAmount - interestPaid;
  let principalPaid = Math.min(remainingAmount, principalDue);
  
  // If there's still money left, it's an advance payment on principal
  remainingAmount -= principalPaid;
  if(remainingAmount > 0) {
    principalPaid += remainingAmount;
  }

  // Ensure we don't pay more principal than is outstanding
  principalPaid = Math.min(principalPaid, outstandingPrincipal);

  return { interestPaid, principalPaid };
}
