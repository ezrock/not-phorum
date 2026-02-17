'use client';

import Link from 'next/link';

export default function ForumError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="max-w-6xl mx-auto mt-8 px-4">
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Foorumin lataus epäonnistui</h2>
        <p className="text-gray-600 mb-6">
          {error.message || 'Odottamaton virhe tapahtui.'}
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={reset}
            className="px-6 py-3 bg-gray-800 text-yellow-400 font-bold rounded hover:bg-gray-700 transition"
          >
            Yritä uudelleen
          </button>
          <Link
            href="/"
            className="px-6 py-3 border border-gray-300 text-gray-700 font-bold rounded hover:bg-gray-50 transition"
          >
            Etusivulle
          </Link>
        </div>
      </div>
    </div>
  );
}
