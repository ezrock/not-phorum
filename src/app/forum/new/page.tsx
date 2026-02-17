'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { CldUploadWidget } from 'next-cloudinary';
import Link from 'next/link';
import { ArrowLeft, Send, ImagePlus, X } from 'lucide-react';
import { postThumb } from '@/lib/cloudinary';

interface Category {
  id: number;
  name: string;
  icon: string;
  era: string | null;
  sort_order: number;
  parent_id: number | null;
}

interface CloudinaryUploadResult {
  info?: {
    secure_url?: string;
  };
}

function extractSecureUrl(result: unknown): string | null {
  const typed = result as CloudinaryUploadResult;
  return typed?.info?.secure_url ?? null;
}

export default function NewTopicPage() {
  const { supabase } = useAuth();
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchCategories = async () => {
      const { data } = await supabase
        .from('categories')
        .select('id, name, icon, era, sort_order, parent_id')
        .order('sort_order');

      if (data) {
        setCategories(data as Category[]);
        const offTopic = data.find((c: Category) => c.name.toLowerCase() === 'off-topic');
        if (offTopic) setCategoryId(offTopic.id);
      }
    };

    fetchCategories();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!categoryId) {
      setError('Valitse kategoria');
      return;
    }
    if (title.trim().length < 1) {
      setError('Kirjoita otsikko');
      return;
    }
    if (title.trim().length < 3) {
      setError('Otsikon pitää olla vähintään 3 merkkiä');
      return;
    }
    if (content.trim().length < 1) {
      setError('Kirjoita viestin sisältö');
      return;
    }

    setSubmitting(true);

    try {
      const { data: topicIdResult, error: createError } = await supabase.rpc('create_topic_with_post', {
        input_category_id: categoryId,
        input_title: title.trim(),
        input_content: content.trim(),
        input_image_url: imageUrl || null,
      });

      if (createError || typeof topicIdResult !== 'number') {
        throw createError ?? new Error('Langan luominen feilasi');
      }

      router.push(`/forum/topic/${topicIdResult}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Langan luominen feilasi';
      setError(message);
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto mt-8 px-4 mb-12">
      <div className="mb-6">
        <Link href="/forum" className="flex items-center gap-2 text-yellow-600 hover:underline text-sm">
          <ArrowLeft size={16} />
          Takaisin lankoihin
        </Link>
      </div>

      <Card>
        <h1 className="text-3xl font-bold mb-6">Uusi lanka</h1>

        {error && <Alert variant="error">{error}</Alert>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="category" className="block text-sm font-medium mb-1">
              Kategoria
            </label>
            <select
              id="category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}
              className="w-full border-2 border-gray-300 rounded-lg p-3 focus:border-yellow-400 focus:outline-none bg-white"
              required
            >
              <option value="">Valitse kategoria...</option>
              {categories
                .filter((c) => !c.parent_id)
                .map((parent) => (
                  <optgroup key={parent.id} label={parent.name}>
                    {categories
                      .filter((c) => c.parent_id === parent.id)
                      .map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.icon} {cat.name}{cat.era ? ` (${cat.era})` : ''}
                        </option>
                      ))}
                  </optgroup>
                ))}
            </select>
          </div>

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
              className="w-full border-2 border-gray-300 rounded-lg p-3 min-h-[200px] focus:border-yellow-400 focus:outline-none"
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

          <div className="flex items-center gap-2">
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
              type="submit"
              variant="primary"
              disabled={submitting}
              className="flex items-center gap-2"
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
