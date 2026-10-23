import React, { useEffect, useState } from 'react';
import { fetchGoogleDrivePhotos, getDriveFolderWebUrl } from './services/googleDrive';

interface GalleryItem {
  id: string;
  src: string;
  alt: string;
}

const STATIC_GALLERY_IMAGES: GalleryItem[] = [
  'media/img1.jpg',
  'media/img2.jpg',
  'media/img3.jpg',
  'media/img4.jpg',
  'media/img5.jpg',
  'media/img6.jpg',
  'media/img7.jpg',
  'media/img8.jpg',
  'media/img9.jpg',
  'media/img10.jpg',
  'media/img11.jpg',
  'media/img12.jpg',
  'media/img13.jpg',
  'media/img14.jpg',
  'media/img15.jpg',
  'media/img16.jpg',
].map((src, index) => ({
  id: `static-${index + 1}`,
  src,
  alt: `Jacmel Mission Photo ${index + 1}`,
}));

export const App: React.FC = () => {
  const [drivePhotos, setDrivePhotos] = useState<GalleryItem[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Record<string, boolean>>({});
  const driveFolderUrl = getDriveFolderWebUrl();

  useEffect(() => {
    let isMounted = true;
    fetchGoogleDrivePhotos().then((photos) => {
      if (!isMounted || photos.length === 0) return;
      setDrivePhotos(
        photos.map((photo) => ({
          id: `drive-${photo.id}`,
          src: photo.url,
          alt: photo.name || 'Jacmel Community Photo',
        }))
      );
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const allGalleryImages = [...drivePhotos, ...STATIC_GALLERY_IMAGES].filter(
    (item) => !hiddenIds[item.id]
  );

  return (
    <div className="page-wrapper">
      
      {/* EDITORIAL HEADER */}
      <header className="header">
        <div className="header-top">
          <h4>NON-PROFIT FOUNDATION</h4>
          <h1>ALTER HAITI</h1>
        </div>
        <div className="header-contact">
          <a href="mailto:alterhaitinyfoundationinc@gmail.com" className="email-link">
            ✉ alterhaitinyfoundationinc@gmail.com
          </a>
        </div>
      </header>

      {/* CINEMATIC HERO VIDEO */}
      <section className="hero-section">
        <video 
          src="media/jacmel3.mp4" 
          className="hero-video" 
          autoPlay 
          muted 
          loop 
          playsInline
        />
        <div className="hero-text-overlay">
          <h2>Revitalizing Jacmel.</h2>
          <p>Through solar illumination, education, and sanitation.</p>
        </div>
      </section>

      {/* MISSION FEATURE */}
      <section className="mission-section">
        <div className="mission-content">
          <h3>Our Mission & Vision</h3>
          <p>
            We believe that empowering the local community starts with sustainable infrastructure. 
            By installing solar street lights, supporting education, and improving community sanitation, 
            we bring safety and opportunity to the heart of Jacmel. Together, we are building a brighter, stronger future.
          </p>
          <div className="contact-box">
            <span>Get in touch with us:</span>
            <a href="mailto:alterhaitinyfoundationinc@gmail.com" className="contact-email">
              alterhaitinyfoundationinc@gmail.com
            </a>
          </div>
        </div>
      </section>

      {/* FULL WIDTH ANIMATED BANNER */}
      <section className="banner-section">
        <video 
          src="media/jacmel2.mp4" 
          className="banner-video" 
          autoPlay 
          muted 
          loop 
          playsInline
        />
        <div className="banner-text-overlay">
          <h2>Together We Are Stronger.</h2>
        </div>
      </section>

      {/* NEW PHOTO GALLERY SHOWCASE */}
      <section className="gallery-section">
        <div className="gallery-header">
          <h3>Community Gallery</h3>
          <p>Moments & Progress in Jacmel, Haiti</p>
        </div>
        <div className="photo-grid">
          {allGalleryImages.map((item) => (
            <div key={item.id} className="photo-card">
              <img 
                src={item.src} 
                alt={item.alt} 
                className="photo-img"
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={() =>
                  setHiddenIds((prev) => ({ ...prev, [item.id]: true }))
                }
              />
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <p>© 2026 Alter Haiti Foundation Inc. • Building a Brighter Future</p>
        <p className="footer-email">
          <a href="mailto:alterhaitinyfoundationinc@gmail.com">alterhaitinyfoundationinc@gmail.com</a>
          {driveFolderUrl && (
            <>
              {' • '}
              <a
                href={driveFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="staff-upload-link"
              >
                + Add Photos
              </a>
            </>
          )}
        </p>
      </footer>
    </div>
  );
};

export default App;

