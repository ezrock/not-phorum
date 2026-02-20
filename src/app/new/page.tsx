'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { CldUploadWidget } from 'next-cloudinary';
import Link from 'next/link';
import { ArrowLeft, Send, ImagePlus, X } from 'lucide-react';
import { extractSecureUrl, postThumb } from '@/lib/cloudinary';
import { getCloudinaryUploadPresetOrThrow, getPostUploadWidgetOptions } from '@/lib/cloudinaryWidget';
import { AddTags, type TagOption } from '@/components/forum/AddTags';
import { getFirstValidationError, rules, validate } from '@/lib/validation';
import { handleMarkdownTextareaShortcut } from '@/lib/markdownShortcuts';

export default function NewTopicPage() {
  const { supabase } = useAuth();
  const router = useRouter();
  const uploadPreset = getCloudinaryUploadPresetOrThrow();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedTags, setSelectedTags] = useState<TagOption[]>([]);
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validation = validate(
      { title: title.trim(), content: content.trim() },
      {
        title: [
          rules.required('Kirjoita otsikko'),
          rules.minLength(3, 'Otsikon pitää olla vähintään 3 merkkiä'),
        ],
        content: [
          rules.required('Kirjoita viestin sisältö'),
        ],
      }
    );
    const firstError = getFirstValidationError(validation);
    if (firstError) {
      setError(firstError);
      return;
    }
    setSubmitting(true);

    try {
      const { data: topicIdResult, error: createError } = await supabase.rpc('create_topic_with_post', {
        input_title: title.trim(),
        input_content: content.trim(),
        input_image_url: imageUrl || null,
        input_tag_ids: selectedTags.map((tag) => tag.id),
      });

      if (createError || typeof topicIdResult !== 'number') {
        throw createError ?? new Error('Langan luominen feilasi');
      }

      router.push(`/topic/${topicIdResult}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Langan luominen feilasi';
      setError(message);
      setSubmitting(false);
    }
  };

  return (
    <div className="layout-page-shell-thread max-w-4xl">
      <div className="mb-6">
        <Link href="/" className="app-back-link">
          <ArrowLeft size={16} />
          Takaisin lankoihin
        </Link>
      </div>

      <Card>
        <h1 className="text-3xl font-bold mb-6">Uusi lanka</h1>

        {error && <Alert variant="error">{error}</Alert>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-1">
              Otsikko
            </label>
            <Input
              id="title"
              value={title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
              placeholder="Langan otsikko"
              required
            />
          </div>

          <div>
            <label htmlFor="content" className="block text-sm font-medium mb-1">
              Viesti
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => {
                handleMarkdownTextareaShortcut(e, content, setContent);
              }}
              className="field-textarea field-textarea--new-topic"
              placeholder="Kirjoita viestisi..."
              required
            />
            <p className="mt-2 text-xs text-gray-500">
              <a
                href="https://www.markdownguide.org/cheat-sheet/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-yellow-700 hover:underline"
              >
                Muotoile viesti Markdownilla
              </a>
            </p>
          </div>

          <AddTags
            selected={selectedTags}
            onChange={setSelectedTags}
            disabled={submitting}
            maxSelected={1}
            featuredOnly={null}
            label="Tagi"
            placeholder="Valitse tagi (jos tyhjä, käytetään off-topic)"
          />

          {imageUrl && (
            <div className="relative inline-block">
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
                <Button type="button" variant="outline" className="flex items-center gap-2" onClick={() => open()}>
                  <ImagePlus size={16} />
                  Lisää kuva
                </Button>
              )}
            </CldUploadWidget>
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
              className="composer-actions-submit flex items-center gap-2"
            >
              <Send size={16} />
              {submitting ? 'Luodaan...' : 'Luo lanka'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
