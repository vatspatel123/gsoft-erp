# Invoices/Sales History Module - Complete Setup Guide

## Overview
The Invoices module has been successfully built for your Retail ERP with a complete UI, functionality, and styling. This guide walks you through the setup and testing process.

## Files Created/Updated

### New Files Created:
1. **src/hooks/useInvoices.ts** - Complete hook for invoice data management
2. **src/styles/invoices.css** - All styling for the Invoices page
3. **SUPABASE_RPC_SETUP.sql** - Database RPC function and policies

### Files Modified:
1. **src/pages/InvoicesPage.tsx** - Complete invoice page component

## Features Implemented

### ✅ Top Bar
- "Sales & Invoices" heading
- Export CSV button (outline purple style)
- Date range picker: Today | This Week | This Month

### ✅ Stat Cards (4 Cards)
- **Total Sales Today**: Count of today's invoices
- **Revenue Today**: Sum of net_amount with ₹ formatting
- **Average Bill Value**: Total revenue / bill count
- **Total GST Collected**: Sum of gst_amount

### ✅ Search & Filter Bar
- Search by invoice number or customer name
- Payment mode filter: All | Cash | Card | UPI | Credit
- Salesman filter: Dropdown with all active salesmen

### ✅ Payment Summary Bar
- Breakdown of filtered invoices by payment mode
- Shows amount and bill count for each mode
- Color-coded badges

### ✅ Invoices Table
- **Columns**: Invoice No | Date & Time | Customer | Items | Salesman | Payment | Amount | Actions
- **Features**:
  - Invoice number in monospace font (purple)
  - Date/Time with proper formatting
  - Customer avatar with initials + name (grey for walk-in)
  - Item count badge
  - Salesman avatar with name
  - Payment mode badge (color-coded)
  - Amount display (net amount in purple, GST below in grey)
  - Refunded status with red badge and strikethrough

### ✅ Actions
- **👁️ View** - Opens invoice detail modal
- **🖨️ Print** - Reprints bill using existing printBill function
- **💬 WhatsApp** - Resends bill via WhatsApp
- **↩️ Refund** - Marks invoice as returned and restores stock

### ✅ Invoice Detail Modal
- Shop name and location header
- Invoice info: Invoice No, Date/Time, Salesman, Counter
- Customer info (if exists): Name, Phone
- Items table with product name, qty, price, total
- Totals section: Subtotal, GST, Discount, Net Payable
- Payment mode badge
- Thank you message
- Action buttons: Print Bill | Send WhatsApp | Close

### ✅ Refund Feature
- Confirmation dialog with details
- Marks original sale with is_return: true
- Restores stock quantity via increment_stock RPC
- Shows success toast
- Prevents refunding already-refunded invoices

### ✅ Export CSV
- Exports filtered invoices with formatted data
- Columns: Invoice No, Date, Customer, Amount, GST, Discount, Payment, Salesman
- Auto-timestamps the filename

### ✅ Styling
- Fashion theme colors:
  - Background: #fdf8ff
  - Cards: white with #f3e8ff border
  - Primary: #9333ea (purple)
  - Secondary colors for each stat card
  - Font: DM Sans
- Responsive design (mobile, tablet, desktop)
- Dark mode compatible
- Smooth transitions and hover effects

## Setup Instructions

### Step 1: Run Supabase Database Functions

1. Open your Supabase dashboard: https://app.supabase.com
2. Go to **SQL Editor** → Click **New Query**
3. Copy all the SQL from `SUPABASE_RPC_SETUP.sql`:
   ```sql
   CREATE OR REPLACE FUNCTION increment_stock(p_id UUID, qty INTEGER)
   RETURNS void AS $$
   BEGIN
     UPDATE products
     SET stock_qty = stock_qty + qty
     WHERE id = p_id;
   END;
   $$ LANGUAGE plpgsql;
   ```
4. Execute the query
5. Repeat for the RLS policy update (also in the file)
6. Create the indexes for better performance

### Step 2: Verify Your Database Schema

Make sure your Supabase `sales` table has these columns:
- `id` (UUID, primary key)
- `invoice_no` (TEXT)
- `customer_id` (UUID, foreign key to customers)
- `salesman_id` (UUID, foreign key to users)
- `counter_id` (TEXT, optional)
- `total_amount` (NUMERIC)
- `discount_amount` (NUMERIC)
- `net_amount` (NUMERIC)
- `gst_amount` (NUMERIC)
- `payment_mode` (TEXT: 'cash' | 'card' | 'upi' | 'credit')
- `is_return` (BOOLEAN, default: false)
- `created_at` (TIMESTAMP)

And `sale_items` table:
- `id` (UUID)
- `sale_id` (UUID, foreign key to sales)
- `product_id` (UUID, foreign key to products)
- `qty` (INTEGER)
- `unit_price` (NUMERIC)
- `discount_pct` (NUMERIC)
- `gst_rate` (NUMERIC)
- `line_total` (NUMERIC)

### Step 3: Start Development Server

```bash
npm run dev
```

The app will start at http://localhost:5173

### Step 4: Testing Checklist

Run through all these tests to verify everything works:

#### UI Tests
- [ ] Invoices page loads without errors
- [ ] Stat cards display correct values for today
- [ ] All icons render properly
- [ ] Table columns align and display correctly
- [ ] Modal opens and displays invoice details correctly
- [ ] Confirmation dialogs appear on actions

#### Functionality Tests
- [ ] Click "Today" button → shows only today's invoices
- [ ] Click "This Week" button → shows this week's invoices
- [ ] Click "This Month" button → shows this month's invoices
- [ ] Search by invoice number → filters correctly
- [ ] Search by customer name → filters correctly
- [ ] Filter by payment mode (Cash/Card/UPI/Credit) → works
- [ ] Filter by salesman → shows only that salesman's bills
- [ ] Payment summary updates when filters change
- [ ] Invoice detail modal opens with 👁️ button
- [ ] All invoice details display correctly in modal
- [ ] Print button (🖨️) opens print dialog
- [ ] WhatsApp button (💬) opens WhatsApp (if customer has phone)
- [ ] Refund button (↩️) shows confirmation
- [ ] Confirmed refund marks invoice as REFUNDED
- [ ] Stock increases after refund (check in Inventory)
- [ ] Cannot refund already-refunded invoices
- [ ] Export CSV downloads file with correct name
- [ ] CSV contains all filtered invoices

#### Data Display Tests
- [ ] Customer names display correctly, "Walk-in" for no customer
- [ ] Salesman names display correctly
- [ ] Dates and times formatted as per locale (en-IN)
- [ ] Currency formatted with ₹ symbol and commas
- [ ] Payment mode badges have correct colors
- [ ] Refunded invoices show strikethrough amount
- [ ] Item counts match actual items in modal

#### Responsive Tests
- [ ] Desktop view (1920x1080) displays properly
- [ ] Tablet view (768px) displays properly
- [ ] Mobile view (375px) displays properly
- [ ] Table scrolls horizontally on mobile
- [ ] Modals fit on mobile screens

## Troubleshooting

### Issue: "Refund failed" error
**Solution**: Make sure the `increment_stock` RPC function is created in Supabase. Check the SQL Editor for errors.

### Issue: Dates showing in wrong timezone
**Solution**: The hook uses the user's local timezone with `toLocaleString('en-IN')`. This should work correctly as long as your Supabase timestamps are in UTC.

### Issue: Images not loading in customer avatars
**Solution**: The current implementation shows initials. To add images, modify the `customer-avatar` to accept a `background-image` style.

### Issue: WhatsApp button not working
**Solution**: Make sure the `sendBillWhatsApp` function in `utils/whatsappBill.ts` is working. The button will be disabled if no phone number is available.

## Performance Optimization

The setup includes database indexes for faster queries:
- `idx_sales_created_at` - Speeds up date range queries
- `idx_sales_payment_mode` - Speeds up payment filter
- `idx_sales_salesman_id` - Speeds up salesman filter

For large datasets (10k+ invoices), consider adding pagination to the table.

## Future Enhancements

Potential features to add later:
1. **Pagination** - For tables with 1000+ invoices
2. **Invoice PDF generation** - Instead of just printing
3. **Bulk refunds** - Select multiple invoices and refund at once
4. **Custom date range** - Currently limited to Today/Week/Month
5. **Sales analytics** - Charts and graphs
6. **Invoice numbering system** - Auto-generation settings
7. **Refund history** - Separate tracking for refunds
8. **Multi-language support** - Besides en-IN locale
9. **Invoice templates** - Customizable bill designs
10. **Email invoices** - Send directly via email

## API Endpoints Used

The module uses these Supabase functions/tables:
- `supabase.from('sales').select()` - Fetch invoices
- `supabase.from('sale_items').select()` - Fetch invoice items
- `supabase.from('customers').select()` - Fetch customer details
- `supabase.from('users').select()` - Fetch salesman list
- `supabase.from('sales').update()` - Mark as returned
- `supabase.rpc('increment_stock')` - Restore stock quantity

## Styling Details

### Color Scheme (Fashion Theme)
- **Primary Background**: #fdf8ff (light lavender)
- **Card Background**: #ffffff (white)
- **Card Border**: #f3e8ff (very light purple)
- **Primary Color**: #9333ea (purple)
- **Secondary Colors**:
  - Green (#16a34a, #f0fdf4) - Revenue
  - Amber (#f97316, #fff7ed) - Average Bill
  - Pink (#ec4899, #fdf2f8) - GST
  - Grey (#f5f5f5) - Cash
  - Blue (#1e40af, #dbeafe) - Card
  - Green (#15803d, #dcfce7) - UPI
  - Amber (#b45309, #fed7aa) - Credit

### Font
- **Family**: DM Sans (specified in CSS)
- **Weights**: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Verify Supabase connection in Network tab
3. Check that all dependencies are installed (`npm install`)
4. Clear cache and restart dev server (`npm run dev`)
5. Check that sales and sale_items tables exist in Supabase

## Files Summary

| File | Lines | Purpose |
|------|-------|---------|
| src/hooks/useInvoices.ts | 226 | Invoice data management hook |
| src/pages/InvoicesPage.tsx | 576 | Main invoice page component |
| src/styles/invoices.css | 855 | All CSS styling |
| SUPABASE_RPC_SETUP.sql | 30 | Database setup scripts |

**Total: 1,687 lines of code**

---

**Built with**: React, TypeScript, Lucide React icons, Supabase
**Theme**: Fashion Edition
**Date Created**: March 26, 2026
