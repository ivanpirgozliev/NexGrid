import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { User, Gamepad2, Target, Flame, RefreshCw, Upload, Trash2 } from 'lucide-react';
import Cropper, { type Area } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { useAuthContext } from '../../auth/context/AuthContext';
import { useUserStats } from '../hooks/useUserStats';
import { useUserProfile } from '../hooks/useUserProfile';
import { StatCard } from '../components/StatCard';
import { Button } from '../../../components/ui/Button';
import { authService } from '../../../services/auth.service';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const MAX_SOURCE_AVATAR_BYTES = 8 * 1024 * 1024;
const AVATAR_OUTPUT_SIZE = 512;
const AVATAR_MIN_OUTPUT_SIZE = 256;
const AVATAR_START_QUALITY = 0.9;
const AVATAR_MIN_QUALITY = 0.55;
const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'Something went wrong. Please try again.';
}

function validateAvatarSourceFile(file: File): string | null {
  if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
    return 'Use PNG, JPG, or WEBP images only.';
  }

  if (file.size > MAX_SOURCE_AVATAR_BYTES) {
    return 'Image must be 8MB or smaller before cropping.';
  }

  return null;
}

function validateAvatarUploadFile(file: File): string | null {
  if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
    return 'Use PNG, JPG, or WEBP images only.';
  }

  if (file.size > MAX_AVATAR_BYTES) {
    return 'Image must be 2MB or smaller.';
  }

  return null;
}

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) {
    return `${mb.toFixed(1)}MB`;
  }

  const kb = bytes / 1024;
  return `${Math.round(kb)}KB`;
}

function stripFileExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '');
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to read image file'));
    image.src = source;
  });
}

function drawCroppedAvatar(image: HTMLImageElement, cropPixels: Area, outputSize: number) {
  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Image processing is not available in this browser');
  }

  const sx = Math.max(0, Math.floor(cropPixels.x));
  const sy = Math.max(0, Math.floor(cropPixels.y));
  const sw = Math.max(1, Math.floor(cropPixels.width));
  const sh = Math.max(1, Math.floor(cropPixels.height));

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, sx, sy, sw, sh, 0, 0, outputSize, outputSize);

  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to prepare avatar image'));
          return;
        }

        resolve(blob);
      },
      'image/webp',
      quality
    );
  });
}

async function createCroppedAvatarFile(
  imageSource: string,
  cropPixels: Area,
  originalFileName: string
): Promise<File> {
  const image = await loadImage(imageSource);
  let outputSize = AVATAR_OUTPUT_SIZE;
  let quality = AVATAR_START_QUALITY;

  let blob = await canvasToBlob(drawCroppedAvatar(image, cropPixels, outputSize), quality);

  while (blob.size > MAX_AVATAR_BYTES) {
    if (quality > AVATAR_MIN_QUALITY) {
      quality = Math.max(AVATAR_MIN_QUALITY, Number((quality - 0.08).toFixed(2)));
    } else if (outputSize > AVATAR_MIN_OUTPUT_SIZE) {
      outputSize = Math.max(AVATAR_MIN_OUTPUT_SIZE, outputSize - 64);
      quality = AVATAR_START_QUALITY;
    } else {
      break;
    }

    blob = await canvasToBlob(drawCroppedAvatar(image, cropPixels, outputSize), quality);
  }

  if (blob.size > MAX_AVATAR_BYTES) {
    throw new Error(
      `Could not shrink the image under ${formatBytes(MAX_AVATAR_BYTES)}. Try another photo.`
    );
  }

  const baseName = stripFileExtension(originalFileName) || 'avatar';
  return new File([blob], `${baseName}.webp`, { type: 'image/webp' });
}

export function ProfilePage() {
  const { user, username } = useAuthContext();
  const { data: stats, isLoading, isError, refetch, isFetching } = useUserStats();
  const {
    data: profile,
    isLoading: isProfileLoading,
    isError: isProfileError,
    refetch: refetchProfile,
    isFetching: isProfileFetching,
  } = useUserProfile();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarVersion, setAvatarVersion] = useState(() => Date.now());
  const [cropImageSource, setCropImageSource] = useState<string | null>(null);
  const [cropImageName, setCropImageName] = useState('avatar');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessingAvatar, setIsProcessingAvatar] = useState(false);

  useEffect(() => {
    return () => {
      if (cropImageSource) {
        URL.revokeObjectURL(cropImageSource);
      }
    };
  }, [cropImageSource]);

  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error('Not authenticated');
      return authService.uploadAvatar(user.id, file);
    },
    onSuccess: async () => {
      setAvatarError(null);
      setAvatarVersion(Date.now());
      await refetchProfile();
    },
    onError: (error) => {
      setAvatarError(getErrorMessage(error));
    },
  });

  const removeAvatarMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      return authService.removeAvatar(user.id);
    },
    onSuccess: async () => {
      setAvatarError(null);
      setAvatarVersion(Date.now());
      await refetchProfile();
    },
    onError: (error) => {
      setAvatarError(getErrorMessage(error));
    },
  });

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : '';

  const avatarUrl = profile?.avatar_url ?? null;
  const avatarSrc = avatarUrl
    ? `${avatarUrl}${avatarUrl.includes('?') ? '&' : '?'}v=${avatarVersion}`
    : null;
  const displayName = profile?.username ?? username ?? 'Player';
  const isAvatarLoading =
    uploadAvatarMutation.isPending || removeAvatarMutation.isPending || isProcessingAvatar;
  const isCropDialogOpen = Boolean(cropImageSource);
  const isPageLoading = isLoading || isProfileLoading;
  const hasLoadError = isError || isProfileError;

  function closeCropDialog() {
    if (cropImageSource) {
      URL.revokeObjectURL(cropImageSource);
    }

    setCropImageSource(null);
    setCropImageName('avatar');
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setIsProcessingAvatar(false);
  }

  function handleChooseAvatar() {
    fileInputRef.current?.click();
  }

  function handleAvatarSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file || !user) return;

    const validationError = validateAvatarSourceFile(file);
    if (validationError) {
      setAvatarError(validationError);
      return;
    }

    if (cropImageSource) {
      URL.revokeObjectURL(cropImageSource);
    }

    const localPreviewUrl = URL.createObjectURL(file);

    setAvatarError(null);
    setCropImageName(file.name);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setCropImageSource(localPreviewUrl);
  }

  function handleRemoveAvatar() {
    if (!user || !avatarUrl) return;
    setAvatarError(null);
    removeAvatarMutation.mutate();
  }

  async function handleCropAndUploadAvatar() {
    if (!user || !cropImageSource || !croppedAreaPixels) return;

    setIsProcessingAvatar(true);

    try {
      const processedFile = await createCroppedAvatarFile(
        cropImageSource,
        croppedAreaPixels,
        cropImageName
      );

      const uploadValidationError = validateAvatarUploadFile(processedFile);
      if (uploadValidationError) {
        setAvatarError(uploadValidationError);
        return;
      }

      setAvatarError(null);
      closeCropDialog();
      uploadAvatarMutation.mutate(processedFile);
    } catch (error) {
      setAvatarError(getErrorMessage(error));
    } finally {
      setIsProcessingAvatar(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="max-w-[840px] mx-auto px-4 py-10"
    >
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/20 flex items-center justify-center overflow-hidden">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt="Profile avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-6 h-6 text-cyan-400" />
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">{displayName}</h1>
            {memberSince && (
              <p className="text-gray-500 text-sm">Member since {memberSince}</p>
            )}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleAvatarSelected}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1.5"
                onClick={handleChooseAvatar}
                isLoading={uploadAvatarMutation.isPending}
                disabled={isAvatarLoading || isCropDialogOpen}
              >
                <Upload className="w-3.5 h-3.5" />
                Upload avatar
              </Button>

              {avatarUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-gray-400 hover:text-red-400"
                  onClick={handleRemoveAvatar}
                  isLoading={removeAvatarMutation.isPending}
                  disabled={isAvatarLoading || isCropDialogOpen}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove
                </Button>
              )}
            </div>
            {avatarError && <p className="text-xs text-red-400 mt-2">{avatarError}</p>}
            {isCropDialogOpen && !avatarError && (
              <p className="text-xs text-cyan-400 mt-2">Crop and confirm to upload your avatar.</p>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void refetch();
            void refetchProfile();
          }}
          isLoading={isFetching || isProfileFetching}
          className="gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      {isPageLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
        </div>
      )}

      {hasLoadError && (
        <div className="text-center py-16 text-gray-500">
          <p className="mb-3">Failed to load profile data</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void refetch();
              void refetchProfile();
            }}
          >
            Try again
          </Button>
        </div>
      )}

      {stats && !isPageLoading && !hasLoadError && (
        <>
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Stats Dashboard
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              icon={<Gamepad2 className="w-5 h-5 text-cyan-400" />}
              label="Games Played"
              value={stats.games_played}
              sublabel="Total completed games"
              accentColor="#22d3ee"
              delay={0}
            />
            <StatCard
              icon={<Target className="w-5 h-5 text-emerald-400" />}
              label="Average Score"
              value={stats.avg_score}
              sublabel="Across all games"
              accentColor="#34d399"
              delay={0.08}
            />
            <StatCard
              icon={<Flame className="w-5 h-5 text-amber-400" />}
              label="Best Streak"
              value={stats.best_streak}
              sublabel="Consecutive improving games"
              accentColor="#fbbf24"
              delay={0.16}
            />
          </div>
        </>
      )}

      {stats && stats.games_played === 0 && (
        <div className="mt-8 text-center py-10 rounded-2xl border border-gray-800 bg-gray-900/30">
          <Gamepad2 className="w-10 h-10 mx-auto mb-3 text-gray-700" />
          <p className="text-gray-500">No games played yet. Start playing to see your stats!</p>
        </div>
      )}

      {cropImageSource && (
        <div className="fixed inset-0 z-50 bg-gray-950/90 backdrop-blur-sm px-4 py-6 flex items-center justify-center">
          <div className="w-full max-w-2xl rounded-2xl border border-gray-700 bg-gray-900/95 shadow-2xl shadow-black/40">
            <div className="px-5 pt-5 pb-4 sm:px-6 sm:pt-6 sm:pb-5">
              <h2 className="text-white text-lg font-semibold">Crop avatar</h2>
              <p className="text-sm text-gray-400 mt-1">
                Drag the image and adjust zoom. We will resize it to square WebP before upload.
              </p>

              <div className="relative mt-4 h-72 sm:h-96 rounded-xl overflow-hidden bg-black/70 border border-gray-800">
                <Cropper
                  image={cropImageSource}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  minZoom={1}
                  maxZoom={3}
                  zoomSpeed={0.15}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={(_, areaPixels) => setCroppedAreaPixels(areaPixels)}
                />
              </div>

              <div className="mt-4">
                <label htmlFor="avatar-zoom" className="block text-xs font-medium text-gray-400 mb-2">
                  Zoom
                </label>
                <input
                  id="avatar-zoom"
                  type="range"
                  min={1}
                  max={3}
                  step={0.01}
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>

              <p className="text-xs text-gray-500 mt-3">
                Output target: {AVATAR_OUTPUT_SIZE}x{AVATAR_OUTPUT_SIZE} WebP, max{' '}
                {formatBytes(MAX_AVATAR_BYTES)}.
              </p>

              <div className="mt-5 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={closeCropDialog}
                  disabled={isProcessingAvatar}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    void handleCropAndUploadAvatar();
                  }}
                  isLoading={isProcessingAvatar}
                >
                  Apply and upload
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
