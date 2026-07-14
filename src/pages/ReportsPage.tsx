import { useState, useEffect } from 'react'
import { Layout } from '../components/shared/Layout'
import { supabase } from '../lib/supabase'
import { exportToCSV } from '../utils/exportCSV'
import {
  BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts'

const IST_OFFSET = 5.5 * 60 * 60 * 1000

const getRange = (range: string) => {
  const now = new Date()
  const toIST = (d: Date) =>
    new Date(d.getTime() + IST_OFFSET)
  const startOf = (d: Date) => {
    const i = toIST(d)
    return new Date(
      Date.UTC(i.getUTCFullYear(),
        i.getUTCMonth(),
        i.getUTCDate(), 0, 0, 0)
      - IST_OFFSET
    ).toISOString()
  }
  const endOf = (d: Date) => {
    const i = toIST(d)
    return new Date(
      Date.UTC(i.getUTCFullYear(),
        i.getUTCMonth(),
        i.getUTCDate(), 23, 59, 59)
      - IST_OFFSET
    ).toISOString()
  }
  const ist = toIST(now)
  switch (range) {
    case 'today':
      return { from: startOf(now), to: endOf(now) }
    case 'yesterday': {
      const y = new Date(now.getTime() - 86400000)
      return { from: startOf(y), to: endOf(y) }
    }
    case 'week': {
      const w = new Date(now.getTime() - 6 * 86400000)
      return { from: startOf(w), to: endOf(now) }
    }
    case 'month': {
      const ms = new Date(
        Date.UTC(ist.getUTCFullYear(),
          ist.getUTCMonth(), 1, 0, 0, 0)
        - IST_OFFSET)
      return { from: ms.toISOString(), to: endOf(now) }
    }
    case 'last_month': {
      const lms = new Date(
        Date.UTC(ist.getUTCFullYear(),
          ist.getUTCMonth() - 1, 1, 0, 0, 0)
        - IST_OFFSET)
      const lme = new Date(
        Date.UTC(ist.getUTCFullYear(),
          ist.getUTCMonth(), 0, 23, 59, 59)
        - IST_OFFSET)
      return {
        from: lms.toISOString(),
        to: lme.toISOString()
      }
    }
    default:
      return { from: startOf(now), to: endOf(now) }
  }
}

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
]

const TABS = [
  { key: 'overview', label: 'Sales Overview' },
  { key: 'gst', label: 'GST Report' },
  { key: 'pl', label: 'Profit & Loss' },
  { key: 'staff', label: 'Staff Performance' },
  { key: 'daily', label: 'Daily Report' },
]

const btn = (active: boolean) => ({
  padding: '7px 14px',
  borderRadius: '8px',
  border: active ? 'none' : '1px solid #f3e8ff',
  background: active ? '#9333ea' : 'white',
  color: active ? 'white' : '#64748b',
  fontSize: '12px',
  fontWeight: active ? '500' : '400',
  cursor: 'pointer',
  fontFamily: 'DM Sans, sans-serif',
  transition: 'all 0.15s',
} as React.CSSProperties)

const card = {
  background: 'white',
  border: '1px solid #f3e8ff',
  borderRadius: '16px',
  padding: '20px',
} as React.CSSProperties

const getBestProduct = (sales: any[]) => {
  const map: Record<string, number> = {}
  sales.forEach(s =>
    s.sale_items?.forEach((i: any) => {
      const n = i.products?.name || 'Unknown'
      map[n] = (map[n] || 0) + (i.qty || 0)
    })
  )
  if (!Object.keys(map).length) return '—'
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])[0][0]
}

export default function ReportsPage() {
  const [tab, setTab] = useState('overview')
  const [range, setRange] = useState('month')
  const [sales, setSales] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      const { from, to } = getRange(range)
      // extract date parts for expense_date range
      const ist = (d: string) => {
        const dt = new Date(d)
        return new Date(dt.getTime() + 5.5 * 60 * 60 * 1000)
          .toISOString().slice(0, 10)
      }
      const dateFrom = ist(from)
      const dateTo = ist(to)

      const [s, i, e] = await Promise.all([
        supabase.from('sales').select(`
          *, customers(name,phone),
          users(name,role),
          sale_items(qty,line_total,
            unit_price,gst_rate,
            products(name,cost_price,unit_price))
        `).gte('created_at', from)
          .lte('created_at', to)
          .eq('is_return', false)
          .order('created_at', { ascending: false }),
        supabase.from('sale_items').select(`
          qty,line_total,unit_price,gst_rate,
          products(name,cost_price),
          sales!inner(created_at,is_return)
        `).gte('sales.created_at', from)
          .lte('sales.created_at', to)
          .eq('sales.is_return', false),
        supabase.from('expenses').select('*')
          .gte('expense_date', dateFrom)
          .lte('expense_date', dateTo)
      ])
      setSales(s.data || [])
      setItems(i.data || [])
      setExpenses(e.data || [])
      setLoading(false)
    }
    fetch()
  }, [range])

  const totalRevenue = sales.reduce(
    (s, x) => s + (x.net_amount || 0), 0)
  const totalGST = sales.reduce(
    (s, x) => s + (x.gst_amount || 0), 0)
  const totalDiscount = sales.reduce(
    (s, x) => s + (x.discount_amount || 0), 0)
  const avgBill = sales.length
    ? totalRevenue / sales.length : 0

  const payBreakdown = ['cash','card','upi','credit']
    .map(mode => ({
      mode,
      sales: sales.filter(s => s.payment_mode === mode),
      revenue: sales.filter(s => s.payment_mode === mode)
        .reduce((s, x) => s + (x.net_amount || 0), 0)
    }))

  const topProducts = (() => {
    const map: Record<string, any> = {}
    items.forEach(i => {
      const n = i.products?.name || 'Unknown'
      if (!map[n]) map[n] = { name: n, qty: 0, revenue: 0 }
      map[n].qty += i.qty || 0
      map[n].revenue += i.line_total || 0
    })
    return Object.values(map)
      .sort((a: any, b: any) => b.revenue - a.revenue)
      .slice(0, 10)
  })()

  const salesmanData = (() => {
    const map: Record<string, any> = {}
    sales.forEach(s => {
      const n = s.users?.name || 'Unknown'
      if (!map[n]) map[n] = {
        name: n, role: s.users?.role || '',
        bills: 0, revenue: 0, sales: []
      }
      map[n].bills++
      map[n].revenue += s.net_amount || 0
      map[n].sales.push(s)
    })
    return Object.values(map)
      .sort((a: any, b: any) => b.revenue - a.revenue)
  })()

  const gstByRate = (() => {
    const map: Record<number, any> = {}
    items.forEach(i => {
      const r = i.gst_rate || 0
      if (!map[r]) map[r] = {
        rate: r, taxable: 0,
        gst: 0, count: 0
      }
      const taxable = (i.line_total || 0) /
        (1 + r / 100)
      const gst = (i.line_total || 0) - taxable
      map[r].taxable += taxable
      map[r].gst += gst
      map[r].count += i.qty || 0
    })
    return Object.values(map)
      .sort((a: any, b: any) => a.rate - b.rate)
  })()

  const totalCost = items.reduce((s, i) => {
    const c = i.products?.cost_price
    return c ? s + c * (i.qty || 0) : s
  }, 0)
  const grossProfit = totalRevenue - totalCost
  const margin = totalRevenue > 0
    ? (grossProfit / totalRevenue) * 100 : 0

  // Expenses by category for P&L
  const expenseCatTotals: Record<string, number> = {}
  expenses.forEach(e => {
    expenseCatTotals[e.category] = (expenseCatTotals[e.category] || 0) + (e.amount || 0)
  })
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0)
  const netProfit = grossProfit - totalExpenses
  const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

  const plByProduct = (() => {
    const map: Record<string, any> = {}
    items.forEach(i => {
      const n = i.products?.name || 'Unknown'
      const cost = i.products?.cost_price
      if (!map[n]) map[n] = {
        name: n, qty: 0,
        revenue: 0, cost: 0
      }
      map[n].qty += i.qty || 0
      map[n].revenue += i.line_total || 0
      if (cost) map[n].cost += cost * (i.qty || 0)
    })
    return Object.values(map).map((p: any) => ({
      ...p,
      profit: p.revenue - p.cost,
      margin: p.revenue > 0
        ? ((p.revenue - p.cost) / p.revenue * 100)
        : 0
    })).sort((a: any, b: any) => b.profit - a.profit)
  })()

  const chartData = (() => {
    const days = range === 'today' ||
      range === 'yesterday' ? 1 :
      range === 'week' ? 7 :
      range === 'month' ? 30 : 30
    const arr = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(
        Date.now() - i * 86400000)
      const ist = new Date(
        d.getTime() + IST_OFFSET)
      const label = ist.toLocaleDateString(
        'en-IN', { day: '2-digit', month: 'short' })
      const total = sales.filter(s => {
        const sd = new Date(
          new Date(s.created_at).getTime() +
          IST_OFFSET)
        return sd.getUTCDate() ===
          ist.getUTCDate() &&
          sd.getUTCMonth() ===
          ist.getUTCMonth()
      }).reduce((s, x) =>
        s + (x.net_amount || 0), 0)
      arr.push({ date: label, amount: total })
    }
    return arr
  })()

  const modeColor: Record<string,string> = {
    cash: '#64748b', card: '#2563eb',
    upi: '#16a34a', credit: '#f97316'
  }
  const modeBg: Record<string,string> = {
    cash: '#f1f5f9', card: '#eff6ff',
    upi: '#f0fdf4', credit: '#fff7ed'
  }
  const medalEmoji = ['🥇','🥈','🥉']

  const statCard = (
    label: string, value: string,
    sub?: string, color = '#9333ea'
  ) => (
    <div style={card}>
      <div style={{
        fontSize: '12px', color: '#94a3b8',
        marginBottom: '8px',
        fontFamily: 'DM Sans, sans-serif'
      }}>
        {label}
      </div>
      <div style={{
        fontSize: '22px', fontWeight: '600',
        color, fontFamily: 'DM Mono, monospace'
      }}>
        {value}
      </div>
      {sub && (
        <div style={{
          fontSize: '11px', color: '#94a3b8',
          marginTop: '4px'
        }}>
          {sub}
        </div>
      )}
    </div>
  )

  return (
    <Layout>
      <div style={{
        padding: '24px',
        background: '#fdf8ff',
        minHeight: '100vh',
        fontFamily: 'DM Sans, sans-serif'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap', gap: '12px'
        }}>
          <h1 style={{
            fontSize: '20px', fontWeight: '600',
            color: '#1a0a2e', margin: 0
          }}>
            Reports & Analytics
          </h1>
          <div style={{
            display: 'flex', gap: '6px',
            flexWrap: 'wrap'
          }}>
            {RANGES.map(r => (
              <button key={r.key}
                onClick={() => setRange(r.key)}
                style={btn(range === r.key)}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{
          display: 'flex', gap: '4px',
          background: 'white',
          border: '1px solid #f3e8ff',
          borderRadius: '12px',
          padding: '4px',
          marginBottom: '20px',
          flexWrap: 'wrap',
          width: 'fit-content'
        }}>
          {TABS.map(t => (
            <button key={t.key}
              onClick={() => setTab(t.key)}
              style={btn(tab === t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{
            textAlign: 'center',
            padding: '60px',
            color: '#94a3b8'
          }}>
            Loading report data...
          </div>
        ) : (
          <>
            {tab === 'overview' && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(4,1fr)',
                  gap: '12px'
                }}>
                  {statCard('Total Revenue',
                    '₹' + totalRevenue
                      .toLocaleString('en-IN'),
                    sales.length + ' orders')}
                  {statCard('Total Orders',
                    String(sales.length),
                    'bills generated', '#16a34a')}
                  {statCard('Total GST',
                    '₹' + totalGST
                      .toLocaleString('en-IN'),
                    'collected', '#ec4899')}
                  {statCard('Avg Bill',
                    '₹' + Math.round(avgBill)
                      .toLocaleString('en-IN'),
                    'per order', '#f97316')}
                </div>

                <div style={card}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#1a0a2e',
                    marginBottom: '16px'
                  }}>
                    Revenue by Payment Mode
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(4,1fr)',
                    gap: '10px'
                  }}>
                    {payBreakdown.map(p => (
                      <div key={p.mode} style={{
                        background: modeBg[p.mode],
                        borderRadius: '12px',
                        padding: '14px',
                        textAlign: 'center'
                      }}>
                        <div style={{
                          fontSize: '16px',
                          fontWeight: '600',
                          color: modeColor[p.mode],
                          fontFamily: 'DM Mono, monospace'
                        }}>
                          ₹{p.revenue
                            .toLocaleString('en-IN')}
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: '#94a3b8',
                          marginTop: '4px',
                          textTransform: 'capitalize'
                        }}>
                          {p.mode} · {p.sales.length} bills
                        </div>
                        <div style={{
                          fontSize: '10px',
                          color: modeColor[p.mode],
                          marginTop: '2px',
                          fontWeight: '500'
                        }}>
                          {totalRevenue > 0
                            ? Math.round(
                                p.revenue /
                                totalRevenue * 100
                              ) + '%'
                            : '0%'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={card}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#1a0a2e',
                    marginBottom: '16px'
                  }}>
                    Revenue Trend
                  </div>
                  <ResponsiveContainer
                    width="100%" height={200}>
                    <BarChart data={chartData}
                      margin={{
                        top: 5, right: 10,
                        left: 0, bottom: 5
                      }}>
                      <XAxis dataKey="date"
                        tick={{
                          fontSize: 11,
                          fill: '#94a3b8'
                        }}
                        axisLine={false}
                        tickLine={false}/>
                      <YAxis
                        tick={{
                          fontSize: 11,
                          fill: '#94a3b8'
                        }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={v =>
                          v >= 1000
                            ? '₹' + (v/1000)
                                .toFixed(0) + 'k'
                            : '₹' + v}/>
                      <Tooltip
                        contentStyle={{
                          background: 'white',
                          border: '1px solid #f3e8ff',
                          borderRadius: '10px',
                          fontSize: '12px'
                        }}
                        formatter={(v: any) => [
                          '₹' + Number(v)
                            .toLocaleString('en-IN'),
                          'Revenue'
                        ]}/>
                      <Bar dataKey="amount"
                        radius={[6,6,0,0]}
                        maxBarSize={48}>
                        {chartData.map((e,i) => (
                          <Cell key={i}
                            fill={e.amount > 0
                              ? '#9333ea'
                              : '#f3e8ff'}/>
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div style={card}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px'
                  }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#1a0a2e'
                    }}>
                      Top Products
                    </div>
                    <button
                      onClick={() =>
                        exportToCSV(
                          topProducts,
                          'top_products',
                          [
                            { key: 'name',
                              label: 'Product' },
                            { key: 'qty',
                              label: 'Units Sold' },
                            { key: 'revenue',
                              label: 'Revenue' },
                          ]
                        )
                      }
                      style={{
                        background: 'white',
                        color: '#9333ea',
                        border: '1px solid #f3e8ff',
                        borderRadius: '8px',
                        padding: '5px 12px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        fontFamily: 'DM Sans'
                      }}>
                      Export CSV
                    </button>
                  </div>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '13px'
                  }}>
                    <thead>
                      <tr style={{
                        borderBottom:
                          '1px solid #f3e8ff'
                      }}>
                        {['#','Product',
                          'Units','Revenue',
                          '% of Total'].map(h => (
                          <th key={h} style={{
                            padding: '8px',
                            textAlign: 'left',
                            fontSize: '11px',
                            color: '#94a3b8',
                            fontWeight: '500'
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {topProducts.map(
                        (p: any, i: number) => (
                        <tr key={i} style={{
                          borderBottom:
                            '1px solid #fdf8ff'
                        }}>
                          <td style={{
                            padding: '10px 8px',
                            color: '#9333ea',
                            fontWeight: '600'
                          }}>
                            {i + 1}
                          </td>
                          <td style={{
                            padding: '10px 8px',
                            fontWeight: '500',
                            color: '#1a0a2e'
                          }}>
                            {p.name}
                          </td>
                          <td style={{
                            padding: '10px 8px',
                            color: '#64748b'
                          }}>
                            {p.qty}
                          </td>
                          <td style={{
                            padding: '10px 8px',
                            color: '#9333ea',
                            fontWeight: '600',
                            fontFamily: 'DM Mono'
                          }}>
                            ₹{Math.round(p.revenue)
                              .toLocaleString('en-IN')}
                          </td>
                          <td style={{
                            padding: '10px 8px'
                          }}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}>
                              <div style={{
                                flex: 1,
                                height: '4px',
                                background: '#f3e8ff',
                                borderRadius: '2px'
                              }}>
                                <div style={{
                                  width: totalRevenue > 0
                                    ? (p.revenue /
                                      totalRevenue *
                                      100) + '%'
                                    : '0%',
                                  height: '100%',
                                  background: '#9333ea',
                                  borderRadius: '2px'
                                }}/>
                              </div>
                              <span style={{
                                fontSize: '11px',
                                color: '#94a3b8',
                                minWidth: '32px'
                              }}>
                                {totalRevenue > 0
                                  ? Math.round(
                                      p.revenue /
                                      totalRevenue *
                                      100
                                    ) + '%'
                                  : '0%'}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 'gst' && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(4,1fr)',
                  gap: '12px'
                }}>
                  {statCard('Taxable Value',
                    '₹' + Math.round(
                      totalRevenue - totalGST
                    ).toLocaleString('en-IN'))}
                  {statCard('Total GST',
                    '₹' + Math.round(totalGST)
                      .toLocaleString('en-IN'),
                    undefined, '#ec4899')}
                  {statCard('CGST (50%)',
                    '₹' + Math.round(totalGST/2)
                      .toLocaleString('en-IN'),
                    undefined, '#2563eb')}
                  {statCard('SGST (50%)',
                    '₹' + Math.round(totalGST/2)
                      .toLocaleString('en-IN'),
                    undefined, '#16a34a')}
                </div>

                <div style={card}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '16px'
                  }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#1a0a2e'
                    }}>
                      GST by Rate
                    </div>
                    <button
                      onClick={() => {
                        const rows =
                          gstByRate.map(g => ({
                            ...g,
                            cgst: (g.gst/2)
                              .toFixed(2),
                            sgst: (g.gst/2)
                              .toFixed(2),
                            taxable: g.taxable
                              .toFixed(2),
                            gst: g.gst.toFixed(2)
                          }))
                        exportToCSV(
                          rows, 'gst_report',
                          [
                            { key: 'rate',
                              label: 'GST Rate %' },
                            { key: 'taxable',
                              label: 'Taxable Amt' },
                            { key: 'gst',
                              label: 'GST Amount' },
                            { key: 'cgst',
                              label: 'CGST' },
                            { key: 'sgst',
                              label: 'SGST' },
                          ]
                        )
                      }}
                      style={{
                        background: 'white',
                        color: '#9333ea',
                        border: '1px solid #f3e8ff',
                        borderRadius: '8px',
                        padding: '5px 12px',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}>
                      Export for CA
                    </button>
                  </div>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '13px'
                  }}>
                    <thead>
                      <tr style={{
                        borderBottom:
                          '1px solid #f3e8ff'
                      }}>
                        {['GST Rate','Taxable',
                          'GST Amt','CGST',
                          'SGST'].map(h => (
                          <th key={h} style={{
                            padding: '8px',
                            textAlign: 'left',
                            fontSize: '11px',
                            color: '#94a3b8',
                            fontWeight: '500'
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {gstByRate.map(
                        (g: any, i: number) => (
                        <tr key={i} style={{
                          borderBottom:
                            '1px solid #fdf8ff'
                        }}>
                          <td style={{
                            padding: '10px 8px'
                          }}>
                            <span style={{
                              background: '#f5f3ff',
                              color: '#9333ea',
                              padding: '3px 8px',
                              borderRadius: '99px',
                              fontSize: '11px',
                              fontWeight: '500'
                            }}>
                              {g.rate}%
                            </span>
                          </td>
                          <td style={{
                            padding: '10px 8px',
                            fontFamily: 'DM Mono'
                          }}>
                            ₹{Math.round(g.taxable)
                              .toLocaleString('en-IN')}
                          </td>
                          <td style={{
                            padding: '10px 8px',
                            color: '#ec4899',
                            fontFamily: 'DM Mono',
                            fontWeight: '600'
                          }}>
                            ₹{Math.round(g.gst)
                              .toLocaleString('en-IN')}
                          </td>
                          <td style={{
                            padding: '10px 8px',
                            color: '#2563eb',
                            fontFamily: 'DM Mono'
                          }}>
                            ₹{Math.round(g.gst/2)
                              .toLocaleString('en-IN')}
                          </td>
                          <td style={{
                            padding: '10px 8px',
                            color: '#16a34a',
                            fontFamily: 'DM Mono'
                          }}>
                            ₹{Math.round(g.gst/2)
                              .toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                      <tr style={{
                        borderTop:
                          '2px solid #9333ea',
                        fontWeight: '600'
                      }}>
                        <td style={{
                          padding: '10px 8px',
                          color: '#9333ea'
                        }}>
                          Total
                        </td>
                        <td style={{
                          padding: '10px 8px',
                          fontFamily: 'DM Mono'
                        }}>
                          ₹{Math.round(
                            totalRevenue - totalGST
                          ).toLocaleString('en-IN')}
                        </td>
                        <td style={{
                          padding: '10px 8px',
                          color: '#ec4899',
                          fontFamily: 'DM Mono',
                          fontWeight: '700'
                        }}>
                          ₹{Math.round(totalGST)
                            .toLocaleString('en-IN')}
                        </td>
                        <td style={{
                          padding: '10px 8px',
                          color: '#2563eb',
                          fontFamily: 'DM Mono'
                        }}>
                          ₹{Math.round(totalGST/2)
                            .toLocaleString('en-IN')}
                        </td>
                        <td style={{
                          padding: '10px 8px',
                          color: '#16a34a',
                          fontFamily: 'DM Mono'
                        }}>
                          ₹{Math.round(totalGST/2)
                            .toLocaleString('en-IN')}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 'pl' && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(4,1fr)',
                  gap: '12px'
                }}>
                  {statCard('Total Revenue',
                    '₹' + Math.round(totalRevenue)
                      .toLocaleString('en-IN'))}
                  {statCard('Cost of Goods',
                    '₹' + Math.round(totalCost)
                      .toLocaleString('en-IN'),
                    undefined, '#ef4444')}
                  {statCard('Gross Profit',
                    '₹' + Math.round(grossProfit)
                      .toLocaleString('en-IN'),
                    undefined,
                    grossProfit >= 0
                      ? '#16a34a' : '#ef4444')}
                  {statCard('Gross Margin',
                    Math.round(margin) + '%',
                    margin >= 30
                      ? '✓ Healthy margins'
                      : margin >= 20
                      ? '~ Average margins'
                      : '⚠ Low margins',
                    margin >= 30 ? '#16a34a'
                      : margin >= 20 ? '#f97316'
                      : '#ef4444')}
                </div>

                {/* P&L Statement with Expenses */}
                <div style={card}>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#1a0a2e', marginBottom: '16px' }}>
                    Profit & Loss Statement
                  </div>
                  <div style={{ maxWidth: '460px' }}>
                    {/* Revenue */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}>
                      <span style={{ color: '#64748b' }}>Revenue</span>
                      <span style={{ fontFamily: 'DM Mono', fontWeight: 600, color: '#1a0a2e' }}>₹{Math.round(totalRevenue).toLocaleString('en-IN')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '2px solid #e2e8f0', fontSize: '13px' }}>
                      <span style={{ color: '#64748b' }}>Cost of Goods Sold</span>
                      <span style={{ fontFamily: 'DM Mono', color: '#ef4444' }}>−₹{Math.round(totalCost).toLocaleString('en-IN')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #f1f5f9', fontSize: '14px', fontWeight: 600 }}>
                      <span style={{ color: '#1a0a2e' }}>Gross Profit</span>
                      <span style={{ fontFamily: 'DM Mono', color: grossProfit >= 0 ? '#16a34a' : '#ef4444' }}>₹{Math.round(grossProfit).toLocaleString('en-IN')}</span>
                    </div>

                    {/* Expenses breakdown */}
                    {Object.keys(expenseCatTotals).length > 0 && (
                      <>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '12px 0 6px' }}>
                          Expenses
                        </div>
                        {Object.entries(expenseCatTotals).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                          <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px', borderBottom: '1px solid #f8fafc' }}>
                            <span style={{ color: '#64748b', paddingLeft: '12px' }}>{cat}</span>
                            <span style={{ fontFamily: 'DM Mono', color: '#ef4444' }}>−₹{Math.round(amt).toLocaleString('en-IN')}</span>
                          </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '2px solid #e2e8f0', fontSize: '13px', fontWeight: 600 }}>
                          <span style={{ color: '#1a0a2e' }}>Total Expenses</span>
                          <span style={{ fontFamily: 'DM Mono', color: '#ef4444' }}>−₹{Math.round(totalExpenses).toLocaleString('en-IN')}</span>
                        </div>
                      </>
                    )}

                    {/* Net Profit */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', padding: '14px 0',
                      fontSize: '16px', fontWeight: 700, marginTop: '4px',
                      borderTop: Object.keys(expenseCatTotals).length === 0 ? 'none' : undefined,
                    }}>
                      <span style={{ color: '#1a0a2e' }}>NET PROFIT</span>
                      <span style={{ fontFamily: 'DM Mono', color: netProfit >= 0 ? '#16a34a' : '#ef4444', fontSize: '20px' }}>
                        {netProfit >= 0 ? '' : '−'}₹{Math.abs(Math.round(netProfit)).toLocaleString('en-IN')}
                      </span>
                    </div>
                    {totalRevenue > 0 && (
                      <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'right' }}>
                        Net Margin: <span style={{ fontWeight: 600, color: netMargin >= 10 ? '#16a34a' : '#ef4444' }}>{Math.round(netMargin)}%</span>
                      </div>
                    )}
                  </div>
                </div>

                {totalCost === 0 && (
                  <div style={{
                    background: '#fff7ed',
                    border: '1px solid #fed7aa',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    fontSize: '13px',
                    color: '#c2410c'
                  }}>
                    ⚠ Some products are missing
                    cost price. Add cost prices
                    in Products page for accurate
                    P&L calculations.
                  </div>
                )}

                <div style={card}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#1a0a2e',
                    marginBottom: '16px'
                  }}>
                    Product Profit & Loss
                  </div>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '13px'
                  }}>
                    <thead>
                      <tr style={{
                        borderBottom:
                          '1px solid #f3e8ff'
                      }}>
                        {['Product','Units',
                          'Revenue','Cost',
                          'Profit','Margin'].map(
                          h => (
                          <th key={h} style={{
                            padding: '8px',
                            textAlign: 'left',
                            fontSize: '11px',
                            color: '#94a3b8',
                            fontWeight: '500'
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {plByProduct.map(
                        (p: any, i: number) => (
                        <tr key={i} style={{
                          borderBottom:
                            '1px solid #fdf8ff',
                          background:
                            p.margin > 40
                              ? '#f0fdf4'
                              : p.margin < 0
                              ? '#fef2f2'
                              : p.margin < 20
                              ? '#fff7ed'
                              : 'white'
                        }}>
                          <td style={{
                            padding: '10px 8px',
                            fontWeight: '500',
                            color: '#1a0a2e'
                          }}>
                            {p.name}
                          </td>
                          <td style={{
                            padding: '10px 8px',
                            color: '#64748b'
                          }}>
                            {p.qty}
                          </td>
                          <td style={{
                            padding: '10px 8px',
                            color: '#9333ea',
                            fontFamily: 'DM Mono'
                          }}>
                            ₹{Math.round(p.revenue)
                              .toLocaleString('en-IN')}
                          </td>
                          <td style={{
                            padding: '10px 8px',
                            color: '#64748b',
                            fontFamily: 'DM Mono'
                          }}>
                            {p.cost > 0
                              ? '₹' + Math.round(
                                  p.cost
                                ).toLocaleString(
                                  'en-IN')
                              : '—'}
                          </td>
                          <td style={{
                            padding: '10px 8px',
                            fontWeight: '600',
                            fontFamily: 'DM Mono',
                            color: p.profit >= 0
                              ? '#16a34a'
                              : '#ef4444'
                          }}>
                            {p.cost > 0
                              ? '₹' + Math.round(
                                  p.profit
                                ).toLocaleString(
                                  'en-IN')
                              : '—'}
                          </td>
                          <td style={{
                            padding: '10px 8px'
                          }}>
                            {p.cost > 0 ? (
                              <span style={{
                                background:
                                  p.margin > 40
                                    ? '#f0fdf4'
                                    : p.margin > 20
                                    ? '#f5f3ff'
                                    : '#fef2f2',
                                color:
                                  p.margin > 40
                                    ? '#16a34a'
                                    : p.margin > 20
                                    ? '#9333ea'
                                    : '#ef4444',
                                padding:
                                  '3px 8px',
                                borderRadius:
                                  '99px',
                                fontSize: '11px',
                                fontWeight: '500'
                              }}>
                                {Math.round(
                                  p.margin
                                )}%
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 'staff' && (
              <div style={card}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '16px'
                }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#1a0a2e'
                  }}>
                    Staff Performance
                  </div>
                  <button
                    onClick={() =>
                      exportToCSV(
                        salesmanData.map(
                          (s: any) => ({
                            name: s.name,
                            role: s.role,
                            bills: s.bills,
                            revenue: Math.round(
                              s.revenue),
                            avg: Math.round(
                              s.revenue /
                              (s.bills || 1)),
                            best: getBestProduct(
                              s.sales)
                          })
                        ),
                        'staff_performance',
                        [
                          { key: 'name',
                            label: 'Name' },
                          { key: 'role',
                            label: 'Role' },
                          { key: 'bills',
                            label: 'Total Bills' },
                          { key: 'revenue',
                            label: 'Revenue' },
                          { key: 'avg',
                            label: 'Avg Bill' },
                          { key: 'best',
                            label: 'Best Product' },
                        ]
                      )
                    }
                    style={{
                      background: 'white',
                      color: '#9333ea',
                      border: '1px solid #f3e8ff',
                      borderRadius: '8px',
                      padding: '5px 12px',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}>
                    Export CSV
                  </button>
                </div>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '13px'
                }}>
                  <thead>
                    <tr style={{
                      borderBottom:
                        '1px solid #f3e8ff'
                    }}>
                      {['Rank','Staff',
                        'Bills','Revenue',
                        'Avg Bill',
                        'Best Product'].map(
                        h => (
                        <th key={h} style={{
                          padding: '8px',
                          textAlign: 'left',
                          fontSize: '11px',
                          color: '#94a3b8',
                          fontWeight: '500'
                        }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {salesmanData.map(
                      (s: any, i: number) => (
                      <tr key={i} style={{
                        borderBottom:
                          '1px solid #fdf8ff',
                        background:
                          i === 0 ? '#fffbeb'
                          : i === 1 ? '#f8fafc'
                          : i === 2 ? '#fff7ed'
                          : 'white'
                      }}>
                        <td style={{
                          padding: '12px 8px',
                          fontSize: '18px'
                        }}>
                          {medalEmoji[i] ||
                            String(i + 1)}
                        </td>
                        <td style={{
                          padding: '12px 8px'
                        }}>
                          <div style={{
                            fontWeight: '500',
                            color: '#1a0a2e'
                          }}>
                            {s.name}
                          </div>
                          <div style={{
                            fontSize: '11px',
                            color: '#94a3b8',
                            textTransform:
                              'capitalize',
                            marginTop: '2px'
                          }}>
                            {s.role}
                          </div>
                        </td>
                        <td style={{
                          padding: '12px 8px',
                          color: '#64748b'
                        }}>
                          {s.bills}
                        </td>
                        <td style={{
                          padding: '12px 8px',
                          color: '#9333ea',
                          fontWeight: '600',
                          fontFamily: 'DM Mono'
                        }}>
                          ₹{Math.round(s.revenue)
                            .toLocaleString('en-IN')}
                        </td>
                        <td style={{
                          padding: '12px 8px',
                          fontFamily: 'DM Mono',
                          color: '#64748b'
                        }}>
                          ₹{Math.round(
                            s.revenue /
                            (s.bills || 1)
                          ).toLocaleString('en-IN')}
                        </td>
                        <td style={{
                          padding: '12px 8px',
                          fontSize: '12px',
                          color: '#64748b'
                        }}>
                          {getBestProduct(s.sales)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === 'daily' && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns:
                    'repeat(4,1fr)',
                  gap: '12px'
                }}>
                  {statCard('Total Revenue',
                    '₹' + Math.round(totalRevenue)
                      .toLocaleString('en-IN'),
                    sales.length + ' bills')}
                  {statCard('GST Collected',
                    '₹' + Math.round(totalGST)
                      .toLocaleString('en-IN'),
                    undefined, '#ec4899')}
                  {statCard('Net Revenue',
                    '₹' + Math.round(
                      totalRevenue - totalGST
                    ).toLocaleString('en-IN'),
                    'after GST', '#16a34a')}
                  {statCard('Discount Given',
                    '₹' + Math.round(totalDiscount)
                      .toLocaleString('en-IN'),
                    undefined, '#f97316')}
                </div>

                <div style={card}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '16px',
                    alignItems: 'center'
                  }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#1a0a2e'
                    }}>
                      Payment Collection
                    </div>
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(4,1fr)',
                    gap: '10px'
                  }}>
                    {payBreakdown.map(p => (
                      <div key={p.mode} style={{
                        background: modeBg[p.mode],
                        borderRadius: '10px',
                        padding: '14px',
                        textAlign: 'center'
                      }}>
                        <div style={{
                          fontSize: '11px',
                          color: modeColor[p.mode],
                          textTransform: 'capitalize',
                          fontWeight: '500',
                          marginBottom: '6px'
                        }}>
                          {p.mode}
                          {p.mode === 'credit'
                            && ' ⚠'}
                        </div>
                        <div style={{
                          fontSize: '18px',
                          fontWeight: '700',
                          color: modeColor[p.mode],
                          fontFamily: 'DM Mono'
                        }}>
                          ₹{Math.round(p.revenue)
                            .toLocaleString('en-IN')}
                        </div>
                        <div style={{
                          fontSize: '10px',
                          color: '#94a3b8',
                          marginTop: '4px'
                        }}>
                          {p.sales.length} bills
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={card}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '16px',
                    alignItems: 'center'
                  }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: '#1a0a2e'
                    }}>
                      All Bills
                    </div>
                    <button
                      onClick={() => {
                        const d = sales.map(
                          s => ({
                            invoice:
                              s.invoice_no,
                            customer:
                              s.customers?.name
                              || 'Walk-in',
                            amount:
                              s.net_amount,
                            gst: s.gst_amount,
                            payment:
                              s.payment_mode,
                            salesman:
                              s.users?.name,
                            time:
                              new Date(
                                s.created_at
                              ).toLocaleTimeString(
                                'en-IN')
                          })
                        )
                        exportToCSV(
                          d, 'daily_report',
                          [
                            { key: 'invoice',
                              label: 'Invoice' },
                            { key: 'customer',
                              label: 'Customer' },
                            { key: 'amount',
                              label: 'Amount' },
                            { key: 'gst',
                              label: 'GST' },
                            { key: 'payment',
                              label: 'Payment' },
                            { key: 'salesman',
                              label: 'Salesman' },
                            { key: 'time',
                              label: 'Time' },
                          ]
                        )
                      }}
                      style={{
                        background: 'white',
                        color: '#9333ea',
                        border: '1px solid #f3e8ff',
                        borderRadius: '8px',
                        padding: '5px 12px',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}>
                      Export CSV
                    </button>
                  </div>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '13px'
                  }}>
                    <thead>
                      <tr style={{
                        borderBottom:
                          '1px solid #f3e8ff'
                      }}>
                        {['Invoice','Time',
                          'Customer','Staff',
                          'Payment','Amount'].map(
                          h => (
                          <th key={h} style={{
                            padding: '8px',
                            textAlign: 'left',
                            fontSize: '11px',
                            color: '#94a3b8',
                            fontWeight: '500'
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sales.map(
                        (s: any, i: number) => (
                        <tr key={i} style={{
                          borderBottom:
                            '1px solid #fdf8ff'
                        }}>
                          <td style={{
                            padding: '10px 8px',
                            color: '#9333ea',
                            fontFamily: 'DM Mono',
                            fontSize: '12px'
                          }}>
                            {s.invoice_no}
                          </td>
                          <td style={{
                            padding: '10px 8px',
                            color: '#94a3b8',
                            fontSize: '12px'
                          }}>
                            {new Date(
                              s.created_at
                            ).toLocaleTimeString(
                              'en-IN',{
                                hour: '2-digit',
                                minute: '2-digit'
                              }
                            )}
                          </td>
                          <td style={{
                            padding: '10px 8px',
                            fontWeight: '500',
                            color: '#1a0a2e'
                          }}>
                            {s.customers?.name
                              || 'Walk-in'}
                          </td>
                          <td style={{
                            padding: '10px 8px',
                            color: '#64748b'
                          }}>
                            {s.users?.name
                              || '—'}
                          </td>
                          <td style={{
                            padding: '10px 8px'
                          }}>
                            <span style={{
                              background:
                                modeBg[
                                  s.payment_mode
                                ] || '#f1f5f9',
                              color:
                                modeColor[
                                  s.payment_mode
                                ] || '#64748b',
                              padding: '3px 8px',
                              borderRadius: '99px',
                              fontSize: '11px',
                              fontWeight: '500',
                              textTransform:
                                'capitalize'
                            }}>
                              {s.payment_mode}
                            </span>
                          </td>
                          <td style={{
                            padding: '10px 8px',
                            color: '#9333ea',
                            fontWeight: '600',
                            fontFamily: 'DM Mono'
                          }}>
                            ₹{Math.round(
                              s.net_amount || 0
                            ).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}