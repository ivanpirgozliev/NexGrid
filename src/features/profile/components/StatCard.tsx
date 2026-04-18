import { type ReactNode } from 'react';
import { motion } from 'framer-motion';

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  sublabel?: string;
  accentColor: string;
  delay?: number;
}

export function StatCard({ icon, label, value, sublabel, accentColor, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="relative group"
    >
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl -z-10"
        style={{ background: `linear-gradient(135deg, ${accentColor}15, transparent)` }}
      />
      <div className="rounded-2xl border border-gray-800 bg-gray-900/50 backdrop-blur-sm p-5 sm:p-6 hover:border-gray-700 transition-colors duration-300">
        <div className="flex items-start justify-between mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${accentColor}15`, border: `1px solid ${accentColor}30` }}
          >
            {icon}
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-2xl sm:text-3xl font-bold text-white tabular-nums tracking-tight">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          <p className="text-sm font-medium text-gray-400">{label}</p>
          {sublabel && (
            <p className="text-xs text-gray-600">{sublabel}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
