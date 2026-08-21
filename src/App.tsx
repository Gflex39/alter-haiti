import React from 'react';

export const App: React.FC = () => {
  return (
    <div className="page-wrapper">
      
      {/* EDITORIAL HEADER */}
      <header className="header">
        <div className="header-top">
          <h4>NON-PROFIT FOUNDATION</h4>
          <h1>ALTER HAITI</h1>
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

      {/* EDITORIAL SPLIT FEATURE */}
      <section className="feature-section">
        <div className="feature-text">
          <h3>The Community Focus</h3>
          <p>
            We believe that empowering the local community starts with sustainable infrastructure. 
            By installing solar street lights, we bring safety and extended hours of operation 
            to the heart of Jacmel. Together, we are building a brighter, stronger future.
          </p>
        </div>
        <div className="feature-image-wrapper">
          <img src="media/jacmel1.jpg" alt="Jacmel Community" className="feature-image" />
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
          <h2>Together we are stronger.</h2>
        </div>
      </section>

      <footer className="footer">
        <p>© 2026 Alter Haiti Foundation Inc. • Building a Brighter Future</p>
      </footer>
    </div>
  );
};

export default App;
