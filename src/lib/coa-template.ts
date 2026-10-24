
export const coaTemplate = [
  // Assets (1000–1999)
  // Cash & Bank
  { glCode: "1100", accountName: "Bank – Operating Account", accountType: "Asset", subType: "Current Asset", isEditable: true, isBankAccount: true },
  { glCode: "1110", accountName: "Bank – Loan Disbursement Account", accountType: "Asset", subType: "Current Asset", isEditable: true, isBankAccount: true },
  { glCode: "1120", accountName: "Bank – Collections Account", accountType: "Asset", subType: "Current Asset", isEditable: true, isBankAccount: true },
  { glCode: "1130", accountName: "Bank – Payroll Account", accountType: "Asset", subType: "Current Asset", isEditable: true, isBankAccount: true },
  { glCode: "1140", accountName: "Mobile Money – Payroll", accountType: "Asset", subType: "Current Asset", isEditable: true, isBankAccount: true },
  { glCode: "1200", accountName: "Cash in Vault", accountType: "Asset", subType: "Current Asset", isEditable: true, isBankAccount: true },
  { glCode: "1300", accountName: "Chief Cashier Control", accountType: "Asset", subType: "Current Asset", isEditable: true, isBankAccount: true },
  { glCode: "1310", accountName: "Teller Cash Control", accountType: "Asset", subType: "Current Asset", isEditable: true, isBankAccount: true },
  { glCode: "1311", accountName: "Teller 1 Cash Control", accountType: "Asset", subType: "Current Asset", isEditable: true, isBankAccount: true },
  { glCode: "1312", accountName: "Teller 2 Cash Control", accountType: "Asset", subType: "Current Asset", isEditable: true, isBankAccount: true },
  // Clearing & Float Accounts
  { glCode: "1400", accountName: "Cheque Clearing", accountType: "Asset", subType: "Current Asset", isEditable: true, isBankAccount: false },
  { glCode: "1410", accountName: "Mobile Money Clearing", accountType: "Asset", subType: "Current Asset", isEditable: true, isBankAccount: false },
  { glCode: "1420", accountName: "EFT / RTGS Clearing", accountType: "Asset", subType: "Current Asset", isEditable: true, isBankAccount: false },
  // Loan Portfolio
  { glCode: "1500", accountName: "Gross Loan Portfolio", accountType: "Asset", subType: "Financial Asset", isEditable: true, isBankAccount: false },
  { glCode: "1510", accountName: "Loan Receivable – Current", accountType: "Asset", subType: "Financial Asset", isEditable: true, isBankAccount: false },
  { glCode: "1511", accountName: "Loan Receivable – Arrears", accountType: "Asset", subType: "Financial Asset", isEditable: true, isBankAccount: false },
  { glCode: "1520", accountName: "Restructured Loans", accountType: "Asset", subType: "Financial Asset", isEditable: true, isBankAccount: false },
  { glCode: "1530", accountName: "Written-Off Loans", accountType: "Asset", subType: "Financial Asset", isEditable: true, isBankAccount: false },
  { glCode: "1540", accountName: "Staff Loan Receivable", accountType: "Asset", subType: "Financial Asset", isEditable: true, isBankAccount: false },
  // Other Assets
  { glCode: "1600", accountName: "Prepaid Expenses", accountType: "Asset", subType: "Current Asset", isEditable: true, isBankAccount: false },
  { glCode: "1610", accountName: "Office Equipment", accountType: "Asset", subType: "Fixed Asset", isEditable: true, isBankAccount: false },
  { glCode: "1615", accountName: "Accum. Depreciation - Office Equipment", accountType: "Asset", subType: "Contra Asset", isEditable: true, isBankAccount: false },
  { glCode: "1620", accountName: "Computer Equipment", accountType: "Asset", subType: "Fixed Asset", isEditable: true, isBankAccount: false },
  { glCode: "1625", accountName: "Accum. Depreciation - Computer Equipment", accountType: "Asset", subType: "Contra Asset", isEditable: true, isBankAccount: false },
  { glCode: "1630", accountName: "Fixed Assets – Inventory Assets", accountType: "Asset", subType: "Fixed Asset", isEditable: true, isBankAccount: false },
  { glCode: "1635", accountName: "Accum. Depreciation – Inventory Assets", accountType: "Asset", subType: "Contra Asset", isEditable: true, isBankAccount: false },
  // Inventory
  { glCode: "1700", accountName: "Inventory - Loanable Items", accountType: "Asset", subType: "Current Asset", isEditable: true, isBankAccount: false },
  { glCode: "1701", accountName: "Inventory – Raw Materials", accountType: "Asset", subType: "Current Asset", isEditable: true, isBankAccount: false },
  { glCode: "1710", accountName: "Inventory - Consumables", accountType: "Asset", subType: "Current Asset", isEditable: true, isBankAccount: false },
  { glCode: "1720", accountName: "Inventory – Finished Goods", accountType: "Asset", subType: "Current Asset", isEditable: true, isBankAccount: false },
  { glCode: "1750", accountName: "Loan Asset Issued (Control)", accountType: "Asset", subType: "Current Asset", isEditable: true, isBankAccount: false },
  { glCode: "1760", accountName: "Staff Asset Issued Account", accountType: "Asset", subType: "Current Asset", isEditable: true, isBankAccount: false },


  // Liabilities (2000–2999)
  { glCode: "2100", accountName: "Customer Savings", accountType: "Liability", subType: "Current Liability", isEditable: true, isBankAccount: false },
  { glCode: "2200", accountName: "Customer Deposits", accountType: "Liability", subType: "Current Liability", isEditable: true, isBankAccount: false },
  { glCode: "2300", accountName: "Unearned Loan Fees", accountType: "Liability", subType: "Current Liability", isEditable: true, isBankAccount: false },
  { glCode: "2400", accountName: "Accrued Expenses", accountType: "Liability", subType: "Current Liability", isEditable: true, isBankAccount: false },
  { glCode: "2500", accountName: "Taxes Payable", accountType: "Liability", subType: "Current Liability", isEditable: true, isBankAccount: false },
  { glCode: "2510", accountName: "PAYE Payable", accountType: "Liability", subType: "Current Liability", isEditable: true, isBankAccount: false },
  { glCode: "2520", accountName: "Pension Contributions Payable", accountType: "Liability", subType: "Current Liability", isEditable: true, isBankAccount: false },
  { glCode: "2521", accountName: "TEVET Levy Payable", accountType: "Liability", subType: "Current Liability", isEditable: true, isBankAccount: false },
  { glCode: "2530", accountName: "Staff Loan Deductions Payable", accountType: "Liability", subType: "Current Liability", isEditable: true, isBankAccount: false },
  { glCode: "2540", accountName: "Net Salaries Payable", accountType: "Liability", subType: "Current Liability", isEditable: true, isBankAccount: false },
  { glCode: "2541", accountName: "Employee Pension Payable", accountType: "Liability", subType: "Current Liability", isEditable: true, isBankAccount: false },
  { glCode: "2600", accountName: "Accounts Payable - Other", accountType: "Liability", subType: "Current Liability", isEditable: true, isBankAccount: false },
  { glCode: "2700", accountName: "Trade Creditors / Accounts Payable", accountType: "Liability", subType: "Current Liability", isEditable: true, isBankAccount: false },
  { glCode: "2710", accountName: "Goods Received Not Invoiced (GRNI)", accountType: "Liability", subType: "Current Liability", isEditable: true, isBankAccount: false },
  { glCode: "2800", accountName: "Payroll Clearing Account", accountType: "Liability", subType: "Current Liability", isEditable: true, isBankAccount: false },
  { glCode: "2810", accountName: "Salary Control Account", accountType: "Liability", subType: "Current Liability", isEditable: true, isBankAccount: false },
  { glCode: "2820", accountName: "Payroll Suspense Account", accountType: "Liability", subType: "Current Liability", isEditable: true, isBankAccount: false },
  { glCode: "2830", accountName: "Inventory Clearing Account", accountType: "Liability", subType: "Current Liability", isEditable: true, isBankAccount: false },
  { glCode: "2840", accountName: "Stock Adjustment Account", accountType: "Liability", subType: "Current Liability", isEditable: true, isBankAccount: false },
  { glCode: "2850", accountName: "Loan Recovery via Payroll Control", accountType: "Liability", subType: "Current Liability", isEditable: true, isBankAccount: false },


  // Equity (3000–3999)
  { glCode: "3100", accountName: "Share Capital", accountType: "Equity", subType: "Member Equity", isEditable: true, isBankAccount: false },
  { glCode: "3200", accountName: "Retained Earnings", accountType: "Equity", subType: "Institutional Capital", isEditable: true, isBankAccount: false },
  { glCode: "3300", accountName: "Current Year Surplus", accountType: "Equity", subType: "Institutional Capital", isEditable: false, isBankAccount: false },
  { glCode: "3400", accountName: "Inventory Revaluation Reserve", accountType: "Equity", subType: "Institutional Capital", isEditable: true, isBankAccount: false },


  // Income (4000–4999)
  { glCode: "4100", accountName: "Interest on Loans", accountType: "Income", subType: "Operating Income", isEditable: true, isBankAccount: false },
  { glCode: "4110", accountName: "Penalty Interest", accountType: "Income", subType: "Operating Income", isEditable: true, isBankAccount: false },
  { glCode: "4120", accountName: "Loan Fees", accountType: "Income", subType: "Operating Income", isEditable: true, isBankAccount: false },
  { glCode: "4130", accountName: "Processing Fees", accountType: "Income", subType: "Operating Income", isEditable: true, isBankAccount: false },
  { glCode: "4200", accountName: "Commission Income", accountType: "Income", subType: "Non-Operating Income", isEditable: true, isBankAccount: false },
  { glCode: "4300", accountName: "Other Operating Income", accountType: "Income", subType: "Non-Operating Income", isEditable: true, isBankAccount: false },
  { glCode: "4400", accountName: "Inventory Sales Revenue", accountType: "Income", subType: "Operating Income", isEditable: true, isBankAccount: false },
  { glCode: "4410", accountName: "Asset Loan Fee Income", accountType: "Income", subType: "Operating Income", isEditable: true, isBankAccount: false },
  { glCode: "4420", accountName: "Asset Disposal Gain/Loss", accountType: "Income", subType: "Non-Operating Income", isEditable: true, isBankAccount: false },


  // Expenses (5000–5999)
  { glCode: "5100", accountName: "Staff Salaries & Wages – Basic", accountType: "Expense", subType: "Personnel Expense", isEditable: true, isBankAccount: false },
  { glCode: "5102", accountName: "Overtime Expense", accountType: "Expense", subType: "Personnel Expense", isEditable: true, isBankAccount: false },
  { glCode: "5103", accountName: "Allowances Expense", accountType: "Expense", subType: "Personnel Expense", isEditable: true, isBankAccount: false },
  { glCode: "5104", accountName: "Bonuses & Incentives", accountType: "Expense", subType: "Personnel Expense", isEditable: true, isBankAccount: false },
  { glCode: "5120", accountName: "Employer Pension Contributions", accountType: "Expense", subType: "Personnel Expense", isEditable: true, isBankAccount: false },
  { glCode: "5130", accountName: "TEVET Levy Expense", accountType: "Expense", subType: "Personnel Expense", isEditable: true, isBankAccount: false },
  { glCode: "5132", accountName: "Staff Benefits Expense", accountType: "Expense", subType: "Personnel Expense", isEditable: true, isBankAccount: false },
  { glCode: "5133", accountName: "Leave Pay Expense", accountType: "Expense", subType: "Personnel Expense", isEditable: true, isBankAccount: false },
  { glCode: "5134", accountName: "Gratuity Expense", accountType: "Expense", subType: "Personnel Expense", isEditable: true, isBankAccount: false },
  { glCode: "5200", accountName: "Rent", accountType: "Expense", subType: "Operating Expense", isEditable: true, isBankAccount: false },
  { glCode: "5300", accountName: "Utilities", accountType: "Expense", subType: "Operating Expense", isEditable: true, isBankAccount: false },
  { glCode: "5400", accountName: "IT & Systems", accountType: "Expense", subType: "Operating Expense", isEditable: true, isBankAccount: false },
  { glCode: "5500", accountName: "Transport", accountType: "Expense", subType: "Operating Expense", isEditable: true, isBankAccount: false },
  { glCode: "5600", accountName: "Loan Loss Provision Expense", accountType: "Expense", subType: "Credit Risk Expense", isEditable: true, isBankAccount: false },
  { glCode: "5610", accountName: "Write-Off Expense", accountType: "Expense", subType: "Credit Risk Expense", isEditable: true, isBankAccount: false },
  { glCode: "5700", accountName: "Platform & Bank Charges", accountType: "Expense", subType: "Operating Expense", isEditable: true, isBankAccount: false },
  { glCode: "5800", accountName: "Cost of Goods Sold (COGS)", accountType: "Expense", subType: "Operating Expense", isEditable: true, isBankAccount: false },
  { glCode: "5810", accountName: "Inventory Consumption Expense", accountType: "Expense", subType: "Operating Expense", isEditable: true, isBankAccount: false },
  { glCode: "5820", accountName: "Inventory Write-Off Expense", accountType: "Expense", subType: "Operating Expense", isEditable: true, isBankAccount: false },
  { glCode: "5830", accountName: "Inventory Loss / Damage Expense", accountType: "Expense", subType: "Operating Expense", isEditable: true, isBankAccount: false },
  { glCode: "5840", accountName: "Depreciation Expense – Inventory Assets", accountType: "Expense", subType: "Operating Expense", isEditable: true, isBankAccount: false },
  { glCode: "5850", accountName: "Staff Asset Recovery Expense", accountType: "Expense", subType: "Operating Expense", isEditable: true, isBankAccount: false },


  // Provisions & Contra Accounts (6000-6999)
  { glCode: "6100", accountName: "Allowance for Loan Losses", accountType: "Asset", subType: "Contra Asset", isEditable: true, isBankAccount: false },
  { glCode: "6200", accountName: "Interest Suspense", accountType: "Liability", subType: "Contra Liability", isEditable: true, isBankAccount: false },
];
