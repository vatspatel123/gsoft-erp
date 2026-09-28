import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { saveSalesmenToCache, getCachedSalesmen } from '../utils/offlineCache';
import toast from 'react-hot-toast';
import { Plus, Edit3, Trash2, KeyRound } from 'lucide-react';
import { setStaffPassword, staffWithPassword } from '../utils/billEdits';
import { Layout } from '../components/shared/Layout';
import { RoleBadge } from '../components/shared/RoleBadge';

type StaffUser = {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'senior_cashier' | 'cashier' | 'salesperson';
  is_active: boolean;
};

export function StaffPage() {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'owner' | 'senior_cashier' | 'cashier' | 'salesperson'>('cashier');
  const [isActive, setIsActive] = useState(true);

  // Staff passwords: used to approve sensitive changes such as the salesman on a
  // bill. Stored hashed in the database; this screen can set them, never read them.
  const [withPw, setWithPw] = useState<Set<string>>(new Set());
  const [pwFor, setPwFor] = useState<StaffUser | null>(null);
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [ownerLogin, setOwnerLogin] = useState('');
  const [ownerPw, setOwnerPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const ownerHasPw = staff.some(u => u.role === 'owner' && withPw.has(u.id));

  const openPassword = (user: StaffUser) => {
    setPwFor(user); setNewPw(''); setNewPw2(''); setOwnerLogin(''); setOwnerPw('');
  };

  const savePassword = async () => {
    if (!pwFor) return;
    if (newPw.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (newPw !== newPw2) { toast.error('The two passwords do not match'); return; }
    if (ownerHasPw && (!ownerLogin.trim() || !ownerPw)) { toast.error("Enter an owner's ID and password to approve this"); return; }
    setSavingPw(true);
    const res = await setStaffPassword(pwFor.id, newPw, ownerHasPw ? { login: ownerLogin.trim(), password: ownerPw } : undefined);
    setSavingPw(false);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success(`Password set for ${pwFor.name}`);
    setWithPw(prev => new Set(prev).add(pwFor.id));
    setPwFor(null);
  };

  const fetchStaff = async () => {
    setLoading(true);
    try {
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('users')
          .select('id, name, email, role, is_active')
          .order('name', { ascending: true });
        if (!error && data && data.length > 0) {
          setStaff(data as StaffUser[]);
          saveSalesmenToCache(data);
          setLoading(false);
          return;
        }
      }
    } catch (e: any) {
      console.warn('Network error loading staff, using cache:', e);
    }
    const cached = getCachedSalesmen() || [];
    setStaff(cached as StaffUser[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchStaff();
    staffWithPassword().then(setWithPw);
  }, []);

  const resetForm = () => {
    setName('');
    setEmail('');
    setRole('cashier');
    setIsActive(true);
    setEditing(null);
  };

  const openAdd = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (user: StaffUser) => {
    setEditing(user);
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
    setIsActive(user.is_active);
    setShowModal(true);
  };

  const saveUser = async () => {
    if (!name.trim() || !email.trim()) {
      toast.error('Full Name and Email are required');
      return;
    }

    const userId = editing ? editing.id : crypto.randomUUID();
    const payload: StaffUser = {
      id: userId,
      name: name.trim(),
      email: email.trim(),
      role,
      is_active: isActive
    };

    if (navigator.onLine) {
      try {
        if (editing) {
          const { error } = await supabase
            .from('users')
            .update({ name: payload.name, email: payload.email, role: payload.role, is_active: payload.is_active })
            .eq('id', editing.id);
          if (error) console.warn('DB update user warning:', error.message);
        } else {
          const { error } = await supabase
            .from('users')
            .insert({ id: payload.id, name: payload.name, email: payload.email, role: payload.role, is_active: payload.is_active });
          if (error) console.warn('DB insert user warning:', error.message);
        }
      } catch (dbErr) {
        console.warn('DB user save notice, saving locally:', dbErr);
      }
    }

    const newStaff = editing ? staff.map(u => u.id === editing.id ? payload : u) : [payload, ...staff];
    saveSalesmenToCache(newStaff);
    setStaff(newStaff);

    toast.success(editing ? 'Staff updated' : 'Staff added');
    setShowModal(false);
    resetForm();
  };

  const deleteUser = async (id: string) => {
    if (!confirm('Delete this staff member?')) return;
    if (navigator.onLine) {
      try {
        const { error } = await supabase
          .from('users')
          .delete()
          .eq('id', id);
        if (error) console.warn('DB delete user warning:', error.message);
      } catch (e: any) {
        console.warn('Network error deleting user:', e);
      }
    }
    const cached = getCachedSalesmen() || [];
    const updated = cached.filter((u: any) => u.id !== id);
    saveSalesmenToCache(updated);
    setStaff(prev => prev.filter(u => u.id !== id));
    toast.success('Staff deleted');
  };

  const toggleActive = async (user: StaffUser) => {
    const updatedUser = { ...user, is_active: !user.is_active };
    if (navigator.onLine) {
      try {
        const { error } = await supabase
          .from('users')
          .update({ is_active: updatedUser.is_active })
          .eq('id', user.id);
        if (error) console.warn('DB update status warning:', error.message);
      } catch (e: any) {
        console.warn('Network error updating status:', e);
      }
    }
    const newStaff = staff.map((u) => u.id === user.id ? updatedUser : u);
    saveSalesmenToCache(newStaff);
    setStaff(newStaff);
  };

  return (
    <Layout>
      <div style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>Staff Management</h1>
          <button onClick={openAdd} style={{ background: '#9333ea', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, cursor: 'pointer' }}>
            <Plus size={14} /> Add Staff
          </button>
        </div>

        <div style={{ background: 'white', border: '1px solid #f3e8ff', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 2fr 2fr 1fr 1fr 150px', padding: '12px', borderBottom: '1px solid #f3e8ff', fontWeight: 700, color: '#6b7280', fontSize: '12px' }}>
            <div>Avatar</div>
            <div>Name</div>
            <div>Email</div>
            <div>Role</div>
            <div>Status</div>
            <div>Actions</div>
          </div>

          {loading ? (
            <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>
          ) : staff.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No staff members found.</div>
          ) : (
            staff.map((user) => {
              return (
                <div key={user.id} style={{ display: 'grid', gridTemplateColumns: '80px 2fr 2fr 1fr 1fr 150px', padding: '12px', alignItems: 'center', borderBottom: '1px solid #f3e8ff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#c4b5d4', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{user.name.charAt(0).toUpperCase()}</div>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a0a2e' }}>{user.name}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    {user.email}
                    <div style={{ fontSize: '11px', marginTop: '2px', color: withPw.has(user.id) ? '#16a34a' : '#94a3b8' }}>
                      {withPw.has(user.id) ? '🔑 Password set' : 'No password yet'}
                    </div>
                  </div>
                  <div><RoleBadge role={user.role} /></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }} onClick={() => toggleActive(user)}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: user.is_active ? '#16a34a' : '#9ca3af' }} />
                    <span style={{ fontSize: '12px', color: user.is_active ? '#16a34a' : '#6b7280' }}>{user.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => openEdit(user)} style={{ border: '1px solid #e5e7eb', background: 'white', padding: '6px 8px', borderRadius: '8px', cursor: 'pointer' }}><Edit3 size={14} /></button>
                    <button onClick={() => openPassword(user)} title="Set password" style={{ border: '1px solid #e9d5ff', background: '#faf5ff', color: '#7c3aed', padding: '6px 8px', borderRadius: '8px', cursor: 'pointer' }}><KeyRound size={14} /></button>
                    <button onClick={() => deleteUser(user.id)} style={{ border: '1px solid #fee2e2', background: '#fef2f2', color: '#b91c1c', padding: '6px 8px', borderRadius: '8px', cursor: 'pointer' }}><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.35)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '460px', background: 'white', borderRadius: '12px', padding: '20px' }}>
            <h2 style={{ margin: '0 0 14px', fontSize: '20px', fontWeight: 700 }}>{editing ? 'Edit Staff' : 'Add Staff'}</h2>
            <div style={{ display: 'grid', gap: '12px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500 }}>Full Name</label>
              <input value={name} onChange={e => setName(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb' }} />
              <label style={{ fontSize: '13px', fontWeight: 500 }}>Email</label>
              <input value={email} onChange={e => setEmail(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb' }} />
              <label style={{ fontSize: '13px', fontWeight: 500 }}>Role</label>
              <select value={role} onChange={e => setRole(e.target.value as any)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                <option value="owner">Owner</option>
                <option value="senior_cashier">Senior Cashier</option>
                <option value="cashier">Cashier</option>
                <option value="salesperson">Salesperson</option>
              </select>
              <label style={{ fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input type="checkbox" checked={isActive} onChange={() => setIsActive(p => !p)} /> Active
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button onClick={() => { setShowModal(false); resetForm(); }} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white' }}>Cancel</button>
                <button onClick={saveUser} style={{ padding: '10px 14px', borderRadius: '8px', border: 'none', background: '#9333ea', color: 'white'}}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}


      {pwFor && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.35)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '440px', background: 'white', borderRadius: '12px', padding: '20px' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700 }}>
              {withPw.has(pwFor.id) ? 'Change' : 'Set'} password — {pwFor.name}
            </h2>
            <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: '#6b7280', lineHeight: 1.5 }}>
              {pwFor.name} signs in to approvals with their ID <b>{pwFor.email}</b> and this password — for example,
              to change the salesman on a bill.
            </p>
            <div style={{ display: 'grid', gap: '10px' }}>
              <input type="password" placeholder="New password (6+ characters)" autoComplete="new-password" value={newPw}
                onChange={e => setNewPw(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb' }} />
              <input type="password" placeholder="Type it again" autoComplete="new-password" value={newPw2}
                onChange={e => setNewPw2(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb' }} />

              {ownerHasPw ? (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '10px', display: 'grid', gap: '8px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#92400e' }}>Owner approval</div>
                  <input placeholder="Owner ID (email)" autoComplete="off" value={ownerLogin}
                    onChange={e => setOwnerLogin(e.target.value)} style={{ padding: '9px', borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                  <input type="password" placeholder="Owner password" autoComplete="off" value={ownerPw}
                    onChange={e => setOwnerPw(e.target.value)} style={{ padding: '9px', borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: '#92400e', background: '#fffbeb', borderRadius: '10px', padding: '10px' }}>
                  First set a password for an <b>owner</b>. After that, setting anyone's password needs an owner's ID and password.
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
                <button onClick={() => setPwFor(null)} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'white' }}>Cancel</button>
                <button onClick={savePassword} disabled={savingPw} style={{ padding: '10px 14px', borderRadius: '8px', border: 'none', background: '#9333ea', color: 'white' }}>
                  {savingPw ? 'Saving…' : 'Save password'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </Layout>
  );
}
