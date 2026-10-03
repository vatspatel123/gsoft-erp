import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  RefreshCw, 
  ShoppingCart, 
  AlertTriangle, 
  Users, 
  Package, 
  BarChart2,
  CheckCircle2
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { Layout } from '../components/shared/Layout';
import { useDashboard } from '../hooks/useDashboard';
import { SalesmanDetailModal } from '../components/reports/SalesmanDetailModal';
import { useAISummary } from '../hooks/useAISummary';
import { Skeleton } from '../components/shared/Skeleton';
import { RoleBadge } from '../components/shared/RoleBadge';
import '../styles/dashboard.css';
import { fmtLongDate } from '../utils/date'

export function DashboardPage() {
  const navigate = useNavigate();
  const { 
    data, 
    loading: dashLoading, 
    refresh: refreshDash,
    dateRange,
    setDateRange,
    customFrom,
    setCustomFrom,
    customTo,
    setCustomTo
  } = useDashboard();

  const [selectedSalesmanId, setSelectedSalesmanId] = useState<string | null>(null);
  const [selectedSalesmanName, setSelectedSalesmanName] = useState('');
  const [selectedSalesmanRole, setSelectedSalesmanRole] = useState('');
  const [hoveredSalesmanIndex, setHoveredSalesmanIndex] = useState<number | null>(null);

  const { summary, loading: aiLoading, refresh: refreshAI } = useAISummary();

  const handleRefreshAI = () => {
    refreshDash();
    refreshAI();
  };

  const hour = new Date().getHours();
  const getGreeting = () => {
    if (hour < 12) return 'morning 👋';
    if (hour < 17) return 'afternoon 👋';
    return 'evening 👋';
  };
  
  const currentDate = fmtLongDate(new Date());

  const rangeLabel = {
    today: 'Today',
    yesterday: 'Yesterday',
    week: 'This Week',
    month: 'This Month',
    last_month: 'Last Month',
    custom: 'Selected Period'
  }[dateRange] || 'Today';

  const getPctChange = (today: number, yesterday: number) => {
    if (yesterday === 0) return { pct: 0, text: 'First day data', trend: 'neutral' };
    const pct = ((today - yesterday) / yesterday) * 100;
    const rounded = Math.round(pct);
    if (rounded > 0) return { pct: rounded, text: `↑ ${rounded}% vs yesterday`, trend: 'green' };
    if (rounded < 0) return { pct: Math.abs(rounded), text: `↓ ${Math.abs(rounded)}% vs yesterday`, trend: 'red' };
    return { pct: 0, text: `Same as yesterday`, trend: 'neutral' };
  };

  const revChange = getPctChange(data.todayRevenue, data.yesterdayRevenue);
  const orderChange = getPctChange(data.todayOrders, data.yesterdayOrders);

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-IN')
  }

  const formatRupee = (amount: number) => {
    return '₹' + amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })
  }

  const formatTime = (isoString: string) => {
    const d = new Date(isoString)
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  }

  const maxProductQty = useMemo(() => {
    if (!data.topProducts || data.topProducts.length === 0) return 1;
    return Math.max(...data.topProducts.map(p => p.qty));
  }, [data.topProducts]);

  return (
    <Layout>
      <div className="dashboard-page">
        {/* Section A: Greeting */}
        {data.birthdayCustomers?.length > 0 && (
          <div style={{
            background: '#fdf2f8',
            border: '1px solid #f472b6',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '16px',
            color: '#be185d',
            fontSize: '14px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            🎂 {data.birthdayCustomers.length === 1 
                 ? `${data.birthdayCustomers[0].name} has a birthday today! Send them a special offer` 
                 : `${data.birthdayCustomers.length} customers have birthdays today! Send them special offers`}
          </div>
        )}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <h1 style={{
              fontSize: '22px',
              fontWeight: '600',
              color: '#1a0a2e',
              fontFamily: 'DM Sans, sans-serif'
            }}>
              Good {getGreeting()}
            </h1>
            <p style={{
              fontSize: '13px',
              color: '#94a3b8',
              marginTop: '2px'
            }}>
              {currentDate}
            </p>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap'
          }}>
            
            {/* Date range buttons */}
            {[
              { key: 'today', label: 'Today' },
              { key: 'yesterday', label: 'Yesterday' },
              { key: 'week', label: 'This Week' },
              { key: 'month', label: 'This Month' },
              { key: 'last_month', label: 'Last Month' },
              { key: 'custom', label: 'Custom' },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => {
                  setDateRange(opt.key)
                }}
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  border: dateRange === opt.key
                    ? 'none'
                    : '1px solid #f3e8ff',
                  background: dateRange === opt.key
                    ? '#9333ea'
                    : 'white',
                  color: dateRange === opt.key
                    ? 'white'
                    : '#64748b',
                  fontSize: '12px',
                  fontWeight: dateRange === opt.key
                    ? '500' : '400',
                  cursor: 'pointer',
                  fontFamily: 'DM Sans, sans-serif',
                  transition: 'all 0.15s'
                }}
              >
                {opt.label}
              </button>
            ))}

            {/* New Sale button */}
            <button
              onClick={() => navigate('/pos')}
              style={{
                padding: '8px 18px',
                borderRadius: '10px',
                border: 'none',
                background: '#9333ea',
                color: 'white',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                fontFamily: 'DM Sans, sans-serif',
                marginLeft: '4px'
              }}
            >
              New Sale →
            </button>
          </div>
        </div>

        {/* Custom date range picker */}
        {dateRange === 'custom' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'white',
            border: '1px solid #f3e8ff',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '16px',
            flexWrap: 'wrap'
          }}>
            <span style={{
              fontSize: '13px',
              color: '#64748b',
              fontFamily: 'DM Sans, sans-serif'
            }}>
              From:
            </span>
            <input
              type="date"
              value={customFrom}
              onChange={e => 
                setCustomFrom(e.target.value)
              }
              style={{
                border: '1px solid #f3e8ff',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '13px',
                fontFamily: 'DM Sans, sans-serif',
                outline: 'none',
                color: '#1a0a2e'
              }}
            />
            <span style={{
              fontSize: '13px',
              color: '#64748b'
            }}>
              To:
            </span>
            <input
              type="date"
              value={customTo}
              onChange={e => 
                setCustomTo(e.target.value)
              }
              style={{
                border: '1px solid #f3e8ff',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '13px',
                fontFamily: 'DM Sans, sans-serif',
                outline: 'none',
                color: '#1a0a2e'
              }}
            />
            <button
              onClick={() => {
                if (customFrom && customTo) {
                  setDateRange('custom')
                }
              }}
              style={{
                background: '#9333ea',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '7px 16px',
                fontSize: '13px',
                cursor: 'pointer',
                fontFamily: 'DM Sans, sans-serif'
              }}
            >
              Apply
            </button>
            <span style={{
              fontSize: '12px',
              color: '#94a3b8'
            }}>
              {customFrom && customTo 
                ? customFrom + ' → ' + customTo
                : 'Select date range'
              }
            </span>
          </div>
        )}

        {/* Section B: AI Summary Card */}
        <div className="card ai-card">
          <div className="ai-card-header">
            <span className="ai-badge">✦ AI Summary</span>
            <button className={`ai-refresh-btn ${aiLoading ? 'spinning' : ''}`} onClick={handleRefreshAI}>
              <RefreshCw size={14} />
            </button>
          </div>
          <h3 className="ai-title">Yesterday at a glance</h3>
          {aiLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
              <Skeleton width="100%" height="16px" />
              <Skeleton width="85%" height="16px" />
              <Skeleton width="60%" height="12px" />
            </div>
          ) : (
            <p className="ai-text">{summary}</p>
          )}
        </div>

        {/* Section C: KPI Grid */}
        <div className="kpi-grid">
          {/* Card 1: Revenue */}
          <div className="card kpi-card">
            {dashLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                   <Skeleton width="40px" height="40px" style={{ borderRadius: '50%' }} />
                   <Skeleton width="80px" height="12px" />
                </div>
                <Skeleton width="120px" height="26px" />
                <Skeleton width="100px" height="16px" style={{ borderRadius: '12px' }} />
              </div>
            ) : (
              <>
                <div className="kpi-header">
                  <div className="kpi-icon-circle purple">
                    <BarChart2 size={20} />
                  </div>
                  <span className="kpi-label">Revenue ({rangeLabel})</span>
                </div>
                <div className="kpi-value" style={{ fontFamily: "'DM Sans', sans-serif", color: '#1a0a2e', fontSize: '26px', fontWeight: 600 }}>
                  {formatRupee(data.todayRevenue)}
                </div>
                {data.todayRevenue === 0 && data.allTimeRevenue > 0 ? (
                  <span className="kpi-badge neutral" style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 400 }}>
                    All time: {formatRupee(data.allTimeRevenue)}
                  </span>
                ) : (
                  <span className={`kpi-badge ${revChange.trend}`}>{revChange.text}</span>
                )}
              </>
            )}
          </div>

          {/* Card 2: Orders */}
          <div className="card kpi-card">
            {dashLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                 <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                   <Skeleton width="40px" height="40px" style={{ borderRadius: '50%' }} />
                   <Skeleton width="80px" height="12px" />
                </div>
                <Skeleton width="120px" height="26px" />
                <Skeleton width="100px" height="16px" style={{ borderRadius: '12px' }} />
              </div>
            ) : (
              <>
                <div className="kpi-header">
                  <div className="kpi-icon-circle pink">
                    <ShoppingCart size={20} />
                  </div>
                  <span className="kpi-label">Orders ({rangeLabel})</span>
                </div>
                <div className="kpi-value">{formatCurrency(data.todayOrders)}</div>
                {data.todayOrders === 0 && data.allTimeOrders > 0 ? (
                  <span className="kpi-badge neutral" style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 400 }}>
                    All time: {formatCurrency(data.allTimeOrders)} orders
                  </span>
                ) : (
                  <span className={`kpi-badge ${orderChange.trend}`}>{orderChange.text}</span>
                )}
              </>
            )}
          </div>

          {/* Card 3: Low Stock Alerts */}
          <div className="card kpi-card">
            {dashLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                   <Skeleton width="40px" height="40px" style={{ borderRadius: '50%' }} />
                   <Skeleton width="100px" height="12px" />
                </div>
                <Skeleton width="80px" height="26px" />
                <Skeleton width="120px" height="16px" style={{ borderRadius: '12px' }} />
              </div>
            ) : (
              <>
                <div className="kpi-header">
                  <div className="kpi-icon-circle amber">
                    <AlertTriangle size={20} />
                  </div>
                  <span className="kpi-label">Low Stock Items</span>
                </div>
                <div className="kpi-value">{formatCurrency(data.lowStockCount)}</div>
                {data.lowStockCount > 0 ? (
                  <span className="kpi-badge amber">⚠ Needs attention</span>
                ) : (
                  <span className="kpi-badge green">✓ All stocked</span>
                )}
              </>
            )}
          </div>

          {/* Card 4: Customers Today */}
          <div className="card kpi-card">
            {dashLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                   <Skeleton width="40px" height="40px" style={{ borderRadius: '50%' }} />
                   <Skeleton width="100px" height="12px" />
                </div>
                <Skeleton width="80px" height="26px" />
                <Skeleton width="90px" height="16px" style={{ borderRadius: '12px' }} />
              </div>
            ) : (
              <>
                <div className="kpi-header">
                  <div className="kpi-icon-circle teal">
                    <Users size={20} />
                  </div>
                  <span className="kpi-label">Customers ({rangeLabel})</span>
                </div>
                <div className="kpi-value">{formatCurrency(data.todayCustomers)}</div>
                {data.todayCustomers === 0 && data.allTimeCustomers > 0 ? (
                  <span className="kpi-badge neutral" style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 400 }}>
                    All time: {formatCurrency(data.allTimeCustomers)} customers
                  </span>
                ) : (
                  <span className="kpi-badge neutral">unique buyers</span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Section D: Chart */}
        <div className="card sparkline-card">
          <div className="sparkline-header">
            <h3 className="sparkline-title">
              {dateRange === 'today' && 'Revenue Today (hourly)'}
              {dateRange === 'yesterday' && 'Revenue Yesterday (hourly)'}
              {dateRange === 'week' && 'Revenue This Week (daily)'}
              {dateRange === 'month' && 'Revenue This Month (daily)'}
              {dateRange === 'last_month' && 'Revenue Last Month (daily)'}
              {dateRange === 'custom' && 'Revenue for Selected Period (daily)'}
            </h3>
            {data.weeklyRevenue.length > 0 && (
              <p className="sparkline-subtitle">
                {data.weeklyRevenue[0].date} to {data.weeklyRevenue[data.weeklyRevenue.length - 1].date}
              </p>
            )}
          </div>
          
          {dashLoading ? (
             <div style={{ height: 120, display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                {[...Array(7)].map((_, i) => (
                  <Skeleton key={i} width={`${100/7}%`} height={`${30 + Math.random()*70}%`} style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }} />
                ))}
             </div>
          ) : data.weeklyRevenue.length > 0 ? (
            <div style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={data.weeklyRevenue}
                  margin={{ 
                    top: 5, right: 10, 
                    left: 0, bottom: 5 
                  }}
                >
                  <XAxis 
                    dataKey="name"
                    tick={{ 
                      fontSize: 11, 
                      fill: '#94a3b8',
                      fontFamily: 'DM Sans'
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ 
                      fontSize: 11, 
                      fill: '#94a3b8',
                      fontFamily: 'DM Sans'
                    }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) =>
                      v === 0 ? '₹0' :
                      v >= 1000 
                        ? '₹' + (v/1000).toFixed(0) + 'k'
                        : '₹' + v
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'white',
                      border: '1px solid #f3e8ff',
                      borderRadius: '10px',
                      fontSize: '12px',
                      fontFamily: 'DM Sans'
                    }}
                    formatter={(value: any) => [
                      '₹' + Number(value)
                        .toLocaleString('en-IN'),
                      'Revenue'
                    ]}
                    cursor={{ 
                      fill: '#f5f3ff',
                      radius: 6
                    }}
                  />
                  <Bar
                    dataKey="amount"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={48}
                  >
                    {data.weeklyRevenue.map(
                      (entry: any, index: number) => (
                        <Cell
                          key={index}
                          fill={
                            entry.amount > 0 
                              ? '#9333ea' 
                              : '#f3e8ff'
                          }
                        />
                      )
                    )}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="sparkline-empty">
              No data yet — start billing to see your weekly trend
            </div>
          )}
        </div>

        {/* Section E: Two Column Layout */}
        <div className="two-col-grid">
          {/* Left Column: Recent Invoices */}
          <div className="card table-card">
            <div className="table-header-row">
              <h3 className="table-title">Recent Invoices</h3>
              <a href="/invoices" className="table-link" onClick={(e) => { e.preventDefault(); navigate('/invoices'); }}>View all &rarr;</a>
            </div>
            
            {dashLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} width="100%" height="24px" />
                ))}
              </div>
            ) : data.recentSales.length > 0 ? (
              <table className="invoice-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Payment</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentSales.map(sale => (
                    <tr key={sale.id}>
                      <td className="col-invoice" style={{ fontFamily: "'Monaco', 'Courier New', monospace", color: '#9333ea', fontWeight: 600 }}>
                        {sale.invoice_no || '#' + sale.id.slice(0, 8)}
                      </td>
                      <td className={`col-customer ${sale.customers?.name ? 'registered' : 'walk-in'}`}>
                        {sale.customers?.name || 'Walk-in'}
                      </td>
                      <td className="col-amount" style={{ color: '#9333ea', fontWeight: 600 }}>
                        {formatRupee(Number(sale.net_amount))}
                      </td>
                      <td>
                        <span className={`payment-badge ${sale.payment_mode || 'cash'}`}>
                          {sale.payment_mode || 'cash'}
                        </span>
                      </td>
                      <td className="col-time">{formatTime(sale.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <ShoppingCart size={32} color="var(--text-3)" />
                <div className="empty-state-text">No sales today yet</div>
                <button className="empty-state-btn" onClick={() => navigate('/pos')}>Start Billing &rarr;</button>
              </div>
            )}
          </div>

          {/* Right Column: Two stacked cards */}
          <div className="stacked-cards-container">
            {/* Card A: Top Products */}
            <div className="card stat-card">
              <h3 className="table-title">Top Products</h3>
              <div className="top-product-list">
                {dashLoading ? (
                  [...Array(3)].map((_, i) => (
                    <div key={i} className="top-product-row">
                      <Skeleton width="60%" height="16px" />
                      <Skeleton width="40%" height="12px" />
                      <Skeleton width="100%" height="4px" />
                    </div>
                  ))
                ) : data.topProducts.length > 0 ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    {data.topProducts.map((p: any, i: number) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 0',
                          borderBottom: i < data.topProducts.length - 1
                            ? '1px solid #fdf8ff'
                            : 'none'
                        }}
                      >
                        <div style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '6px',
                          background: i === 0 
                            ? '#f5f3ff'
                            : i === 1 
                            ? '#f0fdf4'
                            : '#fff7ed',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: i === 0 
                            ? '#9333ea'
                            : i === 1
                            ? '#16a34a'
                            : '#f97316',
                          flexShrink: 0
                        }}>
                          {i + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: '13px',
                            fontWeight: '500',
                            color: '#1a0a2e'
                          }}>
                            {p.name}
                          </div>
                          <div style={{
                            fontSize: '11px',
                            color: '#94a3b8'
                          }}>
                            {p.qty} units sold
                          </div>
                        </div>
                        <div style={{
                          fontSize: '13px',
                          fontWeight: '600',
                          color: '#9333ea',
                          fontFamily: 'DM Mono, monospace'
                        }}>
                          ₹{Number(p.revenue)
                            .toLocaleString('en-IN')}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    textAlign: 'center',
                    padding: '20px',
                    color: '#94a3b8',
                    fontSize: '13px'
                  }}>
                    No sales data yet
                  </div>
                )}
              </div>
            </div>

            {/* Card B: Low Stock Alerts */}
            <div className="card stat-card">
              <div className="table-header-row" style={{ marginBottom: 0 }}>
                <h3 className="table-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Low Stock <AlertTriangle size={16} color="var(--amber)" />
                </h3>
                {data.lowStockList.length > 0 && (
                  <span className="kpi-badge amber" style={{ margin: 0 }}>{data.lowStockCount}</span>
                )}
              </div>
              
              <div className="low-stock-list">
                {dashLoading ? (
                  [...Array(3)].map((_, i) => (
                    <div key={i} className="stock-row">
                      <Skeleton width="100%" height="20px" />
                      <Skeleton width="100%" height="4px" />
                    </div>
                  ))
                ) : data.lowStockList.length > 0 ? (
                  data.lowStockList.map(prod => {
                    const isCritical = prod.stock_qty <= 2;
                    return (
                      <div key={prod.name} className="stock-row">
                        <div className="product-row-header">
                          <span className="product-name">{prod.name}</span>
                          <span className={`stock-value ${isCritical ? 'critical' : 'warning'}`}>{prod.stock_qty}</span>
                        </div>
                        <div className="progress-bar-container">
                          <div className={`progress-bar ${isCritical ? 'red' : 'amber'}`} style={{ width: `${Math.max(5, (prod.stock_qty / (Math.max(prod.low_stock_alert || 5, 5))) * 100)}%` }}></div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
                    <CheckCircle2 size={16} color="var(--green)" />
                    <span style={{ color: 'var(--green)', fontSize: '13px', fontWeight: 500 }}>All products well stocked &#10003;</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section F: Salesman Performance */}
        <div className="card stat-card" style={{ marginBottom: '16px' }}>
          <h3 className="table-title">Salesman Performance</h3>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {dashLoading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <Skeleton width="30px" height="24px" />
                  <Skeleton width="60%" height="16px" />
                  <Skeleton width="30%" height="16px" />
                </div>
              ))
            ) : data.salesmanData && data.salesmanData.length > 0 ? (
              data.salesmanData.map((salesman: any, i: number) => {
                const medals = ['🥇', '🥈', '🥉']
                const medal = medals[i] || ''
                return (
                  <div
                    key={i}
                    onClick={() => {
                      setSelectedSalesmanId(salesman.id || null)
                      setSelectedSalesmanName(salesman.name || 'Unknown')
                      setSelectedSalesmanRole(salesman.role || 'Cashier')
                    }}
                    onMouseEnter={() => setHoveredSalesmanIndex(i)}
                    onMouseLeave={() => setHoveredSalesmanIndex(null)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 0',
                      borderBottom: i < (data.salesmanData?.length || 0) - 1
                        ? '1px solid #fdf8ff'
                        : 'none',
                      cursor: 'pointer',
                      backgroundColor: hoveredSalesmanIndex === i ? '#fdf8ff' : 'transparent'
                    }}
                  >
                    <div style={{
                      fontSize: '16px',
                      width: '24px',
                      textAlign: 'center'
                    }}>
                      {medal}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '13px',
                        fontWeight: '500',
                        color: '#1a0a2e'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{salesman.name}</span>
                          <RoleBadge role={salesman.role || 'staff'} />
                        </div>
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: '#94a3b8'
                      }}>
                        {salesman.sales} sales
                      </div>
                    </div>
                    <div style={{
                      fontSize: '13px',
                      fontWeight: '600',
                      color: '#9333ea',
                      fontFamily: 'DM Mono, monospace'
                    }}>
                      ₹{Number(salesman.revenue)
                        .toLocaleString('en-IN')}
                    </div>
                  </div>
                )
              })
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '20px',
                color: '#94a3b8',
                fontSize: '13px'
              }}>
                No sales data yet
              </div>
            )}
          </div>
        </div>

        {selectedSalesmanId && (
          <SalesmanDetailModal
            salesmanName={selectedSalesmanName}
            salesmanId={selectedSalesmanId}
            salesmanRole={selectedSalesmanRole}
            dateRange={dateRange}
            onClose={() => {
              setSelectedSalesmanId(null)
              setSelectedSalesmanName('')
              setSelectedSalesmanRole('')
            }}
          />
        )}

        {/* Section G: Quick Actions */}
        <div className="quick-actions-grid">
          <div className="card quick-action-card" onClick={() => navigate('/pos')}>
            <ShoppingCart size={24} className="qa-icon purple" />
            <span className="qa-title">New Sale</span>
          </div>
          <div className="card quick-action-card" onClick={() => navigate('/products')}>
            <Package size={24} className="qa-icon pink" />
            <span className="qa-title">Add Product</span>
          </div>
          <div className="card quick-action-card" onClick={() => navigate('/crm')}>
            <Users size={24} className="qa-icon teal" />
            <span className="qa-title">Add Customer</span>
          </div>
          <div className="card quick-action-card" onClick={() => navigate('/reports')}>
            <BarChart2 size={24} className="qa-icon amber" />
            <span className="qa-title">View Reports</span>
          </div>
        </div>
      </div>
    </Layout>
  );
}
