'use client';

import { Check, Edit2, Heart, Link2, Trash2 } from 'lucide-react';
import type { PostLikeState } from '@/hooks/usePostLikes';

interface PostActionsProps {
  canEdit: boolean;
  canDelete: boolean;
  isOriginalPost: boolean;
  isConfirmingDelete: boolean;
  onStartEdit: () => void;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  likeState: PostLikeState;
  likeSaving: boolean;
  onToggleLike: () => void;
  isCopied: boolean;
  onCopyLink: () => void;
}

export function PostActions({
  canEdit,
  canDelete,
  isOriginalPost,
  isConfirmingDelete,
  onStartEdit,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
  likeState,
  likeSaving,
  onToggleLike,
  isCopied,
  onCopyLink,
}: PostActionsProps) {
  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <button
        className={`inline-flex h-10 min-w-10 px-2 items-center justify-center rounded text-sm transition ${
          isCopied
            ? 'text-green-700 bg-green-100 hover:bg-green-100'
            : 'text-gray-500 hover:text-blue-700 hover:bg-gray-100'
        }`}
        onClick={onCopyLink}
        title="Kopioi viestilinkki"
      >
        {isCopied ? <Check size={16} /> : <Link2 size={16} />}
      </button>
      <button
        className={`inline-flex h-10 min-w-10 px-2 items-center justify-center gap-1 rounded text-sm transition ${
          likeState.likedByMe
            ? 'text-red-600 bg-red-50 hover:bg-red-100'
            : 'text-gray-500 hover:text-red-600 hover:bg-gray-100'
        }`}
        onClick={onToggleLike}
        disabled={likeSaving}
        title={likeState.likedByMe ? 'Poista tykkäys' : 'Tykkää'}
      >
        <Heart size={16} className={likeState.likedByMe ? 'fill-current' : ''} />
        <span>{likeState.count || 0}</span>
      </button>
      {canEdit && (
        <>
          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded text-gray-500 hover:text-yellow-600 hover:bg-gray-100 transition"
            onClick={onStartEdit}
            title="Muokkaa"
          >
            <Edit2 size={16} />
          </button>
          {!isOriginalPost && canDelete && (
            isConfirmingDelete ? (
              <div className="flex items-center gap-1">
                <span className="text-xs text-red-600">Poistetaanko?</span>
                <button className="text-red-600 hover:text-red-800 text-xs font-bold" onClick={onConfirmDelete}>
                  Kyllä
                </button>
                <button className="text-gray-500 hover:text-gray-700 text-xs" onClick={onCancelDelete}>
                  Ei
                </button>
              </div>
            ) : (
              <button
                className="inline-flex h-10 w-10 items-center justify-center rounded text-gray-500 hover:text-red-600 hover:bg-gray-100 transition"
                onClick={onRequestDelete}
                title="Poista"
              >
                <Trash2 size={16} />
              </button>
            )
          )}
        </>
      )}
    </div>
  );
}
