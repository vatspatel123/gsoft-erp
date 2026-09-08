import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

export function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Login successful!')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f8fafc'
    }}>
      <div style={{
        background: 'white',
        padding: '40px',
        borderRadius: '24px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.05)',
        width: '100%',
        maxWidth: '400px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ 
            width: '64px', height: '64px', background: '#9333ea', 
            borderRadius: '16px', display: 'flex', alignItems: 'center', 
            justifyContent: 'center', margin: '0 auto 16px',
            color: 'white', fontSize: '24px', fontWeight: 'bold'
          }}>
            R
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', margin: '0 0 8px' }}>
            Retail ERP
          </h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
            Sign in to your store account
          </p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
              Email Address
            </label>
            <input 
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{
                width: '100%', padding: '12px 16px', borderRadius: '12px',
                border: '1px solid #e2e8f0', outline: 'none', fontSize: '14px',
                fontFamily: 'inherit'
              }}
              placeholder="store@example.com"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>
              Password
            </label>
            <input 
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{
                width: '100%', padding: '12px 16px', borderRadius: '12px',
                border: '1px solid #e2e8f0', outline: 'none', fontSize: '14px',
                fontFamily: 'inherit'
              }}
              placeholder="••••••••"
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            style={{
              marginTop: '8px', padding: '14px', background: '#9333ea',
              color: 'white', border: 'none', borderRadius: '12px',
              fontSize: '15px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1, transition: 'all 0.2s'
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
