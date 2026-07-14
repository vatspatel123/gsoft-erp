interface Props {
  barcode?: string
  onClose?: () => void
}

export function AddProductModal({ barcode, onClose }: Props) {
  return (
    <div style={{padding:'40px',
      textAlign:'center',
      color:'#9333ea',
      fontFamily:'DM Sans,sans-serif'}}>
      <h2>Coming Soon</h2>
      {barcode && (
        <p style={{fontSize:'13px', color:'#64748b', marginTop:'12px'}}>
          Barcode: {barcode}
        </p>
      )}
    </div>
  )
}
