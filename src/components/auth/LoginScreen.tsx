import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

// The shop signs in with one store email. It is remembered on this PC after the
// first sign-in, so from then on only the password is typed.
const EMAIL_KEY = 'gsoft_login_email'
const savedEmail = () => { try { return localStorage.getItem(EMAIL_KEY) || '' } catch { return '' } }

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 16px', borderRadius: '12px',
  border: '1px solid #e2e8f0', outline: 'none', fontSize: '14px',
  fontFamily: 'inherit', boxSizing: 'border-box'
}
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }
const linkStyle: React.CSSProperties = { background: 'none', border: 'none', color: '#9333ea', fontSize: '13px', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }

export function LoginScreen() {
  const [email, setEmail] = useState(savedEmail)
  const [editEmail, setEditEmail] = useState(!savedEmail())
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  // Forgot password: 'send' asks for the code, 'reset' takes the code and the new password.
  const [mode, setMode] = useState<'login' | 'send' | 'reset'>('login')
  const [code, setCode] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      toast.error(error.message === 'Invalid login credentials' ? 'Wrong password' : error.message)
    } else {
      try { localStorage.setItem(EMAIL_KEY, email.trim()) } catch { /* only a convenience */ }
      toast.success('Login successful!')
    }
    setLoading(false)
  }

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim())
    setLoading(false)
    if (error) return toast.error(error.message)
    toast.success(`A reset code was sent to ${email.trim()}`)
    setMode('reset')
  }

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) return toast.error('Password must be at least 6 characters')
    setLoading(true)
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'recovery' })
    if (error) { setLoading(false); return toast.error('Wrong or expired code') }
    // verifyOtp has signed this PC in; set the new password on that login.
    const { error: upErr } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (upErr) return toast.error(upErr.message)
    try { localStorage.setItem(EMAIL_KEY, email.trim()) } catch { /* only a convenience */ }
    toast.success('Password changed. You are signed in.')
  }

  const emailField = editEmail ? (
    <div>
      <label style={labelStyle}>Email Address</label>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
        style={inputStyle} placeholder="store@example.com" />
    </div>
  ) : (
    <div style={{ fontSize: '13px', color: '#475569', textAlign: 'center' }}>
      Signing in as <b>{email}</b>{' '}
      <button type="button" style={linkStyle} onClick={() => setEditEmail(true)}>Change</button>
    </div>
  )

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
            {mode === 'login' ? 'Sign in to your store account' : 'Reset your password'}
          </p>
        </div>

        <form onSubmit={mode === 'login' ? handleLogin : mode === 'send' ? sendCode : resetPassword}
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {emailField}

          {mode === 'reset' && (
            <div>
              <label style={labelStyle}>Code from the email</label>
              <input value={code} onChange={e => setCode(e.target.value)} required autoFocus
                inputMode="numeric" style={inputStyle} placeholder="123456" />
            </div>
          )}

          {mode !== 'send' && (
            <div>
              <label style={labelStyle}>{mode === 'reset' ? 'New password' : 'Password'}</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                autoFocus={mode === 'login' && !editEmail} style={inputStyle} placeholder="••••••••" />
            </div>
          )}

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
            {loading ? 'Please wait...'
              : mode === 'login' ? 'Sign In' : mode === 'send' ? 'Send reset code' : 'Set new password'}
          </button>

          <div style={{ textAlign: 'center' }}>
            {mode === 'login'
              ? <button type="button" style={linkStyle} onClick={() => { setMode('send'); setPassword('') }}>Forgot password?</button>
              : <button type="button" style={linkStyle} onClick={() => { setMode('login'); setPassword(''); setCode('') }}>Back to sign in</button>}
          </div>
        </form>
      </div>
    </div>
  )
}
