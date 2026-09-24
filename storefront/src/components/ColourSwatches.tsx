export function ColourSwatches({
  colours, selected, onSelect
}: {
  colours: string[]
  selected: string | null
  onSelect: (colour: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 11 }}>
      {colours.map(colour => (
        <button
          key={colour}
          type="button"
          onClick={() => onSelect(colour)}
          aria-label={colour}
          title={colour}
          style={{
            padding: '6px 14px', borderRadius: 999, cursor: 'pointer',
            border: `1.5px solid ${selected === colour ? 'var(--pink)' : 'rgba(51,59,71,.2)'}`,
            background: selected === colour ? 'var(--blush)' : '#fff',
            color: 'var(--navy)', fontSize: 13
          }}
        >{colour}</button>
      ))}
    </div>
  )
}
