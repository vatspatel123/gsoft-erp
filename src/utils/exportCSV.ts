export function exportToCSV(
  data: any[],
  filename: string,
  columns: { key: string; label: string }[]
) {
  if (data.length === 0) {
    alert('No data to export')
    return
  }

  const headers = columns.map(c => c.label).join(',')
  const rows = data.map(row =>
    columns
      .map(col => {
        const val = row[col.key] ?? ''
        const str = String(val)
        return str.includes(',') ? '"' + str + '"' : str
      })
      .join(',')
  )

  const csv = [headers, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download =
    filename +
    '_' +
    new Date().toISOString().slice(0, 10) +
    '.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
