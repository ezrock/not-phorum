import type { JSX } from 'react';

export const Footer = (): JSX.Element => {
  return (
    <footer className="app-footer py-6 mt-16">
      <div className="max-w-6xl mx-auto text-center">
        <a
          href="https://github.com/ezrock/not-phorum"
          target="_blank"
          rel="noopener noreferrer"
          className="app-link"
        >
          GitHub
        </a>
      </div>
    </footer>
  );
};
