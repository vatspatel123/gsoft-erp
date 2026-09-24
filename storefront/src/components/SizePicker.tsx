export function SizePicker({
  sizes, availableSizes, selected, onSelect
}: {
  sizes: string[]
  availableSizes: string[]
  selected: string | null
  onSelect: (size: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9 }}>
      {sizes.map(size => {
        const disabled = !availableSizes.includes(size)
        const active = selected === size
        return (
          <button
            key={size}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(size)}
            style={{
              border: `1px solid ${active ? 'var(--navy)' : 'rgba(51,59,71,.2)'}`,
              background: active ? 'var(--navy)' : '#fff',
              color: disabled ? 'rgba(51,59,71,.3)' : active ? '#fff' : 'var(--navy)',
              fontSize: 14, minWidth: 56, height: 48, borderRadius: 10,
              cursor: disabled ? 'not-allowed' : 'pointer',
              textDecoration: disabled ? 'line-through' : 'none'
            }}
          >{size}</button>
        )
      })}
    </div>
  )
}
