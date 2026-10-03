import React from 'react'
import type { Product } from '../../hooks/usePOS'
import { colourToCSS } from '../../utils/design'
import { fmtDate } from '../../utils/date'

interface Props {
  scannedProduct: Product
  olderProduct: Product
  onSwap: () => void
  onKeep: () => void
  onCancel: () => void
}

export function OldLotAlertModal({
  scannedProduct,
  olderProduct,
  onSwap,
  onKeep,
  onCancel
}: Props) {
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A'
    try {
      return fmtDate(new Date(dateStr))
    } catch {
      return dateStr
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(26, 10, 46, 0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '20px',
          padding: '28px',
          maxWidth: '540px',
          width: '100%',
          boxShadow: '0 20px 40px rgba(147, 51, 234, 0.2)',
          border: '1px solid #f3e8ff',
          animation: 'fadeIn 0.2s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Warning Icon & Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: '#fef3c7',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              fontWeight: '700',
              flexShrink: 0
            }}
          >
            ⚠️
          </div>
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: '700',
                color: '#1a0a2e',
                fontFamily: 'DM Sans, sans-serif'
              }}
            >
              Older Inventory Lot Available!
            </h3>
            <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: '#64748b' }}>
              An older piece from an earlier batch/lot is still in stock. It is recommended to sell old stock first (FIFO).
            </p>
          </div>
        </div>

        {/* Comparison Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', margin: '20px 0' }}>
          {/* Older Product (Recommended) */}
          <div
            style={{
              background: '#fdf8ff',
              border: '2px solid #a855f7',
              borderRadius: '14px',
              padding: '14px 16px',
              position: 'relative'
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '-10px',
                right: '16px',
                background: '#9333ea',
                color: 'white',
                fontSize: '10px',
                fontWeight: '700',
                padding: '2px 10px',
                borderRadius: '99px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase'
              }}
            >
              ⭐ Recommended (Older Stock)
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#1a0a2e' }}>
                  {olderProduct.name}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px', fontSize: '12px', color: '#64748b' }}>
                  <span>SKU: <strong style={{ color: '#1a0a2e' }}>{olderProduct.sku}</strong></span>
                  {olderProduct.batch_no && <span>• Batch: <strong style={{ color: '#9333ea' }}>{olderProduct.batch_no}</strong></span>}
                </div>
                {(olderProduct.size || olderProduct.colour) && (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '6px' }}>
                    {olderProduct.size && (
                      <span style={{ background: '#f5f3ff', color: '#9333ea', padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
                        Size: {olderProduct.size}
                      </span>
                    )}
                    {olderProduct.colour && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f5f3ff', color: '#64748b', padding: '2px 8px', borderRadius: '6px', fontSize: '11px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: colourToCSS(olderProduct.colour) }} />
                        {olderProduct.colour}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#9333ea', fontFamily: 'DM Mono, monospace' }}>
                  ₹{olderProduct.unit_price.toFixed(0)}
                </div>
                <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: '600', marginTop: '2px' }}>
                  Stock: {olderProduct.stock_qty} pcs
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  Created: {formatDate(olderProduct.created_at)}
                </div>
              </div>
            </div>
          </div>

          {/* Scanned Product (Newer Lot) */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '14px 16px',
              opacity: 0.85
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>
              Scanned Item (Newer Lot)
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>
                  {scannedProduct.name}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px', fontSize: '11px', color: '#64748b' }}>
                  <span>SKU: {scannedProduct.sku}</span>
                  {scannedProduct.batch_no && <span>• Batch: {scannedProduct.batch_no}</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#475569', fontFamily: 'DM Mono, monospace' }}>
                  ₹{scannedProduct.unit_price.toFixed(0)}
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  Created: {formatDate(scannedProduct.created_at)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
          <button
            onClick={onSwap}
            style={{
              flex: 2,
              background: 'linear-gradient(135deg, #9333ea 0%, #7e22ce 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '12px 16px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif',
              boxShadow: '0 4px 12px rgba(147, 51, 234, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            ✓ Yes, Sell Old Piece First
          </button>
          <button
            onClick={onKeep}
            style={{
              flex: 1.2,
              background: 'white',
              color: '#475569',
              border: '1px solid #cbd5e1',
              borderRadius: '12px',
              padding: '12px 12px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif'
            }}
          >
            No, Sell Scanned
          </button>
          <button
            onClick={onCancel}
            style={{
              flex: 0.8,
              background: '#f1f5f9',
              color: '#64748b',
              border: 'none',
              borderRadius: '12px',
              padding: '12px 12px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif'
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
