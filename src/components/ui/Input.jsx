export const Input = ({ label = undefined, icon: Icon = undefined, className = '', ...props }) => {
    if (label || Icon) {
      return (
        <div>
          <label className="flex items-center gap-2 mb-2 font-semibold">
            {Icon && <Icon size={20} />}
            {label}
          </label>
          <input
            className={`w-full px-4 py-2 border-2 border-gray-300 rounded focus:border-yellow-400 focus:outline-none ${className}`}
            {...props}
          />
        </div>
      );
    }

    return (
      <input
        className={`w-full px-4 py-2 border-2 border-gray-300 rounded focus:border-yellow-400 focus:outline-none ${className}`}
        {...props}
      />
    );
  };