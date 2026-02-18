import type { JSX, ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

export const Card = ({ children, className = '' }: CardProps): JSX.Element => {
  return (
    <div className={`app-card card-padding-default rounded-lg shadow-lg ${className}`}>
      {children}
    </div>
  );
};
