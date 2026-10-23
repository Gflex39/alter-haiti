export const INSTAGRAM_CONFIG = {
  // Your Instagram User Handle
  username: 'alterhaitinyfoundationinc',
  // Official Account URL
  accountUrl: 'https://www.instagram.com/alterhaitinyfoundationinc/',
  // Optional: Instagram Graph API Access Token to fetch all live posts automatically
  // Learn how to get one: https://developers.facebook.com/docs/instagram-basic-display-api
  accessToken: ''
};

export const GOOGLE_DRIVE_CONFIG = {
  // Paste your shared Google Drive Folder link (or Folder ID) below.
  // Make sure the folder is shared as "Anyone with the link -> Viewer"
  // and shared as "Editor" with the person who will be uploading photos!
  // Example: 'https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j?usp=sharing'
  folderUrl:
    import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_URL ||
    'https://drive.google.com/drive/folders/1iIUrJ-hyW3YKd6zb6exiGZJ0EVSxMUdN',

  // Optional: Google Drive API Key (not required for public shared folders)
  apiKey: import.meta.env.VITE_GOOGLE_DRIVE_API_KEY || ''
};

