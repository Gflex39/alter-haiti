import { INSTAGRAM_CONFIG } from '../config';

export interface FetchedInstagramPost {
  id: string;
  permalink: string;
  embedUrl: string;
  caption?: string;
  mediaType?: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  mediaUrl?: string;
  timestamp?: string;
}

export async function fetchAllAccountPosts(): Promise<FetchedInstagramPost[]> {
  // If an Access Token is configured, fetch all posts programmatically from Meta Graph API
  if (INSTAGRAM_CONFIG.accessToken) {
    try {
      const response = await fetch(
        `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,permalink,timestamp&access_token=${INSTAGRAM_CONFIG.accessToken}`
      );
      const data = await response.json();
      if (data && data.data) {
        return data.data.map((item: any) => ({
          id: item.id,
          permalink: item.permalink,
          embedUrl: `${item.permalink}embed`,
          caption: item.caption,
          mediaType: item.media_type,
          mediaUrl: item.media_url,
          timestamp: item.timestamp
        }));
      }
    } catch (err) {
      console.warn('Could not fetch live Instagram API feed, using embed list:', err);
    }
  }

  // Fallback posts list
  return [
    {
      id: 'DZoNHm5xjsg',
      permalink: 'https://www.instagram.com/p/DZoNHm5xjsg/',
      embedUrl: 'https://www.instagram.com/p/DZoNHm5xjsg/embed'
    },
    {
      id: 'DZoNHm5xjsg-2',
      permalink: 'https://www.instagram.com/p/DZoNHm5xjsg/',
      embedUrl: 'https://www.instagram.com/p/DZoNHm5xjsg/embed'
    },
    {
      id: 'DZoNHm5xjsg-3',
      permalink: 'https://www.instagram.com/p/DZoNHm5xjsg/',
      embedUrl: 'https://www.instagram.com/p/DZoNHm5xjsg/embed'
    },
    {
      id: 'DZoNHm5xjsg-4',
      permalink: 'https://www.instagram.com/p/DZoNHm5xjsg/',
      embedUrl: 'https://www.instagram.com/p/DZoNHm5xjsg/embed'
    },
    {
      id: 'DZoNHm5xjsg-5',
      permalink: 'https://www.instagram.com/p/DZoNHm5xjsg/',
      embedUrl: 'https://www.instagram.com/p/DZoNHm5xjsg/embed'
    },
    {
      id: 'DZoNHm5xjsg-6',
      permalink: 'https://www.instagram.com/p/DZoNHm5xjsg/',
      embedUrl: 'https://www.instagram.com/p/DZoNHm5xjsg/embed'
    }
  ];
}
