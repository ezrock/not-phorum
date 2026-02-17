'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Edit2, ImagePlus, X, Trash2, Save, User, Heart, Link2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CldUploadWidget } from 'next-cloudinary';
import { profileThumb, postImage, postThumb } from '@/lib/cloudinary';
import { formatPostDateTime } from '@/lib/formatDate';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import type { PostLikeState } from '@/hooks/usePostLikes';
import LinkifyIt from 'linkify-it';
import tlds from 'tlds';

// --- Types ---

export interface Post {
  id: number;
  content: string;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  image_url: string | null;
  author: {
    id: string;
    username: string;
    profile_image_url: string | null;
    created_at: string;
    signature: string | null;
    show_signature: boolean;
  } | null;
}

interface CloudinaryUploadResult {
  info?: { secure_url?: string };
}

interface PostItemProps {
  post: Post;
  isOriginalPost: boolean;
  isHighlighted: boolean;
  currentUserId: string | null;
  // Edit
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (postId: number, content: string, imageUrl: string) => Promise<void>;
  editSaving: boolean;
  // Delete
  isConfirmingDelete: boolean;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  // Like
  likeState: PostLikeState;
  likeSaving: boolean;
  onToggleLike: () => void;
  // Copy
  isCopied: boolean;
  onCopyLink: () => void;
}

// --- URL / YouTube utilities (pure functions, module-scoped) ---

const URL_MAX_DISPLAY_LENGTH = 60;
const linkify = new LinkifyIt();
linkify.set({ fuzzyLink: true, fuzzyIP: false, fuzzyEmail: false });
linkify.tlds(tlds as string[]);

function shortenUrlDisplay(url: string): string {
  if (url.length <= URL_MAX_DISPLAY_LENGTH) return url;
  return `${url.slice(0, URL_MAX_DISPLAY_LENGTH - 3)}...`;
}

function ensureUrlProtocol(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

function parseYouTubeVideoId(rawUrl: string): string | null {
  try {
    const normalized = ensureUrlProtocol(rawUrl);
    const url = new URL(normalized);
    const host = url.hostname.replace(/^www\./i, '').toLowerCase();

    if (host === 'youtu.be') {
      const candidate = url.pathname.split('/').filter(Boolean)[0] || '';
      return /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      if (url.pathname === '/watch') {
        const candidate = url.searchParams.get('v') || '';
        return /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
      }
      if (url.pathname.startsWith('/shorts/')) {
        const candidate = url.pathname.split('/')[2] || '';
        return /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
      }
      if (url.pathname.startsWith('/embed/')) {
        const candidate = url.pathname.split('/')[2] || '';
        return /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function extractYouTubeEmbedUrls(text: string): string[] {
  const matches = linkify.match(text);
  if (!matches || matches.length === 0) return [];

  const videoIds = new Set<string>();
  for (const match of matches) {
    const videoId = parseYouTubeVideoId(match.url || match.raw);
    if (videoId) videoIds.add(videoId);
  }

  return Array.from(videoIds).map((id) => `https://www.youtube-nocookie.com/embed/${id}`);
}

function autoLinkPlainUrls(markdown: string): string {
  const matches = linkify.match(markdown);
  if (!matches || matches.length === 0) return markdown;

  let result = '';
  let cursor = 0;

  for (const match of matches) {
    const start = match.index;
    const end = match.lastIndex;
    const raw = match.raw;
    const href = ensureUrlProtocol(match.url || raw);

    result += markdown.slice(cursor, start);
    result += `[${shortenUrlDisplay(raw)}](${href})`;
    cursor = end;
  }

  result += markdown.slice(cursor);
  return result;
}

function preserveSingleLineBreaks(markdown: string): string {
  const normalized = markdown.replace(/\r\n/g, '\n');
  return normalized.replace(/(?<!\n)\n(?!\n)/g, '  \n');
}

function extractSecureUrl(result: unknown): string | null {
  const typed = result as CloudinaryUploadResult;
  return typed?.info?.secure_url ?? null;
}

function hasBeenEdited(post: Post) {
  if (!post.updated_at) return false;
  const updatedAt = new Date(post.updated_at).getTime();
  const createdAt = new Date(post.created_at).getTime();
  if (Number.isNaN(updatedAt) || Number.isNaN(createdAt)) return false;
  return updatedAt - createdAt > 1000;
}

// --- Sanitize schema ---

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a || []), ['target', '_blank'], ['rel', 'noopener noreferrer']],
  },
};

// --- Component ---

export function PostItem({
  post,
  isOriginalPost,
  isHighlighted,
  currentUserId,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSave,
  editSaving,
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

  return (
    <div
      id={`post-${post.id}`}
      className={`py-6 border-b border-gray-200 last:border-b-0 scroll-mt-24 transition-colors ${
        isHighlighted ? 'bg-yellow-50' : ''
      }`}
    >
      <div className="flex gap-4">
        {/* Author Info Sidebar */}
        <Link href={`/profile/${post.author?.id}`} className="w-32 flex-shrink-0 text-center border-r-2 border-gray-200 pr-4 hover:opacity-80">
          {post.author?.profile_image_url ? (
            <img src={profileThumb(post.author.profile_image_url)} alt={post.author.username} className="w-10 h-10 rounded-none object-cover mx-auto mb-2" />
          ) : (
            <div className="w-10 h-10 square-full bg-gray-200 text-gray-500 inline-flex items-center justify-center mb-2">
              <User size={30} />
            </div>
          )}
          <p className="font-bold text-sm mb-1" style={{ fontFamily: 'monospace' }}>{post.author?.username}</p>
          <p className="text-xs text-gray-400">
            {formatPostDateTime(post.created_at)}
          </p>
        </Link>

        {/* Post Content */}
        {post.deleted_at ? (
          <div className="flex-1 flex items-center">
            <p className="text-gray-400 italic py-4">Tämä viesti on poistettu.</p>
          </div>
        ) : isEditing ? (
          <div className="flex-1">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full border-2 border-gray-300 rounded-lg p-3 mb-3 min-h-[120px] focus:border-yellow-400 focus:outline-none"
            />
            {editImageUrl && (
              <div className="relative inline-block mb-3">
                <img src={postThumb(editImageUrl)} alt="Liite" className="max-h-40 rounded-lg" />
                <button
                  type="button"
                  onClick={() => setEditImageUrl('')}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <CldUploadWidget
                uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET}
                options={{ maxFiles: 1, resourceType: 'image', folder: 'freakon/posts' }}
                onSuccess={(result: unknown) => {
                  const secureUrl = extractSecureUrl(result);
                  if (secureUrl) setEditImageUrl(secureUrl);
                }}
              >
                {({ open }) => (
                  <Button type="button" variant="outline" className="flex items-center gap-2" onClick={() => open()}>
                    <ImagePlus size={16} />
                    {editImageUrl ? 'Vaihda kuva' : 'Lisää kuva'}
                  </Button>
                )}
              </CldUploadWidget>
              <Button variant="outline" onClick={onCancelEdit}>
                Peruuta
              </Button>
              <Button
                variant="success"
                className="flex items-center gap-2"
                onClick={handleSave}
                disabled={editSaving || !editContent.trim()}
              >
                <Save size={16} />
                {editSaving ? 'Tallennetaan...' : 'Tallenna'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1">
            <div className="prose max-w-none mb-4">
              {(() => {
                const youtubeEmbeds = extractYouTubeEmbedUrls(post.content);
                return (
                  <>
                    <ReactMarkdown
                      rehypePlugins={[[rehypeSanitize, sanitizeSchema]]}
                      components={{
                        a: ({ href, children }) => {
                          let safeHref = href;
                          try {
                            const url = new URL(href || '', 'https://placeholder.invalid');
                            if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) {
                              safeHref = undefined;
                            }
                          } catch {
                            safeHref = undefined;
                          }

                          const firstChild = Array.isArray(children) ? children[0] : children;
                          const label = typeof firstChild === 'string' ? firstChild : '';
                          const shouldShorten = label && /^https?:\/\//i.test(label);
                          const visibleText = shouldShorten ? shortenUrlDisplay(label) : children;

                          if (!safeHref) {
                            return <span>{visibleText}</span>;
                          }

                          return (
                            <a href={safeHref} target="_blank" rel="noopener noreferrer">
                              {visibleText}
                            </a>
                          );
                        },
                      }}
                    >
                      {preserveSingleLineBreaks(autoLinkPlainUrls(post.content))}
                    </ReactMarkdown>
                    {youtubeEmbeds.length > 0 && (
                      <div className="mt-4 space-y-3 not-prose">
                        {youtubeEmbeds.map((embedUrl) => (
                          <div key={`${post.id}-${embedUrl}`} className="relative w-full max-w-3xl overflow-hidden rounded-lg border border-gray-200 bg-black" style={{ paddingTop: '56.25%' }}>
                            <iframe
                              src={embedUrl}
                              title="YouTube video"
                              className="absolute inset-0 h-full w-full"
                              loading="lazy"
                              referrerPolicy="strict-origin-when-cross-origin"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                              allowFullScreen
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
              {post.image_url && (
                <img src={postImage(post.image_url)} alt="Liite" className="mt-3 max-w-full max-h-96 rounded-lg" />
              )}
            </div>

            <div className="mt-3 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {post.author?.signature && post.author?.show_signature && (
                  <p className="text-xs text-gray-400 italic whitespace-pre-wrap">{post.author.signature}</p>
                )}
                {hasBeenEdited(post) && (
                  <p className={`text-xs text-gray-400 italic ${post.author?.signature && post.author?.show_signature ? 'mt-1' : ''}`}>
                    Muokattu viimeksi {formatPostDateTime(post.updated_at as string)}
                  </p>
                )}
              </div>

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
                {currentUserId && currentUserId === post.author?.id && (
                  <>
                    <button
                      className="inline-flex h-10 w-10 items-center justify-center rounded text-gray-500 hover:text-yellow-600 hover:bg-gray-100 transition"
                      onClick={handleStartEdit}
                      title="Muokkaa"
                    >
                      <Edit2 size={16} />
                    </button>
                    {!isOriginalPost && (
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
