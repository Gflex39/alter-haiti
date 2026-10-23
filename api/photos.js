/**
 * Vercel Serverless Function: GET /api/photos
 *
 * Fetches all photos from a public/shared Google Drive folder ("Anyone with the link can view").
 * Works out-of-the-box WITHOUT requiring a Google Cloud API key by reading Google Drive's
 * public embedded folder view, and also supports optional GOOGLE_DRIVE_API_KEY if provided.
 */

const DEFAULT_FOLDER_URL = 'https://drive.google.com/drive/folders/1iIUrJ-hyW3YKd6zb6exiGZJ0EVSxMUdN';
const NON_IMAGE_EXTENSIONS = /\.(mp4|mov|avi|mkv|webm|mp3|wav|pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|txt|csv)$/i;

export function extractFolderId(input) {
  if (!input || typeof input !== 'string') return '';
  const trimmed = input.trim();
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch) return idParamMatch[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) return trimmed;
  return '';
}

export function buildDriveImageUrl(fileId) {
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w1200`;
}

export async function fetchDriveFolderPhotos(folderInput, apiKey = '') {
  const folderId = extractFolderId(folderInput);
  if (!folderId) {
    return [];
  }

  // 1. If a Google Drive API key is available, try the official v3 API first
  if (apiKey) {
    try {
      const q = encodeURIComponent(`'${folderId}' in parents and mimeType contains 'image/' and trashed = false`);
      const apiUrl = `https://www.googleapis.com/drive/v3/files?q=${q}&key=${encodeURIComponent(apiKey)}&fields=files(id,name,mimeType,createdTime)&orderBy=createdTime desc&pageSize=100`;
      const response = await fetch(apiUrl);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.files)) {
          return data.files.map((file) => ({
            id: file.id,
            name: file.name || 'Community Photo',
            url: buildDriveImageUrl(file.id),
          }));
        }
      }
    } catch (err) {
      console.warn('Google Drive API key fetch failed, falling back to public folder view:', err);
    }
  }

  // 2. Zero-config public folder fetch (no API key needed)
  const embedUrl = `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}#list`;
  const response = await fetch(embedUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to read Google Drive folder (status ${response.status})`);
  }

  const html = await response.text();
  const photos = [];
  const seenIds = new Set();

  // Match each flip-entry block in Google Drive's embedded folder view
  const entryRegex = /id="entry-([a-zA-Z0-9_-]+)"[\s\S]*?<div class="flip-entry-title">([^<]*)<\/div>/g;
  let match;
  while ((match = entryRegex.exec(html)) !== null) {
    const fileId = match[1];
    const title = (match[2] || '').trim();

    if (!fileId || seenIds.has(fileId)) continue;
    if (title && NON_IMAGE_EXTENSIONS.test(title)) continue;

    seenIds.add(fileId);
    photos.push({
      id: fileId,
      name: title || 'Community Photo',
      url: buildDriveImageUrl(fileId),
    });
  }

  // Fallback if Google Drive markup structure changes slightly
  if (photos.length === 0) {
    const simpleIdRegex = /id="entry-([a-zA-Z0-9_-]+)"/g;
    let idMatch;
    while ((idMatch = simpleIdRegex.exec(html)) !== null) {
      const fileId = idMatch[1];
      if (!fileId || seenIds.has(fileId)) continue;
      seenIds.add(fileId);
      photos.push({
        id: fileId,
        name: 'Community Photo',
        url: buildDriveImageUrl(fileId),
      });
    }
  }

  return photos;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const folderInput =
    (req.query && (req.query.folderId || req.query.folder)) ||
    process.env.GOOGLE_DRIVE_FOLDER_ID ||
    process.env.VITE_GOOGLE_DRIVE_FOLDER_URL ||
    DEFAULT_FOLDER_URL;

  const apiKey =
    (req.query && req.query.apiKey) ||
    process.env.GOOGLE_DRIVE_API_KEY ||
    process.env.VITE_GOOGLE_DRIVE_API_KEY ||
    '';

  if (!folderInput) {
    return res.status(200).json({ photos: [], configured: false });
  }

  try {
    const photos = await fetchDriveFolderPhotos(folderInput, apiKey);
    // Cache at Vercel Edge for 60s so page loads are instant while new uploads appear within ~1 min
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({
      photos,
      configured: true,
    });
  } catch (error) {
    console.error('Error fetching Google Drive folder photos:', error);
    return res.status(200).json({
      photos: [],
      configured: true,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
