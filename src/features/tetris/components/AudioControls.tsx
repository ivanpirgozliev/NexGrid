import { memo } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { Button } from '../../../components/ui/Button';

interface AudioControlsProps {
  masterVolume: number;
  effectsVolume: number;
  muted: boolean;
  onToggleMute: () => void;
  onMasterVolumeChange: (value: number) => void;
  onEffectsVolumeChange: (value: number) => void;
}

function toPercent(value: number): number {
  return Math.round(value * 100);
}

export const AudioControls = memo(function AudioControls({
  masterVolume,
  effectsVolume,
  muted,
  onToggleMute,
  onMasterVolumeChange,
  onEffectsVolumeChange,
}: AudioControlsProps) {
  return (
    <div className={"bg-gray-900/50 border border-gray-800 rounded-xl p-4"}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className={"font-semibold text-gray-500 uppercase tracking-widest text-xs"}>
          Audio
        </p>
        <Button
          type="button"
          variant={muted ? 'danger' : 'secondary'}
          size="sm"
          onClick={onToggleMute}
          className="px-2.5 py-1.5 h-7 text-[11px]"
        >
          {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          {muted ? 'Muted' : 'On'}
        </Button>
      </div>

      <div className={"flex flex-col gap-2"}>
        <label className="block">
          <div className="flex items-center justify-between text-gray-400 text-[10px] mb-1">
            <span>Master</span>
            <span className="tabular-nums">{toPercent(masterVolume)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={toPercent(masterVolume)}
            onChange={(e) => onMasterVolumeChange(Number(e.target.value) / 100)}
            className="w-full accent-cyan-400"
            aria-label="Master volume"
          />
        </label>

        <label className="block">
          <div className="flex items-center justify-between text-gray-400 text-[10px] mb-1">
            <span>Effects</span>
            <span className="tabular-nums">{toPercent(effectsVolume)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={toPercent(effectsVolume)}
            onChange={(e) => onEffectsVolumeChange(Number(e.target.value) / 100)}
            className="w-full accent-cyan-400"
            aria-label="Effects volume"
          />
        </label>
      </div>
    </div>
  );
});
