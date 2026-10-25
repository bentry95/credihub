

import { addMonths, differenceInDays, addDays, addYears, differenceInCalendarDays, startOfDay } from 'date-fns';

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

export type LoanRepaymentAccrualEntry = {
  date: Date;
  principalPaid: number;
  interestPaid: number;
};

export function calculateAccruedLoanInterest(input: {
  principal: number;
  outstandingPrincipal: number;
  annualInterestRate: number;
  interestRateType: 'Flat' | 'Reducing Balance';
  startDate: Date;
  asOfDate: Date;
  maturityDate?: Date;
  repayments?: LoanRepaymentAccrualEntry[];
}) {
  const { principal, outstandingPrincipal, annualInterestRate, interestRateType, startDate, asOfDate, maturityDate, repayments = [] } = input;
  if (principal <= 0 || annualInterestRate <= 0) return 0;

  const accrualStart = startOfDay(startDate);
  const requestedEnd = startOfDay(asOfDate);
  const accrualEnd = maturityDate && startOfDay(maturityDate) < requestedEnd
    ? startOfDay(maturityDate)
    : requestedEnd;
  if (accrualEnd <= accrualStart) return 0;

  const eligibleRepayments = repayments
    .filter(repayment => repayment.date && startOfDay(repayment.date) >= accrualStart && startOfDay(repayment.date) <= accrualEnd)
    .slice()
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const recordedPrincipalPaid = eligibleRepayments.reduce((sum, repayment) => sum + Math.max(0, repayment.principalPaid || 0), 0);
  const principalAdjustment = outstandingPrincipal - (principal - recordedPrincipalPaid);
  let balance = Math.max(0, principal + principalAdjustment);
  let accruedInterest = 0;
  let lastAccrualDate = accrualStart;
  const dailyRate = annualInterestRate / 100 / 365;

  for (const repayment of eligibleRepayments) {
    const repaymentDate = startOfDay(repayment.date);
    const elapsedDays = differenceInCalendarDays(repaymentDate, lastAccrualDate);
    const interestBearingPrincipal = interestRateType === 'Flat' ? principal : balance;
    accruedInterest += Math.max(0, interestBearingPrincipal) * dailyRate * Math.max(0, elapsedDays);
    balance = Math.max(0, balance - Math.max(0, repayment.principalPaid || 0));
    lastAccrualDate = repaymentDate;
  }

  const remainingDays = differenceInCalendarDays(accrualEnd, lastAccrualDate);
  const interestBearingPrincipal = interestRateType === 'Flat' ? principal : balance;
  accruedInterest += Math.max(0, interestBearingPrincipal) * dailyRate * Math.max(0, remainingDays);

  const interestAlreadyPaid = eligibleRepayments.reduce((sum, repayment) => sum + Math.max(0, repayment.interestPaid || 0), 0);
  return Math.max(0, accruedInterest - interestAlreadyPaid);
}

export function calculateRepaymentSplit(
  repaymentAmount: number,
  outstandingPrincipal: number,
  interestDue: number
) {
  let interestPaid = Math.min(repaymentAmount, interestDue);
  let remainingAmount = repaymentAmount - interestPaid;
  const principalPaid = Math.min(remainingAmount, outstandingPrincipal);

  return { interestPaid, principalPaid, interestDue };
}
