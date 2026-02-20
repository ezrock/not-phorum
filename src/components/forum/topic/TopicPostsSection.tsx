import { type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { PostItem, type Post } from '@/components/forum/post';
import { ReplyForm } from '@/components/forum/ReplyForm';

interface TopicPostsSectionProps {
  posts: Post[];
  firstPostId: number | null;
  highlightedPostId: number | null;
  currentUser: { id: string } | null;
  callerIsAdmin: boolean;
  canEditTopicMeta: boolean;
  editingPostId: number | null;
  editSaving: boolean;
  deleteConfirmId: number | null;
  copiedPostId: number | null;
  postLikes: Record<number, { count: number; likedByMe: boolean }>;
  likeSaving: Record<number, boolean>;
  canLoadOlder: boolean;
  loadingMore: boolean;
  canShowMore: boolean;
  displayedPostCount: number;
  totalPosts: number;
  submitting: boolean;
  loadOlderPosts: () => Promise<void>;
  handleShowMore: () => Promise<void>;
  handleReply: (content: string, imageUrl: string) => Promise<void>;
  handleEditSave: (postId: number, content: string, imageUrl: string) => Promise<void>;
  handleDelete: (postId: number) => Promise<void>;
  handleCopyPostLink: (postId: number) => Promise<void>;
  setDeleteConfirmId: (id: number | null) => void;
  startEdit: (post: Post) => void;
  cancelEdit: (post: Post) => void;
  toggleLike: (postId: number) => Promise<void>;
  buildEditTopContent: (post: Post) => ReactNode;
}

export function TopicPostsSection({
  posts,
  firstPostId,
  highlightedPostId,
  currentUser,
  callerIsAdmin,
  canEditTopicMeta,
  editingPostId,
  editSaving,
  deleteConfirmId,
  copiedPostId,
  postLikes,
  likeSaving,
  canLoadOlder,
  loadingMore,
  canShowMore,
  displayedPostCount,
  totalPosts,
  submitting,
  loadOlderPosts,
  handleShowMore,
  handleReply,
  handleEditSave,
  handleDelete,
  handleCopyPostLink,
  setDeleteConfirmId,
  startEdit,
  cancelEdit,
  toggleLike,
  buildEditTopContent,
}: TopicPostsSectionProps) {
  return (
    <>
      <div className="mt-6 border-t border-gray-200">
        {canLoadOlder && (
          <div className="pt-4 pb-2 flex justify-center">
            <Button
              type="button"
              variant="outline"
              onClick={loadOlderPosts}
              disabled={loadingMore}
              className="btn-min-w-44"
            >
              {loadingMore ? 'Ladataan...' : 'Näytä vanhempia viestejä'}
            </Button>
          </div>
        )}

        {posts.map((post) => (
          <PostItem
            key={post.id}
            post={post}
            isOriginalPost={post.id === firstPostId}
            isHighlighted={highlightedPostId === post.id}
            canEdit={!!currentUser && (currentUser.id === post.author?.id || (callerIsAdmin && post.id === firstPostId))}
            canDelete={!!currentUser && currentUser.id === post.author?.id}
            isEditing={editingPostId === post.id}
            onStartEdit={() => startEdit(post)}
            onCancelEdit={() => cancelEdit(post)}
            onSave={handleEditSave}
            editSaving={editSaving}
            saveLabel={post.id === firstPostId ? 'Tallenna lanka' : 'Tallenna'}
            editTopContent={post.id === firstPostId && canEditTopicMeta ? buildEditTopContent(post) : null}
            isConfirmingDelete={deleteConfirmId === post.id}
            onRequestDelete={() => setDeleteConfirmId(post.id)}
            onConfirmDelete={() => handleDelete(post.id)}
            onCancelDelete={() => setDeleteConfirmId(null)}
            likeState={postLikes[post.id] || { count: 0, likedByMe: false }}
            likeSaving={!!likeSaving[post.id]}
            onToggleLike={() => toggleLike(post.id)}
            isCopied={copiedPostId === post.id}
            onCopyLink={() => handleCopyPostLink(post.id)}
          />
        ))}
      </div>

      {canShowMore && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleShowMore}
            disabled={loadingMore}
            className="btn-min-w-44"
          >
            {loadingMore ? 'Ladataan...' : 'Näytä lisää viestejä'}
          </Button>
          <p className="text-muted-xs">
            Näytetään {displayedPostCount} / {totalPosts} viestiä
          </p>
        </div>
      )}

      {currentUser && (
        <div className="mt-6 border-t border-gray-200 pt-6 md:ml-36">
          <h2 className="mb-3 text-base font-medium text-gray-900">Vastaa lankaan</h2>
          <ReplyForm onSubmit={handleReply} submitting={submitting} />
        </div>
      )}
    </>
  );
}
