import { memo } from 'react';

const keys = [
  { key: '← →', action: 'Move' },
  { key: '↑ / X', action: 'Rotate' },
  { key: '↓', action: 'Soft drop' },
  { key: 'Space', action: 'Hard drop' },
  { key: 'P / Esc', action: 'Pause' },
];

export const Controls = memo(function Controls() {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Controls</p>
      <div className="flex flex-col gap-2">
        {keys.map(({ key, action }) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <kbd className="px-2 py-0.5 bg-gray-800 border border-gray-700 rounded-md text-gray-300 text-xs font-mono whitespace-nowrap">
              {key}
            </kbd>
            <span className="text-gray-500 text-xs text-right">{action}</span>
          </div>
        ))}
      </div>
    </div>
  );
});
