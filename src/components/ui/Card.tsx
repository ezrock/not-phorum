import type { JSX, ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export const Card = ({ children, className = '' }: CardProps): JSX.Element => {
    return (
      <div className={`bg-white rounded-lg shadow-lg p-8 ${className}`}>
        {children}
      </div>
    );
  };
