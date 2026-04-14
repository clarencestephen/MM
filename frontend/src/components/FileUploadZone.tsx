"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, FileAudio, Loader2, CheckCircle2 } from "lucide-react";

interface FileUploadZoneProps {
  onUpload: (file: File) => void;
  accept?: string;
  label?: string;
  loading?: boolean;
  uploadedFile?: { name: string; size: number } | null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileUploadZone({
  onUpload,
  accept = "audio/*",
  label = "Drop your audio file here",
  loading = false,
  uploadedFile = null,
}: FileUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) onUpload(file);
    },
    [onUpload]
  );

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onUpload(file);
    },
    [onUpload]
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-violet-500/50 bg-zinc-900/50 p-8">
        <Loader2 className="h-10 w-10 animate-spin text-violet-400" />
        <p className="text-sm text-zinc-400">Uploading...</p>
      </div>
    );
  }

  if (uploadedFile) {
    return (
      <div className="flex items-center gap-4 rounded-xl border-2 border-dashed border-green-500/40 bg-zinc-900/50 p-6">
        <CheckCircle2 className="h-8 w-8 flex-shrink-0 text-green-500" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-200">
            {uploadedFile.name}
          </p>
          <p className="text-xs text-zinc-500">
            {formatFileSize(uploadedFile.size)}
          </p>
        </div>
        <button
          onClick={handleClick}
          className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
        >
          Replace
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 transition-colors ${
        isDragOver
          ? "border-violet-500 bg-violet-500/10"
          : "border-zinc-700 bg-zinc-900/50 hover:border-violet-500/50 hover:bg-zinc-800/50"
      }`}
    >
      {isDragOver ? (
        <FileAudio className="h-10 w-10 text-violet-400" />
      ) : (
        <Upload className="h-10 w-10 text-zinc-500" />
      )}
      <div className="text-center">
        <p className="text-sm font-medium text-zinc-300">{label}</p>
        <p className="mt-1 text-xs text-zinc-500">
          or click to browse
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
