import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { supabase } from '../../lib/supabase';
import { exportToCSV } from '../../utils/exportCSV';

interface SalesmanDetailModalProps {
  salesmanName: string;
  salesmanId: string | null;
  salesmanRole?: string;
  onClose: () => void;
  dateRange: string;
}

export function SalesmanDetailModal({ salesmanName, salesmanId, salesmanRole = 'Salesman', onClose, dateRange }: SalesmanDetailModalProps) {
  const [activeRange, setActiveRange] = useState<'today' | 'week' | 'month' | 'all'>(() => {
    if (dateRange === 'today' || dateRange === 'week' || dateRange === 'month') return dateRange;
    return 'all';
  });
  const [loading, setLoading] = useState(false);
  const [totalBills, setTotalBills] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [avgBill, setAvgBill] = useState(0);
  const [productRows, setProductRows] = useState<Array<{productName:string; units:number; revenue:number; share:number;}>>([]);
  const [recentBills, setRecentBills] = useState<any[]>([]);
  const [dailyData, setDailyData] = useState<Array<{date:string; revenue:number}>>([]);

  const toIST = (d: Date) => new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  const startOfDay = (d: Date) => {
    const ist = toIST(d);
    const start = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), 0, 0, 0) - 5.5 * 60 * 60 * 1000);
    return start;
  };
  const endOfDay = (d: Date) => {
    const ist = toIST(d);
    const end = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), 23, 59, 59) - 5.5 * 60 * 60 * 1000);
    return end;
  };

  const getPeriod = (range: 'today' | 'week' | 'month' | 'all') => {
    const now = new Date();
    if (range === 'today') {
      return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
    }
    if (range === 'week') {
      const weekAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
      return { from: startOfDay(weekAgo).toISOString(), to: endOfDay(now).toISOString() };
    }
    if (range === 'month') {
      const ist = toIST(now);
      const monthStart = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1, 0, 0, 0) - 5.5 * 60 * 60 * 1000);
      return { from: monthStart.toISOString(), to: endOfDay(now).toISOString() };
    }
    // all time
    return { from: '2000-01-01T00:00:00.000Z', to: endOfDay(new Date()).toISOString() };
  };

  const rangeLabel = useMemo(() => {
    switch (activeRange) {
      case 'today': return 'Today';
      case 'week': return 'This Week';
      case 'month': return 'This Month';
      default: return 'All Time';
    }
  }, [activeRange]);

  const fetchData = async () => {
    if (!salesmanId) return;
    setLoading(true);

    const { from, to } = getPeriod(activeRange);
    const now = new Date();
    const last7 = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);

    try {
      const salesQuery = supabase
        .from('sales')
        .select('id, invoice_no, created_at, net_amount, payment_mode, customers(name), sale_items(qty, line_total, unit_price, products(name)), salesman_id')
        .eq('salesman_id', salesmanId)
        .gte('created_at', from)
        .lte('created_at', to)
        .eq('is_return', false)
        .order('created_at', { ascending: false })
        .limit(10);

      const salesRes = await salesQuery;
      if (salesRes.error) throw salesRes.error;
      const salesData = salesRes.data || [];

      const allSalesQuery = supabase
        .from('sales')
        .select('id, invoice_no, created_at, net_amount, payment_mode, customers(name), sale_items(qty, line_total, unit_price, products(name)), salesman_id')
        .eq('salesman_id', salesmanId)
        .gte('created_at', from)
        .lte('created_at', to)
        .eq('is_return', false);

      const allSalesRes = await allSalesQuery;
      if (allSalesRes.error) throw allSalesRes.error;
      const allSalesData = allSalesRes.data || [];

      const recent = salesData.map((s: any) => ({
        invoice: s.invoice_no,
        customer: s.customers?.name || 'Walk-in',
        amount: Number(s.net_amount || 0),
        payment: s.payment_mode || 'cash',
        date: new Date(s.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      }));

      const revenue = allSalesData.reduce((sum: number, s: any) => sum + Number(s.net_amount || 0), 0);
      const bills = allSalesData.length;
      const avg = bills > 0 ? revenue / bills : 0;

      const itemMap: Record<string, { productName: string; units: number; revenue: number }> = {};
      let totalItemRevenue = 0;

      allSalesData.forEach((sale: any) => {
        (sale.sale_items || []).forEach((item: any) => {
          const name = item.products?.name || 'Unknown';
          if (!itemMap[name]) itemMap[name] = { productName: name, units: 0, revenue: 0 };
          itemMap[name].units += Number(item.qty || 0);
          itemMap[name].revenue += Number(item.line_total || 0);
          totalItemRevenue += Number(item.line_total || 0);
        });
      });

      const grouped = Object.values(itemMap).map((x) => ({
        ...x,
        share: totalItemRevenue > 0 ? (x.revenue / totalItemRevenue) * 100 : 0
      })).sort((a, b) => b.revenue - a.revenue);

      const last7Str = last7.toISOString();
      const thisWeekData = await supabase
        .from('sales')
        .select('created_at, net_amount')
        .eq('salesman_id', salesmanId)
        .gte('created_at', last7Str)
        .lte('created_at', endOfDay(now).toISOString())
        .eq('is_return', false);
      if (thisWeekData.error) throw thisWeekData.error;

      const dailyMap: Record<string, number> = {};
      for (let i = 0; i < 7; i++) {
        const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const label = day.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        dailyMap[label] = 0;
      }

      (thisWeekData.data || []).forEach((sale: any) => {
        const label = new Date(sale.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        dailyMap[label] = (dailyMap[label] || 0) + Number(sale.net_amount || 0);
      });

      const chart = Object.entries(dailyMap)
        .map(([date, revenue]) => ({ date, revenue }))
        .reverse();

      setTotalBills(bills);
      setTotalRevenue(revenue);
      setAvgBill(avg);
      setProductRows(grouped);
      setRecentBills(recent);
      setDailyData(chart);

    } catch (err: any) {
      console.error('Salesman detail fetch failed', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [salesmanId, activeRange]);

  const handleExport = () => {
    const rows: any[] = [];
    for (const item of productRows) {
      rows.push({
        metric: 'Product',
        product: item.productName,
        units: item.units,
        revenue: item.revenue,
        share_pct: item.share.toFixed(2)
      });
    }

    const columns = [
      { key: 'metric', label: 'Metric' },
      { key: 'product', label: 'Product' },
      { key: 'units', label: 'Units Sold' },
      { key: 'revenue', label: 'Revenue' },
      { key: 'share_pct', label: '% of Total' }
    ];

    exportToCSV(rows, `salesman_${salesmanName.replace(/\s+/g, '_')}_report`, columns);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.35)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: '600px', background: 'white', borderRadius: '14px', boxShadow: '0 15px 35px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #f3e8ff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '22px', fontWeight: 700 }}>{salesmanName.charAt(0).toUpperCase()}</div>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 600, color: '#1a0a2e' }}>{salesmanName}</div>
              <div style={{ fontSize: '12px', display: 'inline-block', marginTop: '4px', padding: '2px 8px', borderRadius: '999px', background: '#f3e8ff', color: '#4338ca' }}>{salesmanRole}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#6b7280' }}><X size={20} /></button>
        </div>

        <div style={{ padding: '14px 18px' }}>
          <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(3,1fr)', marginBottom: '12px' }}>
            <div style={{ background: '#f8f6ff', border: '1px solid #ede9fe', borderRadius: '10px', padding: '10px' }}>
              <div style={{ fontSize: '11px', color: '#6b7280' }}>Total Sales</div>
              <div style={{ fontSize: '16px', fontWeight: 700, marginTop: '4px' }}>{totalBills}</div>
            </div>
            <div style={{ background: '#f8f6ff', border: '1px solid #ede9fe', borderRadius: '10px', padding: '10px' }}>
              <div style={{ fontSize: '11px', color: '#6b7280' }}>Total Revenue</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#9333ea', marginTop: '4px' }}>₹{totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
            </div>
            <div style={{ background: '#f8f6ff', border: '1px solid #ede9fe', borderRadius: '10px', padding: '10px' }}>
              <div style={{ fontSize: '11px', color: '#6b7280' }}>Avg Bill Value</div>
              <div style={{ fontSize: '16px', fontWeight: 700, marginTop: '4px' }}>₹{avgBill.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            {['today', 'week', 'month', 'all'].map((option) => (
              <button
                key={option}
                onClick={() => setActiveRange(option as any)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '8px',
                  border: activeRange === option ? '1px solid #9333ea' : '1px solid #e5e7eb',
                  background: activeRange === option ? '#f5f3ff' : 'white',
                  color: activeRange === option ? '#9333ea' : '#64748b',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                {option === 'all' ? 'All Time' : option === 'week' ? 'This Week' : option === 'month' ? 'This Month' : 'Today'}
              </button>
            ))}
          </div>

          <div style={{ marginBottom: '12px', fontSize: '12px', color: '#6b7280' }}>Date range: {rangeLabel}</div>

          <div style={{ marginBottom: '12px' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: '14px', color: '#1a0a2e' }}>Products Sold</h4>
            <div style={{ width: '100%', maxHeight: '220px', overflowY: 'auto', border: '1px solid #f3e8ff', borderRadius: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#faf5ff' }}>
                    <th style={{ textAlign: 'left', padding: '8px', fontSize: '12px', color: '#6b7280' }}>Product Name</th>
                    <th style={{ textAlign: 'right', padding: '8px', fontSize: '12px', color: '#6b7280' }}>Units Sold</th>
                    <th style={{ textAlign: 'right', padding: '8px', fontSize: '12px', color: '#6b7280' }}>Revenue</th>
                    <th style={{ textAlign: 'right', padding: '8px', fontSize: '12px', color: '#6b7280' }}>% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={4} style={{ padding: '10px', textAlign: 'center' }}>Loading...</td></tr>
                  ) : productRows.length === 0 ? (
                    <tr><td colSpan={4} style={{ padding: '10px', textAlign: 'center', color: '#94a3b8' }}>No products sold</td></tr>
                  ) : productRows.map((row, idx) => (
                    <tr key={idx} style={{ borderTop: '1px solid #f3e8ff' }}>
                      <td style={{ padding: '8px', fontSize: '13px', color: '#1a0a2e' }}>{row.productName}</td>
                      <td style={{ padding: '8px', fontSize: '13px', color: '#1a0a2e', textAlign: 'right' }}>
                        <span style={{ display: 'inline-block', minWidth: '24px', background: '#f0fdf4', color: '#166534', padding: '2px 6px', borderRadius: '999px', fontWeight: 600 }}>{row.units}</span>
                      </td>
                      <td style={{ padding: '8px', fontSize: '13px', color: '#9333ea', textAlign: 'right' }}>₹{Number(row.revenue).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: '#6b7280', fontSize: '12px' }}>{row.share.toFixed(1)}%</span>
                          <div style={{ width: '70px', height: '8px', background: '#ede9fe', borderRadius: '999px' }}>
                            <div style={{ width: `${Math.min(100, Math.max(0, row.share))}%`, height: '100%', background: '#7c3aed', borderRadius: '999px' }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: '14px', color: '#1a0a2e' }}>Recent Bills</h4>
            <div style={{ width: '100%', maxHeight: '220px', overflowY: 'auto', border: '1px solid #f3e8ff', borderRadius: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#faf5ff' }}>
                    <th style={{ padding: '8px', fontSize: '12px', color: '#6b7280' }}>Invoice</th>
                    <th style={{ padding: '8px', fontSize: '12px', color: '#6b7280' }}>Customer</th>
                    <th style={{ padding: '8px', fontSize: '12px', color: '#6b7280' }}>Amount</th>
                    <th style={{ padding: '8px', fontSize: '12px', color: '#6b7280' }}>Payment</th>
                    <th style={{ padding: '8px', fontSize: '12px', color: '#6b7280' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} style={{ padding: '10px', textAlign: 'center' }}>Loading...</td></tr>
                  ) : recentBills.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: '10px', textAlign: 'center', color: '#94a3b8' }}>No bills yet</td></tr>
                  ) : recentBills.map((b, idx) => (
                    <tr key={idx} style={{ borderTop: '1px solid #f3e8ff' }}>
                      <td style={{ padding: '8px', color: '#6d28d9', fontFamily: 'DM Mono, monospace', fontWeight: 600 }}>{b.invoice || b.invoiceNo}</td>
                      <td style={{ padding: '8px', color: '#1a0a2e' }}>{b.customer || 'Walk-in'}</td>
                      <td style={{ padding: '8px', fontWeight: 700, color: '#9333ea' }}>₹{Number(b.amount || 0).toLocaleString('en-IN')}</td>
                      <td style={{ padding: '8px' }}><span style={{ borderRadius: '8px', padding: '3px 8px', fontSize: '11px', fontWeight: 600, background: '#ede9fe', color: '#4338ca' }}>{b.payment}</span></td>
                      <td style={{ padding: '8px', color: '#64748b' }}>{b.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <h4 style={{ margin: '0 0 8px', fontSize: '14px', color: '#1a0a2e' }}>Performance (Last 7 days)</h4>
            <div style={{ width: '100%', height: '180px', padding: '10px', background: '#f9f5ff', borderRadius: '10px' }}>
              {dailyData.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: '30px' }}>No activity</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyData} margin={{ top: 8, right: 10, left: 0, bottom: 2 }}>
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `₹${v}`}/>
                    <Tooltip formatter={(val:any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Revenue']} />
                    <Bar dataKey="revenue" radius={[6, 6, 0, 0]} fill="#9333ea">
                      {dailyData.map((_, idx) => (
                        <Cell key={idx} fill="#9333ea" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleExport} style={{ marginRight: '8px', padding: '8px 12px', borderRadius: '8px', border: '1px solid #c084fc', background: 'white', color: '#6d28d9', cursor: 'pointer' }}>
              Export This Report
            </button>
            <button onClick={onClose} style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', background: '#9333ea', color: 'white', cursor: 'pointer' }}>
              Close
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
