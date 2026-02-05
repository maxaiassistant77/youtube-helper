"use client";

import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";

type AnalysisResult = {
  titles: string[];
  description: string;
  tags: string[];
  thumbnails: string[];
};

type CollapsibleProps = {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
};

const CollapsibleSection = ({ title, children, defaultOpen }: CollapsibleProps) => {
  const [open, setOpen] = useState(Boolean(defaultOpen));

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6 shadow-[0_0_40px_rgba(0,0,0,0.4)]">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between text-left text-lg font-semibold text-zinc-100"
      >
        <span>{title}</span>
        <span className="text-zinc-400">{open ? "−" : "+"}</span>
      </button>
      {open ? <div className="mt-4">{children}</div> : null}
    </section>
  );
};

const MAX_VIDEO_SIZE = 500 * 1024 * 1024;

export default function Home() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [context, setContext] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDropVideo = useCallback((accepted: File[]) => {
    setError(null);
    setVideoFile(accepted[0] ?? null);
  }, []);

  const onDropImages = useCallback((accepted: File[]) => {
    setError(null);
    setImageFiles(accepted);
  }, []);

  const {
    getRootProps: getVideoRootProps,
    getInputProps: getVideoInputProps,
    isDragActive: isVideoDragActive,
  } = useDropzone({
    onDrop: onDropVideo,
    onDropRejected: () => {
      setError("Video must be MP4, MOV, or WEBM and under 500MB.");
    },
    accept: {
      "video/mp4": [".mp4"],
      "video/quicktime": [".mov"],
      "video/webm": [".webm"],
    },
    maxFiles: 1,
    multiple: false,
    maxSize: MAX_VIDEO_SIZE,
  });

  const {
    getRootProps: getImageRootProps,
    getInputProps: getImageInputProps,
    isDragActive: isImageDragActive,
  } = useDropzone({
    onDrop: onDropImages,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".webp"],
    },
    maxFiles: 8,
    multiple: true,
  });

  const videoMeta = useMemo(() => {
    if (!videoFile) return "Drop a video file here (MP4, MOV, WEBM). Up to 500MB.";
    const sizeMb = (videoFile.size / (1024 * 1024)).toFixed(1);
    return `${videoFile.name} • ${sizeMb} MB`;
  }, [videoFile]);

  const handleAnalyze = async () => {
    if (!videoFile) {
      setError("Please upload a video file.");
      return;
    }
    setError(null);
    setIsLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("video", videoFile);
      imageFiles.forEach((file) => formData.append("images", file));
      formData.append("context", context);

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error ?? "Analysis failed.");
      }

      const data = (await response.json()) as AnalysisResult;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,0,0,0.15),_transparent_40%),radial-gradient(circle_at_20%_20%,_rgba(255,255,255,0.06),_transparent_45%),linear-gradient(180deg,_#0a0a0f_0%,_#050505_100%)]">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 pb-24 pt-16">
        <header className="flex flex-col gap-6">
          <span className="w-fit rounded-full border border-red-500/40 bg-red-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-red-200">
            Creator Lab
          </span>
          <div className="max-w-3xl space-y-4">
            <h1 className="text-4xl font-semibold text-zinc-100 md:text-5xl">
              YouTube Helper
            </h1>
            <p className="text-lg text-zinc-300 md:text-xl">
              Analyze your latest upload and generate high-CTR titles, SEO
              descriptions, tags, and thumbnail concepts in minutes.
            </p>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div
              {...getVideoRootProps()}
              className={`group cursor-pointer rounded-3xl border border-dashed px-6 py-10 transition ${
                isVideoDragActive
                  ? "border-red-400 bg-red-500/10"
                  : "border-zinc-800 bg-zinc-950/60 hover:border-red-500/60"
              }`}
            >
              <input {...getVideoInputProps()} />
              <div className="flex flex-col gap-4">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500">
                  Video Upload
                </p>
                <div className="text-xl font-semibold text-zinc-100">
                  {videoFile ? "Video ready for analysis" : "Drag & drop your video"}
                </div>
                <p className="text-sm text-zinc-400">{videoMeta}</p>
                <div className="w-fit rounded-full bg-zinc-900 px-4 py-2 text-xs text-zinc-300">
                  Supports MP4, MOV, WEBM
                </div>
              </div>
            </div>

            <div
              {...getImageRootProps()}
              className={`group cursor-pointer rounded-3xl border border-dashed px-6 py-8 transition ${
                isImageDragActive
                  ? "border-red-400 bg-red-500/10"
                  : "border-zinc-800 bg-zinc-950/40 hover:border-red-500/60"
              }`}
            >
              <input {...getImageInputProps()} />
              <div className="flex flex-col gap-3">
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500">
                  Creator Photos
                </p>
                <div className="text-lg font-semibold text-zinc-100">
                  Drop headshots or brand imagery for thumbnails
                </div>
                <p className="text-sm text-zinc-400">
                  {imageFiles.length
                    ? `${imageFiles.length} image${imageFiles.length > 1 ? "s" : ""} selected`
                    : "PNG, JPG, WEBP"}
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-950/40 p-6">
              <label className="text-sm font-semibold uppercase tracking-[0.25em] text-zinc-500">
                Additional Context
              </label>
              <textarea
                value={context}
                onChange={(event) => setContext(event.target.value)}
                placeholder="Example: Targeting beginner creators, focus on growth tips, casual tone."
                className="mt-4 min-h-[120px] w-full resize-none rounded-2xl border border-zinc-800 bg-black/60 px-4 py-3 text-sm text-zinc-100 outline-none transition focus:border-red-500/60"
              />
            </div>
          </div>

          <aside className="flex flex-col gap-6 rounded-3xl border border-zinc-800 bg-gradient-to-b from-zinc-950/80 to-zinc-900/60 p-6">
            <div className="space-y-3">
              <h2 className="text-xl font-semibold text-zinc-100">Output Preview</h2>
              <p className="text-sm text-zinc-400">
                Gemini analyzes your video and returns high-performing titles,
                SEO-rich descriptions, tags, and thumbnail concepts.
              </p>
            </div>
            <div className="space-y-3 text-sm text-zinc-300">
              <div className="flex items-center justify-between">
                <span>Titles</span>
                <span className="text-zinc-500">5 options</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Description</span>
                <span className="text-zinc-500">SEO + timestamps</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Tags</span>
                <span className="text-zinc-500">30 keywords</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Thumbnails</span>
                <span className="text-zinc-500">3 concepts</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isLoading}
              className="mt-auto rounded-2xl bg-red-600 px-6 py-4 text-base font-semibold text-white shadow-[0_20px_50px_rgba(255,0,0,0.35)] transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Analyzing..." : "Analyze & Generate"}
            </button>
            {error ? (
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </p>
            ) : null}
          </aside>
        </section>

        {result ? (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-zinc-100">Results</h2>
              <span className="text-sm text-zinc-400">
                Generated just now. Refine your context and re-run anytime.
              </span>
            </div>

            <CollapsibleSection title="Title Suggestions" defaultOpen>
              <div className="grid gap-3">
                {result.titles.map((title, index) => (
                  <div
                    key={`${title}-${index}`}
                    className="flex flex-col gap-2 rounded-2xl border border-zinc-800 bg-black/50 p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <p className="text-sm text-zinc-200">{title}</p>
                    <button
                      type="button"
                      onClick={() => handleCopy(title)}
                      className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 transition hover:border-red-500/60 hover:text-white"
                    >
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="SEO Description" defaultOpen>
              <div className="space-y-4">
                <pre className="whitespace-pre-wrap rounded-2xl border border-zinc-800 bg-black/50 p-4 text-sm text-zinc-200">
                  {result.description}
                </pre>
                <button
                  type="button"
                  onClick={() => handleCopy(result.description)}
                  className="rounded-full border border-zinc-700 px-4 py-2 text-xs text-zinc-300 transition hover:border-red-500/60 hover:text-white"
                >
                  Copy Description
                </button>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Tags" defaultOpen>
              <div className="flex flex-wrap gap-2">
                {result.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-zinc-700 bg-zinc-950/70 px-3 py-1 text-xs text-zinc-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={() => handleCopy(result.tags.join(", "))}
                className="mt-4 rounded-full border border-zinc-700 px-4 py-2 text-xs text-zinc-300 transition hover:border-red-500/60 hover:text-white"
              >
                Copy All Tags
              </button>
            </CollapsibleSection>

            <CollapsibleSection title="Thumbnail Concepts" defaultOpen>
              <div className="grid gap-4 md:grid-cols-3">
                {result.thumbnails.map((thumb, index) => (
                  <div
                    key={`${thumb}-${index}`}
                    className="rounded-2xl border border-zinc-800 bg-black/50 p-4 text-sm text-zinc-200"
                  >
                    <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                      Concept {index + 1}
                    </p>
                    <p className="mt-3 leading-relaxed">{thumb}</p>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          </section>
        ) : null}
      </main>
    </div>
  );
}
