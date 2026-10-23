import { GOOGLE_DRIVE_CONFIG } from '../config';

export interface DrivePhoto {
  id: string;
  name: string;
  url: string;
}

export function extractDriveFolderId(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch) return idParamMatch[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) return trimmed;
  return '';
}

export function getDriveFolderWebUrl(): string {
  const folderId = extractDriveFolderId(GOOGLE_DRIVE_CONFIG.folderUrl);
  if (!folderId) return '';
  return `https://drive.google.com/drive/folders/${folderId}`;
}

export async function fetchGoogleDrivePhotos(): Promise<DrivePhoto[]> {
  const folderId = extractDriveFolderId(GOOGLE_DRIVE_CONFIG.folderUrl);

  try {
    const params = new URLSearchParams();
    if (folderId) {
      params.set('folderId', folderId);
    }
    if (GOOGLE_DRIVE_CONFIG.apiKey) {
      params.set('apiKey', GOOGLE_DRIVE_CONFIG.apiKey);
    }

    const queryString = params.toString();
    const endpoint = queryString ? `/api/photos?${queryString}` : '/api/photos';

    const response = await fetch(endpoint);
    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    if (data && Array.isArray(data.photos)) {
      return data.photos;
    }
  } catch (err) {
    console.warn('Could not fetch Google Drive gallery photos:', err);
  }

  return [];
}
