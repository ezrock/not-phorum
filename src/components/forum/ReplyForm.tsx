'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, ImagePlus, X } from 'lucide-react';
import { CldUploadWidget } from 'next-cloudinary';
import { postThumb } from '@/lib/cloudinary';

interface CloudinaryUploadResult {
  info?: {
    secure_url?: string;
  };
}

function extractSecureUrl(result: unknown): string | null {
  const typed = result as CloudinaryUploadResult;
  return typed?.info?.secure_url ?? null;
}

interface ReplyFormProps {
  onSubmit: (content: string, imageUrl: string) => Promise<void>;
  submitting: boolean;
}

export function ReplyForm({ onSubmit, submitting }: ReplyFormProps) {
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const handleSubmit = async () => {
    if (!content.trim()) return;
    await onSubmit(content, imageUrl);
    setContent('');
    setImageUrl('');
  };

  return (
    <div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full border-2 border-gray-300 rounded-lg p-3 mb-4 min-h-[150px] focus:border-yellow-400 focus:outline-none"
        placeholder="Kirjoita vastauksesi..."
      />
      <p className="mb-4 -mt-2 text-xs text-gray-500">
        <a
          href="https://www.markdownguide.org/cheat-sheet/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-yellow-700 hover:underline"
        >
          Muotoile viesti Markdownilla
        </a>
      </p>
      {imageUrl && (
        <div className="relative inline-block mb-4">
          <img src={postThumb(imageUrl)} alt="Liite" className="max-h-40 rounded-lg" />
          <button
            type="button"
            onClick={() => setImageUrl('')}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className="composer-actions">
        <CldUploadWidget
          uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET}
          options={{
            maxFiles: 1,
            resourceType: 'image',
            folder: 'freakon/posts',
          }}
          onSuccess={(result: unknown) => {
            const secureUrl = extractSecureUrl(result);
            if (secureUrl) {
              setImageUrl(secureUrl);
            }
          }}
        >
          {({ open }) => (
            <Button type="button" variant="outline" className="flex items-center gap-2" onClick={() => open()}>
              <ImagePlus size={16} />
              Lisää kuva
            </Button>
          )}
        </CldUploadWidget>
        <Button
          variant="primary"
          className="composer-actions-submit flex items-center gap-2"
          onClick={handleSubmit}
          disabled={submitting || !content.trim()}
        >
          <MessageSquare size={16} />
          {submitting ? 'Lähetetään...' : 'Lähetä vastaus'}
        </Button>
      </div>
    </div>
  );
}
