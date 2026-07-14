import { useState } from 'react';
import { Layout } from '../components/shared/Layout';
import { useProducts } from '../hooks/useProducts';
import { ProductForm } from '../components/inventory/ProductForm';
import { ProductSpreadsheet } from '../components/inventory/ProductSpreadsheet';
import { PrintLabelsModal } from '../components/inventory/PrintLabelsModal';
import { exportToCSV } from '../utils/exportCSV';
import { EmptyState } from '../components/shared/EmptyState';
import { ConfirmModal } from '../components/shared/ConfirmModal';
import {
  Package, CheckCircle, AlertTriangle, XCircle,
  Search, Pencil, Copy, Trash2, Download, Tag
} from 'lucide-react';

const COLOUR_MAP: Record<string, string> = {
  red: '#ef4444', blue: '#3b82f6', black: '#1e293b', white: '#e2e8f0',
  green: '#16a34a', yellow: '#eab308', pink: '#ec4899', navy: '#1e3a5f',
  grey: '#94a3b8', gray: '#94a3b8', brown: '#92400e', orange: '#f97316',
  purple: '#9333ea', maroon: '#7f1d1d', cream: '#fef9c3'
}
function colourCSS(name: string) {
  return COLOUR_MAP[name?.toLowerCase()] || '#94a3b8'
}

export function ProductsPage() {
  const p = useProducts();
  const [showForm, setShowForm] = useState(false);
  const [showSpreadsheet, setShowSpreadsheet] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [showPrintLabels, setShowPrintLabels] = useState(false);
  const [labelProducts, setLabelProducts] = useState<any[]>([]);

  const openEdit = (product: any) => { setEditProduct(product); setShowForm(true); };
  const openAdd = () => { setEditProduct(null); setShowForm(true); };

  const toggleSelect = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleAll = () => {
    setSelected(selected.length === p.products.length ? [] : p.products.map(x => x.id));
  };

  const stats = [
    { label: 'Total Products', value: p.products.length, icon: Package, bg: '#f5f3ff', color: '#9333ea' },
    { label: 'Active', value: p.products.filter(x => x.is_active).length, icon: CheckCircle, bg: '#f0fdf4', color: '#16a34a' },
    { label: 'Low Stock', value: p.products.filter(x => x.stock_qty <= x.low_stock_alert && x.stock_qty > 0).length, icon: AlertTriangle, bg: '#fff7ed', color: '#f59e0b' },
    { label: 'Out of Stock', value: p.products.filter(x => x.stock_qty === 0).length, icon: XCircle, bg: '#fef2f2', color: '#ef4444' },
  ];

  const stockBadge = (product: any) => {
    if (product.stock_qty === 0) return { text: 'Out of stock', bg: '#fef2f2', color: '#ef4444' };
    if (product.stock_qty <= product.low_stock_alert) return { text: `Low: ${product.stock_qty}`, bg: '#fff7ed', color: '#f59e0b' };
    return { text: `${product.stock_qty} in stock`, bg: '#f0fdf4', color: '#16a34a' };
  };

  return (
    <Layout>
      <div style={{ padding: '24px', backgroundColor: '#fdf8ff', minHeight: '100%', fontFamily: 'DM Sans, sans-serif', overflowY: 'auto' }}>

        {/* Top Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#1a0a2e', margin: 0 }}>Products</h1>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => exportToCSV(p.products, 'products', [
                { key: 'name', label: 'Product Name' },
                { key: 'sku', label: 'SKU' },
                { key: 'design_no', label: 'Design No' },
                { key: 'pcode', label: 'PCode' },
                { key: 'size', label: 'Size' },
                { key: 'colour', label: 'Colour' },
                { key: 'mrp', label: 'MRP' },
                { key: 'unit_price', label: 'Rate' },
                { key: 'cost_price', label: 'Cost Price' },
                { key: 'gst_rate', label: 'GST %' },
                { key: 'stock_qty', label: 'Stock' },
                { key: 'batch_no', label: 'Batch No' },
                { key: 'hsn_code', label: 'HSN Code' },
                { key: 'barcode', label: 'Barcode' },
                { key: 'is_active', label: 'Active' },
              ])}
              style={{ padding: '10px 18px', background: 'white', color: '#9333ea', border: '1px solid #f3e8ff', borderRadius: '12px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Download size={14} /> Export CSV
            </button>
            <button
              onClick={() => setShowSpreadsheet(!showSpreadsheet)}
              style={{ padding: '10px 18px', background: 'white', color: '#9333ea', border: '1px solid #c084fc', borderRadius: '12px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              📊 {showSpreadsheet ? 'Close' : 'Bulk Add'}
            </button>
            <button onClick={openAdd} style={{ padding: '10px 20px', background: '#9333ea', color: 'white', border: 'none', borderRadius: '12px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
              + Add Product
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '20px' }}>
          {stats.map(s => (
            <div key={s.label} style={{ background: 'white', border: '1px solid #f3e8ff', borderRadius: '16px', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <s.icon size={18} color={s.color} />
              </div>
              <div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: s.color, fontFamily: 'DM Mono, monospace' }}>{s.value}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Spreadsheet Component */}
        <div
          style={{
            maxHeight: showSpreadsheet ? '1000px' : '0px',
            overflow: 'hidden',
            transition: 'max-height 0.3s ease',
            marginBottom: showSpreadsheet ? '20px' : '0px'
          }}
        >
          <ProductSpreadsheet
            onClose={() => setShowSpreadsheet(false)}
            onSaved={() => {
              p.loadProducts();
              setTimeout(() => setShowSpreadsheet(false), 1000);
            }}
          />
        </div>

        {/* Filters Bar */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#9333ea' }} />
            <input
              value={p.search}
              onChange={e => p.setSearch(e.target.value)}
              placeholder="Search products..."
              style={{ width: '100%', border: '1px solid #f3e8ff', borderRadius: '10px', padding: '10px 14px 10px 38px', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', outline: 'none', color: '#1a0a2e', background: 'white' }}
            />
          </div>
          <select value={p.categoryFilter} onChange={e => p.setCategoryFilter(e.target.value)} style={{ border: '1px solid #f3e8ff', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', outline: 'none', color: '#1a0a2e', background: 'white', minWidth: '140px' }}>
            <option value="">All Categories</option>
            {p.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={p.statusFilter} onChange={e => p.setStatusFilter(e.target.value)} style={{ border: '1px solid #f3e8ff', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', outline: 'none', color: '#1a0a2e', background: 'white' }}>
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select value={p.sortBy} onChange={e => p.setSortBy(e.target.value)} style={{ border: '1px solid #f3e8ff', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', outline: 'none', color: '#1a0a2e', background: 'white' }}>
            <option value="name">Sort: Name</option>
            <option value="price">Sort: Price</option>
            <option value="stock">Sort: Stock</option>
            <option value="latest">Sort: Latest</option>
          </select>
        </div>

        {/* Bulk Actions Bar */}
        {selected.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 18px', background: '#f5f3ff', border: '1px solid #e9d5ff', borderRadius: '12px', marginBottom: '14px' }}>
            <span style={{ fontSize: '13px', fontWeight: 500, color: '#9333ea' }}>{selected.length} selected</span>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => {
                const sel = p.products.filter(x => selected.includes(x.id));
                setLabelProducts(sel);
                setShowPrintLabels(true);
              }}
              style={{ padding: '7px 14px', background: '#9333ea', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Tag size={13} /> Print Labels
            </button>
            <button onClick={() => { p.bulkDeactivate(selected); setSelected([]); }} style={{ padding: '7px 14px', background: '#fff7ed', color: '#f59e0b', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>Deactivate</button>
            <select onChange={e => { if (e.target.value) { p.bulkCategory(selected, e.target.value); setSelected([]); } }} defaultValue="" style={{ padding: '7px 12px', border: '1px solid #f3e8ff', borderRadius: '8px', fontSize: '12px', background: 'white', color: '#64748b', cursor: 'pointer' }}>
              <option value="">Change Category</option>
              {p.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button onClick={() => setConfirmBulkDelete(true)} style={{ padding: '7px 14px', background: '#fef2f2', color: '#ef4444', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>Delete All</button>
          </div>
        )}

        {/* Product Table */}
        <div style={{ background: 'white', border: '1px solid #f3e8ff', borderRadius: '16px', overflow: 'hidden' }}>
          {p.loading ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>Loading products...</div>
          ) : p.products.length === 0 ? (
            <EmptyState
              icon="📦"
              title="No products found"
              subtitle="Try adjusting your filters or add your first product"
              actionLabel="+ Add Product"
              onAction={openAdd}
            />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f3e8ff' }}>
                    <th style={{ padding: '14px 16px', textAlign: 'left', width: '36px' }}>
                      <input type="checkbox" checked={selected.length === p.products.length && p.products.length > 0} onChange={toggleAll} style={{ accentColor: '#9333ea' }} />
                    </th>
                    <th style={thStyle}>Photo</th>
                    <th style={thStyle}>Name & SKU</th>
                    <th style={thStyle}>Design</th>
                    <th style={thStyle}>Size</th>
                    <th style={thStyle}>Colour</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>MRP</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Rate</th>
                    <th style={thStyle}>Stock</th>
                    <th style={thStyle}>Status</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {p.products.map(product => {
                    const sb = stockBadge(product);
                    return (
                      <tr key={product.id} style={{ borderBottom: '1px solid #fdf8ff', transition: 'background 0.1s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#fdf8ff')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                        <td style={{ padding: '12px 16px' }}>
                          <input type="checkbox" checked={selected.includes(product.id)} onChange={() => toggleSelect(product.id)} style={{ accentColor: '#9333ea' }} />
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          {product.photo_url ? (
                            <img src={product.photo_url} alt="" style={{ width: '40px', height: '40px', borderRadius: '10px', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#f5f3ff', color: '#9333ea', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 700 }}>
                              {product.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 500, color: '#1a0a2e' }}>{product.name}</div>
                          <div style={{ fontSize: '10px', fontFamily: 'DM Mono, monospace', color: '#94a3b8', marginTop: '2px' }}>{product.sku}</div>
                          {product.barcode && (
                            <div style={{ fontSize: '9px', color: '#c084fc', fontFamily: 'DM Mono, monospace', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '1px' }}>
                              ▌▌▌ {product.barcode}
                            </div>
                          )}
                        </td>
                        {/* Design No */}
                        <td style={{ padding: '12px 8px' }}>
                          {product.design_no
                            ? <span style={{ fontSize: '12px', color: '#64748b', fontFamily: 'DM Mono, monospace' }}>{product.design_no}</span>
                            : <span style={{ color: '#cbd5e1', fontSize: '11px' }}>—</span>}
                        </td>
                        {/* Size */}
                        <td style={{ padding: '12px 8px' }}>
                          {product.size
                            ? <span style={{ background: '#f5f3ff', color: '#9333ea', padding: '2px 8px', borderRadius: '99px', fontSize: '11px', fontWeight: 600 }}>{product.size}</span>
                            : <span style={{ color: '#cbd5e1', fontSize: '11px' }}>—</span>}
                        </td>
                        {/* Colour */}
                        <td style={{ padding: '12px 8px' }}>
                          {product.colour ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: colourCSS(product.colour), border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 }} />
                              <span style={{ fontSize: '12px', color: '#475569' }}>{product.colour}</span>
                            </div>
                          ) : (
                            <span style={{ color: '#cbd5e1', fontSize: '11px' }}>—</span>
                          )}
                        </td>
                        {/* MRP */}
                        <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                          {product.mrp != null
                            ? <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'DM Mono, monospace' }}>₹{Number(product.mrp).toLocaleString('en-IN')}</div>
                            : <span style={{ color: '#cbd5e1', fontSize: '11px' }}>—</span>}
                        </td>
                        {/* Rate */}
                        <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, color: '#9333ea', fontFamily: 'DM Mono, monospace' }}>₹{product.unit_price?.toLocaleString('en-IN')}</div>
                          {product.cost_price != null && (
                            <div style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'DM Mono, monospace' }}>Cost ₹{product.cost_price?.toLocaleString('en-IN')}</div>
                          )}
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <span style={{ background: sb.bg, color: sb.color, padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 600 }}>{sb.text}</span>
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <button onClick={() => p.toggleStatus(product.id, product.is_active)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 500, color: product.is_active ? '#16a34a' : '#94a3b8', padding: '4px 0' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: product.is_active ? '#16a34a' : '#cbd5e1' }} />
                            {product.is_active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                            <button onClick={() => { setLabelProducts([product]); setShowPrintLabels(true); }} title="Print Label" style={{ ...actionBtnStyle, color: '#7c3aed' }}><Tag size={14} /></button>
                            <button onClick={() => openEdit(product)} title="Edit" style={actionBtnStyle}><Pencil size={14} /></button>
                            <button onClick={() => p.duplicateProduct(product)} title="Duplicate" style={actionBtnStyle}><Copy size={14} /></button>
                            {confirmDelete === product.id ? (
                              <button onClick={() => { p.deleteProduct(product.id); setConfirmDelete(null); }} style={{ ...actionBtnStyle, background: '#fef2f2', color: '#ef4444' }}>Confirm?</button>
                            ) : (
                              <button onClick={() => setConfirmDelete(product.id)} title="Delete" style={{ ...actionBtnStyle, color: '#ef4444' }}><Trash2 size={14} /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Product Form Modal */}
        {showForm && (
          <ProductForm
            product={editProduct}
            categories={p.categories}
            onSave={p.saveProduct}
            onAddCategory={p.addCategory}
            onClose={() => { setShowForm(false); setEditProduct(null); }}
          />
        )}

        <ConfirmModal
          isOpen={confirmBulkDelete}
          title={`Delete ${selected.length} products?`}
          message="This action cannot be undone. All selected products will be permanently deleted."
          confirmLabel="Delete All"
          confirmColor="red"
          onConfirm={() => { p.bulkDelete(selected); setSelected([]); setConfirmBulkDelete(false); }}
          onCancel={() => setConfirmBulkDelete(false)}
        />

        {showPrintLabels && (
          <PrintLabelsModal
            products={labelProducts}
            isOpen={showPrintLabels}
            onClose={() => { setShowPrintLabels(false); setLabelProducts([]); }}
          />
        )}
      </div>
    </Layout>
  );
}

const thStyle: React.CSSProperties = {
  padding: '14px 8px',
  textAlign: 'left',
  fontSize: '10px',
  fontWeight: 700,
  color: '#9333ea',
  textTransform: 'uppercase',
  letterSpacing: '0.05em'
};

const actionBtnStyle: React.CSSProperties = {
  background: '#fdf8ff',
  border: '1px solid #f3e8ff',
  borderRadius: '8px',
  padding: '6px 8px',
  cursor: 'pointer',
  color: '#9333ea',
  display: 'flex',
  alignItems: 'center'
};
