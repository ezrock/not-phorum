'use client';

import { Children, isValidElement, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import LinkifyIt from 'linkify-it';
import tlds from 'tlds';
import { postImage } from '@/lib/cloudinary';
import type { Post } from '@/components/forum/post/post.types';

const URL_MAX_DISPLAY_LENGTH = 60;
const UNDERLINE_START = 'ULSTARTTOKEN';
const UNDERLINE_END = 'ULENDTOKEN';
const linkify = new LinkifyIt();
linkify.set({ fuzzyLink: true, fuzzyIP: false, fuzzyEmail: false });
linkify.tlds(tlds as string[]);

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a || []), ['target', '_blank'], ['rel', 'noopener noreferrer']],
  },
};

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

function encodeUnderlineSyntax(markdown: string): string {
  return markdown.replace(/\+\+([^\n]+?)\+\+/g, (_match, inner: string) => {
    return `*${UNDERLINE_START}${inner}${UNDERLINE_END}*`;
  });
}

function flattenText(node: ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join('');
  if (isValidElement(node)) return flattenText(node.props.children);
  return '';
}

interface PostContentProps {
  post: Post;
  hasBeenEdited: boolean;
  editedLabel: string | null;
}

export function PostContent({ post, hasBeenEdited, editedLabel }: PostContentProps) {
  const youtubeEmbeds = extractYouTubeEmbedUrls(post.content);

  return (
    <div className="flex-1">
      <div className="prose max-w-none mb-4">
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
            em: ({ children }) => {
              const plain = Children.toArray(children).map((child) => flattenText(child)).join('');
              if (plain.includes(UNDERLINE_START) && plain.includes(UNDERLINE_END)) {
                const clean = plain
                  .replaceAll(UNDERLINE_START, '')
                  .replaceAll(UNDERLINE_END, '');
                return <u>{clean}</u>;
              }
              return <em>{children}</em>;
            },
          }}
        >
          {encodeUnderlineSyntax(preserveSingleLineBreaks(autoLinkPlainUrls(post.content)))}
        </ReactMarkdown>
        {youtubeEmbeds.length > 0 && (
          <div className="mt-4 space-y-3 not-prose">
            {youtubeEmbeds.map((embedUrl) => (
              <div
                key={`${post.id}-${embedUrl}`}
                className="relative w-full max-w-3xl overflow-hidden rounded-lg border border-gray-200 bg-black"
                style={{ paddingTop: '56.25%' }}
              >
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
        {post.image_url && (
          <img src={postImage(post.image_url)} alt="Liite" className="mt-3 max-w-full max-h-96 rounded-lg" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        {post.author?.signature && post.author?.show_signature && (
          <p className="text-xs text-gray-400 italic whitespace-pre-wrap">{post.author.signature}</p>
        )}
        {hasBeenEdited && editedLabel && (
          <p className={`text-xs text-gray-400 italic ${post.author?.signature && post.author?.show_signature ? 'mt-1' : ''}`}>
            Muokattu viimeksi {editedLabel}
          </p>
        )}
      </div>
    </div>
  );
}
