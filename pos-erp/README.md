# GSOFT ERP — POS Module
### Stack: React + TypeScript + Vite + Supabase + Tailwind-free CSS

---

## ⚡ Setup in 5 Steps

### Step 1 — Open in Google Antigravity
1. Open Antigravity → Agent Manager → New Conversation
2. Select this project folder
3. Paste this prompt into the agent:
```
I have a React + TypeScript POS app. Install all dependencies from package.json,
create a vite.config.ts with React plugin, create src/main.tsx that renders App,
and create index.html. Then run the dev server.
```

### Step 2 — Setup Supabase
1. Go to https://supabase.com → New Project (free)
2. Name it: `gsoft-erp`  |  Region: `South Asia (Mumbai)`
3. Go to SQL Editor → paste entire `supabase_schema.sql` → Run
4. Go to Settings → API → copy `Project URL` and `anon public key`

### Step 3 — Configure Environment
```bash
cp .env.example .env
# Edit .env and fill in your Supabase URL and anon key
```

### Step 4 — Run
```bash
npm install
npm run dev
```
Open http://localhost:5173

### Step 5 — Deploy to Vercel (Free)
```bash
# Push to GitHub first, then:
# Go to vercel.com → Import GitHub repo
# Add environment variables from .env
# Deploy!
```

---

## 📁 File Structure
```
src/
├── lib/
│   └── supabase.ts          ← Supabase client
├── types/
│   └── index.ts             ← All TypeScript types
├── hooks/
│   └── usePOS.ts            ← All POS business logic
├── components/pos/
│   ├── POSScreen.tsx        ← Main layout (left + right panels)
│   ├── ProductSearch.tsx    ← Barcode scan + name/SKU search
│   ├── Cart.tsx             ← Cart items with qty/discount
│   ├── OrderSummary.tsx     ← Customer, coupon, payment, totals
│   └── pos.css              ← All styles (dark navy + amber theme)
├── App.tsx                  ← Root component with toast provider
supabase_schema.sql          ← Paste into Supabase SQL Editor
.env.example                 → Copy to .env and fill credentials
```

---

## 🎯 Features Included
- ✅ Product search by name, SKU, barcode
- ✅ Barcode scanner support (scan directly into search)
- ✅ Cart with qty controls + per-item discount
- ✅ Customer lookup by phone
- ✅ Coupon code validation (flat / percentage)
- ✅ Loyalty points earn & redeem
- ✅ 4 payment modes: Cash, Card, UPI, Credit
- ✅ GST calculation per product rate
- ✅ Auto invoice number generation (INV-YYYYMMDD-0001)
- ✅ Stock auto-decrement on sale
- ✅ Multi-counter support

---

## 🔜 Next Modules (Tell Claude to generate these)
1. **Inventory Management** — Product CRUD, barcode print, stock count
2. **CRM / Loyalty** — Customer master, points history, coupons admin
3. **Basic Accounting** — Ledger, purchase orders, cash management
4. **Reports** — Sales report, P&L, GST summary

---

## 💡 Antigravity Agent Prompts for Enhancements

**Add invoice print:**
```
Add a print invoice button to OrderSummary. After a successful sale, show a
modal with the invoice details (invoice no, items, totals, GST) and a print button
that uses window.print() with a print-specific CSS class.
```

**Add sale return:**
```
Add a Sale Return button in the topbar. When clicked, show a modal to enter
an invoice number, fetch the original sale items, load them into the cart
with is_return=true, and save as a return sale linked to the original.
```

**Add barcode printer integration:**
```
Add a Barcode Print button per cart item. Use react-barcode to render a
CODE128 barcode with the product SKU. Add a print button that prints just
that barcode using window.print().
```
