import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * Lokale Audiodateien werden nur im Arbeitsspeicher gehalten (nie hochgeladen, nie gespeichert).
 * Nach einem Neuladen der Seite müssen sie erneut ausgewählt werden.
 */
interface AudioFilesApi {
  files: Map<string, File>;
  register: (files: File[]) => number;
  has: (fileName: string | undefined) => boolean;
}

const Ctx = createContext<AudioFilesApi | null>(null);

export function AudioFilesProvider({ children }: { children: ReactNode }) {
  const [files, setFiles] = useState<Map<string, File>>(() => new Map());
  const register = useCallback((list: File[]) => {
    const audio = list.filter((f) => f.type.startsWith('audio/') || /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|webm)$/i.test(f.name));
    setFiles((prev) => {
      const next = new Map(prev);
      for (const f of audio) next.set(f.name, f);
      return next;
    });
    return audio.length;
  }, []);
  const api = useMemo<AudioFilesApi>(
    () => ({ files, register, has: (n) => !!n && files.has(n) }),
    [files, register],
  );
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useAudioFiles(): AudioFilesApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('AudioFilesProvider fehlt');
  return ctx;
}
