export const Button = ({ children, variant = 'primary', onClick, className = '', ...props }) => {
    const variants = {
      primary: 'bg-yellow-400 hover:bg-yellow-500 text-gray-800',
      success: 'bg-green-600 hover:bg-green-700 text-white',
      danger: 'bg-red-600 hover:bg-red-700 text-white',
      dark: 'bg-gray-800 hover:bg-gray-700 text-yellow-400'
    };
  
    return (
      <button
        onClick={onClick}
        className={`px-6 py-3 font-bold rounded transition ${variants[variant]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  };