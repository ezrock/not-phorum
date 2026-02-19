import { type ChangeEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { PostItem, type Post } from '@/components/forum/PostItem';
import { ReplyForm } from '@/components/forum/ReplyForm';
import { AddTags, type TagOption } from '@/components/forum/AddTags';
import type { Topic, TopicPrimaryTag } from '@/components/forum/types';

interface TopicPageViewProps {
  topic: Topic | null;
  topicPrimaryTag: TopicPrimaryTag | null;
  posts: Post[];
  totalPosts: number;
  firstPostId: number | null;
  loading: boolean;
  loadingMore: boolean;
  submitting: boolean;
  displayedPostCount: number;
  canLoadOlder: boolean;
  canShowMore: boolean;
  currentUser: { id: string } | null;
  callerIsAdmin: boolean;
  canEditTopicMeta: boolean;
  editingPostId: number | null;
  editSaving: boolean;
  deleteConfirmId: number | null;
  copiedPostId: number | null;
  highlightedPostId: number | null;
  topicTitleDraft: string;
  topicTagDraft: TagOption[];
  topicEditError: string;
  postLikes: Record<number, { count: number; likedByMe: boolean }>;
  likeSaving: Record<number, boolean>;
  loadOlderPosts: () => Promise<void>;
  handleShowMore: () => Promise<void>;
  handleReply: (content: string, imageUrl: string) => Promise<void>;
  handleEditSave: (postId: number, content: string, imageUrl: string) => Promise<void>;
  handleDelete: (postId: number) => Promise<void>;
  handleCopyPostLink: (postId: number) => Promise<void>;
  setDeleteConfirmId: (id: number | null) => void;
  setTopicTitleDraft: (value: string) => void;
  setTopicTagDraft: (value: TagOption[]) => void;
  startEdit: (post: Post) => void;
  cancelEdit: (post: Post) => void;
  toggleLike: (postId: number) => Promise<void>;
}

export function TopicPageView({
  topic,
  topicPrimaryTag,
  posts,
  totalPosts,
  firstPostId,
  loading,
  loadingMore,
  submitting,
  displayedPostCount,
  canLoadOlder,
  canShowMore,
  currentUser,
  callerIsAdmin,
  canEditTopicMeta,
  editingPostId,
  editSaving,
  deleteConfirmId,
  copiedPostId,
  highlightedPostId,
  topicTitleDraft,
  topicTagDraft,
  topicEditError,
  postLikes,
  likeSaving,
  loadOlderPosts,
  handleShowMore,
  handleReply,
  handleEditSave,
  handleDelete,
  handleCopyPostLink,
  setDeleteConfirmId,
  setTopicTitleDraft,
  setTopicTagDraft,
  startEdit,
  cancelEdit,
  toggleLike,
}: TopicPageViewProps) {
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto mt-8 px-4">
        <Card>
          <p className="text-center text-gray-500 py-8">Ladataan...</p>
        </Card>
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="max-w-6xl mx-auto mt-8 px-4">
        <Card>
          <h2 className="text-2xl font-bold">Aihetta ei löytynyt</h2>
          <Link href="/forum">
            <Button className="mt-4">Takaisin foorumille</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto mt-8 px-4 mb-12">
      <Card className="mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <span className="text-4xl">{topicPrimaryTag?.icon || '🏷️'}</span>
            <div>
              <h1 className="text-3xl font-bold mb-2">{topic.title}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="text-yellow-800 font-medium">{topicPrimaryTag?.name || 'Tagit'}</span>
                <span>{topic.views_unique ?? topic.views} katselua</span>
                <span>{totalPosts} viestiä</span>
              </div>
            </div>
          </div>
          <Link href="/forum">
            <Button variant="outline" className="flex items-center gap-2">
              <ArrowLeft size={16} />
              Takaisin
            </Button>
          </Link>
        </div>

        <div className="mt-6 border-t border-gray-200">
          {canLoadOlder && (
            <div className="pt-4 pb-2 flex justify-center">
              <Button
                type="button"
                variant="outline"
                onClick={loadOlderPosts}
                disabled={loadingMore}
                className="min-w-44"
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
              editTopContent={
                post.id === firstPostId && canEditTopicMeta ? (
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="topic-edit-title" className="block text-sm font-medium mb-1">
                        Otsikko
                      </label>
                      <Input
                        id="topic-edit-title"
                        value={topicTitleDraft}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setTopicTitleDraft(e.target.value)}
                        placeholder="Langan otsikko"
                      />
                    </div>
                    <AddTags
                      selected={topicTagDraft}
                      onChange={setTopicTagDraft}
                      disabled={editSaving}
                      maxSelected={1}
                      featuredOnly={null}
                      label="Tagi"
                      placeholder="Valitse tagi (tyhjä = off-topic)"
                    />
                    {topicEditError && <p className="text-sm text-red-600">{topicEditError}</p>}
                  </div>
                ) : null
              }
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
              className="min-w-44"
            >
              {loadingMore ? 'Ladataan...' : 'Näytä lisää viestejä'}
            </Button>
            <p className="text-xs text-gray-500">
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
      </Card>

      {!currentUser && (
        <Card className="mt-6 text-center">
          <p className="text-gray-600 mb-4">Kirjaudu sisään vastataksesi tähän aiheeseen</p>
          <Link href="/login">
            <Button>Kirjaudu sisään</Button>
          </Link>
        </Card>
      )}
    </div>
  );
}
