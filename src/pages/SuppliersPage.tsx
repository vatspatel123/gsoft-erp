import { Layout } from '../components/shared/Layout';

export function SuppliersPage() {
  return (
    <Layout>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '40px', backgroundColor: 'var(--bg-page)' }}>
        <div style={{ backgroundColor: '#ffffff', border: '1px solid #c084fc', borderRadius: '16px', padding: '60px', textAlign: 'center', boxShadow: '0 4px 16px rgba(147,51,234,0.10)' }}>
          <h1 style={{ color: '#1a0a2e', fontSize: '2rem', marginBottom: '16px', fontFamily: "'Playfair Display', serif" }}>Suppliers</h1>
          <p style={{ color: '#64748b', fontSize: '1.1rem' }}>Coming soon — under construction</p>
        </div>
      </div>
    </Layout>
  );
}
