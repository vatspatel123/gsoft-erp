export const ROLES = [
  {
    value: 'owner',
    label: 'Owner',
    color: '#9333ea',
    bg: '#f5f3ff'
  },
  {
    value: 'senior_cashier',
    label: 'Sr. Cashier',
    color: '#2563eb',
    bg: '#eff6ff'
  },
  {
    value: 'cashier',
    label: 'Cashier',
    color: '#16a34a',
    bg: '#f0fdf4'
  },
  {
    value: 'salesperson',
    label: 'Salesperson',
    color: '#f97316',
    bg: '#fff7ed'
  }
];

export const getRoleStyle = (role: string) => {
  const found = ROLES.find((item) => item.value === role);
  if (found) return found;
  return {
    color: '#64748b',
    bg: '#f1f5f9',
    label: role || 'Staff'
  };
};

export function RoleBadge({ role }: { role: string }) {
  const style = getRoleStyle(role);
  return (
    <span
      style={{
        background: style.bg,
        color: style.color,
        padding: '3px 10px',
        borderRadius: '99px',
        fontSize: '11px',
        fontWeight: '500',
        fontFamily: 'DM Sans, sans-serif',
        display: 'inline-flex',
        alignItems: 'center'
      }}
    >
      {style.label}
    </span>
  );
}
