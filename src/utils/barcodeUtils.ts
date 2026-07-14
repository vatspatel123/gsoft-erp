export function generateBarcode(product: {
  id?: string
  sku?: string
  batch_no?: string
  design_no?: string
  pcode?: string
}): string {
  const timestamp = Date.now().toString().slice(-6)

  if (product.batch_no && /^\d+$/.test(product.batch_no)) {
    return product.batch_no.padStart(8, '0')
  }

  if (product.sku && product.sku.startsWith('SKU-')) {
    return product.sku.replace(/\D/g, '').padStart(8, '0')
  }

  return timestamp + Math.floor(Math.random() * 100).toString().padStart(2, '0')
}

export function generateBatchNo(): string {
  const seq = Math.floor(10000 + Math.random() * 90000)
  return `${seq}`
}

export function isValidBarcode(code: string): boolean {
  return /^\d{6,13}$/.test(code)
}
