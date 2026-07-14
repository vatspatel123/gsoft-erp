import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { Plus, Edit3, Trash2 } from 'lucide-react';
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

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, role, is_active')
        .order('name', { ascending: true });
      if (error) throw error;
      if (data) {
        setStaff(data as StaffUser[]);
      }
    } catch (e: any) {
      toast.error('Failed to load staff');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
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

    const payload = {
      name: name.trim(),
      email: email.trim(),
      role,
      is_active: isActive
    };

    try {
      if (editing) {
        const { error } = await supabase
          .from('users')
          .update(payload)
          .eq('id', editing.id);
        if (error) throw error;
        toast.success('Staff updated');
      } else {
        const { error } = await supabase
          .from('users')
          .insert(payload);
        if (error) throw error;
        toast.success('Staff added');
      }
      setShowModal(false);
      fetchStaff();
      resetForm();
    } catch (e: any) {
      toast.error(e?.message || 'Save failed');
      console.error(e);
    }
  };

  const deleteUser = async (id: string) => {
    if (!confirm('Delete this staff member?')) return;
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Staff deleted');
      fetchStaff();
    } catch (e: any) {
      toast.error('Delete failed');
      console.error(e);
    }
  };

  const toggleActive = async (user: StaffUser) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: !user.is_active })
        .eq('id', user.id);
      if (error) throw error;
      setStaff((s) => s.map((u) => u.id === user.id ? { ...u, is_active: !u.is_active } : u));
    } catch (e: any) {
      toast.error('Status update failed');
      console.error(e);
    }
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
          <div style={{ display: 'grid', gridTemplateColumns: '80px 2fr 2fr 1fr 1fr 110px', padding: '12px', borderBottom: '1px solid #f3e8ff', fontWeight: 700, color: '#6b7280', fontSize: '12px' }}>
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
                <div key={user.id} style={{ display: 'grid', gridTemplateColumns: '80px 2fr 2fr 1fr 1fr 110px', padding: '12px', alignItems: 'center', borderBottom: '1px solid #f3e8ff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#c4b5d4', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{user.name.charAt(0).toUpperCase()}</div>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a0a2e' }}>{user.name}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>{user.email}</div>
                  <div><RoleBadge role={user.role} /></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }} onClick={() => toggleActive(user)}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: user.is_active ? '#16a34a' : '#9ca3af' }} />
                    <span style={{ fontSize: '12px', color: user.is_active ? '#16a34a' : '#6b7280' }}>{user.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => openEdit(user)} style={{ border: '1px solid #e5e7eb', background: 'white', padding: '6px 8px', borderRadius: '8px', cursor: 'pointer' }}><Edit3 size={14} /></button>
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

    </Layout>
  );
}
