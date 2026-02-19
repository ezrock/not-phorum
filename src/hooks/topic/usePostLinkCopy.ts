'use client';

import { useEffect, useRef, useState } from 'react';

export function usePostLinkCopy() {
  const [copiedPostId, setCopiedPostId] = useState<number | null>(null);
  const copyTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = null;
      }
    };
  }, []);

  const handleCopyPostLink = async (postId: number) => {
    if (typeof window === 'undefined') return;

    const linkUrl = new URL(window.location.href);
    linkUrl.hash = `post-${postId}`;
    const linkText = linkUrl.toString();

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(linkText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = linkText;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      setCopiedPostId(postId);
      if (copyTimeoutRef.current) {
        window.clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopiedPostId((prev) => (prev === postId ? null : prev));
        copyTimeoutRef.current = null;
      }, 1200);
    } catch {
      // no-op
    }
  };

  return {
    copiedPostId,
    handleCopyPostLink,
  };
}
