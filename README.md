# FinPulse Analytics

## Run it
1. Install Node.js (v22 LTS) from https://nodejs.org
2. In Terminal, inside this folder:
       npm install
       npm run dev
3. Open http://localhost:3000 and drop a sample file onto the page.

## Sample files
- `sample-ledger.xlsx`: four planted problems at Excel rows 302 (huge amount),
  902 (VAT at 50% instead of 5%), 1502 (duplicate payment) and 2002 (odd quantity/price).
- `sample-expenses.xlsx`: one employee splitting claims to stay under a 5,000
  approval limit. Caught by approval-limit clustering and Benford's Law.

## Exports
- **Audit report (PDF):** click the button, add your name, then Save as PDF.
- **Excel workbook:** summary, patterns, flagged rows with review status and notes,
  every individual finding, and your original data with risk columns added.

Workbooks are analysed and exported entirely in the browser. Nothing is uploaded.
