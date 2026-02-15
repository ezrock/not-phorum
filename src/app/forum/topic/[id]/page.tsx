'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, MessageSquare, Edit2, ImagePlus, X, Trash2, Save } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { CldUploadWidget } from 'next-cloudinary';
import { profileThumb, postImage, postThumb } from '@/lib/cloudinary';
import ReactMarkdown from 'react-markdown';

interface Post {
  id: number;
  content: string;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  image_url: string | null;
  author: {
    id: string;
    username: string;
    avatar: string;
    profile_image_url: string | null;
    created_at: string;
    signature: string | null;
    show_signature: boolean;
  } | null;
}

interface Topic {
  id: number;
  title: string;
  views: number;
  category: { name: string; icon: string } | null;
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

export default function TopicPage() {
  const params = useParams();
  const { currentUser, supabase } = useAuth();
  const topicId = parseInt(params.id as string);

  const [topic, setTopic] = useState<Topic | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyContent, setReplyContent] = useState('');
  const [replyImageUrl, setReplyImageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [topicRes, postsRes] = await Promise.all([
        supabase
          .from('topics')
          .select(`
            id, title, views,
            category:categories(name, icon)
          `)
          .eq('id', topicId)
          .single(),
        supabase
          .from('posts')
          .select(`
            id, content, created_at, updated_at, deleted_at, image_url,
            author:profiles!author_id(id, username, avatar, profile_image_url, created_at, signature, show_signature)
          `)
          .eq('topic_id', topicId)
          .order('created_at', { ascending: true }),
      ]);

      if (!topicRes.error && topicRes.data) {
        setTopic(topicRes.data as Topic);
      }
      if (!postsRes.error && postsRes.data) {
        setPosts(postsRes.data as Post[]);
      }
      setLoading(false);
    };

    fetchData();
  }, [supabase, topicId]);

  useEffect(() => {
    if (!Number.isFinite(topicId)) return;
    supabase.rpc('increment_topic_views', { target_topic_id: topicId });
  }, [supabase, topicId]);

  const handleReply = async () => {
    if (!replyContent.trim() || !currentUser) return;
    setSubmitting(true);

    const { data, error } = await supabase
      .from('posts')
      .insert({
        topic_id: topicId,
        author_id: currentUser.id,
        content: replyContent.trim(),
        image_url: replyImageUrl || null,
      })
      .select(`
        id, content, created_at, updated_at, deleted_at, image_url,
        author:profiles!author_id(id, username, avatar, profile_image_url, created_at)
      `)
      .single();

    if (!error && data) {
      setPosts((prev) => [...prev, data as Post]);
      setReplyContent('');
      setReplyImageUrl('');
    }
    setSubmitting(false);
  };

  const startEditing = (post: Post) => {
    setEditingPostId(post.id);
    setEditContent(post.content);
    setEditImageUrl(post.image_url || '');
  };

  const cancelEditing = () => {
    setEditingPostId(null);
    setEditContent('');
    setEditImageUrl('');
  };

  const handleEditSave = async (postId: number) => {
    if (!editContent.trim() || !currentUser) return;
    setEditSaving(true);

    const { data, error } = await supabase
      .from('posts')
      .update({
        content: editContent.trim(),
        image_url: editImageUrl || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId)
      .eq('author_id', currentUser.id)
      .select(`
        id, content, created_at, updated_at, deleted_at, image_url,
        author:profiles!author_id(id, username, avatar, profile_image_url, created_at)
      `)
      .single();

    if (!error && data) {
      setPosts((prev) => prev.map((p) => (p.id === postId ? (data as Post) : p)));
      setEditingPostId(null);
    }
    setEditSaving(false);
  };

  const handleDelete = async (postId: number) => {
    if (!currentUser) return;

    const { data, error } = await supabase
      .from('posts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', postId)
      .eq('author_id', currentUser.id)
      .select(`
        id, content, created_at, updated_at, deleted_at, image_url,
        author:profiles!author_id(id, username, avatar, profile_image_url, created_at)
      `)
      .single();

    if (!error && data) {
      setPosts((prev) => prev.map((p) => (p.id === postId ? (data as Post) : p)));
    }
    setDeleteConfirmId(null);
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('fi-FI', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fi-FI');
  };

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
            <Button className="mt-4" onClick={() => {}}>Takaisin foorumille</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto mt-8 px-4 mb-12">
      {/* Breadcrumb Navigation */}
      <div className="mb-6 flex items-center gap-2 text-sm">
        <Link href="/forum" className="text-yellow-600 hover:underline">
          Foorumi
        </Link>
        <span className="text-gray-400">/</span>
        <span className="text-yellow-600">{topic.category?.name}</span>
        <span className="text-gray-400">/</span>
        <span className="text-gray-600">{topic.title}</span>
      </div>

      {/* Topic Header */}
      <Card className="mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <span className="text-4xl">{topic.category?.icon}</span>
            <div>
              <h1 className="text-3xl font-bold mb-2">{topic.title}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="text-yellow-600 font-medium">{topic.category?.name}</span>
                <span>{topic.views} katselua</span>
                <span>{posts.length} vastausta</span>
              </div>
            </div>
          </div>
          <Link href="/forum">
            <Button variant="outline" className="flex items-center gap-2" onClick={() => {}}>
              <ArrowLeft size={16} />
              Takaisin
            </Button>
          </Link>
        </div>
      </Card>

      {/* Posts */}
      <div className="space-y-4">
        {posts.map((post, index) => {
          const isOriginalPost = index === 0;

          return (
            <Card key={post.id} className={isOriginalPost ? 'border-yellow-400 border-2' : ''}>
              <div className="flex gap-4">
                {/* Author Info Sidebar */}
                <Link href={`/profile/${post.author?.id}`} className="w-32 flex-shrink-0 text-center border-r-2 border-gray-200 pr-4 hover:opacity-80">
                  {post.author?.profile_image_url ? (
                    <img src={profileThumb(post.author.profile_image_url)} alt={post.author.username} className="w-14 h-14 rounded-full object-cover mx-auto mb-2" />
                  ) : (
                    <div className="text-5xl mb-2">{post.author?.avatar}</div>
                  )}
                  <p className="font-bold text-sm mb-1">{post.author?.username}</p>
                  <p className="text-xs text-gray-400">
                    Liittynyt {post.author?.created_at ? formatDate(post.author.created_at) : ''}
                  </p>
                </Link>

                {/* Post Content */}
                {post.deleted_at ? (
                  <div className="flex-1 flex items-center">
                    <p className="text-gray-400 italic py-4">Tämä viesti on poistettu.</p>
                  </div>
                ) : editingPostId === post.id ? (
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
                          if (secureUrl) {
                            setEditImageUrl(secureUrl);
                          }
                        }}
                      >
                        {({ open }) => (
                          <Button type="button" variant="outline" className="flex items-center gap-2" onClick={() => open()}>
                            <ImagePlus size={16} />
                            {editImageUrl ? 'Vaihda kuva' : 'Lisää kuva'}
                          </Button>
                        )}
                      </CldUploadWidget>
                      <Button variant="outline" onClick={cancelEditing}>
                        Peruuta
                      </Button>
                      <Button
                        variant="success"
                        className="flex items-center gap-2"
                        onClick={() => handleEditSave(post.id)}
                        disabled={editSaving || !editContent.trim()}
                      >
                        <Save size={16} />
                        {editSaving ? 'Tallennetaan...' : 'Tallenna'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <div className="text-sm text-gray-500">
                        {formatDateTime(post.created_at)}
                        {post.updated_at && (
                          <span className="ml-2 text-xs">
                            (Muokattu: {formatDateTime(post.updated_at)})
                          </span>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {currentUser && currentUser.id === post.author?.id && (
                          <>
                            <button
                              className="text-gray-500 hover:text-yellow-600"
                              onClick={() => startEditing(post)}
                              title="Muokkaa"
                            >
                              <Edit2 size={16} />
                            </button>
                            {!isOriginalPost && (
                              deleteConfirmId === post.id ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-xs text-red-600">Poistetaanko?</span>
                                  <button
                                    className="text-red-600 hover:text-red-800 text-xs font-bold"
                                    onClick={() => handleDelete(post.id)}
                                  >
                                    Kyllä
                                  </button>
                                  <button
                                    className="text-gray-500 hover:text-gray-700 text-xs"
                                    onClick={() => setDeleteConfirmId(null)}
                                  >
                                    Ei
                                  </button>
                                </div>
                              ) : (
                                <button
                                  className="text-gray-500 hover:text-red-600"
                                  onClick={() => setDeleteConfirmId(post.id)}
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

                    <div className="prose max-w-none mb-4">
                      <ReactMarkdown>{post.content}</ReactMarkdown>
                      {post.image_url && (
                        <img src={postImage(post.image_url)} alt="Liite" className="mt-3 max-w-full max-h-96 rounded-lg" />
                      )}
                    </div>

                    {post.author?.signature && post.author?.show_signature && (
                      <div className="pt-3 mt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-400 italic whitespace-pre-wrap">{post.author.signature}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-4 pt-3 border-t border-gray-200">
                      <button className="flex items-center gap-1 text-sm text-gray-600 hover:text-yellow-600 transition">
                        <MessageSquare size={16} />
                        <span>Vastaa</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Reply Box */}
      {currentUser ? (
        <Card className="mt-6">
          <h3 className="text-xl font-bold mb-4">Vastaa aiheeseen</h3>
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            className="w-full border-2 border-gray-300 rounded-lg p-3 mb-4 min-h-[150px] focus:border-yellow-400 focus:outline-none"
            placeholder="Kirjoita vastauksesi..."
          />
          {replyImageUrl && (
            <div className="relative inline-block mb-4">
              <img src={postThumb(replyImageUrl)} alt="Liite" className="max-h-40 rounded-lg" />
              <button
                type="button"
                onClick={() => setReplyImageUrl('')}
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
                  setReplyImageUrl(secureUrl);
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
              variant="success"
              className="flex items-center gap-2"
              onClick={handleReply}
              disabled={submitting || !replyContent.trim()}
            >
              <MessageSquare size={16} />
              {submitting ? 'Lähetetään...' : 'Lähetä vastaus'}
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="mt-6 text-center">
          <p className="text-gray-600 mb-4">
            Kirjaudu sisään vastataksesi tähän aiheeseen
          </p>
          <Link href="/login">
            <Button onClick={() => {}}>Kirjaudu sisään</Button>
          </Link>
        </Card>
      )}
    </div>
  );
}
