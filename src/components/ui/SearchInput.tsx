'use client';

import { Search } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  wrapperClassName?: string;
  inputClassName?: string;
}

export function SearchInput({ wrapperClassName = '', inputClassName = '', ...props }: SearchInputProps) {
  return (
    <div className={`relative ${wrapperClassName}`}>
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
      <input
        type="text"
        {...props}
        className={`w-full rounded px-4 py-2 pl-9 border-2 border-gray-300 bg-white focus:border-yellow-400 focus:outline-none ${inputClassName}`}
      />
    </div>
  );
}
