import { type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', id, ...rest }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-gray-300">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`
          w-full bg-gray-900/80 border rounded-xl px-4 py-2.5 text-gray-100
          placeholder-gray-500 text-sm outline-none transition-all duration-150
          ${error ? 'border-red-500 focus:ring-1 focus:ring-red-500' : 'border-gray-700 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50'}
          ${className}
        `}
        {...rest}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
