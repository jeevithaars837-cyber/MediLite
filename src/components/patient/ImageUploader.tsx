'use client';

import { useState } from 'react';
import { Camera, X, Loader2, ShieldCheck, Image as ImageIcon } from 'lucide-react';
import { compressImage } from '@/lib/image/compressor';
import { CompressionPreset, CompressionResult } from '@/types';

interface ImageUploaderProps {
  preset?: CompressionPreset;
  onImagesChanged: (results: Array<{ result: CompressionResult; clientImageId: string }>) => void;
}

export function ImageUploader({ preset = 'medium', onImagesChanged }: ImageUploaderProps) {
  const [items, setItems] = useState<Array<{ id: string; previewUrl: string; result: CompressionResult }>>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (items.length + files.length > 3) {
      setErrorMsg('You can upload a maximum of 3 photos per consultation.');
      return;
    }

    setErrorMsg(null);
    setIsCompressing(true);

    try {
      const newItems = [...items];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const res = await compressImage(file, preset);
        const id = crypto.randomUUID();
        const previewUrl = URL.createObjectURL(res.thumbBlob);
        newItems.push({ id, previewUrl, result: res });
      }

      setItems(newItems);
      onImagesChanged(newItems.map((item) => ({ result: item.result, clientImageId: item.id })));
    } catch (err: any) {
      if (err.message === 'invalid_image') {
        setErrorMsg('That file doesn\'t look like a photo we can use. Please choose a JPG, PNG or WebP image.');
      } else if (err.message === 'image_too_large') {
        setErrorMsg('That photo is over 25 MB. Try taking a new picture or choosing a smaller file.');
      } else {
        setErrorMsg('Failed to process image. Please try again.');
      }
    } finally {
      setIsCompressing(false);
      e.target.value = '';
    }
  };

  const handleRemove = (id: string) => {
    const next = items.filter((item) => item.id !== id);
    setItems(next);
    onImagesChanged(next.map((item) => ({ result: item.result, clientImageId: item.id })));
  };

  function formatBytes(bytes: number): string {
    if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / 1024).toFixed(0) + ' KB';
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <Camera className="w-4 h-4 text-brand-400" /> Photos (Optional, max 3)
        </label>
        <span className="text-xs text-slate-400">{items.length} / 3 selected</span>
      </div>

      {errorMsg && (
        <div className="text-xs text-rose-300 bg-rose-950/80 p-2.5 rounded-lg border border-rose-800">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="relative bg-slate-900 border border-slate-700/80 rounded-xl overflow-hidden p-2 group"
          >
            <div className="relative h-28 w-full bg-slate-950 rounded-lg overflow-hidden flex items-center justify-center">
              <img
                src={item.previewUrl}
                alt="Upload preview"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => handleRemove(item.id)}
                className="absolute top-1 right-1 bg-slate-950/80 hover:bg-rose-600 text-white p-1 rounded-full backdrop-blur transition-colors"
                title="Remove photo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between text-[11px] font-medium text-slate-300">
                <span>{formatBytes(item.result.originalSize)} → {formatBytes(item.result.compressedSize)}</span>
                <span className="text-teal-400 font-bold">{item.result.savedPercent}% less data</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-slate-400">
                <ShieldCheck className="w-3 h-3 text-brand-400" />
                <span>EXIF & location removed</span>
              </div>
            </div>
          </div>
        ))}

        {items.length < 3 && (
          <label className="border-2 border-dashed border-slate-700 hover:border-brand-500 rounded-xl h-36 flex flex-col items-center justify-center p-3 cursor-pointer bg-slate-900/50 hover:bg-slate-800/40 transition-all text-center">
            {isCompressing ? (
              <div className="flex flex-col items-center gap-2 text-brand-400">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="text-xs font-medium">Compressing photo…</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-slate-400 hover:text-slate-200">
                <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center">
                  <ImageIcon className="w-5 h-5 text-brand-400" />
                </div>
                <span className="text-xs font-semibold">Attach photo</span>
                <span className="text-[10px] text-slate-400">JPG, PNG, WebP (auto-compressed)</span>
              </div>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={isCompressing}
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        )}
      </div>
    </div>
  );
}
