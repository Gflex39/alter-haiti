import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { fetchGoogleDrivePhotos, getDriveFolderWebUrl } from '../services/googleDrive';
import {
  FontPreset,
  resolveAssetUrl,
  SECTION_LABELS,
  SiteContent,
  SiteSection,
} from '../types/cms';
import { EditableText } from './EditableText';

export type SelectedTarget =
  | { kind: 'section'; id: string }
  | { kind: 'header' }
  | { kind: 'footer' }
  | null;

interface SiteRendererProps {
  content: SiteContent;
  editMode?: boolean;
  selectedTarget?: SelectedTarget;
  onSelectTarget?: (target: SelectedTarget) => void;
  onUpdateContent?: (updater: (prev: SiteContent) => SiteContent) => void;
  onMoveSection?: (id: string, direction: 'up' | 'down') => void;
  onDuplicateSection?: (id: string) => void;
  onToggleSectionVisibility?: (id: string) => void;
  onDeleteSection?: (id: string) => void;
  onRequestInsertAfter?: (index: number) => void;
  onOpenEditor?: () => void;
}

interface GalleryDisplayItem {
  id: string;
  src: string;
  alt: string;
  isDrive: boolean;
}

function getFontVars(preset: FontPreset): { heading: string; body: string } {
  switch (preset) {
    case 'serif':
      return {
        heading: "'Playfair Display', Georgia, 'Times New Roman', serif",
        body: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      };
    case 'modern':
      return {
        heading: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
        body: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      };
    case 'editorial':
    default:
      return {
        heading: "'Helvetica Neue', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
        body: "'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      };
  }
}

export const SiteRenderer: React.FC<SiteRendererProps> = ({
  content,
  editMode = false,
  selectedTarget = null,
  onSelectTarget,
  onUpdateContent,
  onMoveSection,
  onDuplicateSection,
  onToggleSectionVisibility,
  onDeleteSection,
  onRequestInsertAfter,
  onOpenEditor,
}) => {
  const [drivePhotos, setDrivePhotos] = useState<GalleryDisplayItem[]>([]);
  const [brokenIds, setBrokenIds] = useState<Record<string, boolean>>({});

  const driveFolderUrl = getDriveFolderWebUrl(content.footer.driveFolderUrl);

  useEffect(() => {
    let isMounted = true;
    fetchGoogleDrivePhotos(content.footer.driveFolderUrl).then((photos) => {
      if (!isMounted) return;
      setDrivePhotos(
        photos.map((photo) => ({
          id: `drive-${photo.id}`,
          src: photo.url,
          alt: photo.name || 'Jacmel Community Photo',
          isDrive: true,
        }))
      );
    });
    return () => {
      isMounted = false;
    };
  }, [content.footer.driveFolderUrl]);

  const updateSectionField = <T extends SiteSection>(
    sectionId: string,
    patcher: (sec: T) => T
  ) => {
    onUpdateContent?.((prev) => ({
      ...prev,
      sections: prev.sections.map((sec) =>
        sec.id === sectionId ? patcher(sec as T) : sec
      ),
    }));
  };

  const fonts = getFontVars(content.theme.fontPreset);
  const cssVars = {
    '--bg-color': content.theme.bgColor,
    '--card-bg': content.theme.cardBg,
    '--text-primary': content.theme.textPrimary,
    '--text-secondary': content.theme.textSecondary,
    '--accent': content.theme.accentColor,
    '--font-heading': fonts.heading,
    '--font-body': fonts.body,
  } as React.CSSProperties;

  const isHeaderSelected = editMode && selectedTarget?.kind === 'header';
  const isFooterSelected = editMode && selectedTarget?.kind === 'footer';

  const handleLinkClick = (e: React.MouseEvent) => {
    if (editMode) {
      e.preventDefault();
    }
  };

  return (
    <div className={`page-wrapper ${editMode ? 'is-canvas-editing' : ''}`} style={cssVars}>
      {/* HEADER */}
      <header
        data-cms-target="header"
        className={`header ${editMode ? 'cms-selectable-region' : ''} ${
          isHeaderSelected ? 'is-selected' : ''
        }`}
        onClick={() => editMode && onSelectTarget?.({ kind: 'header' })}
      >
        {editMode && (
          <div className="cms-region-badge">
            <span>Site Header</span>
          </div>
        )}
        <div className="header-top">
          <EditableText
            as="h4"
            value={content.header.subtitle}
            editable={editMode}
            placeholder="Subtitle"
            onFocusField={() => onSelectTarget?.({ kind: 'header' })}
            onChange={(subtitle) =>
              onUpdateContent?.((prev) => ({
                ...prev,
                header: { ...prev.header, subtitle },
              }))
            }
          />
          <EditableText
            as="h1"
            value={content.header.title}
            editable={editMode}
            placeholder="Organization Name"
            onFocusField={() => onSelectTarget?.({ kind: 'header' })}
            onChange={(title) =>
              onUpdateContent?.((prev) => ({
                ...prev,
                header: { ...prev.header, title },
              }))
            }
          />
        </div>
        <div className="header-actions">
          {content.header.showEmail && content.header.email && (
            <a
              href={`mailto:${content.header.email}`}
              className="email-link"
              onClick={handleLinkClick}
            >
              ✉ {content.header.email}
            </a>
          )}
          {content.header.showCta && content.header.ctaText && (
            <a
              href={content.header.ctaUrl || '#'}
              className="site-btn site-btn-primary site-btn-sm"
              onClick={handleLinkClick}
            >
              {content.header.ctaText}
            </a>
          )}
        </div>
      </header>

      {editMode && (
        <div className="cms-insert-divider">
          <button
            type="button"
            className="cms-insert-pill"
            onClick={(e) => {
              e.stopPropagation();
              onRequestInsertAfter?.(-1);
            }}
          >
            <Plus size={14} /> Add Section Here
          </button>
        </div>
      )}

      {/* PAGE SECTIONS */}
      {content.sections.map((section, index) => {
        if (section.hidden && !editMode) {
          return null;
        }
        const isSelected =
          editMode && selectedTarget?.kind === 'section' && selectedTarget.id === section.id;

        return (
          <React.Fragment key={section.id}>
            <div
              data-cms-target={section.id}
              className={`cms-section-shell ${editMode ? 'is-editable' : ''} ${
                isSelected ? 'is-selected' : ''
              } ${section.hidden ? 'is-hidden-section' : ''}`}
              onClick={(e) => {
                if (!editMode) return;
                e.stopPropagation();
                onSelectTarget?.({ kind: 'section', id: section.id });
              }}
            >
              {editMode && (
                <div className="cms-section-chrome" onClick={(e) => e.stopPropagation()}>
                  <div
                    className="cms-section-badge"
                    onClick={() => onSelectTarget?.({ kind: 'section', id: section.id })}
                  >
                    <span>{SECTION_LABELS[section.type]}</span>
                    {section.hidden && <em className="cms-hidden-pill">Hidden</em>}
                  </div>
                  <div className="cms-section-toolbar">
                    <button
                      type="button"
                      title="Move section up"
                      disabled={index === 0}
                      onClick={() => onMoveSection?.(section.id, 'up')}
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      title="Move section down"
                      disabled={index === content.sections.length - 1}
                      onClick={() => onMoveSection?.(section.id, 'down')}
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      title="Duplicate section"
                      onClick={() => onDuplicateSection?.(section.id)}
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      type="button"
                      title={section.hidden ? 'Show section on live site' : 'Hide section'}
                      onClick={() => onToggleSectionVisibility?.(section.id)}
                    >
                      {section.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    <button
                      type="button"
                      className="is-danger"
                      title="Delete section"
                      onClick={() => onDeleteSection?.(section.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}

              {renderSectionBody({
                section,
                editMode,
                drivePhotos,
                brokenIds,
                setBrokenIds,
                onSelectSection: () => onSelectTarget?.({ kind: 'section', id: section.id }),
                updateSectionField,
                handleLinkClick,
              })}
            </div>

            {editMode && (
              <div className="cms-insert-divider">
                <button
                  type="button"
                  className="cms-insert-pill"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRequestInsertAfter?.(index);
                  }}
                >
                  <Plus size={14} /> Add Section Here
                </button>
              </div>
            )}
          </React.Fragment>
        );
      })}

      {/* FOOTER */}
      <footer
        data-cms-target="footer"
        className={`footer ${editMode ? 'cms-selectable-region' : ''} ${
          isFooterSelected ? 'is-selected' : ''
        }`}
        onClick={() => editMode && onSelectTarget?.({ kind: 'footer' })}
      >
        {editMode && (
          <div className="cms-region-badge">
            <span>Site Footer</span>
          </div>
        )}
        <EditableText
          as="p"
          value={content.footer.copyright}
          editable={editMode}
          placeholder="Footer copyright text"
          onFocusField={() => onSelectTarget?.({ kind: 'footer' })}
          onChange={(copyright) =>
            onUpdateContent?.((prev) => ({
              ...prev,
              footer: { ...prev.footer, copyright },
            }))
          }
        />
        <p className="footer-email">
          {content.footer.email && (
            <a href={`mailto:${content.footer.email}`} onClick={handleLinkClick}>
              {content.footer.email}
            </a>
          )}
          {content.footer.showDriveUploadLink && driveFolderUrl && (
            <>
              {' • '}
              <a
                href={driveFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="staff-upload-link"
                onClick={handleLinkClick}
              >
                + Add Photos
              </a>
            </>
          )}
          {!editMode && content.footer.showEditLink && onOpenEditor && (
            <>
              {' • '}
              <button
                type="button"
                className="footer-edit-trigger"
                onClick={onOpenEditor}
              >
                <Pencil size={12} /> Edit Site
              </button>
            </>
          )}
        </p>
      </footer>
    </div>
  );
};

interface RenderSectionArgs {
  section: SiteSection;
  editMode: boolean;
  drivePhotos: GalleryDisplayItem[];
  brokenIds: Record<string, boolean>;
  setBrokenIds: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onSelectSection: () => void;
  updateSectionField: <T extends SiteSection>(id: string, patcher: (s: T) => T) => void;
  handleLinkClick: (e: React.MouseEvent) => void;
}

function renderSectionBody({
  section,
  editMode,
  drivePhotos,
  brokenIds,
  setBrokenIds,
  onSelectSection,
  updateSectionField,
  handleLinkClick,
}: RenderSectionArgs) {
  switch (section.type) {
    case 'hero': {
      const resolvedSrc = resolveAssetUrl(section.mediaSrc);
      return (
        <section className={`hero-section height-${section.height} align-${section.align}`}>
          {section.mediaType === 'video' ? (
            <video
              key={resolvedSrc}
              src={resolvedSrc}
              className="hero-video"
              style={{ filter: `brightness(${section.brightness})` }}
              autoPlay
              muted
              loop
              playsInline
            />
          ) : (
            <img
              src={resolvedSrc}
              alt={section.heading || 'Hero cover'}
              className="hero-video"
              style={{ filter: `brightness(${section.brightness})` }}
            />
          )}
          <div className="hero-text-overlay">
            <div className="hero-text-inner">
              <EditableText
                as="h2"
                value={section.heading}
                editable={editMode}
                placeholder="Hero Headline"
                onFocusField={onSelectSection}
                onChange={(heading) =>
                  updateSectionField(section.id, (s: typeof section) => ({ ...s, heading }))
                }
              />
              {(section.subheading || editMode) && (
                <EditableText
                  as="p"
                  value={section.subheading}
                  editable={editMode}
                  multiline
                  placeholder="Add a supporting subtitle..."
                  onFocusField={onSelectSection}
                  onChange={(subheading) =>
                    updateSectionField(section.id, (s: typeof section) => ({
                      ...s,
                      subheading,
                    }))
                  }
                />
              )}
              {section.showCta && section.ctaText && (
                <div className="section-cta-row">
                  <a
                    href={section.ctaUrl || '#'}
                    className="site-btn site-btn-primary"
                    onClick={handleLinkClick}
                  >
                    {section.ctaText}
                  </a>
                </div>
              )}
            </div>
          </div>
        </section>
      );
    }

    case 'mission': {
      return (
        <section className={`mission-section align-${section.align}`}>
          <div className="mission-content">
            <EditableText
              as="h3"
              value={section.heading}
              editable={editMode}
              placeholder="Section Heading"
              onFocusField={onSelectSection}
              onChange={(heading) =>
                updateSectionField(section.id, (s: typeof section) => ({ ...s, heading }))
              }
            />
            <EditableText
              as="p"
              value={section.body}
              editable={editMode}
              multiline
              placeholder="Write your story or mission statement here..."
              onFocusField={onSelectSection}
              onChange={(body) =>
                updateSectionField(section.id, (s: typeof section) => ({ ...s, body }))
              }
            />
            {section.showCta && section.ctaText && (
              <div className="section-cta-row" style={{ marginBottom: section.showContactBox ? '2rem' : 0 }}>
                <a
                  href={section.ctaUrl || '#'}
                  className="site-btn site-btn-primary"
                  onClick={handleLinkClick}
                >
                  {section.ctaText}
                </a>
              </div>
            )}
            {section.showContactBox && (
              <div className="contact-box">
                <EditableText
                  as="span"
                  value={section.contactLabel}
                  editable={editMode}
                  placeholder="Contact label"
                  onFocusField={onSelectSection}
                  onChange={(contactLabel) =>
                    updateSectionField(section.id, (s: typeof section) => ({
                      ...s,
                      contactLabel,
                    }))
                  }
                />
                <a
                  href={`mailto:${section.contactEmail}`}
                  className="contact-email"
                  onClick={handleLinkClick}
                >
                  {section.contactEmail}
                </a>
              </div>
            )}
          </div>
        </section>
      );
    }

    case 'banner': {
      const resolvedSrc = resolveAssetUrl(section.mediaSrc);
      return (
        <section className={`banner-section height-${section.height}`}>
          {section.mediaType === 'video' ? (
            <video
              key={resolvedSrc}
              src={resolvedSrc}
              className="banner-video"
              style={{ filter: `brightness(${section.brightness})` }}
              autoPlay
              muted
              loop
              playsInline
            />
          ) : (
            <img
              src={resolvedSrc}
              alt={section.heading || 'Banner background'}
              className="banner-video"
              style={{ filter: `brightness(${section.brightness})` }}
            />
          )}
          <div className="banner-text-overlay">
            <div className="banner-text-inner">
              <EditableText
                as="h2"
                value={section.heading}
                editable={editMode}
                placeholder="Banner Statement"
                onFocusField={onSelectSection}
                onChange={(heading) =>
                  updateSectionField(section.id, (s: typeof section) => ({ ...s, heading }))
                }
              />
              {(section.subheading || editMode) && (
                <EditableText
                  as="p"
                  className="banner-subtext"
                  value={section.subheading}
                  editable={editMode}
                  placeholder="Optional subtitle..."
                  onFocusField={onSelectSection}
                  onChange={(subheading) =>
                    updateSectionField(section.id, (s: typeof section) => ({
                      ...s,
                      subheading,
                    }))
                  }
                />
              )}
              {section.showCta && section.ctaText && (
                <div className="section-cta-row">
                  <a
                    href={section.ctaUrl || '#'}
                    className="site-btn site-btn-primary"
                    onClick={handleLinkClick}
                  >
                    {section.ctaText}
                  </a>
                </div>
              )}
            </div>
          </div>
        </section>
      );
    }

    case 'split': {
      const resolvedSrc = resolveAssetUrl(section.mediaSrc);
      return (
        <section className={`split-section image-${section.imagePosition}`}>
          <div className="split-media-wrap">
            {section.mediaType === 'video' ? (
              <video
                key={resolvedSrc}
                src={resolvedSrc}
                className="split-media"
                autoPlay
                muted
                loop
                playsInline
              />
            ) : (
              <img
                src={resolvedSrc}
                alt={section.heading}
                className="split-media"
                loading="lazy"
              />
            )}
          </div>
          <div className="split-copy">
            {(section.eyebrow || editMode) && (
              <EditableText
                as="h4"
                className="split-eyebrow"
                value={section.eyebrow}
                editable={editMode}
                placeholder="EYEBROW LABEL"
                onFocusField={onSelectSection}
                onChange={(eyebrow) =>
                  updateSectionField(section.id, (s: typeof section) => ({ ...s, eyebrow }))
                }
              />
            )}
            <EditableText
              as="h3"
              value={section.heading}
              editable={editMode}
              placeholder="Feature Heading"
              onFocusField={onSelectSection}
              onChange={(heading) =>
                updateSectionField(section.id, (s: typeof section) => ({ ...s, heading }))
              }
            />
            <EditableText
              as="p"
              value={section.body}
              editable={editMode}
              multiline
              placeholder="Tell the story behind this photo or project..."
              onFocusField={onSelectSection}
              onChange={(body) =>
                updateSectionField(section.id, (s: typeof section) => ({ ...s, body }))
              }
            />
            {section.showCta && section.ctaText && (
              <div className="section-cta-row">
                <a
                  href={section.ctaUrl || '#'}
                  className="site-btn site-btn-primary"
                  onClick={handleLinkClick}
                >
                  {section.ctaText}
                </a>
              </div>
            )}
          </div>
        </section>
      );
    }

    case 'pillars': {
      return (
        <section className="pillars-section">
          <div className="pillars-header">
            <EditableText
              as="h3"
              value={section.heading}
              editable={editMode}
              placeholder="Highlights Heading"
              onFocusField={onSelectSection}
              onChange={(heading) =>
                updateSectionField(section.id, (s: typeof section) => ({ ...s, heading }))
              }
            />
            {(section.subheading || editMode) && (
              <EditableText
                as="p"
                value={section.subheading}
                editable={editMode}
                placeholder="Supporting description"
                onFocusField={onSelectSection}
                onChange={(subheading) =>
                  updateSectionField(section.id, (s: typeof section) => ({
                    ...s,
                    subheading,
                  }))
                }
              />
            )}
          </div>
          <div className="pillars-grid">
            {section.items.map((item) => (
              <div key={item.id} className="pillar-card">
                <EditableText
                  as="span"
                  className="pillar-badge"
                  value={item.badge}
                  editable={editMode}
                  placeholder="01"
                  onFocusField={onSelectSection}
                  onChange={(badge) =>
                    updateSectionField(section.id, (s: typeof section) => ({
                      ...s,
                      items: s.items.map((it) => (it.id === item.id ? { ...it, badge } : it)),
                    }))
                  }
                />
                <EditableText
                  as="h4"
                  value={item.title}
                  editable={editMode}
                  placeholder="Card Title"
                  onFocusField={onSelectSection}
                  onChange={(title) =>
                    updateSectionField(section.id, (s: typeof section) => ({
                      ...s,
                      items: s.items.map((it) => (it.id === item.id ? { ...it, title } : it)),
                    }))
                  }
                />
                <EditableText
                  as="p"
                  value={item.description}
                  editable={editMode}
                  multiline
                  placeholder="Card description..."
                  onFocusField={onSelectSection}
                  onChange={(description) =>
                    updateSectionField(section.id, (s: typeof section) => ({
                      ...s,
                      items: s.items.map((it) =>
                        it.id === item.id ? { ...it, description } : it
                      ),
                    }))
                  }
                />
              </div>
            ))}
          </div>
        </section>
      );
    }

    case 'cta': {
      return (
        <section className="cta-banner-section">
          <div className="cta-banner-card">
            <EditableText
              as="h3"
              value={section.heading}
              editable={editMode}
              placeholder="Call to Action Heading"
              onFocusField={onSelectSection}
              onChange={(heading) =>
                updateSectionField(section.id, (s: typeof section) => ({ ...s, heading }))
              }
            />
            <EditableText
              as="p"
              value={section.body}
              editable={editMode}
              multiline
              placeholder="Explain how supporters can help..."
              onFocusField={onSelectSection}
              onChange={(body) =>
                updateSectionField(section.id, (s: typeof section) => ({ ...s, body }))
              }
            />
            <div className="cta-banner-buttons">
              {section.primaryText && (
                <a
                  href={section.primaryUrl || '#'}
                  className="site-btn site-btn-primary"
                  onClick={handleLinkClick}
                >
                  {section.primaryText}
                </a>
              )}
              {section.showSecondary && section.secondaryText && (
                <a
                  href={section.secondaryUrl || '#'}
                  className="site-btn site-btn-secondary"
                  onClick={handleLinkClick}
                >
                  {section.secondaryText}
                </a>
              )}
            </div>
          </div>
        </section>
      );
    }

    case 'gallery': {
      const hiddenDriveSet = new Set(section.hiddenDriveIds || []);
      const activeDrive = section.showDrivePhotos
        ? drivePhotos.filter((d) => !hiddenDriveSet.has(d.id))
        : [];
      const activeCustom: GalleryDisplayItem[] = (section.customImages || [])
        .filter((img) => !img.hidden)
        .map((img) => ({
          id: img.id,
          src: resolveAssetUrl(img.src),
          alt: img.alt,
          isDrive: false,
        }));

      const combined = [...activeDrive, ...activeCustom].filter((item) => !brokenIds[item.id]);

      return (
        <section className="gallery-section">
          <div className="gallery-header">
            <EditableText
              as="h3"
              value={section.heading}
              editable={editMode}
              placeholder="Gallery Heading"
              onFocusField={onSelectSection}
              onChange={(heading) =>
                updateSectionField(section.id, (s: typeof section) => ({ ...s, heading }))
              }
            />
            <EditableText
              as="p"
              value={section.subheading}
              editable={editMode}
              placeholder="Gallery subtitle"
              onFocusField={onSelectSection}
              onChange={(subheading) =>
                updateSectionField(section.id, (s: typeof section) => ({
                  ...s,
                  subheading,
                }))
              }
            />
          </div>
          <div className={`photo-grid cols-${section.columns || 4}`}>
            {combined.map((item) => (
              <div key={item.id} className="photo-card">
                <img
                  src={item.src}
                  alt={item.alt}
                  className="photo-img"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={() =>
                    setBrokenIds((prev) => ({ ...prev, [item.id]: true }))
                  }
                />
              </div>
            ))}
          </div>
        </section>
      );
    }
  }
}
