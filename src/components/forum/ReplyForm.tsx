'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, ImagePlus, X } from 'lucide-react';
import { CldUploadWidget } from 'next-cloudinary';
import { extractSecureUrl, postThumb } from '@/lib/cloudinary';
import { getCloudinaryUploadPresetOrThrow, getPostUploadWidgetOptions } from '@/lib/cloudinaryWidget';
import { handleMarkdownTextareaShortcut } from '@/lib/markdownShortcuts';

interface ReplyFormProps {
  onSubmit: (content: string, imageUrl: string) => Promise<void>;
  submitting: boolean;
}

export function ReplyForm({ onSubmit, submitting }: ReplyFormProps) {
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const uploadPreset = getCloudinaryUploadPresetOrThrow();

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
        onKeyDown={(e) => {
          handleMarkdownTextareaShortcut(e, content, setContent);
        }}
        className="field-textarea field-textarea--reply"
        placeholder="Kirjoita vastauksesi..."
      />
      <p className="mb-4 -mt-2 text-muted-xs">
        <a
          href="https://www.markdownguide.org/cheat-sheet/"
          target="_blank"
          rel="noopener noreferrer"
          className="content-inline-link"
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
            className="btn-image-remove"
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className="composer-actions">
        <CldUploadWidget
          uploadPreset={uploadPreset}
          options={getPostUploadWidgetOptions()}
          onSuccess={(result: unknown) => {
            const secureUrl = extractSecureUrl(result);
            if (secureUrl) {
              setImageUrl(secureUrl);
            }
          }}
        >
          {({ open }) => (
            <Button type="button" variant="outline" onClick={() => open()}>
              <ImagePlus size={16} />
              Lisää kuva
            </Button>
          )}
        </CldUploadWidget>
        <Button
          variant="primary"
          className="composer-actions-submit"
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
