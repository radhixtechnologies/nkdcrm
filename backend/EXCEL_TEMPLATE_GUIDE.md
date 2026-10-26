# HR + PAYROLL CRM - EXCEL TEMPLATE GUIDE

## 📋 Employee Import Template

This document explains the Excel format required for importing employees.

### Required Columns (MUST be present)

| Column Name | Data Type | Required | Description | Example |
|------------|-----------|----------|-------------|---------|
| Employee Code | Text | ✅ Yes | Unique identifier for employee | EMP001 |
| First Name | Text | ✅ Yes | Employee's first name | Rajesh |
| Wage Type | Text | ✅ Yes | MONTHLY or PER DAY | MONTHLY |
| Basic Salary | Number | ✅ Yes | Monthly basic or daily wage | 25000 |

### Optional Columns (Recommended)

| Column Name | Data Type | Required | Description | Example |
|------------|-----------|----------|-------------|---------|
| Last Name | Text | No | Employee's last name | Kumar |
| Mobile | Text | No | 10-digit mobile number | 9876543210 |
| Email | Text | No | Email address | rajesh@company.com |
| Designation | Text | No | Job title | Software Engineer |
| Department | Text | No | Department name | IT |
| Date of Joining | Date | No | Joining date | 01-01-2024 |
| HRA | Number | No | House Rent Allowance | 10000 |
| Conveyance | Number | No | Conveyance allowance | 1600 |
| Special Allowance | Number | No | Special allowance | 5000 |
| Other Allowance | Number | No | Other allowances | 2000 |
| PF Applicable | Text | No | YES/NO | YES |
| ESI Applicable | Text | No | YES/NO | NO |
| PT Applicable | Text | No | YES/NO | YES |
| UAN Number | Text | No | Universal Account Number | 123456789012 |
| ESI Number | Text | No | ESI number | 1234567890 |
| PAN Number | Text | No | PAN card number | ABCDE1234F |
| Aadhaar Number | Text | No | 12-digit Aadhaar | 123456789012 |
| Bank Name | Text | No | Bank name | HDFC Bank |
| Account Number | Text | No | Bank account number | 12345678901234 |
| IFSC Code | Text | No | Bank IFSC code | HDFC0001234 |
| Site ID | Number | No | Site/branch ID | 1 |

## 📝 Data Format Rules

### Wage Type
- **Accepted values:** MONTHLY, PER DAY, PER_DAY
- **Case insensitive:** "monthly", "Monthly", "MONTHLY" all work
- **Spaces allowed:** "PER DAY" or "PER_DAY" both work

### Numbers (Salary, Allowances)
- **Indian format supported:** 1,00,000 or 100000
- **Decimals allowed:** 25000.50
- **Must be positive:** Negative values will be rejected

### Boolean Fields (PF/ESI/PT Applicable)
- **TRUE values:** YES, Y, 1, TRUE (case insensitive)
- **FALSE values:** NO, N, 0, FALSE, or empty
- **Default:** If empty, defaults to NO/FALSE

### Dates
- **Formats accepted:** 
  - DD-MM-YYYY (01-01-2024)
  - DD/MM/YYYY (01/01/2024)
  - Excel date format
- **Invalid dates:** Will be set to NULL (no error)

### Text Fields
- **Trimming:** Leading/trailing spaces are automatically removed
- **Empty cells:** Treated as NULL in database

## ✅ Validation Rules

### 1. Employee Code
- ✅ Must be unique across all employees
- ✅ Cannot be empty
- ❌ Duplicate codes will be rejected with error

### 2. First Name
- ✅ Cannot be empty
- ✅ Minimum 1 character

### 3. Wage Type
- ✅ Must be exactly "MONTHLY" or "PER DAY"
- ❌ Other values will be rejected

### 4. Basic Salary
- ✅ Must be a positive number
- ✅ Must be greater than 0
- ❌ Zero or negative values rejected

## 🚨 Common Errors and Solutions

### Error: "Employee Code already exists"
**Cause:** Duplicate employee code in database or Excel file  
**Solution:** Use unique employee codes (e.g., EMP001, EMP002, etc.)

### Error: "Wage Type must be 'MONTHLY' or 'PER DAY'"
**Cause:** Invalid wage type value  
**Solution:** Use exactly "MONTHLY" or "PER DAY"

### Error: "Basic Salary must be a positive number"
**Cause:** Salary is 0, negative, or not a number  
**Solution:** Enter valid positive number (e.g., 25000)

### Error: "Missing required columns"
**Cause:** Excel file doesn't have required column headers  
**Solution:** Ensure first row has: Employee Code, First Name, Wage Type, Basic Salary

## 📊 Sample Data

Here's a sample row for reference:

| Employee Code | First Name | Last Name | Mobile | Email | Designation | Department | Date of Joining | Wage Type | Basic Salary | HRA | Conveyance | PF Applicable | ESI Applicable | PT Applicable |
|--------------|------------|-----------|---------|--------|-------------|------------|----------------|-----------|--------------|-----|------------|---------------|----------------|---------------|
| EMP001 | Rajesh | Kumar | 9876543210 | rajesh@company.com | Software Engineer | IT | 01-01-2024 | MONTHLY | 25000 | 10000 | 1600 | YES | NO | YES |
| EMP002 | Priya | Sharma | 9876543211 | priya@company.com | HR Manager | HR | 15-02-2024 | MONTHLY | 30000 | 12000 | 1600 | YES | NO | YES |
| EMP003 | Amit | Patel | 9876543212 | amit@company.com | Worker | Production | 01-03-2024 | PER DAY | 800 | 0 | 0 | YES | YES | NO |

## 💡 Tips for Excel Preparation

1. **Use the first row for headers** - Exact column names as shown above
2. **Start data from row 2** - Row 1 is headers
3. **No empty rows** - Remove empty rows between data
4. **Consistent formatting** - Use same date format throughout
5. **No formulas** - Use plain values only
6. **Save as .xlsx** - Modern Excel format preferred
7. **Check for duplicates** - Ensure Employee Codes are unique before import

## 🔄 Import Process

1. **Upload Excel file** via API endpoint `/api/employees/import`
2. **System validates:**
   - File format (.xls or .xlsx)
   - Required columns present
   - Each row's data validity
3. **System processes:**
   - Validates each employee
   - Checks for duplicates
   - Imports valid records
4. **System responds:**
   - Summary of import (success/failed counts)
   - Detailed errors with row numbers
   - List of successfully imported employees

## 📥 Download Template

A blank template Excel file is available at:
`templates/employee_import_template.xlsx`

This template has all column headers pre-filled and sample data for reference.

## 🎯 Best Practices

1. **Test with small batch first** - Import 2-3 employees to verify format
2. **Keep backup** - Save original Excel before import
3. **Review errors** - Check error messages for specific row issues
4. **Fix and re-import** - Correct errors and import failed records again
5. **Verify data** - Check imported data via GET /api/employees

## 📞 Need Help?

If you encounter issues:
1. Check error message - it includes row number and specific issue
2. Verify column names match exactly (case-sensitive)
3. Ensure required columns have data
4. Check data format matches rules above
