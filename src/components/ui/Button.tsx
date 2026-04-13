import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { motion } from 'framer-motion';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  children: ReactNode;
}

const variantClasses: Record<string, string> = {
  primary:
    'bg-cyan-500 hover:bg-cyan-400 text-gray-950 font-semibold shadow-lg shadow-cyan-500/25',
  secondary:
    'bg-gray-800 hover:bg-gray-700 text-gray-100 border border-gray-700',
  ghost: 'bg-transparent hover:bg-gray-800 text-gray-300',
  danger: 'bg-red-600 hover:bg-red-500 text-white font-semibold shadow-lg shadow-red-500/25',
};

const sizeClasses: Record<string, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-5 py-2.5 text-sm rounded-xl',
  lg: 'px-7 py-3.5 text-base rounded-xl',
};

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      whileHover={{ scale: 1.02 }}
      disabled={disabled || isLoading}
      className={`
        inline-flex items-center justify-center gap-2 transition-colors duration-150
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
      {...(rest as Parameters<typeof motion.button>[0])}
    >
      {isLoading ? (
        <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
      ) : null}
      {children}
    </motion.button>
  );
}
