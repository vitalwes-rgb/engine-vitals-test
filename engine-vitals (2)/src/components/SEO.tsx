import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  ogUrl?: string;
  schemaMarkup?: object;
}

export default function SEO({ 
  title = 'Engine Vitals - AI-Powered Vehicle Diagnostics', 
  description = 'Professional-grade vehicle diagnostics powered by AI. Connect your OBD2 scanner or enter symptoms for expert repair estimates, troubleshooting, and local mechanic recommendations.', 
  keywords = 'OBD2 scanner, car diagnosis, AI mechanic, auto repair, check engine light, car symptoms, auto shop directory, vehicle maintenance',
  ogImage = 'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&w=1200&q=80',
  ogUrl = 'https://enginevitals.com',
  schemaMarkup
}: SEOProps) {
  const siteTitle = title.includes('Engine Vitals') ? title : `${title} | Engine Vitals`;

  return (
    <Helmet>
      {/* Standard metadata tags */}
      <title>{siteTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />

      {/* Open Graph / Facebook tags */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={ogUrl} />
      <meta property="og:title" content={siteTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />

      {/* Twitter tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={ogUrl} />
      <meta name="twitter:title" content={siteTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* Structured Data / Schema Markup */}
      {schemaMarkup && (
        <script type="application/ld+json">
          {JSON.stringify(schemaMarkup)}
        </script>
      )}
    </Helmet>
  );
}
