'use client';

import { type ReactNode } from 'react';
import { ImagePlus, Save, X } from 'lucide-react';
import { CldUploadWidget } from 'next-cloudinary';
import { Button } from '@/components/ui/button';
import { extractSecureUrl, postThumb } from '@/lib/cloudinary';
import { getCloudinaryUploadPresetOrThrow, getPostUploadWidgetOptions } from '@/lib/cloudinaryWidget';
import { handleMarkdownTextareaShortcut } from '@/lib/markdownShortcuts';

interface PostEditFormProps {
  editTopContent?: ReactNode;
  editContent: string;
  onEditContentChange: (value: string) => void;
  editImageUrl: string;
  onEditImageUrlChange: (value: string) => void;
  onCancelEdit: () => void;
  onSave: () => void;
  editSaving: boolean;
  saveLabel: string;
}

export function PostEditForm({
  editTopContent,
  editContent,
  onEditContentChange,
  editImageUrl,
  onEditImageUrlChange,
  onCancelEdit,
  onSave,
  editSaving,
  saveLabel,
}: PostEditFormProps) {
  const uploadPreset = getCloudinaryUploadPresetOrThrow();

  return (
    <div className="flex-1">
      {editTopContent ? <div className="mb-3">{editTopContent}</div> : null}
      <textarea
        value={editContent}
        onChange={(e) => onEditContentChange(e.target.value)}
        onKeyDown={(e) => {
          handleMarkdownTextareaShortcut(e, editContent, onEditContentChange);
        }}
        className="field-textarea field-textarea--edit"
      />
      {editImageUrl && (
        <div className="relative inline-block mb-3">
          <img src={postThumb(editImageUrl)} alt="Liite" className="max-h-40 rounded-lg" />
          <button
            type="button"
            onClick={() => onEditImageUrlChange('')}
            className="btn-image-remove"
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <CldUploadWidget
          uploadPreset={uploadPreset}
          options={getPostUploadWidgetOptions()}
          onSuccess={(result: unknown) => {
            const secureUrl = extractSecureUrl(result);
            if (secureUrl) onEditImageUrlChange(secureUrl);
          }}
        >
          {({ open }) => (
            <Button type="button" variant="outline" onClick={() => open()}>
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
          onClick={onSave}
          disabled={editSaving || !editContent.trim()}
        >
          <Save size={16} />
          {editSaving ? 'Tallennetaan...' : saveLabel}
        </Button>
      </div>
    </div>
  );
}
