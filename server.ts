import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import ExifReader from "exifreader";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type ExifTag = {
  description?: string;
  value?: any;
};

type ExifTagMap = Record<string, ExifTag | undefined>;

const getFirstAvailableTag = (tags: ExifTagMap, keys: string[]): ExifTag | undefined => {
  for (const key of keys) {
    if (tags[key]) {
      return tags[key];
    }
  }
  return undefined;
};

const extractTagString = (tag?: ExifTag): string | undefined => {
  if (!tag) return undefined;
  if (typeof tag.description === "string" && tag.description.trim() !== "") {
    return tag.description.trim();
  }
  const value = tag.value;
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number") return value.toString();
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (entry === null || entry === undefined) return "";
        if (typeof entry === "number" || typeof entry === "string") return entry.toString();
        if (typeof entry === "object" && "numerator" in entry && "denominator" in entry) {
          const denominator = entry.denominator || 1;
          return (entry.numerator / denominator).toString();
        }
        return "";
      })
      .filter(Boolean)
      .join(", ");
  }
  if (typeof value === "object" && "numerator" in value && "denominator" in value) {
    const denominator = value.denominator || 1;
    return (value.numerator / denominator).toString();
  }
  return undefined;
};

const formatAperture = (tag?: ExifTag): string | undefined => {
  const numericString = extractTagString(tag);
  if (!numericString) return undefined;
  if (/f\s*\/?/i.test(numericString)) {
    return numericString.replace(/^F/, "f").replace(/\s+/g, "");
  }
  const numericValue = parseFloat(numericString);
  if (Number.isFinite(numericValue)) {
    return `f/${numericValue.toFixed(1).replace(/\.0$/, "")}`;
  }
  return numericString;
};

const formatExposure = (tag?: ExifTag): string | undefined => {
  const value = extractTagString(tag);
  if (!value) return undefined;
  if (/s$/i.test(value.trim())) return value;
  if (value.includes("/")) return `${value}s`;
  const numericValue = parseFloat(value);
  if (Number.isFinite(numericValue)) {
    if (numericValue >= 1) {
      return `${numericValue.toFixed(1).replace(/\.0$/, "")}s`;
    }
    const reciprocal = Math.round(1 / numericValue);
    return `1/${reciprocal}s`;
  }
  return value;
};

const formatIso = (tag?: ExifTag): string | undefined => {
  const value = extractTagString(tag);
  if (!value) return undefined;
  return /^ISO/i.test(value) ? value : `ISO ${value}`;
};

const formatFocalLength = (tag?: ExifTag): string | undefined => {
  const value = extractTagString(tag);
  if (!value) return undefined;
  return value.includes("mm") ? value : `${value}mm`;
};

const isRangeHeaderAccessDenied = (error: any) => {
  if (!error) return false;
  if (error.Code !== "AccessDenied") return false;
  const message = typeof error.message === "string" ? error.message : "";
  return /not signed/i.test(message) || /range/i.test(message);
};

const limitConcurrency = async <T,>(
  items: T[],
  fn: (item: T) => Promise<any>,
  concurrency: number
): Promise<any[]> => {
  const results: any[] = [];
  const executing: Promise<any>[] = [];
  
  for (const item of items) {
    const promise = fn(item).then((result) => {
      executing.splice(executing.indexOf(promise), 1);
      return result;
    });
    
    results.push(promise);
    executing.push(promise);
    
    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }
  
  return Promise.all(results);
};

type CachedExifData = {
  data: any;
  timestamp: number;
};

const exifCache = new Map<string, CachedExifData>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

const getCachedExif = (key: string): any | null => {
  const cached = exifCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL) {
    exifCache.delete(key);
    return null;
  }
  return cached.data;
};

const setCachedExif = (key: string, data: any): void => {
  exifCache.set(key, {
    data,
    timestamp: Date.now(),
  });
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  // S3 Client Setup
  const endpoint = process.env.S3_ENDPOINT ? process.env.S3_ENDPOINT.trim().replace(/\/$/, "") : undefined;
  
  // Default forcePathStyle to true if endpoint is provided, unless explicitly set to "false"
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === undefined 
    ? (!!endpoint) 
    : process.env.S3_FORCE_PATH_STYLE === "true";

  const s3Config = {
    region: process.env.S3_REGION || "us-east-1",
    credentials: {
      accessKeyId: (process.env.S3_ACCESS_KEY_ID || "").trim(),
      secretAccessKey: (process.env.S3_SECRET_ACCESS_KEY || "").trim(),
    },
    endpoint: endpoint,
    forcePathStyle: forcePathStyle,
  };

  console.log("Initializing S3 Client with config:", {
    region: s3Config.region,
    endpoint: s3Config.endpoint,
    forcePathStyle: s3Config.forcePathStyle,
    bucket: process.env.S3_BUCKET_NAME,
    hasAccessKey: !!s3Config.credentials.accessKeyId,
    hasSecretKey: !!s3Config.credentials.secretAccessKey,
  });

  const s3Client = new S3Client(s3Config);

  // API to list images and their EXIF data
  app.get("/api/photos", async (req, res) => {
    try {
      const bucket = process.env.S3_BUCKET_NAME;
      if (!bucket) {
        console.warn("S3_BUCKET_NAME not configured, returning empty list");
        return res.json([]);
      }

      console.log(`Fetching objects from bucket: ${bucket}`);
      const prefix = process.env.S3_IMAGE_DIR || "";
      const command = new ListObjectsV2Command({ 
        Bucket: bucket,
        Prefix: prefix 
      });
      const response = await s3Client.send(command);

      const photos = (response.Contents || [])
        .filter((item) => item.Key?.match(/\.(jpg|jpeg|png|webp)$/i))
        .map((item) => {
          const key = item.Key!;
          
          let url = "";
          if (process.env.S3_IMAGE_BASE_URL) {
            const baseUrl = process.env.S3_IMAGE_BASE_URL.replace(/\/$/, "");
            const relativeKey = prefix && key.startsWith(prefix) 
              ? key.substring(prefix.length).replace(/^\//, "") 
              : key;
            url = `${baseUrl}/${relativeKey}`;
          } else {
            url = process.env.S3_ENDPOINT 
              ? `${process.env.S3_ENDPOINT}/${bucket}/${key}`
              : `https://${bucket}.s3.${process.env.S3_REGION}.amazonaws.com/${key}`;
          }

          return {
            id: key,
            url,
            name: key.split("/").pop(),
            exif: {},
          };
        });

      res.json(photos);
    } catch (error) {
      console.error("Error fetching photos:", error);
      res.status(500).json({ error: "Failed to fetch photos" });
    }
  });

  app.get("/api/photo/:id/exif", async (req, res) => {
    try {
      const key = decodeURIComponent(req.params.id);
      const bucket = process.env.S3_BUCKET_NAME;
      
      if (!bucket) {
        return res.status(500).json({ error: "S3_BUCKET_NAME not configured" });
      }

      const cachedExif = getCachedExif(key);
      if (cachedExif) {
        console.log(`Using cached EXIF data for ${key}`);
        return res.json(cachedExif);
      }

      console.log(`Fetching EXIF data for ${key}`);
      const getObjCommand = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });
      const objResponse = await s3Client.send(getObjCommand);
      const body = objResponse.Body;
      
      if (!body) {
        return res.status(404).json({ error: "Image not found" });
      }

      const buffer = await body.transformToByteArray();
      const maxSize = 262144;
      const limitedBuffer = buffer.length > maxSize 
        ? buffer.slice(0, maxSize) 
        : buffer;
      
      const tags = ExifReader.load(limitedBuffer.buffer) as ExifTagMap;
      console.log(`EXIF tags found for ${key}:`, Object.keys(tags).slice(0, 10));
      
      const exifData = {
        make: extractTagString(tags["Make"]),
        model: extractTagString(tags["Model"]),
        exposureTime: formatExposure(
          getFirstAvailableTag(tags, ["ExposureTime", "ShutterSpeedValue", "ShutterSpeed"])
        ),
        fNumber: formatAperture(
          getFirstAvailableTag(tags, ["FNumber", "ApertureValue", "LensAperture"])
        ),
        iso: formatIso(
          getFirstAvailableTag(tags, ["ISOSpeedRatings", "PhotographicSensitivity", "ISO"])
        ),
        focalLength: formatFocalLength(
          getFirstAvailableTag(tags, ["FocalLength", "FocalLengthIn35mmFilm", "LensFocalLength"])
        ),
        dateTime: extractTagString(
          getFirstAvailableTag(tags, ["DateTimeOriginal", "CreateDate", "DateCreated"])
        ),
      };
      
      console.log(`Extracted EXIF data for ${key}:`, exifData);
      setCachedExif(key, exifData);
      
      res.json(exifData);
    } catch (error) {
      console.error("Error fetching EXIF:", error);
      res.status(500).json({ error: "Failed to fetch EXIF data" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();