async function test() {
  const r1 = await fetch('https://gsoft-retail-erp.surge.sh')
  console.log('ERP Status:', r1.status)
  const r2 = await fetch('https://gsoft-admin-panel.surge.sh')
  console.log('Admin Status:', r2.status)
}
test()
