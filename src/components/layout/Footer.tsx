import type { JSX } from 'react';

export const Footer = (): JSX.Element => {
  return (
    <footer className="py-6 mt-16">
      <div className="max-w-6xl mx-auto text-center">
        <a
          href="https://github.com/ezrock/not-phorum"
          target="_blank"
          rel="noopener noreferrer"
          className="text-yellow-700 hover:text-yellow-800 underline underline-offset-2"
        >
          GitHub
        </a>
      </div>
    </footer>
  );
};
