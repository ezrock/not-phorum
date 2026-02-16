import type { JSX } from 'react';

export const Footer = (): JSX.Element => {
    return (
      <footer className="bg-gray-800 text-yellow-400 py-6 mt-16">
        <div className="max-w-6xl mx-auto text-center">
          <p className="font-bold text-xl mb-2">FREAK ON! FORUM</p>
          <p className="text-sm text-gray-400">Next.js 14 - Phase 1: User System ✓</p>
        </div>
      </footer>
    );
  };
