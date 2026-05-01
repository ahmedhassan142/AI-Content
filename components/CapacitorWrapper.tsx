'use client';

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

export function useCapacitor() {
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
  }, []);

  const shareContent = async (text: string, title?: string) => {
    if (!isNative) {
      // Web fallback
      if (navigator.share) {
        await navigator.share({ text, title });
      } else {
        await navigator.clipboard.writeText(text);
        alert('Content copied to clipboard!');
      }
      return;
    }

    await Share.share({
      title: title || 'AI Generated Content',
      text: text,
      dialogTitle: 'Share content',
    });
  };

  const saveToFile = async (content: string, filename: string) => {
    if (!isNative) {
      // Web fallback
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    await Filesystem.writeFile({
      path: filename,
      data: content,
      directory: Directory.Documents,
    });
  };

  return { isNative, shareContent, saveToFile };
}