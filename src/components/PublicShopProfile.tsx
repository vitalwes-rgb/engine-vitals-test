import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Shop } from '../types';
import { MapPin, Phone, Mail, Globe, Star, Clock, Shield, ArrowLeft, Loader2, CheckCircle2, ExternalLink } from 'lucide-react';

export default function PublicShopProfile() {
  const { shopId } = useParams<{ shopId: string }>();
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchShop = async () => {
      if (!shopId) return;
      try {
        const shopDoc = await getDoc(doc(db, 'shops', shopId));
        if (shopDoc.exists()) {
          setShop({ id: shopDoc.id, ...shopDoc.data() } as Shop);
        }
      } catch (error) {
        console.error("Error fetching shop:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchShop();
  }, [shopId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col items-center justify-center p-6 text-center">
        <Shield className="w-16 h-16 text-[#525252] mb-4" />
        <h1 className="text-2xl font-bold mb-2">Shop Not Found</h1>
        <p className="text-[#A3A3A3] mb-8">The shop profile you are looking for does not exist or has been removed.</p>
        <Link to="/" className="text-primary hover:underline flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Return Home
        </Link>
      </div>
    );
  }

  const schemaMarkup = shop ? {
    "@context": "https://schema.org",
    "@type": "AutoRepair",
    "name": shop.name,
    "image": shop.logoUrl || "https://enginevitals.com/logo.png",
    "@id": `https://enginevitals.com/shop/${shop.id}`,
    "url": `https://enginevitals.com/shop/${shop.id}`,
    "telephone": shop.phone,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": shop.address,
      "addressLocality": shop.city,
      "addressRegion": shop.state,
      "postalCode": shop.zip,
      "addressCountry": "US"
    },
    "geo": (shop.lat && shop.lng) ? {
      "@type": "GeoCoordinates",
      "latitude": shop.lat,
      "longitude": shop.lng
    } : undefined,
    "aggregateRating": shop.reviewCount > 0 ? {
      "@type": "AggregateRating",
      "ratingValue": shop.rating,
      "reviewCount": shop.reviewCount
    } : undefined,
    "priceRange": "$$"
  } : undefined;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5] font-sans selection:bg-primary selection:text-white">
      <Helmet>
        <title>{shop.name} - Auto Repair in {shop.city}, {shop.state} | Engine Vitals</title>
        <meta name="description" content={`${shop.name} is a trusted auto repair shop in ${shop.city}, ${shop.state}. Specialties include ${shop.specialties.join(', ')}.`} />
        <meta property="og:title" content={`${shop.name} - Auto Repair`} />
        <meta property="og:description" content={`View ${shop.name}'s profile, reviews, and specialties on Engine Vitals.`} />
        {shop.logoUrl && <meta property="og:image" content={shop.logoUrl} />}
        {schemaMarkup && (
          <script type="application/ld+json">
            {JSON.stringify(schemaMarkup)}
          </script>
        )}
      </Helmet>

      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <Link to="/" className="inline-flex items-center gap-2 text-[#A3A3A3] hover:text-white mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Engine Vitals
        </Link>

        <div className="bg-gradient-to-b from-[#1A1A1A] to-[#141414] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
          <div className="h-32 md:h-48 bg-gradient-to-r from-[#1A1A1A] to-[#0A0A0A] relative">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 mix-blend-overlay" />
          </div>
          
          <div className="px-6 md:px-12 pb-12 relative">
            <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start md:items-end -mt-16 md:-mt-20 mb-8">
              <div className="w-32 h-32 md:w-40 md:h-40 bg-white rounded-2xl border-4 border-[#141414] shadow-2xl flex items-center justify-center p-4 overflow-hidden shrink-0 z-10">
                {shop.logoUrl ? (
                  <img src={shop.logoUrl} alt={shop.name} className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full bg-[#f5f5f5] rounded-xl flex items-center justify-center text-4xl font-black text-[#ccc]">
                    {shop.name.charAt(0)}
                  </div>
                )}
              </div>
              
              <div className="flex-1 pt-4 md:pt-0">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl md:text-4xl font-black tracking-tight">{shop.name}</h1>
                  {shop.isVerified && (
                    <CheckCircle2 className="w-6 h-6 text-blue-500" />
                  )}
                </div>
                <div className="flex items-center gap-2 text-[#A3A3A3] text-sm md:text-base">
                  <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  <span className="font-bold text-white">{shop.rating.toFixed(1)}</span>
                  <span>({shop.reviewCount} reviews)</span>
                  <span className="mx-2">•</span>
                  <span>{shop.city}, {shop.state}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
              <div className="md:col-span-2 space-y-8">
                {shop.about && (
                  <section>
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Shield className="w-5 h-5 text-primary" /> About Us
                    </h2>
                    <p className="text-[#A3A3A3] leading-relaxed">{shop.about}</p>
                  </section>
                )}

                <section>
                  <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" /> Specialties
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {shop.specialties.map((spec, i) => (
                      <span key={i} className="px-4 py-2 bg-[#1A1A1A] border border-[#262626] rounded-full text-sm text-[#A3A3A3]">
                        {spec}
                      </span>
                    ))}
                  </div>
                </section>
              </div>

              <div className="space-y-6">
                <div className="bg-[#0A0A0A] border border-[#262626] rounded-2xl p-6 space-y-4">
                  <h3 className="font-bold text-white mb-4">Contact Info</h3>
                  
                  <div className="flex items-start gap-3 text-sm">
                    <MapPin className="w-5 h-5 text-[#525252] shrink-0" />
                    <div className="flex flex-col items-start">
                      <a 
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${shop.address}, ${shop.city}, ${shop.state} ${shop.zip}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#A3A3A3] hover:text-primary transition-colors flex items-center gap-1 group text-left"
                      >
                        <span>{shop.address}<br/>{shop.city}, {shop.state} {shop.zip}</span>
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    </div>
                  </div>
                  
                  {shop.phone && (
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="w-5 h-5 text-[#525252] shrink-0" />
                      <a href={`tel:${shop.phone}`} className="text-primary hover:underline">{shop.phone}</a>
                    </div>
                  )}
                  
                  {shop.email && (
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="w-5 h-5 text-[#525252] shrink-0" />
                      <a href={`mailto:${shop.email}`} className="text-primary hover:underline">{shop.email}</a>
                    </div>
                  )}
                  
                  {shop.website && (
                    <div className="flex items-center gap-3 text-sm">
                      <Globe className="w-5 h-5 text-[#525252] shrink-0" />
                      <a href={shop.website.startsWith('http') ? shop.website : `https://${shop.website}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        Visit Website
                      </a>
                    </div>
                  )}

                  {shop.hours && (
                    <div className="flex items-start gap-3 text-sm pt-4 border-t border-[#262626]">
                      <Clock className="w-5 h-5 text-[#525252] shrink-0" />
                      <span className="text-[#A3A3A3]">{shop.hours}</span>
                    </div>
                  )}
                </div>

                <div className="bg-primary/10 border border-primary/20 rounded-2xl p-6 text-center">
                  <h3 className="font-bold text-white mb-2">Need a Repair?</h3>
                  <p className="text-xs text-[#A3A3A3] mb-4">Sign in to Engine Vitals to send this shop your AI diagnostic report.</p>
                  <Link to="/" className="block w-full py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/80 transition-colors">
                    Start Diagnosis
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
