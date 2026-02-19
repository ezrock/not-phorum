'use client';

import { type ReactNode, useState } from 'react';
import Link from 'next/link';
import { User } from 'lucide-react';
import { formatPostDateTime } from '@/lib/formatDate';
import { profileThumb } from '@/lib/cloudinary';
import { PostActions } from '@/components/forum/postItem/PostActions';
import { PostContent } from '@/components/forum/postItem/PostContent';
import { PostEditForm } from '@/components/forum/postItem/PostEditForm';
import type { PostLikeState } from '@/hooks/usePostLikes';
import type { Post } from '@/components/forum/postItem/types';

export type { Post } from '@/components/forum/postItem/types';

interface PostItemProps {
  post: Post;
  isOriginalPost: boolean;
  isHighlighted: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (postId: number, content: string, imageUrl: string) => Promise<void>;
  editSaving: boolean;
  editTopContent?: ReactNode;
  saveLabel?: string;
  isConfirmingDelete: boolean;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  likeState: PostLikeState;
  likeSaving: boolean;
  onToggleLike: () => void;
  isCopied: boolean;
  onCopyLink: () => void;
}

function hasBeenEdited(post: Post) {
  if (!post.updated_at) return false;
  const updatedAt = new Date(post.updated_at).getTime();
  const createdAt = new Date(post.created_at).getTime();
  if (Number.isNaN(updatedAt) || Number.isNaN(createdAt)) return false;
  return updatedAt - createdAt > 1000;
}

export function PostItem({
  post,
  isOriginalPost,
  isHighlighted,
  canEdit,
  canDelete,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSave,
  editSaving,
  editTopContent,
  saveLabel = 'Tallenna',
  isConfirmingDelete,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
  likeState,
  likeSaving,
  onToggleLike,
  isCopied,
  onCopyLink,
}: PostItemProps) {
  const [editContent, setEditContent] = useState(post.content);
  const [editImageUrl, setEditImageUrl] = useState(post.image_url || '');

  const handleStartEdit = () => {
    setEditContent(post.content);
    setEditImageUrl(post.image_url || '');
    onStartEdit();
  };

  const handleSave = () => onSave(post.id, editContent.trim(), editImageUrl);
  const edited = hasBeenEdited(post);

  return (
    <div
      id={`post-${post.id}`}
      className={`py-6 border-b border-gray-200 last:border-b-0 scroll-mt-24 transition-colors ${
        isHighlighted ? 'bg-yellow-50' : ''
      }`}
    >
      <div className="flex gap-4">
        <Link href={`/profile/${post.author?.id}`} className="w-32 flex-shrink-0 text-center border-r-2 border-gray-200 pr-4 hover:opacity-80">
          {post.author?.profile_image_url ? (
            <img src={profileThumb(post.author.profile_image_url)} alt={post.author.username} className="avatar-md mx-auto mb-2" />
          ) : (
            <div className="avatar-md-fallback mx-auto mb-2">
              <User size={18} />
            </div>
          )}
          <p className="font-bold text-sm mb-1 font-mono">{post.author?.username}</p>
          <p className="text-xs text-gray-400">{formatPostDateTime(post.created_at)}</p>
        </Link>

        {post.deleted_at ? (
          <div className="flex-1 flex items-center">
            <p className="text-gray-400 italic py-4">Tämä viesti on poistettu.</p>
          </div>
        ) : isEditing ? (
          <PostEditForm
            editTopContent={editTopContent}
            editContent={editContent}
            onEditContentChange={setEditContent}
            editImageUrl={editImageUrl}
            onEditImageUrlChange={setEditImageUrl}
            onCancelEdit={onCancelEdit}
            onSave={handleSave}
            editSaving={editSaving}
            saveLabel={saveLabel}
          />
        ) : (
          <div className="flex-1">
            <PostContent
              post={post}
              hasBeenEdited={edited}
              editedLabel={edited && post.updated_at ? formatPostDateTime(post.updated_at) : null}
            />
            <div className="mt-3 flex items-start justify-end gap-3">
              <PostActions
                canEdit={canEdit}
                canDelete={canDelete}
                isOriginalPost={isOriginalPost}
                isConfirmingDelete={isConfirmingDelete}
                onStartEdit={handleStartEdit}
                onRequestDelete={onRequestDelete}
                onConfirmDelete={onConfirmDelete}
                onCancelDelete={onCancelDelete}
                likeState={likeState}
                likeSaving={likeSaving}
                onToggleLike={onToggleLike}
                isCopied={isCopied}
                onCopyLink={onCopyLink}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
