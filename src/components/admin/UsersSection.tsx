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
        <p className="text-sm text-gray-500">Ei uusia hyväksyntää odottavia käyttäjiä.</p>
      ) : (
        <div className="space-y-2">
          {pendingUsers.map((user) => (
            <div key={user.id} className="flex items-center justify-between gap-3 rounded border border-gray-200 bg-gray-50 px-3 py-2">
              <div className="min-w-0">
                <p className="font-medium truncate">{user.username}</p>
                <p className="text-xs text-gray-500">{new Date(user.created_at).toLocaleString('fi-FI')}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={processingUserId === user.id}
                  onClick={() => onSetApprovalStatus(user.id, 'approved')}
                  className="inline-flex items-center gap-1 rounded bg-green-600 px-2 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <Check size={14} />
                  Approve
                </button>
                <button
                  type="button"
                  disabled={processingUserId === user.id}
                  onClick={() => onSetApprovalStatus(user.id, 'rejected')}
                  className="inline-flex items-center gap-1 rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
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
