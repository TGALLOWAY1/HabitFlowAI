import React, { useState, useRef } from 'react';
import { X, Loader2, AlertCircle, Image as ImageIcon, Upload } from 'lucide-react';

interface BadgeUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    goalId: string;
    onSuccess?: (badgeImageUrl: string) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];

export const BadgeUploadModal: React.FC<BadgeUploadModalProps> = ({
    isOpen,
    onClose,
    goalId,
    onSuccess,
}) => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const validateFile = (file: File): string | null => {
        // Check file type
        if (!ALLOWED_TYPES.includes(file.type)) {
            return 'Please select a PNG or JPG image file';
        }

        // Check file size
        if (file.size > MAX_FILE_SIZE) {
            return `File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB`;
        }

        return null;
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) {
            setError(null);
            return;
        }

        setError(null);

        // Validate file
        const validationError = validateFile(file);
        if (validationError) {
            setError(validationError);
            setSelectedFile(null);
            setPreview(null);
            // Clear the input so user can try again
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            return;
        }

        setSelectedFile(file);

        // Create preview with error handling
        const reader = new FileReader();
        reader.onloadend = () => {
            if (reader.result) {
                setPreview(reader.result as string);
            }
        };
        reader.onerror = () => {
            setError('Failed to read image file. Please try another file.');
            setSelectedFile(null);
            setPreview(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFile) return;

        setError(null);
        setIsUploading(true);

        try {
            // Create FormData
            const formData = new FormData();
            formData.append('image', selectedFile);

            // Upload badge
            const response = await fetch(`/api/goals/${goalId}/badge`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.error?.message || 'Failed to upload badge';
                
                // Provide more specific error messages
                if (response.status === 400) {
                    throw new Error(errorMessage || 'Invalid file. Please select a PNG or JPG image under 10MB.');
                } else if (response.status === 404) {
                    throw new Error('Goal not found. Please refresh the page and try again.');
                } else if (response.status === 500) {
                    throw new Error('Server error. Please try again later.');
                }
                
                throw new Error(errorMessage);
            }

            const data = await response.json();
            const badgeImageUrl = data.badgeImageUrl;

            // Reset form
            setSelectedFile(null);
            setPreview(null);
            setError(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }

            // Call success callback
            if (onSuccess) {
                onSuccess(badgeImageUrl);
            }

            onClose();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to upload badge';
            setError(errorMessage);
            console.error('Error uploading badge:', err);
        } finally {
            setIsUploading(false);
        }
    };

    const handleCancel = () => {
        setSelectedFile(null);
        setPreview(null);
        setError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-md bg-neutral-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white">Add Your Badge</h3>
                    <button
                        onClick={handleCancel}
                        disabled={isUploading}
                        className="text-neutral-400 hover:text-white transition-colors disabled:opacity-50"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Error Display */}
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-3">
                            <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={16} />
                            <div className="flex-1">
                                <div className="text-red-400 text-sm">{error}</div>
                            </div>
                        </div>
                    )}

                    {/* File Input */}
                    <div>
                        <label
                            htmlFor="badge-image"
                            className="block text-sm font-medium text-neutral-300 mb-2"
                        >
                            Select Image (PNG or JPG, max 10MB)
                        </label>
                        <div className="relative">
                            <input
                                ref={fileInputRef}
                                id="badge-image"
                                type="file"
                                accept="image/png,image/jpeg,image/jpg"
                                onChange={handleFileSelect}
                                disabled={isUploading}
                                className="hidden"
                            />
                            <label
                                htmlFor="badge-image"
                                className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                                    isUploading
                                        ? 'border-neutral-700 bg-neutral-800/50 cursor-not-allowed'
                                        : 'border-neutral-700 hover:border-emerald-500 hover:bg-neutral-800/50'
                                }`}
                            >
                                {preview ? (
                                    <div className="relative w-full h-full flex items-center justify-center">
                                        <img
                                            src={preview}
                                            alt="Preview"
                                            className="max-w-full max-h-full object-contain rounded-lg"
                                        />
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <Upload className="text-neutral-400 mb-2" size={32} />
                                        <p className="text-sm text-neutral-400">
                                            <span className="font-semibold text-emerald-400">Click to upload</span> or drag and drop
                                        </p>
                                        <p className="text-xs text-neutral-500 mt-1">
                                            PNG or JPG (MAX. 10MB)
                                        </p>
                                    </div>
                                )}
                            </label>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3 pt-2">
                        <button
                            type="button"
                            onClick={handleCancel}
                            disabled={isUploading}
                            className="flex-1 px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isUploading || !selectedFile}
                            className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-900 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isUploading ? (
                                <>
                                    <Loader2 className="animate-spin" size={16} />
                                    Uploading...
                                </>
                            ) : (
                                <>
                                    <ImageIcon size={16} />
                                    Upload Badge
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
