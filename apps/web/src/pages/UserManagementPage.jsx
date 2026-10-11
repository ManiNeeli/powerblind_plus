import { useState, useId } from 'react';
import { UserPlus, Unlock, Trash2, Loader2, UserCog } from 'lucide-react';
import { useAuth }  from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useApi, useMutation } from '../hooks/useApi';
import { api } from '../lib/api';
import PageShell from '../components/layout/PageShell';
import { Badge, SkeletonRows, ErrorAlert, Modal, FormField, Input, EmptyState, Button } from '../components/ui/index.jsx';

export default function UserManagementPage() {
  const { user: me }       = useAuth();
  const { toastSuccess, toastError } = useToast();
  const { data, loading, error, refetch } = useApi('/api/users');
  const { mutate }         = useMutation();

  const [showModal, setShowModal] = useState(false);
  const [form,      setForm]      = useState({ email:'', password:'', role:'OPERATOR' });
  const [creating,  setCreating]  = useState(false);
  const [formErr,   setFormErr]   = useState('');

  const emailId = useId();
  const pwId    = useId();
  const roleId  = useId();

  const users = data?.users ?? [];

  const createUser = async () => {
    setFormErr(''); setCreating(true);
    try {
      await api.post('/api/users', form);
      setShowModal(false);
      setForm({ email:'', password:'', role:'OPERATOR' });
      toastSuccess(`User ${form.email} created.`);
      refetch();
    } catch (e) { setFormErr(e.message); }
    finally { setCreating(false); }
  };

  const changeRole = async (id, role) => {
    try {
      await mutate(() => api.patch(`/api/users/${id}/role`, { role }));
      toastSuccess('Role updated.'); refetch();
    } catch (e) { toastError(e.message); }
  };

  const unlock = async (id, email) => {
    try {
      await mutate(() => api.patch(`/api/users/${id}/unlock`, {}));
      toastSuccess(`${email} unlocked.`); refetch();
    } catch (e) { toastError(e.message); }
  };

  const deleteUser = async (id, email) => {
    if (!confirm(`Delete ${email}? This cannot be undone.`)) return;
    try {
      await mutate(() => api.delete(`/api/users/${id}`));
      toastSuccess(`User ${email} deleted.`); refetch();
    } catch (e) { toastError(e.message); }
  };

  return (
    <PageShell title="User Management" subtitle="Manage operator and admin accounts"
      actions={
        <button onClick={() => setShowModal(true)} aria-label="Add new user"
          className="flex items-center gap-2 px-3 py-2 rounded-md bg-accent/10 text-accent border border-accent/30 text-sm hover:bg-accent/20 transition-colors">
          <UserPlus className="w-4 h-4" aria-hidden /> Add User
        </button>
      }
    >
      <ErrorAlert message={error} className="mb-4" />

      <section aria-label="Users table" className="card overflow-hidden">
        <div className="overflow-x-auto table-responsive">
          <table className="data-table" aria-label="User accounts">
          <thead>
            <tr>
              <th scope="col">Email</th>
              <th scope="col">Role</th>
              <th scope="col">Status</th>
              <th scope="col" className="hidden sm:table-cell">Failed Logins</th>
              <th scope="col" className="hidden md:table-cell">Created</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? <SkeletonRows cols={[80,40,50,30,60,40]} rows={4} />
              : users.length === 0
                ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState icon={UserCog} title="No users yet" sub="Add an operator to get started." />
                    </td>
                  </tr>
                )
                : users.map(u => {
                    const isLocked = u.lockedUntil && new Date(u.lockedUntil) > new Date();
                    return (
                      <tr key={u.id}>
                        <td className="text-sm text-ink-primary">{u.email}</td>
                        <td>
                          <select value={u.role} disabled={u.id === me?.sub}
                            onChange={e => changeRole(u.id, e.target.value)}
                            aria-label={`Role for ${u.email}`}
                            className="bg-canvas border border-surface-border rounded px-2 py-1 text-xs text-ink-secondary outline-none focus:border-accent/60 disabled:opacity-50 transition-colors">
                            <option value="OPERATOR">OPERATOR</option>
                            <option value="ADMIN">ADMIN</option>
                          </select>
                        </td>
                        <td>
                          <Badge label={isLocked ? 'Locked' : 'Active'} />
                        </td>
                        <td className="text-xs font-mono text-ink-secondary hidden sm:table-cell">
                          {u.failedLoginCount ?? 0}
                        </td>
                        <td className="text-[10px] font-mono text-ink-muted hidden md:table-cell">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td>
                          <div className="flex gap-2 items-center">
                            {isLocked && (
                              <button onClick={() => unlock(u.id, u.email)}
                                aria-label={`Unlock account for ${u.email}`}
                                title="Unlock account"
                                className="text-amber-400 hover:text-amber-300 transition-colors p-1 rounded focus-visible:ring-1 focus-visible:ring-accent">
                                <Unlock className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {u.id !== me?.sub && (
                              <button onClick={() => deleteUser(u.id, u.email)}
                                aria-label={`Delete user ${u.email}`}
                                title="Delete user"
                                className="text-ink-muted hover:text-red-400 transition-colors p-1 rounded focus-visible:ring-1 focus-visible:ring-accent">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
            }
          </tbody>
        </table>
        </div>
      </section>

      {/* Create user modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setFormErr(''); }} title="Add New User">
        <ErrorAlert message={formErr} className="mb-4" />
        <div className="space-y-3">
          <FormField label="Email" htmlFor={emailId}>
            <Input id={emailId} type="email" value={form.email}
              onChange={e => setForm(f=>({...f,email:e.target.value}))}
              placeholder="operator@utility.com" autoComplete="off" />
          </FormField>
          <FormField label="Password" htmlFor={pwId}
            hint="Min 10 chars · 1 uppercase · 1 number · 1 symbol">
            <Input id={pwId} type="password" value={form.password}
              onChange={e => setForm(f=>({...f,password:e.target.value}))}
              placeholder="••••••••••" autoComplete="new-password" />
          </FormField>
          <FormField label="Role" htmlFor={roleId}>
            <select id={roleId} value={form.role} onChange={e => setForm(f=>({...f,role:e.target.value}))}
              className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-ink-primary outline-none focus:border-accent transition-colors">
              <option value="OPERATOR">OPERATOR</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </FormField>
        </div>
        <div className="flex gap-2.5 mt-5">
          <button onClick={() => { setShowModal(false); setFormErr(''); }}
            className="flex-1 px-4 py-2.5 rounded-lg border border-surface-border text-sm font-semibold text-ink-secondary hover:text-ink-primary hover:bg-surface transition-colors">
            Cancel
          </button>
          <button onClick={createUser} disabled={creating} aria-busy={creating}
            className="flex-1 btn-primary py-2.5 text-sm disabled:opacity-60">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Create User
          </button>
        </div>
      </Modal>
    </PageShell>
  );
}
