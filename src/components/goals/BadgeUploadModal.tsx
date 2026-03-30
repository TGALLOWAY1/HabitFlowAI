import React, { useState, useRef, useCallback } from 'react';
import { X, Loader2, AlertCircle, Image as ImageIcon, Upload, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { uploadGoalBadge } from '../../lib/persistenceClient';

interface BadgeUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    goalId: string;
    goalTitle?: string;
    onSuccess?: (badgeImageUrl: string) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const OUTPUT_SIZE = 800; // px square output

function centerAspectCrop(mediaWidth: number, mediaHeight: number): Crop {
    return centerCrop(
        makeAspectCrop({ unit: '%', width: 90 }, 1, mediaWidth, mediaHeight),
        mediaWidth,
        mediaHeight,
    );
}

/**
 * Render the cropped region of an image onto a canvas and return it as a Blob.
 */
function getCroppedImageBlob(
    image: HTMLImageElement,
    crop: PixelCrop,
    rotation: number,
): Promise<Blob> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const cropX = crop.x * scaleX;
    const cropY = crop.y * scaleY;
    const cropW = crop.width * scaleX;
    const cropH = crop.height * scaleY;

    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;

    ctx.imageSmoothingQuality = 'high';

    // Apply rotation around canvas center
    if (rotation !== 0) {
        ctx.translate(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.translate(-OUTPUT_SIZE / 2, -OUTPUT_SIZE / 2);
    }

    ctx.drawImage(
        image,
        cropX, cropY, cropW, cropH,
        0, 0, OUTPUT_SIZE, OUTPUT_SIZE,
    );

    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) resolve(blob);
                else reject(new Error('Canvas toBlob failed'));
            },
            'image/webp',
            0.9,
        );
    });
}

export const BadgeUploadModal: React.FC<BadgeUploadModalProps> = ({
    isOpen,
    onClose,
    goalId,
    goalTitle,
    onSuccess,
}) => {
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const [rotation, setRotation] = useState(0);
    const [scale, setScale] = useState(1);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);

    if (!isOpen) return null;

    const reset = () => {
        setImageSrc(null);
        setCrop(undefined);
        setCompletedCrop(undefined);
        setRotation(0);
        setScale(1);
        setError(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setError(null);

        if (!ALLOWED_TYPES.includes(file.type)) {
            setError('Please select a PNG, JPG, or WebP image');
            return;
        }
        if (file.size > MAX_FILE_SIZE) {
            setError('File size must be less than 10MB');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            if (reader.result) setImageSrc(reader.result as string);
        };
        reader.onerror = () => {
            setError('Failed to read image file');
        };
        reader.readAsDataURL(file);
    };

    const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
        const { width, height } = e.currentTarget;
        setCrop(centerAspectCrop(width, height));
    }, []);

    const handleSubmit = async () => {
        if (!imgRef.current || !completedCrop) return;

        setError(null);
        setIsUploading(true);

        try {
            const blob = await getCroppedImageBlob(imgRef.current, completedCrop, rotation);
            const file = new File([blob], 'badge.webp', { type: 'image/webp' });
            const { badgeImageUrl } = await uploadGoalBadge(goalId, file);

            reset();
            if (onSuccess) onSuccess(badgeImageUrl);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to upload badge');
        } finally {
            setIsUploading(false);
        }
    };

    const handleCancel = () => {
        reset();
        onClose();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (!file) return;
        // Create a synthetic change event
        const dt = new DataTransfer();
        dt.items.add(file);
        if (fileInputRef.current) {
            fileInputRef.current.files = dt.files;
            fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
        }
        // Process directly
        setError(null);
        if (!ALLOWED_TYPES.includes(file.type)) {
            setError('Please select a PNG, JPG, or WebP image');
            return;
        }
        if (file.size > MAX_FILE_SIZE) {
            setError('File size must be less than 10MB');
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            if (reader.result) setImageSrc(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl max-h-[90dvh] overflow-y-auto modal-scroll">
                {/* Header */}
                <div className="flex items-center justify-between p-5 pb-0">
                    <div>
                        <h3 className="text-lg font-bold text-white">Upload Badge Image</h3>
                        {goalTitle && (
                            <p className="text-sm text-neutral-400 mt-0.5 line-clamp-1">{goalTitle}</p>
                        )}
                    </div>
                    <button
                        onClick={handleCancel}
                        disabled={isUploading}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-400 hover:text-white transition-colors disabled:opacity-50 -mr-2"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {/* Error */}
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-3">
                            <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={16} />
                            <div className="text-red-400 text-sm">{error}</div>
                        </div>
                    )}

                    {!imageSrc ? (
                        /* File picker / drop zone */
                        <div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/jpg,image/webp"
                                onChange={handleFileSelect}
                                className="hidden"
                                id="badge-file-input"
                            />
                            <label
                                htmlFor="badge-file-input"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={handleDrop}
                                className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-neutral-700 hover:border-emerald-500 rounded-xl cursor-pointer transition-colors hover:bg-neutral-800/50"
                            >
                                <Upload className="text-neutral-400 mb-3" size={36} />
                                <p className="text-sm text-neutral-300">
                                    <span className="font-semibold text-emerald-400">Click to upload</span> or drag and drop
                                </p>
                                <p className="text-xs text-neutral-500 mt-1.5">
                                    PNG, JPG, or WebP (max 10MB)
                                </p>
                            </label>
                        </div>
                    ) : (
                        /* Crop editor */
                        <>
                            <div className="rounded-xl overflow-hidden bg-neutral-950 border border-white/5">
                                <ReactCrop
                                    crop={crop}
                                    onChange={(c) => setCrop(c)}
                                    onComplete={(c) => setCompletedCrop(c)}
                                    aspect={1}
                                    circularCrop={false}
                                    className="max-h-[50vh]"
                                >
                                    <img
                                        ref={imgRef}
                                        src={imageSrc}
                                        alt="Crop preview"
                                        onLoad={onImageLoad}
                                        className="max-w-full max-h-[50vh] mx-auto block"
                                        style={{
                                            transform: `scale(${scale}) rotate(${rotation}deg)`,
                                            transformOrigin: 'center',
                                        }}
                                    />
                                </ReactCrop>
                            </div>

                            {/* Controls */}
                            <div className="flex items-center justify-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setRotation((r) => (r + 90) % 360)}
                                    className="p-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                                    title="Rotate 90deg"
                                >
                                    <RotateCw size={18} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setScale((s) => Math.max(0.5, s - 0.1))}
                                    className="p-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                                    title="Zoom out"
                                >
                                    <ZoomOut size={18} />
                                </button>
                                <span className="text-xs text-neutral-500 w-12 text-center">{Math.round(scale * 100)}%</span>
                                <button
                                    type="button"
                                    onClick={() => setScale((s) => Math.min(3, s + 0.1))}
                                    className="p-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                                    title="Zoom in"
                                >
                                    <ZoomIn size={18} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        reset();
                                    }}
                                    className="ml-2 px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-sm transition-colors"
                                >
                                    Change image
                                </button>
                            </div>
                        </>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-1">
                        <button
                            type="button"
                            onClick={handleCancel}
                            disabled={isUploading}
                            className="flex-1 px-4 py-2.5 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isUploading || !completedCrop || !imageSrc}
                            className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-900 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isUploading ? (
                                <>
                                    <Loader2 className="animate-spin" size={16} />
                                    Uploading...
                                </>
                            ) : (
                                <>
                                    <ImageIcon size={16} />
                                    Save Badge
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
