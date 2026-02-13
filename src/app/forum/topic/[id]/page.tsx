'use client';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { mockCategories, mockTopics, mockPosts, mockUsers } from '@/lib/mockData';
import Link from 'next/link';
import { ArrowLeft, Heart, MessageSquare, Edit2, Flag } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function TopicPage() {
  const params = useParams();
  const { currentUser } = useAuth();
  const topicId = parseInt(params.id as string);

  // Find the topic
  const topic = mockTopics.find((t) => t.id === topicId);

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

  const category = mockCategories.find((cat) => cat.id === topic.categoryId);

  // Get posts for this topic
  const topicPosts = mockPosts.filter((post) => post.topicId === topicId);
  const sortedPosts = [...topicPosts].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('fi-FI', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="max-w-6xl mx-auto mt-8 px-4 mb-12">
      {/* Breadcrumb Navigation */}
      <div className="mb-6 flex items-center gap-2 text-sm">
        <Link href="/forum" className="text-yellow-600 hover:underline">
          Foorumi
        </Link>
        <span className="text-gray-400">/</span>
        <span className="text-yellow-600">{category?.name}</span>
        <span className="text-gray-400">/</span>
        <span className="text-gray-600">{topic.title}</span>
      </div>

      {/* Topic Header */}
      <Card className="mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <span className="text-4xl">{category?.icon}</span>
            <div>
              <h1 className="text-3xl font-bold mb-2">{topic.title}</h1>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="text-yellow-600 font-medium">{category?.name}</span>
                <span>{topic.views} katselua</span>
                <span>{topic.replyCount} vastausta</span>
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
        {sortedPosts.map((post, index) => {
          const author = mockUsers.find((user) => user.id === post.authorId);
          const isOriginalPost = index === 0;

          return (
            <Card key={post.id} className={isOriginalPost ? 'border-yellow-400 border-2' : ''}>
              <div className="flex gap-4">
                {/* Author Info Sidebar */}
                <div className="w-32 flex-shrink-0 text-center border-r-2 border-gray-200 pr-4">
                  <div className="text-5xl mb-2">{author?.avatar}</div>
                  <p className="font-bold text-sm mb-1">{author?.username}</p>
                  <p className="text-xs text-gray-500 mb-2">{author?.posts} viestiä</p>
                  <p className="text-xs text-gray-400">
                    Liittynyt {author?.joinDate}
                  </p>
                </div>

                {/* Post Content */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div className="text-sm text-gray-500">
                      {formatDateTime(post.createdAt)}
                      {post.editedAt && (
                        <span className="ml-2 text-xs">
                          (Muokattu: {formatDateTime(post.editedAt)})
                        </span>
                      )}
                    </div>

                    {currentUser && (
                      <div className="flex gap-2">
                        {currentUser.id === post.authorId && (
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
            className="w-full border-2 border-gray-300 rounded-lg p-3 mb-4 min-h-[150px] focus:border-yellow-400 focus:outline-none"
            placeholder="Kirjoita vastauksesi..."
          />
          <Button
            variant="success"
            className="flex items-center gap-2"
            onClick={() => alert('Vastauksen lähettäminen tulossa pian!')}
          >
            <MessageSquare size={16} />
            Lähetä vastaus
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
