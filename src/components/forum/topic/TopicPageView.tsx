import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import type { Post } from '@/components/forum/post';
import type { TagOption } from '@/components/forum/AddTags';
import { TopicEditMetaFields } from '@/components/forum/topic/TopicEditMetaFields';
import { TopicPostsSection } from '@/components/forum/topic/TopicPostsSection';
import type { Topic, TopicPrimaryTag } from '@/components/forum/types';
import { TagChip } from '@/components/ui/TagChip';

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
          <Link href="/" className="app-back-link mt-4">
            <ArrowLeft size={16} />
            Takaisin foorumille
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto mt-8 px-4 mb-12">
      <div className="mb-4">
        <Link href="/" className="app-back-link">
          <ArrowLeft size={16} />
          Takaisin foorumille
        </Link>
      </div>

      <Card className="mb-6">
        <div className="flex items-start gap-3">
          <span className="text-4xl">{topicPrimaryTag?.icon || '🏷️'}</span>
          <div>
            <h1 className="text-3xl font-bold mb-2">{topic.title}</h1>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <TagChip>{topicPrimaryTag?.name || 'Tagit'}</TagChip>
              <span>{topic.views_unique ?? topic.views} katselua</span>
              <span>{totalPosts} viestiä</span>
            </div>
          </div>
        </div>

        <TopicPostsSection
          posts={posts}
          firstPostId={firstPostId}
          highlightedPostId={highlightedPostId}
          currentUser={currentUser}
          callerIsAdmin={callerIsAdmin}
          canEditTopicMeta={canEditTopicMeta}
          editingPostId={editingPostId}
          editSaving={editSaving}
          deleteConfirmId={deleteConfirmId}
          copiedPostId={copiedPostId}
          postLikes={postLikes}
          likeSaving={likeSaving}
          canLoadOlder={canLoadOlder}
          loadingMore={loadingMore}
          canShowMore={canShowMore}
          displayedPostCount={displayedPostCount}
          totalPosts={totalPosts}
          submitting={submitting}
          loadOlderPosts={loadOlderPosts}
          handleShowMore={handleShowMore}
          handleReply={handleReply}
          handleEditSave={handleEditSave}
          handleDelete={handleDelete}
          handleCopyPostLink={handleCopyPostLink}
          setDeleteConfirmId={setDeleteConfirmId}
          startEdit={startEdit}
          cancelEdit={cancelEdit}
          toggleLike={toggleLike}
          buildEditTopContent={() => (
            <TopicEditMetaFields
              topicTitleDraft={topicTitleDraft}
              onTopicTitleDraftChange={setTopicTitleDraft}
              topicTagDraft={topicTagDraft}
              onTopicTagDraftChange={setTopicTagDraft}
              editSaving={editSaving}
              topicEditError={topicEditError}
            />
          )}
        />
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
