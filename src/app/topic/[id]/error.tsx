'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function TopicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="layout-page-shell">
      <div className="mb-4">
        <Link href="/" className="app-back-link">
          <ArrowLeft size={16} />
          Takaisin foorumille
        </Link>
      </div>
      <div className="state-card-centered">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Aiheen lataus epäonnistui</h2>
        <p className="text-gray-600 mb-6">
          {error.message || 'Odottamaton virhe tapahtui.'}
        </p>
        <div className="flex items-center justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-gray-800 text-yellow-400 font-bold rounded hover:bg-gray-700 transition"
          >
            Yritä uudelleen
          </button>
        </div>
      </div>
    </div>
  );
}
