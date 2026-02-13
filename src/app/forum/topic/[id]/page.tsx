'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Heart, MessageSquare, Edit2, Flag } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface Post {
  id: number;
  content: string;
  created_at: string;
  edited_at: string | null;
  likes: number;
  author: {
    id: string;
    username: string;
    avatar: string;
    created_at: string;
  } | null;
}

interface Topic {
  id: number;
  title: string;
  views: number;
  reply_count: number;
  category: { name: string; icon: string } | null;
}

export default function TopicPage() {
  const params = useParams();
  const { currentUser, supabase } = useAuth();
  const topicId = parseInt(params.id as string);

  const [topic, setTopic] = useState<Topic | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const [topicRes, postsRes] = await Promise.all([
        supabase
          .from('topics')
          .select(`
            id, title, views, reply_count,
            category:categories(name, icon)
          `)
          .eq('id', topicId)
          .single(),
        supabase
          .from('posts')
          .select(`
            id, content, created_at, edited_at, likes,
            author:profiles!author_id(id, username, avatar, created_at)
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

  const handleReply = async () => {
    if (!replyContent.trim() || !currentUser) return;
    setSubmitting(true);

    const { data, error } = await supabase
      .from('posts')
      .insert({
        topic_id: topicId,
        author_id: currentUser.id,
        content: replyContent.trim(),
      })
      .select(`
        id, content, created_at, edited_at, likes,
        author:profiles!author_id(id, username, avatar, created_at)
      `)
      .single();

    if (!error && data) {
      setPosts((prev) => [...prev, data as Post]);
      setReplyContent('');
    }
    setSubmitting(false);
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
                <span>{topic.reply_count} vastausta</span>
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
                <div className="w-32 flex-shrink-0 text-center border-r-2 border-gray-200 pr-4">
                  <div className="text-5xl mb-2">{post.author?.avatar}</div>
                  <p className="font-bold text-sm mb-1">{post.author?.username}</p>
                  <p className="text-xs text-gray-400">
                    Liittynyt {post.author?.created_at ? formatDate(post.author.created_at) : ''}
                  </p>
                </div>

                {/* Post Content */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div className="text-sm text-gray-500">
                      {formatDateTime(post.created_at)}
                      {post.edited_at && (
                        <span className="ml-2 text-xs">
                          (Muokattu: {formatDateTime(post.edited_at)})
                        </span>
                      )}
                    </div>

                    {currentUser && (
                      <div className="flex gap-2">
                        {currentUser.id === post.author?.id && (
                          <button className="text-gray-500 hover:text-yellow-600">
                            <Edit2 size={16} />
                          </button>
                        )}
                        <button className="text-gray-500 hover:text-red-600">
                          <Flag size={16} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="prose max-w-none mb-4">
                    <p className="text-gray-700 whitespace-pre-wrap">{post.content}</p>
                  </div>

                  <div className="flex items-center gap-4 pt-3 border-t border-gray-200">
                    <button className="flex items-center gap-1 text-sm text-gray-600 hover:text-red-600 transition">
                      <Heart size={16} />
                      <span>{post.likes}</span>
                    </button>
                    <button className="flex items-center gap-1 text-sm text-gray-600 hover:text-yellow-600 transition">
                      <MessageSquare size={16} />
                      <span>Vastaa</span>
                    </button>
                  </div>
                </div>
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
          <Button
            variant="success"
            className="flex items-center gap-2"
            onClick={handleReply}
            disabled={submitting || !replyContent.trim()}
          >
            <MessageSquare size={16} />
            {submitting ? 'Lähetetään...' : 'Lähetä vastaus'}
          </Button>
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
