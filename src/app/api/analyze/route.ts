import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { createWriteStream } from "fs";
import { unlink } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type AnalysisPayload = {
  titles: string[];
  description: string;
  tags: string[];
  thumbnails: string[];
};

const MODEL_NAME = "gemini-1.5-pro-latest";

const toTempFile = async (file: File) => {
  const safeName = file.name.replace(/[^\w.-]+/g, "_");
  const tempPath = path.join("/tmp", `yt-helper-${crypto.randomUUID()}-${safeName}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const readable = Readable.fromWeb(file.stream() as any);
  const writable = createWriteStream(tempPath);
  await pipeline(readable, writable);
  return tempPath;
};

const fileToInlinePart = async (file: File) => {
  const buffer = Buffer.from(await file.arrayBuffer());
  return {
    inlineData: {
      data: buffer.toString("base64"),
      mimeType: file.type || "image/jpeg",
    },
  };
};

const parseJsonResponse = (text: string): AnalysisPayload => {
  try {
    return JSON.parse(text) as AnalysisPayload;
  } catch (error) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]) as AnalysisPayload;
    }
    throw error;
  }
};

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing GEMINI_API_KEY environment variable." },
      { status: 500 }
    );
  }

  const formData = await request.formData();
  const videoFile = formData.get("video");
  const context = String(formData.get("context") ?? "").trim();
  const imageFiles = formData.getAll("images").filter(Boolean) as File[];

  if (!(videoFile instanceof File)) {
    return NextResponse.json({ error: "Video file is required." }, { status: 400 });
  }

  const tempPath = await toTempFile(videoFile);
  let upload;

  try {
    const fileManager = new GoogleAIFileManager(apiKey);
    upload = await fileManager.uploadFile(tempPath, {
      mimeType: videoFile.type || "video/mp4",
      displayName: videoFile.name || "youtube-helper-video",
    });
  } finally {
    await unlink(tempPath).catch(() => null);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });
  const inlineImages = await Promise.all(
    imageFiles.map((file) => fileToInlinePart(file))
  );

  const prompt = `
You are a YouTube growth strategist. Analyze the video content and return a JSON object with:
- titles: 5 high-CTR YouTube title suggestions.
- description: an SEO-optimized description with timestamps (use mm:ss format and realistic chapter labels).
- tags: 30 relevant tags, lower case, no hashtags.
- thumbnails: 3 detailed thumbnail concept descriptions (text only, no image generation).

Additional context from creator: ${context || "None provided."}

Return only valid JSON with keys: titles, description, tags, thumbnails.
  `.trim();

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            fileData: {
              fileUri: upload.file.uri,
              mimeType: upload.file.mimeType,
            },
          },
          ...inlineImages,
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.6,
      maxOutputTokens: 1200,
    },
  });

  const payload = parseJsonResponse(result.response.text());

  const safePayload: AnalysisPayload = {
    titles: Array.isArray(payload.titles) ? payload.titles.slice(0, 5) : [],
    description: typeof payload.description === "string" ? payload.description : "",
    tags: Array.isArray(payload.tags) ? payload.tags.slice(0, 30) : [],
    thumbnails: Array.isArray(payload.thumbnails) ? payload.thumbnails.slice(0, 3) : [],
  };

  return NextResponse.json(safePayload, { status: 200 });
}
