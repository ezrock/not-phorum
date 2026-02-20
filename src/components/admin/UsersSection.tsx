import { Check, Users as UsersIcon, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import type { PendingUser } from '@/components/admin/types';

interface UsersSectionProps {
  showHeaderIcons: boolean;
  pendingUsers: PendingUser[];
  processingUserId: string | null;
  onSetApprovalStatus: (userId: string, status: 'approved' | 'rejected') => void;
}

export function UsersSection({
  showHeaderIcons,
  pendingUsers,
  processingUserId,
  onSetApprovalStatus,
}: UsersSectionProps) {
  return (
    <Card>
      <h2 className="card-title flex items-center gap-2">
        {showHeaderIcons && <UsersIcon size={20} className="text-yellow-600" />}
        Käyttäjät
      </h2>
      {pendingUsers.length === 0 ? (
        <p className="text-muted-sm">Ei uusia hyväksyntää odottavia käyttäjiä.</p>
      ) : (
        <div className="space-y-2">
          {pendingUsers.map((user) => (
            <div key={user.id} className="list-row-card">
              <div className="min-w-0">
                <p className="font-medium truncate">{user.username}</p>
                <p className="text-muted-xs">{new Date(user.created_at).toLocaleString('fi-FI')}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={processingUserId === user.id}
                  onClick={() => onSetApprovalStatus(user.id, 'approved')}
                  className="admin-compact-btn inline-flex items-center gap-1 bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <Check size={14} />
                  Approve
                </button>
                <button
                  type="button"
                  disabled={processingUserId === user.id}
                  onClick={() => onSetApprovalStatus(user.id, 'rejected')}
                  className="admin-compact-btn inline-flex items-center gap-1 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  <X size={14} />
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
