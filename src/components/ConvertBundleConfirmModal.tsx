import React from 'react';
import { X, Info, Loader2 } from 'lucide-react';

interface ConvertBundleConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
    habitName: string;
    bundleType: 'checklist' | 'choice';
    childCount: number;
}

export const ConvertBundleConfirmModal: React.FC<ConvertBundleConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    habitName,
    bundleType,
    childCount,
}) => {
    const [isConverting, setIsConverting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    if (!isOpen) return null;

    const handleConfirm = async () => {
        setIsConverting(true);
        setError(null);
        try {
            await onConfirm();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to convert habit';
            setError(errorMessage);
            console.error('Error converting habit:', err);
        } finally {
            setIsConverting(false);
        }
    };

    return (
        <div className="modal-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-neutral-900 border border-white/10 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-white">Convert to Bundle</h3>
                    <button
                        onClick={onClose}
                        disabled={isConverting}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-400 hover:text-white transition-colors disabled:opacity-50 -mr-2"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="space-y-4">
                    {/* Info Message */}
                    <div className="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-lg flex items-start gap-3">
                        <Info className="text-indigo-400 flex-shrink-0 mt-0.5" size={20} />
                        <div className="flex-1">
                            <div className="text-indigo-400 font-medium mb-1">Confirm Conversion</div>
                            <div className="text-white text-sm space-y-1.5">
                                <p>
                                    Convert <span className="font-medium">&ldquo;{habitName}&rdquo;</span> into
                                    a <span className="font-medium">{bundleType}</span> bundle
                                    with {childCount} child habit{childCount !== 1 ? 's' : ''}.
                                </p>
                                <p className="text-neutral-400 text-xs">
                                    Your historical entries will be preserved and accessible in habit history.
                                    This action is difficult to undo.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isConverting}
                            className="flex-1 px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={isConverting}
                            className="flex-1 px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isConverting ? (
                                <>
                                    <Loader2 className="animate-spin" size={16} />
                                    Converting...
                                </>
                            ) : (
                                'Convert'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
