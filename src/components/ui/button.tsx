interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'success' | 'danger' | 'outline';
  size?: 'sm' | 'md';
  onClick?: () => void;
  className?: string;
}

export const Button = ({ children, variant = 'primary', size = 'md', onClick, className = '', ...props }: ButtonProps) => {
  const variants = {
    primary: 'bg-[var(--button-primary-bg)] hover:bg-[var(--button-primary-bg-hover)] text-[var(--button-primary-text)] border-2 border-transparent',
    success: 'bg-green-600 hover:bg-green-700 text-white border-2 border-transparent',
    danger: 'bg-red-600 hover:bg-red-700 text-white border-2 border-transparent',
    outline: 'border-2 border-gray-300 hover:border-gray-400 text-gray-700 bg-[var(--color-white)]'
  };

  const sizes = {
    sm: 'px-4 py-2',
    md: 'px-6 py-3',
  };

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 ${sizes[size]} font-bold rounded transition ${variants[variant] || variants.primary} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
