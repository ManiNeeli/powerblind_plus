import { useEffect } from 'react';

/**
 * usePageMeta — Dynamically updates page title, meta description, and social tags.
 * Ensures every view is SEO optimized with accurate metadata.
 */
export function usePageMeta({ title, description, canonical }) {
  useEffect(() => {
    // 1. Update Title
    const formattedTitle = title ? `${title} | PowerBlind+` : 'PowerBlind+ — Explainable Smart Meter Anomaly Detection';
    document.title = formattedTitle;

    // 2. Update Meta Description
    const metaDesc = description || 'PowerBlind+ provides explainable smart meter electricity theft detection with physics-informed AI, automated inspection queues, and real-time telemetry.';
    let descTag = document.querySelector('meta[name="description"]');
    if (!descTag) {
      descTag = document.createElement('meta');
      descTag.name = 'description';
      document.head.appendChild(descTag);
    }
    descTag.setAttribute('content', metaDesc);

    // 3. Update OpenGraph Tags
    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', formattedTitle);

    let ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', metaDesc);

    // 4. Update Canonical Link if provided
    if (canonical) {
      let linkCanonical = document.querySelector('link[rel="canonical"]');
      if (!linkCanonical) {
        linkCanonical = document.createElement('link');
        linkCanonical.rel = 'canonical';
        document.head.appendChild(linkCanonical);
      }
      linkCanonical.setAttribute('href', canonical);
    }
  }, [title, description, canonical]);
}
