export type FontPreset = 'editorial' | 'serif' | 'modern';
export type SectionHeight = 'compact' | 'medium' | 'tall';
export type TextAlign = 'left' | 'center';
export type MediaType = 'video' | 'image';

export interface ThemeConfig {
  bgColor: string;
  cardBg: string;
  textPrimary: string;
  textSecondary: string;
  accentColor: string;
  fontPreset: FontPreset;
}

export interface HeaderConfig {
  subtitle: string;
  title: string;
  email: string;
  showEmail: boolean;
  showCta: boolean;
  ctaText: string;
  ctaUrl: string;
}

export interface FooterConfig {
  copyright: string;
  email: string;
  driveFolderUrl: string;
  showDriveUploadLink: boolean;
  showEditLink: boolean;
}

export interface HeroSection {
  id: string;
  type: 'hero';
  hidden?: boolean;
  mediaType: MediaType;
  mediaSrc: string;
  brightness: number;
  height: SectionHeight;
  align: TextAlign;
  heading: string;
  subheading: string;
  showCta: boolean;
  ctaText: string;
  ctaUrl: string;
}

export interface MissionSection {
  id: string;
  type: 'mission';
  hidden?: boolean;
  align: TextAlign;
  heading: string;
  body: string;
  showContactBox: boolean;
  contactLabel: string;
  contactEmail: string;
  showCta: boolean;
  ctaText: string;
  ctaUrl: string;
}

export interface BannerSection {
  id: string;
  type: 'banner';
  hidden?: boolean;
  mediaType: MediaType;
  mediaSrc: string;
  brightness: number;
  height: SectionHeight;
  heading: string;
  subheading: string;
  showCta: boolean;
  ctaText: string;
  ctaUrl: string;
}

export interface SplitSection {
  id: string;
  type: 'split';
  hidden?: boolean;
  imagePosition: 'left' | 'right';
  mediaType: MediaType;
  mediaSrc: string;
  eyebrow: string;
  heading: string;
  body: string;
  showCta: boolean;
  ctaText: string;
  ctaUrl: string;
}

export interface PillarItem {
  id: string;
  badge: string;
  title: string;
  description: string;
}

export interface PillarsSection {
  id: string;
  type: 'pillars';
  hidden?: boolean;
  heading: string;
  subheading: string;
  items: PillarItem[];
}

export interface CtaSection {
  id: string;
  type: 'cta';
  hidden?: boolean;
  heading: string;
  body: string;
  primaryText: string;
  primaryUrl: string;
  showSecondary: boolean;
  secondaryText: string;
  secondaryUrl: string;
}

export interface CustomGalleryImage {
  id: string;
  src: string;
  alt: string;
  hidden?: boolean;
}

export interface GallerySection {
  id: string;
  type: 'gallery';
  hidden?: boolean;
  heading: string;
  subheading: string;
  columns: 3 | 4;
  showDrivePhotos: boolean;
  customImages: CustomGalleryImage[];
  hiddenDriveIds: string[];
}

export type SiteSection =
  | HeroSection
  | MissionSection
  | BannerSection
  | SplitSection
  | PillarsSection
  | CtaSection
  | GallerySection;

export interface SiteContent {
  version: number;
  updatedAt: string;
  theme: ThemeConfig;
  header: HeaderConfig;
  sections: SiteSection[];
  footer: FooterConfig;
}

const DEFAULT_STATIC_IMAGES: CustomGalleryImage[] = Array.from({ length: 16 }, (_, index) => ({
  id: `static-${index + 1}`,
  src: `media/img${index + 1}.jpg`,
  alt: `Jacmel Mission Photo ${index + 1}`,
}));

export const DEFAULT_SITE_CONTENT: SiteContent = {
  version: 1,
  updatedAt: '2026-11-11T00:00:00.000Z',
  theme: {
    bgColor: '#050505',
    cardBg: '#121212',
    textPrimary: '#ffffff',
    textSecondary: '#a3a3a3',
    accentColor: '#3b82f6',
    fontPreset: 'editorial',
  },
  header: {
    subtitle: 'NON-PROFIT FOUNDATION',
    title: 'ALTER HAITI',
    email: 'alterhaitinyfoundationinc@gmail.com',
    showEmail: true,
    showCta: false,
    ctaText: 'Support Our Mission',
    ctaUrl: 'mailto:alterhaitinyfoundationinc@gmail.com?subject=Supporting%20Alter%20Haiti',
  },
  sections: [
    {
      id: 'hero-main',
      type: 'hero',
      mediaType: 'video',
      mediaSrc: 'media/jacmel3.mp4',
      brightness: 0.7,
      height: 'tall',
      align: 'left',
      heading: 'Revitalizing Jacmel.',
      subheading: 'Through solar illumination, education, and sanitation.',
      showCta: false,
      ctaText: 'Get Involved',
      ctaUrl: 'mailto:alterhaitinyfoundationinc@gmail.com',
    },
    {
      id: 'mission-main',
      type: 'mission',
      align: 'center',
      heading: 'Our Mission & Vision',
      body: 'We believe that empowering the local community starts with sustainable infrastructure. By installing solar street lights, supporting education, and improving community sanitation, we bring safety and opportunity to the heart of Jacmel. Together, we are building a brighter, stronger future.',
      showContactBox: true,
      contactLabel: 'Get in touch with us:',
      contactEmail: 'alterhaitinyfoundationinc@gmail.com',
      showCta: false,
      ctaText: 'Donate Today',
      ctaUrl: 'mailto:alterhaitinyfoundationinc@gmail.com',
    },
    {
      id: 'banner-main',
      type: 'banner',
      mediaType: 'video',
      mediaSrc: 'media/jacmel2.mp4',
      brightness: 0.5,
      height: 'medium',
      heading: 'Together We Are Stronger.',
      subheading: '',
      showCta: false,
      ctaText: 'Partner With Us',
      ctaUrl: 'mailto:alterhaitinyfoundationinc@gmail.com',
    },
    {
      id: 'gallery-main',
      type: 'gallery',
      heading: 'Community Gallery',
      subheading: 'Moments & Progress in Jacmel, Haiti',
      columns: 4,
      showDrivePhotos: true,
      customImages: DEFAULT_STATIC_IMAGES,
      hiddenDriveIds: [],
    },
  ],
  footer: {
    copyright: '© 2026 Alter Haiti Foundation Inc. • Building a Brighter Future',
    email: 'alterhaitinyfoundationinc@gmail.com',
    driveFolderUrl: 'https://drive.google.com/drive/folders/1iIUrJ-hyW3YKd6zb6exiGZJ0EVSxMUdN',
    showDriveUploadLink: true,
    showEditLink: false,
  },
};

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  theme: Omit<ThemeConfig, 'fontPreset'>;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'editorial-dark',
    name: 'Editorial Onyx',
    description: 'High-contrast dark cinema look',
    theme: {
      bgColor: '#050505',
      cardBg: '#121212',
      textPrimary: '#ffffff',
      textSecondary: '#a3a3a3',
      accentColor: '#3b82f6',
    },
  },
  {
    id: 'warm-ivory',
    name: 'Warm Daylight',
    description: 'Clean, bright foundation aesthetic',
    theme: {
      bgColor: '#faf8f5',
      cardBg: '#ffffff',
      textPrimary: '#171717',
      textSecondary: '#57534e',
      accentColor: '#1d4ed8',
    },
  },
  {
    id: 'caribbean-slate',
    name: 'Deep Ocean',
    description: 'Rich coastal navy and sky accents',
    theme: {
      bgColor: '#08121e',
      cardBg: '#102033',
      textPrimary: '#f8fafc',
      textSecondary: '#94a3b8',
      accentColor: '#38bdf8',
    },
  },
  {
    id: 'earth-canopy',
    name: 'Warm Charcoal & Gold',
    description: 'Solar warmth on deep charcoal',
    theme: {
      bgColor: '#0c0b09',
      cardBg: '#191714',
      textPrimary: '#fafaf9',
      textSecondary: '#a8a29e',
      accentColor: '#f59e0b',
    },
  },
];

export const SECTION_LABELS: Record<SiteSection['type'], string> = {
  hero: 'Hero Video / Cover',
  mission: 'Text & Mission',
  split: 'Image + Story Split',
  pillars: '3-Column Highlights',
  banner: 'Full-Width Media Banner',
  cta: 'Donate / Call to Action',
  gallery: 'Photo Gallery',
};

export function createSectionFromTemplate(type: SiteSection['type']): SiteSection {
  const uid = `${type}-${Date.now().toString(36)}`;
  switch (type) {
    case 'hero':
      return {
        id: uid,
        type: 'hero',
        mediaType: 'video',
        mediaSrc: 'media/jacmel3.mp4',
        brightness: 0.65,
        height: 'tall',
        align: 'left',
        heading: 'Lighting the Way Forward.',
        subheading: 'Community-led progress in Jacmel, Haiti.',
        showCta: true,
        ctaText: 'Support Jacmel',
        ctaUrl: 'mailto:alterhaitinyfoundationinc@gmail.com',
      };
    case 'mission':
      return {
        id: uid,
        type: 'mission',
        align: 'center',
        heading: 'About This Initiative',
        body: 'Share updates, stories, or upcoming goals with your supporters. Click directly on any text to edit it in place.',
        showContactBox: false,
        contactLabel: 'Reach out anytime:',
        contactEmail: 'alterhaitinyfoundationinc@gmail.com',
        showCta: true,
        ctaText: 'Learn More',
        ctaUrl: 'mailto:alterhaitinyfoundationinc@gmail.com',
      };
    case 'split':
      return {
        id: uid,
        type: 'split',
        imagePosition: 'left',
        mediaType: 'image',
        mediaSrc: 'media/img1.jpg',
        eyebrow: 'COMMUNITY IMPACT',
        heading: 'Solar Street Lights for Safer Evenings',
        body: 'Reliable solar lighting transforms neighborhoods after dusk—helping students study, families gather safely, and local small businesses stay open.',
        showCta: true,
        ctaText: 'Sponsor a Street Light',
        ctaUrl: 'mailto:alterhaitinyfoundationinc@gmail.com?subject=Sponsor%20a%20Solar%20Light',
      };
    case 'pillars':
      return {
        id: uid,
        type: 'pillars',
        heading: 'Our Core Pillars',
        subheading: 'Practical, lasting investments led alongside residents of Jacmel.',
        items: [
          {
            id: `${uid}-1`,
            badge: '01',
            title: 'Solar Illumination',
            description: 'Installing durable solar street lights to bring clean, reliable evening safety to local streets.',
          },
          {
            id: `${uid}-2`,
            badge: '02',
            title: 'Youth Education',
            description: 'Equipping students and local classrooms with essential learning materials and community support.',
          },
          {
            id: `${uid}-3`,
            badge: '03',
            title: 'Clean Sanitation',
            description: 'Strengthening neighborhood hygiene and public health infrastructure across Jacmel.',
          },
        ],
      };
    case 'banner':
      return {
        id: uid,
        type: 'banner',
        mediaType: 'video',
        mediaSrc: 'media/jacmel2.mp4',
        brightness: 0.5,
        height: 'medium',
        heading: 'Every Contribution Makes a Visible Difference.',
        subheading: '',
        showCta: false,
        ctaText: 'Contact Us',
        ctaUrl: 'mailto:alterhaitinyfoundationinc@gmail.com',
      };
    case 'cta':
      return {
        id: uid,
        type: 'cta',
        heading: 'Partner With Alter Haiti Foundation',
        body: '100% of community contributions help fund solar installations, educational supplies, and sanitation efforts in Jacmel.',
        primaryText: 'Donate / Get Involved',
        primaryUrl: 'mailto:alterhaitinyfoundationinc@gmail.com?subject=Donation%20Inquiry',
        showSecondary: true,
        secondaryText: 'Email Our Team',
        secondaryUrl: 'mailto:alterhaitinyfoundationinc@gmail.com',
      };
    case 'gallery':
      return {
        id: uid,
        type: 'gallery',
        heading: 'Project Photos',
        subheading: 'Recent moments from on the ground in Jacmel',
        columns: 3,
        showDrivePhotos: false,
        customImages: [
          { id: `${uid}-img1`, src: 'media/img2.jpg', alt: 'Community Photo 1' },
          { id: `${uid}-img2`, src: 'media/img5.jpg', alt: 'Community Photo 2' },
          { id: `${uid}-img3`, src: 'media/img8.jpg', alt: 'Community Photo 3' },
        ],
        hiddenDriveIds: [],
      };
  }
}

export function resolveAssetUrl(src: string): string {
  if (!src) return '';
  if (
    src.startsWith('http://') ||
    src.startsWith('https://') ||
    src.startsWith('data:') ||
    src.startsWith('blob:') ||
    src.startsWith('/')
  ) {
    return src;
  }
  const clean = src.replace(/^\.\//, '');
  if (typeof window === 'undefined') {
    return clean;
  }
  // If user is on /admin route at root domain, resolve relative assets from site root "/"
  const path = window.location.pathname;
  if (path === '/admin' || path.startsWith('/admin/')) {
    return `/${clean}`;
  }
  // If hosted under a GitHub Pages subpath like /alter-haiti/admin, strip /admin
  if (path.endsWith('/admin') || path.endsWith('/admin/')) {
    const prefix = path.replace(/\/admin\/?$/, '/');
    return `${prefix}${clean}`;
  }
  return clean;
}
