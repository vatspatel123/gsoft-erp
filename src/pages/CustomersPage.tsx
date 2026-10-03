import { useState } from 'react'
import { Users, UserCheck, Star, Gift, Plus, Download, Heart, MessageCircle, Crown, Gem, History } from 'lucide-react'
import { Layout } from '../components/shared/Layout'
import { useCustomers, type Customer, type Sale } from '../hooks/useCustomers'
import { exportToCSV } from '../utils/exportCSV'
import { getTierInfo } from '../utils/customerTier'
import { CustomerHistoryModal } from '../components/customers/CustomerHistoryModal'
import toast from 'react-hot-toast'
import '../styles/customers.css'
import { sendWhatsApp } from '../utils/whatsapp'
import { fmtDate, fmtDayMonth } from '../utils/date'

function CustomersPageComponent() {
  const {
    customers: filteredCustomers,
    allCustomers,
    loading,
    search,
    setSearch,
    filter,
    setFilter,
    birthdayCustomers,
    birthdayThisMonth,
    totalLoyaltyPoints,
    activeTodayCount,
    saveCustomer,
    deleteCustomer,
    addLoyaltyPoints,
    getCustomerPurchases,
    vvipCount,
    vipCount,
    regularCount,
    newCount
  } = useCustomers()

  const [showAddModal, setShowAddModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null)
  const [showDetailPanel, setShowDetailPanel] = useState(false)
  const [showAddPointsModal, setShowAddPointsModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerPurchases, setCustomerPurchases] = useState<Sale[]>([])
  const [purchasesLoading, setPurchasesLoading] = useState(false)
  const [pointsToAdd, setPointsToAdd] = useState(10)
  const [pointsReason, setPointsReason] = useState('')

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    date_of_birth: '',
    address: '',
    notes: ''
  })

  const handleAddCustomer = () => {
    setEditingCustomer(null)
    setFormData({ name: '', phone: '', email: '', date_of_birth: '', address: '', notes: '' })
    setShowAddModal(true)
  }

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer)
    setFormData({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || '',
      date_of_birth: customer.date_of_birth || '',
      address: customer.address || '',
      notes: customer.notes || ''
    })
    setShowAddModal(true)
  }

  const handleSaveCustomer = async () => {
    if (!formData.name.trim() || !formData.phone.trim()) {
      toast.error('Name and phone are required')
      return
    }

    await saveCustomer(formData, editingCustomer?.id)
    setShowAddModal(false)
  }

  const handleDeleteCustomer = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this customer?')) {
      await deleteCustomer(id)
    }
  }

  const handleViewCustomer = async (customer: Customer) => {
    setSelectedCustomer(customer)
    setPurchasesLoading(true)
    const purchases = await getCustomerPurchases(customer.id)
    setCustomerPurchases(purchases)
    setPurchasesLoading(false)
    setShowDetailPanel(true)
  }

  const handleAddPoints = async () => {
    if (!selectedCustomer) return
    if (pointsToAdd <= 0) {
      toast.error('Points must be greater than 0')
      return
    }

    await addLoyaltyPoints(selectedCustomer.id, pointsToAdd, pointsReason)
    setPointsToAdd(10)
    setPointsReason('')
    setShowAddPointsModal(false)
    
    // Refresh selected customer
    const updatedCustomer = allCustomers.find(c => c.id === selectedCustomer.id)
    if (updatedCustomer) {
      setSelectedCustomer(updatedCustomer)
    }
  }

  const sendBirthdayWhatsApp = (customer: Customer) => {
    if (!customer.phone) {
      toast.error('No phone number for this customer')
      return
    }

    const birthdayMsg = 
      `🎂 Happy Birthday ${customer.name}!%0A` +
      `%0AWishing you a wonderful day! 🎉%0A` +
      `%0AAs a birthday gift, visit us today ` +
      `and get a special surprise! 🛍️%0A` +
      `%0A_Retail ERP Fashion Edition_`

    const phone = customer.phone.replace(/\D/g, '')
    sendWhatsApp(phone, birthdayMsg, { encoded: true })
  }

  const getLoyaltyTier = (points: number) => {
    if (points >= 1000) return { name: 'Platinum', className: 'tier-platinum' }
    if (points >= 500) return { name: 'Gold', className: 'tier-gold' }
    if (points >= 100) return { name: 'Silver', className: 'tier-silver' }
    return { name: 'Bronze', className: 'tier-bronze' }
  }

  const formatCurrency = (amount: number) => {
    return '₹' + amount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }

  const getLastVisitText = (createdAt: string) => {
    const date = new Date(createdAt)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return '1 day ago'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    return `${Math.floor(diffDays / 30)} months ago`
  }

  const handleExportCSV = () => {
    exportToCSV(
      allCustomers,
      'customers_export',
      [
        { key: 'name', label: 'Name' },
        { key: 'phone', label: 'Phone' },
        { key: 'email', label: 'Email' },
        { key: 'date_of_birth', label: 'Birthday' },
        { key: 'loyalty_points', label: 'Loyalty Points' },
        { key: 'total_spent', label: 'Total Spent' },
        { key: 'created_at', label: 'Member Since' }
      ]
    )
  }

  return (
    <Layout>
      <div className="customers-page">
        {/* Header */}
        <div className="customers-header">
          <h1>Customers</h1>
          <div className="header-buttons">
            <button className="btn-primary" onClick={handleAddCustomer}>
              <Plus size={16} />
              Add Customer
            </button>
            <button className="btn-outline" onClick={handleExportCSV}>
              <Download size={16} />
              Export CSV
            </button>
          </div>
        </div>

        {/* Birthday Banner */}
        {birthdayCustomers.length > 0 && (
          <div className="birthday-banner">
            <div className="birthday-emoji">🎂</div>
            <div className="birthday-content">
              <div className="birthday-title">Birthday Today!</div>
              <div className="birthday-message">
                {birthdayCustomers.map(c => c.name).join(', ')} — Send them a special offer!
              </div>
            </div>
            <button
              className="birthday-btn"
              onClick={() => birthdayCustomers.forEach(c => sendBirthdayWhatsApp(c))}
            >
              Send WhatsApp 🎁
            </button>
          </div>
        )}

        {/* Stat Cards */}
        <div className="stat-cards-grid">
          <div className="stat-card">
            <div className="stat-icon stat-icon-purple">
              <Users size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{allCustomers.length}</div>
              <div className="stat-label">Total Customers</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-icon-green">
              <UserCheck size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{activeTodayCount}</div>
              <div className="stat-label">Active Today</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-icon-orange">
              <Star size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{totalLoyaltyPoints.toLocaleString()}</div>
              <div className="stat-label">Loyalty Points Issued</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon stat-icon-pink">
              <Gift size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{birthdayThisMonth.length}</div>
              <div className="stat-label">Birthdays This Month</div>
            </div>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="search-filter-bar">
          <input
            type="text"
            className="search-input"
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="filter-buttons" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All ({allCustomers.length})
            </button>
            <button
              className={`filter-btn ${filter === 'vvip' ? 'active' : ''}`}
              onClick={() => setFilter('vvip')}
              style={filter === 'vvip' ? { background: '#eab308', color: '#713f12', border: '1px solid #ca8a04' } : {}}
            >
              👑 VVIP ({vvipCount})
            </button>
            <button
              className={`filter-btn ${filter === 'vip' ? 'active' : ''}`}
              onClick={() => setFilter('vip')}
              style={filter === 'vip' ? { background: '#9333ea', color: 'white', border: '1px solid #7e22ce' } : {}}
            >
              💎 VIP ({vipCount})
            </button>
            <button
              className={`filter-btn ${filter === 'regular' ? 'active' : ''}`}
              onClick={() => setFilter('regular')}
            >
              ⭐ Regular ({regularCount})
            </button>
            <button
              className={`filter-btn ${filter === 'new' ? 'active' : ''}`}
              onClick={() => setFilter('new')}
            >
              🌱 New ({newCount})
            </button>
          </div>
        </div>

        {/* Customers Table */}
        {loading ? (
          <div className="customers-table-container">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton-row">
                <div className="skeleton-item" style={{ width: '20px' }} />
                <div className="skeleton-item" />
                <div className="skeleton-item" />
                <div className="skeleton-item" />
                <div className="skeleton-item" />
                <div className="skeleton-item" />
                <div className="skeleton-item" />
                <div className="skeleton-item" />
              </div>
            ))}
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <h3 className="empty-state-title">No Customers Found</h3>
            <p className="empty-state-message">
              {allCustomers.length === 0 ? 'Add your first customer to get started!' : 'Try adjusting your search or filters.'}
            </p>
          </div>
        ) : (
          <div className="customers-table-container">
            <table className="customers-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>
                    <input type="checkbox" className="checkbox" />
                  </th>
                  <th style={{ width: '50px' }}></th>
                  <th>Customer & Tier</th>
                  <th>Email</th>
                  <th>Birthday</th>
                  <th>Loyalty Points</th>
                  <th>Total Spent</th>
                  <th>Visits</th>
                  <th style={{ width: '180px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map(customer => {
                  const tInfo = getTierInfo(customer.tier || 'New')
                  const hasBirthdayThisMonth = birthdayThisMonth.some(c => c.id === customer.id)
                  const formattedBirthday = customer.date_of_birth
                    ? fmtDayMonth(new Date(customer.date_of_birth))
                    : '—'

                  return (
                    <tr key={customer.id} className={hasBirthdayThisMonth ? 'birthday-row' : ''}>
                      <td>
                        <input type="checkbox" className="checkbox" />
                      </td>
                      <td>
                        <div className={`customer-avatar ${customer.tier === 'VIP' || customer.tier === 'VVIP' ? 'vip' : ''}`}>
                          {(customer.tier === 'VIP' || customer.tier === 'VVIP') && <div className="vip-crown">{tInfo.icon}</div>}
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                      </td>
                      <td>
                        <div className="customer-info">
                          <div className="customer-name" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {customer.name}
                            <span style={{
                              background: tInfo.badgeBg, color: tInfo.badgeText,
                              border: `1px solid ${tInfo.borderColor}`, fontSize: '10px',
                              padding: '1px 6px', borderRadius: '99px', fontWeight: 700,
                              display: 'inline-flex', alignItems: 'center', gap: '2px'
                            }}>
                              {tInfo.icon} {tInfo.label}
                            </span>
                          </div>
                          <div className="customer-phone">{customer.phone}</div>
                        </div>
                      </td>
                      <td>
                        <div className="customer-email">{customer.email || '—'}</div>
                      </td>
                      <td>
                        {hasBirthdayThisMonth ? (
                          <div className="birthday-badge">
                            🎂 {formattedBirthday}
                          </div>
                        ) : (
                          formattedBirthday
                        )}
                      </td>
                      <td>
                        <div className="loyalty-badge">
                          <Star size={12} />
                          {customer.loyalty_points}
                        </div>
                      </td>
                      <td>
                        <div className="amount-spent">{formatCurrency(customer.total_spent)}</div>
                      </td>
                      <td>
                        <div className="last-visit">{customer.bills_count || 0} visits</div>
                      </td>
                      <td>
                        <div className="action-buttons" style={{ display: 'flex', gap: '4px' }}>
                          <button
                            className="btn-outline"
                            onClick={() => { setHistoryCustomer(customer); setShowHistoryModal(true); }}
                            style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 600, color: '#9333ea', display: 'flex', alignItems: 'center', gap: '4px' }}
                            title="360° Customer Ledger & History">
                            <History size={12} /> History
                          </button>
                          <button className="icon-btn" onClick={() => handleEditCustomer(customer)} title="Edit">
                            ✏️
                          </button>
                          <button className="icon-btn" onClick={() => handleDeleteCustomer(customer.id)} title="Delete">
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Customer Modal */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</h2>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
            </div>

            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Enter customer name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone *</label>
              <input
                type="tel"
                className="form-input"
                placeholder="Enter phone number"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="Enter email address"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Birthday</label>
              <input
                type="date"
                className="form-input"
                value={formData.date_of_birth}
                onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Address</label>
              <textarea
                className="form-textarea"
                placeholder="Enter address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                className="form-textarea"
                placeholder="Add any notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            <div className="form-buttons">
              <button className="btn-save" onClick={handleSaveCustomer}>
                {editingCustomer ? 'Update Customer' : 'Add Customer'}
              </button>
              <button className="btn-cancel" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Detail Panel */}
      {showDetailPanel && selectedCustomer && (
        <div className="modal-backdrop" onClick={() => setShowDetailPanel(false)}>
          <div className="modal" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div className="panel-header">
                <div className={`large-avatar ${selectedCustomer.total_spent > 10000 ? 'vip' : ''}`}>
                  {selectedCustomer.total_spent > 10000 && <div className="large-vip-crown">👑</div>}
                  {selectedCustomer.name.charAt(0).toUpperCase()}
                </div>
                <div className="panel-info">
                  <h2 className="panel-name">{selectedCustomer.name}</h2>
                  <p className="panel-contact">📱 {selectedCustomer.phone}</p>
                  {selectedCustomer.email && <p className="panel-contact">📧 {selectedCustomer.email}</p>}
                  <p className="panel-member-since">
                    Member since {fmtDate(new Date(selectedCustomer.created_at))}
                  </p>
                </div>
              </div>
              <button className="modal-close" onClick={() => setShowDetailPanel(false)}>×</button>
            </div>

            {/* Stats Row */}
            <div className="stats-row">
              <div className="mini-stat">
                <p className="mini-stat-value">{selectedCustomer.loyalty_points}</p>
                <p className="mini-stat-label">Loyalty Points</p>
              </div>
              <div className="mini-stat">
                <p className="mini-stat-value">{formatCurrency(selectedCustomer.total_spent)}</p>
                <p className="mini-stat-label">Total Spent</p>
              </div>
              <div className="mini-stat">
                <p className="mini-stat-value">{customerPurchases.length}</p>
                <p className="mini-stat-label">Orders</p>
              </div>
            </div>

            {/* Loyalty Section */}
            <h3 className="section-title">Loyalty Program</h3>
            <div className="loyalty-info">
              <p className="loyalty-balance">Current Balance</p>
              <p className="loyalty-value">{selectedCustomer.loyalty_points} Points</p>
              <p className="loyalty-balance">Value: {formatCurrency(selectedCustomer.loyalty_points * 0.25)}</p>
              <div style={{ marginTop: '12px' }}>
                <span className={`tier-badge ${getLoyaltyTier(selectedCustomer.loyalty_points).className}`}>
                  {getLoyaltyTier(selectedCustomer.loyalty_points).name}
                </span>
              </div>
            </div>

            {/* Purchase History */}
            <h3 className="section-title">Recent Purchases</h3>
            {purchasesLoading ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
                Loading purchases...
              </div>
            ) : customerPurchases.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
                No purchases yet
              </div>
            ) : (
              <div style={{ border: '1px solid #f3e8ff', borderRadius: '8px', overflow: 'hidden', marginBottom: '24px' }}>
                {customerPurchases.map(purchase => (
                  <div key={purchase.id} className="purchase-row">
                    <div className="purchase-invoice">{purchase.invoice_number}</div>
                    <div className="purchase-date">
                      {fmtDate(new Date(purchase.created_at))}
                    </div>
                    <div className="purchase-amount">{formatCurrency(purchase.total_amount)}</div>
                    <div className="purchase-method">{purchase.payment_method}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Quick Actions */}
            <div className="quick-actions">
              <button
                className="btn-whatsapp"
                onClick={() => sendBirthdayWhatsApp(selectedCustomer)}
              >
                <MessageCircle size={14} style={{ marginRight: '4px' }} />
                Send WhatsApp
              </button>
              <button
                className="btn-add-points"
                onClick={() => setShowAddPointsModal(true)}
              >
                <Heart size={14} style={{ marginRight: '4px' }} />
                Add Points
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Loyalty Points Modal */}
      {showAddPointsModal && selectedCustomer && (
        <div className="modal-backdrop" onClick={() => setShowAddPointsModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Loyalty Points</h2>
              <button className="modal-close" onClick={() => setShowAddPointsModal(false)}>×</button>
            </div>

            <div className="form-group">
              <label className="form-label">Number of Points</label>
              <input
                type="number"
                className="form-input"
                min="1"
                value={pointsToAdd}
                onChange={(e) => setPointsToAdd(parseInt(e.target.value) || 0)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Reason</label>
              <textarea
                className="form-textarea"
                placeholder="e.g., Purchase reward, Referral bonus, Special promotion"
                value={pointsReason}
                onChange={(e) => setPointsReason(e.target.value)}
              />
            </div>

            <div className="form-buttons">
              <button className="btn-save" onClick={handleAddPoints}>
                Add {pointsToAdd} Points
              </button>
              <button className="btn-cancel" onClick={() => setShowAddPointsModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 360 Customer History Modal */}
      {showHistoryModal && historyCustomer && (
        <CustomerHistoryModal
          customer={historyCustomer}
          onClose={() => { setShowHistoryModal(false); setHistoryCustomer(null); }}
        />
      )}
    </Layout>
  )
}

export function CustomersPage() {
  return <CustomersPageComponent />
}
