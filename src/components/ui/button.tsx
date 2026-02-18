interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'success' | 'danger' | 'dark' | 'outline';
  onClick?: () => void;
  className?: string;
}

export const Button = ({ children, variant = 'primary', onClick, className = '', ...props }: ButtonProps) => {
  const variants = {
    primary: 'bg-[var(--button-primary-bg)] hover:bg-[var(--button-primary-bg-hover)] text-[var(--button-primary-text)]',
    success: 'bg-green-600 hover:bg-green-700 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    dark: 'bg-gray-800 hover:bg-gray-700 text-yellow-400',
    outline: 'border-2 border-gray-300 hover:border-gray-400 text-gray-700 bg-[var(--color-white)]'
  };

  return (
    <button
      onClick={onClick}
      className={`px-6 py-3 font-bold rounded transition ${variants[variant] || variants.primary} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
