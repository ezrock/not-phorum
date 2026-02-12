export const Card = ({ children, className = '' }) => {
    return (
      <div className={`bg-white rounded-lg shadow-lg p-8 ${className}`}>
        {children}
      </div>
    );
  };