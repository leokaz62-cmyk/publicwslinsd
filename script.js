const PROPERTY_STORAGE_KEY = "wsline-properties";
const GALLERY_STORAGE_KEY = "wsline-gallery";
const FAQ_STORAGE_KEY = "wsline-faq";
const TESTIMONIALS_STORAGE_KEY = "wsline-testimonials";
const RESERVATION_STORAGE_KEY = "wsline-reservations";
const SITE_SETTINGS_KEY = "wsline-site-settings";
const STRIPE_PUBLISHABLE_KEY = "pk_live_51S5sSPJmxZdnLkC3144RzOSn6deR2LHTwNHeXbusLVwLtPAqJNrK2uS83f7eew3dEBUaGXVEizdb5lkM3FJgsIGY00jvgcfrQX";
const STRIPE_CHECKOUT_ENDPOINT = "/backend/create_checkout_session.php";
const STRIPE_SETUP_ENDPOINT = "/backend/create_stripe_setup_session.php";
const STRIPE_RETRIEVE_SESSION_ENDPOINT = "/backend/retrieve_setup_session.php";
const RESERVATIONS_LIST_ENDPOINT = "/backend/reservations_list.php";
const RESERVATIONS_CREATE_ENDPOINT = "/backend/reservations_create.php";
const PROPERTIES_LIST_ENDPOINT = "/backend/properties_list.php";

// Système de gestion des erreurs pour éviter les appels répétés après des 404
const apiErrorTracker = {
  settings: { failures: 0, lastFailure: 0, disabled: false },
  faq: { failures: 0, lastFailure: 0, disabled: false },
  testimonials: { failures: 0, lastFailure: 0, disabled: false },
  MAX_FAILURES: 3, // Arrêter après 3 échecs consécutifs
  RETRY_DELAY: 300000, // Réessayer après 5 minutes
  reset: function(key) {
    this[key].failures = 0;
    this[key].disabled = false;
  },
  recordFailure: function(key) {
    this[key].failures++;
    this[key].lastFailure = Date.now();
    if (this[key].failures >= this.MAX_FAILURES) {
      this[key].disabled = true;
    }
  },
  recordSuccess: function(key) {
    this[key].failures = 0;
    this[key].disabled = false;
  },
  shouldSkip: function(key) {
    if (!this[key].disabled) return false;
    // Réessayer après le délai de retry
    if (Date.now() - this[key].lastFailure > this.RETRY_DELAY) {
      this[key].disabled = false;
      this[key].failures = 0;
      return false;
    }
    return true;
  }
};
const propertyCurrencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

let siteSettings = defaultSiteSettings();
let clientProperties = [];
let clientReservations = [];
let galleryImages = [];
let faqEntries = [];
let testimonials = [];
let cleanupGalleryScroll = null;
let currentCalendarSelection = { arrival: null, departure: null };
let currentCalendarMonthOffset = 0;
let calendarPrevControl = null;
let calendarNextControl = null;
let calendarCurrentLabel = null;

function normalizeReservationVariant(variant = "") {
  const value = String(variant || "").toLowerCase().trim();
  if (["maintenance", "maint"].includes(value)) return "maintenance";
  if (["warning"].includes(value)) return "maintenance";
  if (["info", "neutral"].includes(value)) return "reserved";
  if (["available", "disponible"].includes(value)) return "available";
  return "reserved";
}

function isPastDate(date) {
  const day = toStartOfDay(date);
  const today = toStartOfDay(new Date());
  if (!day || !today) return false;
  return day.getTime() < today.getTime();
}


function escapeHtml(value = "") {
  return value
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function defaultSiteSettings() {
  return {
    hero: {
      badge: "Location saisonnière haut de gamme",
      title: "Deux appartements d'exception au coeur de Rouen",
      description:
        "Découvrez nos deux appartements soigneusement aménagés pour des séjours premium, que vous voyagiez pour affaires ou pour le plaisir. Design contemporain, services sur-mesure et une situation idéale pour explorer Rouen et sa région.",
      primaryCtaLabel: "Explorer les biens",
      primaryCtaLink: "#appartements",
      secondaryCtaLabel: "Parler avec nous",
      secondaryCtaLink: "#contact",
      gallery: ["Vue panoramique sur Rouen", "Intérieurs lumineux et élégants"],
    },
    apartments: {
      title: "Appartements disponibles",
      description:
        "Chaque appartement propose une expérience haut de gamme avec des finitions exceptionnelles, des équipements modernes et une attention particulière aux détails.",
    },
    services: {
      title: "Services exclusifs",
      description:
        "Nous imaginons des séjours sur mesure pour faire de votre passage à Rouen une parenthèse d'exception : confort, discrétion et accompagnement personnalisé.",
      highlights: [
        {
          title: "Check-in souple",
          description: "Arrivées autonomes, flexibles selon vos horaires avec assistance à distance.",
        },
        {
          title: "Confort total",
          description: "Linge premium, literie hôtel 5 étoiles, kits bienvenue et produits de soin.",
        },
        {
          title: "Extras à la carte",
          description: "Ménage en cours de séjour, courses livrées avant votre arrivée, baby-sitting.",
        },
      ],
    },
    contact: {
      title: "Contactez-nous",
      description:
        "Partagez vos dates, le nombre de voyageurs et vos demandes spéciales. Nous reviendrons vers vous dans l'heure.",
      buttonLabel: "Envoyer ma demande",
      detailsTitle: "Informations utiles",
      infoDetails: [
        "Disponibilités flexibles, séjours courte et moyenne durée.",
        "Check-in personnalisé et accueil discret sur place.",
        "Prestations complémentaires : chef privé, spa à domicile, chauffeur.",
      ],
      coordinatesTitle: "Coordonnées",
      location: "Rouen, Normandie",
      email: "contact@prestigerouen.com",
      phone: "+33 6 00 00 00 00",
      callLabel: "Appeler maintenant",
      socialsTitle: "Suivez-nous",
      socials: [
        "Instagram : @prestigerouen",
        "Facebook : Prestige Rouen Locations",
        "LinkedIn : Prestige Rouen Hospitality",
      ],
    },
  };
}

function mergeSiteSettings(defaults, stored) {
  if (Array.isArray(defaults) && Array.isArray(stored)) {
    return stored.map((item, index) => mergeSiteSettings(defaults[index], item));
  }
  if (Array.isArray(defaults) && !Array.isArray(stored)) {
    return defaults.slice();
  }
  if (!Array.isArray(defaults) && Array.isArray(stored)) {
    return stored.map((item) => mergeSiteSettings(undefined, item));
  }
  if (defaults && typeof defaults === "object") {
    const result = { ...defaults };
    if (stored && typeof stored === "object") {
      Object.keys(stored).forEach((key) => {
        result[key] = mergeSiteSettings(defaults[key], stored[key]);
      });
    }
    return result;
  }
  if (stored && typeof stored === "object") {
    return mergeSiteSettings({}, stored);
  }
  return stored === undefined ? defaults : stored;
}

async function loadSiteSettings(useStoredOnly = false) {
  // Charger depuis l'API (priorité absolue - source de vérité)
  if (!useStoredOnly && !apiErrorTracker.shouldSkip('settings')) {
    try {
      const response = await fetch(`/backend/settings_get.php?t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        if (data.status === "success" && data.settings) {
          // Fusionner avec les valeurs par défaut
          const merged = mergeSiteSettings(defaultSiteSettings(), data.settings);
          // Mettre en cache dans localStorage
          localStorage.setItem(SITE_SETTINGS_KEY, JSON.stringify(merged));
          apiErrorTracker.recordSuccess('settings');
          return merged;
        }
      } else if (response.status === 404) {
        // Endpoint non trouvé - arrêter les tentatives répétées
        apiErrorTracker.recordFailure('settings');
        if (apiErrorTracker.settings.failures === 1) {
          console.warn("Endpoint settings_get.php non trouvé (404). Utilisation du cache local uniquement.");
        }
      }
    } catch (error) {
      // Erreurs réseau - ne pas compter comme 404
      if (!error.message || !error.message.includes('404')) {
        console.warn("Impossible de charger les paramètres depuis l'API", error);
      }
    }
  }

  // Si l'API échoue ou useStoredOnly, utiliser le cache localStorage (fallback)
  try {
    const stored = localStorage.getItem(SITE_SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === "object") {
        return mergeSiteSettings(defaultSiteSettings(), parsed);
      }
    }
  } catch (error) {
    console.warn("Impossible de lire les paramètres du site", error);
  }
  
  // Fallback : utiliser les valeurs par défaut
  const defaults = defaultSiteSettings();
  if (!useStoredOnly) {
    try {
      localStorage.setItem(SITE_SETTINGS_KEY, JSON.stringify(defaults));
    } catch (error) {
      console.warn("Impossible d'enregistrer les paramètres par défaut", error);
    }
  }
  return defaults;
}

async function initSiteSettings() {
  siteSettings = await loadSiteSettings();
  applySiteSettings();
  window.addEventListener("storage", async (event) => {
    if (event.key === SITE_SETTINGS_KEY) {
      siteSettings = await loadSiteSettings(true);
      applySiteSettings();
    }
  });
  
  // Synchronisation périodique avec la base de données
  setInterval(async () => {
    try {
      const freshSettings = await loadSiteSettings();
      if (JSON.stringify(freshSettings) !== JSON.stringify(siteSettings)) {
        siteSettings = freshSettings;
        applySiteSettings();
      }
    } catch (error) {
      console.warn("Erreur lors de la synchronisation des paramètres", error);
    }
  }, 30000); // Synchroniser toutes les 30 secondes
}

function applySiteSettings() {
  const { hero, apartments, services, contact } = siteSettings || {};

  const heroSection = document.querySelector(".hero");
  if (heroSection && hero) {
    const badge = heroSection.querySelector(".badge");
    if (badge) badge.textContent = hero.badge || "";

    const title = heroSection.querySelector("h1");
    if (title) title.textContent = hero.title || "";

    const description = heroSection.querySelector("p");
    if (description) description.textContent = hero.description || "";

    const actionButtons = heroSection.querySelectorAll(".hero-actions a");
    const primaryButton = actionButtons[0];
    const secondaryButton = actionButtons[1];
    if (primaryButton) {
      primaryButton.textContent = hero.primaryCtaLabel || primaryButton.textContent;
      primaryButton.setAttribute("href", hero.primaryCtaLink || "#appartements");
    }
    if (secondaryButton) {
      secondaryButton.textContent = hero.secondaryCtaLabel || secondaryButton.textContent;
      secondaryButton.setAttribute("href", hero.secondaryCtaLink || "#contact");
    }

    const galleryCaptions = heroSection.querySelectorAll(".hero-gallery figure span");
    if (Array.isArray(hero.gallery)) {
      hero.gallery.forEach((caption, index) => {
        const target = galleryCaptions[index];
        if (target) target.textContent = caption || "";
      });
    }
  }

  const apartmentsHeader = document.querySelector("#appartements .section-header");
  if (apartmentsHeader && apartments) {
    const title = apartmentsHeader.querySelector("h2");
    if (title) title.textContent = apartments.title || "";
    const description = apartmentsHeader.querySelector("p");
    if (description) description.textContent = apartments.description || "";
  }

  const servicesSection = document.querySelector("#services");
  if (servicesSection && services) {
    const header = servicesSection.querySelector(".section-header");
    const servicesTitle = header?.querySelector("h2");
    const servicesDescription = header?.querySelector("p");
    if (servicesTitle) servicesTitle.textContent = services.title || "";
    if (servicesDescription) servicesDescription.textContent = services.description || "";

    const highlightsContainer = servicesSection.querySelector(".highlights");
    if (highlightsContainer && Array.isArray(services.highlights)) {
      highlightsContainer.innerHTML = services.highlights
        .map(
          (item) => `
            <div class="highlight">
              <strong>${escapeHtml(item?.title || "")}</strong>
              <span>${escapeHtml(item?.description || "")}</span>
            </div>
          `
        )
        .join("");
    }
  }

  const contactSection = document.querySelector("#contact");
  if (contactSection && contact) {
    const formCard = contactSection.querySelector('[data-contact-card="form"]');
    if (formCard) {
      const title = formCard.querySelector("h2");
      if (title) title.textContent = contact.title || "";
      const intro = formCard.querySelector("p");
      if (intro) intro.textContent = contact.description || "";
      const button = formCard.querySelector('button[type="submit"]');
      if (button) button.textContent = contact.buttonLabel || button.textContent;
    }

    const detailsCard = contactSection.querySelector('[data-contact-card="details"]');
    if (detailsCard) {
      const lines = Array.isArray(contact.infoDetails) ? contact.infoDetails : [];
      detailsCard.innerHTML = `
        <h3>${escapeHtml(contact.detailsTitle || "")}</h3>
        ${lines.map((line) => `<span>${escapeHtml(line)}</span>`).join("")}
      `;
    }

    const coordinatesCard = contactSection.querySelector('[data-contact-card="coordinates"]');
    if (coordinatesCard) {
      const phoneHref = formatPhoneHref(contact.phone);
      const locationLine = contact.location ? `<span>${escapeHtml(contact.location)}</span>` : "";
      const emailLine = contact.email ? `<span>${escapeHtml(`Email : ${contact.email}`)}</span>` : "";
      const phoneLine = contact.phone
        ? `<span>${escapeHtml(`Téléphone : ${contact.phone}`)}</span>`
        : "";
      const callButton =
        contact.callLabel && phoneHref
          ? `<a class="btn btn-outline" href="${escapeHtml(phoneHref)}">${escapeHtml(
              contact.callLabel
            )}</a>`
          : "";
      coordinatesCard.innerHTML = `
        <h3>${escapeHtml(contact.coordinatesTitle || "")}</h3>
        ${locationLine}
        ${emailLine}
        ${phoneLine}
        ${callButton}
      `;
    }

    const socialsCard = contactSection.querySelector('[data-contact-card="socials"]');
    if (socialsCard) {
      const socialsLines = Array.isArray(contact.socials) ? contact.socials : [];
      socialsCard.innerHTML = `
        <h3>${escapeHtml(contact.socialsTitle || "")}</h3>
        ${socialsLines.map((line) => `<span>${escapeHtml(line)}</span>`).join("")}
      `;
    }
  }
}

function formatPhoneHref(phone = "") {
  const trimmed = phone.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("tel:")) return trimmed;
  const sanitized = trimmed.replace(/[^+\d]/g, "");
  if (!sanitized) return "";
  return `tel:${sanitized}`;
}

bootstrap();

async function bootstrap() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
    return;
  }

  const year = document.getElementById("year");
  if (year) {
    year.textContent = new Date().getFullYear();
  }

  await initSiteSettings();
  initPropertySync();
  initGallerySync();
  initFaqSync();
  initTestimonialsSync();
  initReservationSync();
  initSmoothScroll();
  initReservationModal();
  initPaymentModal();
  initConfirmationModal();
  initDetailsModal();
  // initTestimonialSlider() sera appelé après le rendu des avis dans renderTestimonials()
  initGalleryScroll();
}

function defaultClientProperties() {
  return [
    {
      id: "property-haussmann",
      name: "Appartement Haussmann - Rive Droite",
      priceNight: 290,
      priceWeek: 1840,
      description:
        "Appartement haussmannien lumineux avec prestations premium, parfait pour un séjour d'affaires ou en famille.",
      bedrooms: 3,
      capacity: 6,
      area: 120,
      location: "Centre historique de Rouen",
      media: [
        {
          id: "media-haussmann-1",
          name: "haussmann-1.jpg",
          type: "image",
          src: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80",
          isExternal: true,
        },
        {
          id: "media-haussmann-2",
          name: "haussmann-2.jpg",
          type: "image",
          src: "https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&w=1200&q=80",
          isExternal: true,
        },
      ],
    },
    {
      id: "property-loft",
      name: "Loft Contemporain - Rive Gauche",
      priceNight: 240,
      priceWeek: 1520,
      description:
        "Loft contemporain inspiré des boutique-hôtels avec terrasse rooftop et services connectés.",
      bedrooms: 2,
      capacity: 4,
      area: 95,
      location: "Quartier des docks, Rouen",
      media: [
        {
          id: "media-loft-1",
          name: "loft-1.jpg",
          type: "image",
          src: "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80",
          isExternal: true,
        },
        {
          id: "media-loft-2",
          name: "loft-2.jpg",
          type: "image",
          src: "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1200&q=80",
          isExternal: true,
        },
      ],
    },
  ];
}

function defaultGalleryImages() {
  return [
    {
      id: "gallery-london-1",
      src: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80",
      alt: "Skyline de Londres au lever du soleil",
      caption: "Skyline de Londres au lever du soleil",
      isExternal: true,
    },
    {
      id: "gallery-london-2",
      src: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=900&q=80",
      alt: "Vue sur les gratte-ciels de Londres",
      caption: "Vue sur les gratte-ciels de Londres",
      isExternal: true,
    },
    {
      id: "gallery-london-3",
      src: "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=900&q=80",
      alt: "Rue animée de Londres sous la neige",
      caption: "Rue animée de Londres sous la neige",
      isExternal: true,
    },
    {
      id: "gallery-london-4",
      src: "https://images.unsplash.com/photo-1505761671935-60b3a7427bad?auto=format&fit=crop&w=900&q=80",
      alt: "Big Ben et Westminster Bridge",
      caption: "Big Ben et Westminster Bridge",
      isExternal: true,
    },
    {
      id: "gallery-london-5",
      src: "https://images.unsplash.com/photo-1470770903676-69b98201ea1c?auto=format&fit=crop&w=900&q=80",
      alt: "Bateaux au bord d'un lac de montagne",
      caption: "Bateaux au bord d'un lac de montagne",
      isExternal: true,
    },
  ];
}


function defaultClientReservations() {
  return [
    {
      id: "reservation-anna",
      name: "Loft Contemporain",
      client: "Anna R.",
      arrivalDate: "2025-04-18",
      departureDate: "2025-04-22",
      statusLabel: "Confirmee",
      statusVariant: "available",
      status: "paid",
      cautionType: "stripe",
    },
    {
      id: "reservation-louis",
      name: "Appartement Haussmann",
      client: "Louis B.",
      arrivalDate: "2025-04-22",
      departureDate: "2025-04-28",
      statusLabel: "Confirmee",
      statusVariant: "available",
      status: "paid",
      cautionType: "stripe",
    },
    {
      id: "reservation-sarah",
      name: "Penthouse Vue Seine",
      client: "Sarah T.",
      arrivalDate: "2025-05-02",
      departureDate: "2025-05-06",
      statusLabel: "Maintenance planifiee",
      statusVariant: "maintenance",
      status: "pending",
      cautionType: "cash",
    },
    {
      id: "reservation-julien",
      name: "Villa Panorama",
      client: "Julien P.",
      arrivalDate: "2025-05-14",
      departureDate: "2025-05-19",
      statusLabel: "Option",
      statusVariant: "reserved",
      status: "pending",
      cautionType: "transfer",
    },
  ];
}

function loadClientProperties(useStoredOnly = false) {
  const stored = localStorage.getItem(PROPERTY_STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      console.warn("Impossible de lire les propriétés stockées", error);
    }
  }

  if (useStoredOnly) {
    return defaultClientProperties();
  }

  const defaults = defaultClientProperties();
  localStorage.setItem(PROPERTY_STORAGE_KEY, JSON.stringify(defaults));
  return defaults;
}

function setClientProperties(list) {
  clientProperties = Array.isArray(list) ? list : [];
  window.wsProperties = clientProperties;
}

function normalizeClientMedia(item = {}) {
  if (!item || typeof item !== "object") {
    return null;
  }
  const src = item.src || item.url || "";
  if (!src) {
    return null;
  }
  return {
    id: item.id || `media-${Math.random().toString(16).slice(2, 8)}`,
    name: item.name || "",
    type: item.type === "video" ? "video" : "image",
    src,
    isExternal: Boolean(item.isExternal ?? true),
  };
}

function normalizeClientProperty(record = {}) {
  if (!record || typeof record !== "object") {
    return null;
  }
  const media = Array.isArray(record.media)
    ? record.media.map(normalizeClientMedia).filter(Boolean)
    : [];
  return {
    id: record.id || record.property_uid || `property-${Math.random().toString(16).slice(2, 8)}`,
    name: record.name || "",
    description: record.description || "",
    priceNight:
      record.priceNight != null
        ? Number(record.priceNight)
        : record.price_night != null
        ? Number(record.price_night)
        : null,
    priceWeek:
      record.priceWeek != null
        ? Number(record.priceWeek)
        : record.price_week != null
        ? Number(record.price_week)
        : null,
    bedrooms:
      record.bedrooms != null && record.bedrooms !== ""
        ? Number(record.bedrooms)
        : null,
    capacity:
      record.capacity != null && record.capacity !== ""
        ? Number(record.capacity)
        : null,
    area:
      record.area != null && record.area !== ""
        ? Number(record.area)
        : null,
    location: record.location || "",
    media,
  };
}

async function refreshClientPropertiesFromServer(useFallbackOnError = false) {
  try {
    const response = await fetch(PROPERTIES_LIST_ENDPOINT, { cache: "no-store" });
    const payload = await response.json().catch(() => null);
    if (!payload || payload.status !== "success" || !Array.isArray(payload.properties)) {
      throw new Error(payload?.message || "Réponse inattendue du serveur.");
    }
    const nextProperties = payload.properties
      .map(normalizeClientProperty)
      .filter(Boolean);
    setClientProperties(nextProperties);
    try {
      localStorage.setItem(PROPERTY_STORAGE_KEY, JSON.stringify(nextProperties));
    } catch (storageError) {
      console.warn("Impossible de mettre en cache les appartements", storageError);
    }
    renderClientProperties();
  } catch (error) {
    console.error("Chargement des appartements côté client", error);
    if (useFallbackOnError && !clientProperties.length) {
      setClientProperties(loadClientProperties(true));
      renderClientProperties();
    }
  }
}

async function loadGalleryImages(useStoredOnly = false) {
  // Charger depuis l'API (priorité absolue - source de vérité)
  if (!useStoredOnly) {
    try {
      const response = await fetch(`/backend/gallery_list.php?t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        if (data.status === "success" && Array.isArray(data.images)) {
          // Convertir le format de l'API vers le format attendu
          const images = data.images
            .filter(img => img && img.id && img.src && img.src.trim().length > 0) // Filtrer les images invalides
            .map(img => ({
              id: img.id,
              src: img.src.trim(),
              alt: img.subtitle || img.title || img.alt || "Photo de la galerie",
              caption: img.subtitle || img.title || "",
              title: img.title || img.subtitle || img.alt || "Photo de la galerie",
              isExternal: img.src && img.src.trim().startsWith('http'),
            }));
          // Mettre en cache dans localStorage
          localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(images));
          return images;
        }
      }
    } catch (error) {
      console.warn("Impossible de charger la galerie depuis l'API", error);
    }
  }

  // Si l'API échoue ou useStoredOnly, utiliser le cache localStorage (fallback)
  const stored = localStorage.getItem(GALLERY_STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (error) {
      console.warn("Impossible de lire la galerie stockée", error);
    }
  }

  // Seulement si vraiment rien n'existe, utiliser les valeurs par défaut (première installation)
  if (!useStoredOnly) {
    const defaults = defaultGalleryImages();
    localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  }
  
  return [];
}

function setGalleryImages(list) {
  galleryImages = Array.isArray(list) ? list : [];
  window.wsGalleryImages = galleryImages;
}

async function loadTestimonials(useStoredOnly = false) {
  // Charger depuis l'API (priorité absolue - source de vérité)
  if (!useStoredOnly && !apiErrorTracker.shouldSkip('testimonials')) {
    try {
      const response = await fetch(`/backend/testimonials_list.php?t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        if (data.status === "success" && Array.isArray(data.testimonials)) {
          // Mettre en cache dans localStorage
          localStorage.setItem(TESTIMONIALS_STORAGE_KEY, JSON.stringify(data.testimonials));
          apiErrorTracker.recordSuccess('testimonials');
          // Retourner la liste (même si vide)
          return data.testimonials;
        }
      } else if (response.status === 404) {
        // Endpoint non trouvé - arrêter les tentatives répétées
        apiErrorTracker.recordFailure('testimonials');
        if (apiErrorTracker.testimonials.failures === 1) {
          console.warn("Endpoint testimonials_list.php non trouvé (404). Utilisation du cache local uniquement.");
        }
      }
    } catch (error) {
      // Erreurs réseau - ne pas compter comme 404
      if (!error.message || !error.message.includes('404')) {
        console.warn("Impossible de charger les avis depuis l'API", error);
      }
    }
  }

  // Si l'API échoue, utiliser le cache localStorage (fallback)
  const stored = localStorage.getItem(TESTIMONIALS_STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      console.warn("Impossible de lire les avis stockés", error);
    }
  }

  // Si vraiment rien n'existe, retourner une liste vide
  return [];
}

async function loadFaqEntries(useStoredOnly = false) {
  // Charger depuis l'API (priorité absolue - source de vérité)
  if (!useStoredOnly && !apiErrorTracker.shouldSkip('faq')) {
    try {
      const response = await fetch(`/backend/faq_list.php?t=${Date.now()}`);
      if (response.ok) {
        const data = await response.json();
        if (data.status === "success" && Array.isArray(data.entries)) {
          // Mettre en cache dans localStorage
          localStorage.setItem(FAQ_STORAGE_KEY, JSON.stringify(data.entries));
          apiErrorTracker.recordSuccess('faq');
          // Retourner la liste (même si vide)
          return data.entries;
        }
      } else if (response.status === 404) {
        // Endpoint non trouvé - arrêter les tentatives répétées
        apiErrorTracker.recordFailure('faq');
        if (apiErrorTracker.faq.failures === 1) {
          console.warn("Endpoint faq_list.php non trouvé (404). Utilisation du cache local uniquement.");
        }
      }
    } catch (error) {
      // Erreurs réseau - ne pas compter comme 404
      if (!error.message || !error.message.includes('404')) {
        console.warn("Impossible de charger la FAQ depuis l'API", error);
      }
    }
  }

  // Si l'API échoue, utiliser le cache localStorage (fallback)
  const stored = localStorage.getItem(FAQ_STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      console.warn("Impossible de lire la FAQ stockée", error);
    }
  }

  // Si vraiment rien n'existe, retourner une liste vide (pas de valeurs par défaut)
  return [];
}

function setFaqEntries(list) {
  faqEntries = Array.isArray(list) ? list : [];
  window.wsFaqEntries = faqEntries;
}

function loadClientReservations(useStoredOnly = false) {
  const stored = localStorage.getItem(RESERVATION_STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      console.warn("Impossible de lire les reservations stockees", error);
    }
  }
  if (useStoredOnly) {
    return defaultClientReservations();
  }
  const defaults = defaultClientReservations();
  localStorage.setItem(RESERVATION_STORAGE_KEY, JSON.stringify(defaults));
  return defaults;
}

function setClientReservations(list) {
  clientReservations = Array.isArray(list) ? list : [];
  window.wsReservations = clientReservations;
  notifyClientReservationsUpdated();
}

function notifyClientReservationsUpdated() {
  const detail = {
    reservations: clientReservations.slice(),
  };
  document.dispatchEvent(
    new CustomEvent("client-reservations:updated", { detail })
  );
}

function renderGalleryImages() {
  const list = document.querySelector("[data-gallery-list]");
  const emptyState = document.querySelector("[data-gallery-empty]");
  const progressBar = document.querySelector("[data-gallery-progress]") || document.querySelector(".progress");
  if (!list) return;

  if (!galleryImages.length) {
    list.innerHTML = "";
    emptyState?.removeAttribute("hidden");
    if (progressBar) {
      progressBar.style.opacity = "0";
      progressBar.style.transform = "scaleX(0)";
    }
    if (typeof cleanupGalleryScroll === "function") {
      cleanupGalleryScroll();
      cleanupGalleryScroll = null;
    }
    return;
  }

  emptyState?.setAttribute("hidden", "");
  list.innerHTML = galleryImages
    .map((image) => {
      const safeId = escapeHtml(image.id || "gallery-item");
      const safeAlt = escapeHtml(image.alt || image.caption || "Photo de la galerie");
      const safeSrc = escapeHtml(image.src);
      return `
        <li class="img-container" data-gallery-id="${safeId}">
          <img src="${safeSrc}" alt="${safeAlt}" loading="lazy" />
        </li>
      `;
    })
    .join("");

  requestAnimationFrame(() => {
    initGalleryScroll();
  });
}

function renderFaqEntries() {
  const list = document.querySelector("[data-faq-list]");
  const emptyState = document.querySelector("[data-faq-empty]");
  if (!list) return;

  if (!faqEntries.length) {
    list.innerHTML = "";
    emptyState?.removeAttribute("hidden");
    return;
  }

  emptyState?.setAttribute("hidden", "");
  list.innerHTML = faqEntries
    .map(
      (entry) => `
        <details class="faq-item" data-faq-id="${escapeHtml(entry.id)}">
          <summary>${escapeHtml(entry.question)}</summary>
          <p>${escapeHtml(entry.answer)}</p>
        </details>
      `
    )
    .join("");
}

function initPropertySync() {
  setClientProperties(loadClientProperties());
  renderClientProperties();
  refreshClientPropertiesFromServer(true);

  window.addEventListener("storage", (event) => {
    if (event.key === PROPERTY_STORAGE_KEY) {
      setClientProperties(loadClientProperties(true));
      renderClientProperties();
    }
  });
}

async function initGallerySync() {
  const images = await loadGalleryImages();
  setGalleryImages(images);
  renderGalleryImages();

  window.addEventListener("storage", async (event) => {
    if (event.key === GALLERY_STORAGE_KEY) {
      const images = await loadGalleryImages(true);
      setGalleryImages(images);
      renderGalleryImages();
    }
  });
}

async function initFaqSync() {
  // Charger depuis l'API (base de données)
  const entries = await loadFaqEntries();
  setFaqEntries(entries);
  renderFaqEntries();

  // Écouter les changements dans le localStorage (pour la synchronisation)
  window.addEventListener("storage", async (event) => {
    if (event.key === FAQ_STORAGE_KEY) {
      const entries = await loadFaqEntries(true);
      setFaqEntries(entries);
      renderFaqEntries();
    }
  });
  
  // Synchroniser périodiquement avec l'API (toutes les 30 secondes)
  setInterval(async () => {
    const entries = await loadFaqEntries();
    setFaqEntries(entries);
    renderFaqEntries();
  }, 30000);
}

async function initTestimonialsSync() {
  // Charger depuis l'API (base de données)
  const loadedTestimonials = await loadTestimonials();
  testimonials = loadedTestimonials;
  renderTestimonials();

  // Écouter les changements dans le localStorage (pour la synchronisation)
  window.addEventListener("storage", async (event) => {
    if (event.key === TESTIMONIALS_STORAGE_KEY) {
      const loadedTestimonials = await loadTestimonials(true);
      testimonials = loadedTestimonials;
      renderTestimonials();
      initTestimonialSlider(); // Réinitialiser le slider après le rendu
    }
  });
  
  // Synchroniser périodiquement avec l'API (toutes les 30 secondes)
  setInterval(async () => {
    const loadedTestimonials = await loadTestimonials();
    testimonials = loadedTestimonials;
    renderTestimonials();
    initTestimonialSlider(); // Réinitialiser le slider après le rendu
  }, 30000);
}

function renderTestimonials() {
  const track = document.querySelector(".testimonial-track");
  if (!track) return;

  if (!testimonials || testimonials.length === 0) {
    track.innerHTML = '<article class="testimonial"><p>Aucun avis disponible pour le moment.</p></article>';
    return;
  }

  track.innerHTML = testimonials
    .map((testimonial) => {
      const quote = escapeHtml(testimonial.quote || "");
      const author = escapeHtml(testimonial.author || "");
      return `
        <article class="testimonial">
          <p>${quote}</p>
          <span>— ${author}</span>
        </article>
      `;
    })
    .join("");

  // Réinitialiser le slider après le rendu
  setTimeout(() => {
    initTestimonialSlider();
  }, 100);
}

function initReservationSync() {
  setClientReservations(loadClientReservations());
  renderReservationCalendar();
  refreshClientReservations(true);

  window.addEventListener("storage", (event) => {
    if (event.key === RESERVATION_STORAGE_KEY) {
      setClientReservations(loadClientReservations(true));
      renderReservationCalendar();
    }
  });
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ["L", "Ma", "Me", "J", "V", "S", "D"];
let currentCalendarProperty = "";

function toStartOfDay(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  if (!(date instanceof Date)) return null;
  const base = toStartOfDay(date);
  if (!base) return null;
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + Number(days || 0));
}

function parseInputDate(value) {
  if (typeof value !== "string" || !value) return null;
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  const [year, month, day] = parts.map((part) => Number(part));
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateForInput(date) {
  const base = toStartOfDay(date);
  if (!base) return "";
  const year = base.getFullYear();
  const month = String(base.getMonth() + 1).padStart(2, "0");
  const day = String(base.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(date) {
  const base = toStartOfDay(date);
  if (!base) return "";
  return base.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatDateRangeText(arrival, departure) {
  const formatted = formatDatesRange(arrival, departure);
  return formatted === "—" ? "Séjour" : formatted;
}

function getReservationRanges(propertyName = "") {
  const filter = propertyName?.toLowerCase().trim();
  const ranges = [];
  
  // Ajouter les plages de maintenance pour les appartements en maintenance
  clientProperties.forEach((property) => {
    const isMaintenance = Boolean(
      property.isMaintenance ?? property.is_under_maintenance ?? property.isUnderMaintenance ?? false
    );
    if (isMaintenance) {
      const propertyNameLower = (property.name || "").toLowerCase().trim();
      if (!filter || propertyNameLower === filter) {
        let startDate = null;
        let endDate = null;
        
        // Utiliser les dates de maintenance si elles sont définies
        if (property.maintenanceStartDate || property.maintenance_start_date) {
          const startDateStr = property.maintenanceStartDate || property.maintenance_start_date;
          startDate = toStartOfDay(parseInputDate(startDateStr));
        } else {
          // Sinon, commencer aujourd'hui
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          startDate = toStartOfDay(today);
        }
        
        if (property.maintenanceEndDate || property.maintenance_end_date) {
          const endDateStr = property.maintenanceEndDate || property.maintenance_end_date;
          const end = toStartOfDay(parseInputDate(endDateStr));
          // Ajouter un jour pour que la date de fin soit incluse
          if (end) {
            endDate = addDays(end, 1);
          }
        } else {
          // Sinon, jusqu'à 2 ans dans le futur
          const futureDate = new Date(startDate || new Date());
          futureDate.setFullYear(futureDate.getFullYear() + 2);
          endDate = toStartOfDay(futureDate);
        }
        
        if (startDate && endDate) {
          ranges.push({
            id: `maintenance-${property.id}`,
            property: property.name || "",
            client: "",
            start: startDate,
            endExclusive: endDate,
            statusLabel: "Maintenance",
            statusVariant: "maintenance",
            statusCategory: "maintenance",
          });
        }
      }
    }
  });
  
  // Ajouter les réservations
  // Inclure les réservations "pending" pour bloquer les dates en attente de validation
  clientReservations
    .filter((reservation) => {
      const status = String(reservation.status || "paid").toLowerCase();
      // Exclure uniquement les réservations annulées ou remboursées
      return status !== "cancelled" && status !== "refunded";
    })
    .filter((reservation) => {
      if (!filter) return true;
      return reservation?.name?.toLowerCase?.().trim() === filter;
    })
    .forEach((reservation) => {
      const arrival = parseInputDate(reservation.arrivalDate);
      const departure = parseInputDate(reservation.departureDate);
      const start = toStartOfDay(arrival);
      const endExclusive = toStartOfDay(departure);
      if (!start || !endExclusive) {
        return;
      }
      const adjustedEndExclusive =
        endExclusive <= start ? addDays(start, 1) : endExclusive;
      ranges.push({
        id: reservation.id,
        property: reservation.name || "",
        client: reservation.client || "",
        start,
        endExclusive: adjustedEndExclusive,
        statusLabel: reservation.statusLabel || "",
        statusVariant: normalizeReservationVariant(reservation.statusVariant),
        statusCategory: normalizeReservationVariant(reservation.statusVariant),
      });
    });
  
  return ranges.sort((a, b) => a.start - b.start);
}

function getCalendarWeekdayOffset(date) {
  const day = date.getDay(); // 0 dimanche
  return (day + 6) % 7; // convertit sur base lundi
}

function getDayReservationMeta(date, ranges) {
  const dayStart = toStartOfDay(date);
  if (!dayStart) {
    return {
      isReserved: false,
      isCheckin: false,
      isCheckout: false,
      tooltip: "",
    };
  }
  const dayTime = dayStart.getTime();
  const matches = ranges.filter(
    (range) =>
      dayTime >= range.start.getTime() && dayTime < range.endExclusive.getTime()
  );
  const categories = matches.map(
    (range) => range.statusCategory || normalizeReservationVariant(range.statusVariant)
  );
  const isMaintenance = categories.includes("maintenance");
  const isReserved = matches.length > 0 && !isMaintenance;
  const isCheckin = matches.some(
    (range) => dayTime === range.start.getTime()
  );
  const isCheckout = matches.some(
    (range) => dayTime === range.endExclusive.getTime() - DAY_IN_MS
  );
  const tooltip = matches
    .map((range) => {
      const client = range.client ? `${range.client}` : "Reservation";
      const property = range.property
        ? ` · ${range.property}`
        : "";
      return `${client}${property}`;
    })
    .join(" / ");
  return {
    isReserved,
    isMaintenance,
    isCheckin,
    isCheckout,
    tooltip,
  };
}

function buildCalendarMonth(monthDate, ranges, today) {
  const monthLabel = monthDate.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
  const firstDay = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth(),
    1
  );
  const totalDays = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth() + 1,
    0
  ).getDate();
  const offset = getCalendarWeekdayOffset(firstDay);
  const todayStart = toStartOfDay(today)?.getTime() ?? 0;
  let daysHtml = "";
  for (let i = 0; i < offset; i += 1) {
    daysHtml += '<span class="calendar-day is-outside"></span>';
  }
  for (let day = 1; day <= totalDays; day += 1) {
    const currentDate = new Date(
      monthDate.getFullYear(),
      monthDate.getMonth(),
      day
    );
    const meta = getDayReservationMeta(currentDate, ranges);
    const classes = ["calendar-day"];
    const currentTime = toStartOfDay(currentDate)?.getTime();
    const isPast = currentTime != null && currentTime < todayStart;
    if (isPast) {
      classes.push("is-disabled", "is-past");
    } else if (meta.isMaintenance) {
      classes.push("is-maintenance", "is-disabled");
    } else if (meta.isReserved) {
      classes.push("is-reserved", "is-disabled");
    } else {
      classes.push("is-available");
    }
    if (meta.isCheckin) {
      classes.push("is-checkin");
    }
    if (meta.isCheckout) {
      classes.push("is-checkout");
    }
    if (currentTime === todayStart) {
      classes.push("is-today");
    }
    const selection = currentCalendarSelection || {};
    const arrivalTime = toStartOfDay(selection.arrival)?.getTime();
    const departureTime = toStartOfDay(selection.departure)?.getTime();
    if (arrivalTime && currentTime === arrivalTime) {
      classes.push("is-selected", "is-selected-start");
    }
    if (departureTime && currentTime === departureTime) {
      classes.push("is-selected", "is-selected-end");
    }
    if (
      arrivalTime &&
      departureTime &&
      currentTime > arrivalTime &&
      currentTime < departureTime
    ) {
      classes.push("is-selected-range");
    }
    const title = meta.tooltip ? ` title="${escapeHtml(meta.tooltip)}"` : "";
    const dataDate = formatDateForInput(currentDate);
    daysHtml += `<span class="${classes.join(" ")}"${title} data-calendar-date="${dataDate}">${day}</span>`;
  }
  const weekdaysHtml = WEEKDAY_LABELS.map(
    (label) => `<span>${escapeHtml(label)}</span>`
  ).join("");
  return `
    <div class="calendar-month">
      <div class="calendar-month-header">
        <span>${escapeHtml(monthLabel)}</span>
      </div>
      <div class="calendar-weekdays">
        ${weekdaysHtml}
      </div>
      <div class="calendar-days">
        ${daysHtml}
      </div>
    </div>
  `;
}

function computeNextAvailability(ranges, fromDate) {
  const today = toStartOfDay(fromDate);
  if (!today) return null;
  let cursor = new Date(today.getTime());
  ranges.forEach((range) => {
    if (cursor < range.start) {
      return;
    }
    if (cursor >= range.start && cursor < range.endExclusive) {
      cursor = new Date(range.endExclusive.getTime());
    }
  });
  return cursor;
}

function renderReservationCalendar(propertyName = currentCalendarProperty) {
  currentCalendarProperty = propertyName || "";
  const container = document.querySelector("[data-reservation-calendar]");
  const noteElement = document.querySelector("[data-reservation-calendar-note]");
  if (!container) {
    return;
  }
  const today = toStartOfDay(new Date());
  const ranges = getReservationRanges(currentCalendarProperty);
  const hasReservations = ranges.length > 0;

  if (currentCalendarMonthOffset < 0) {
    currentCalendarMonthOffset = 0;
  }

  const firstMonth = new Date(today.getFullYear(), today.getMonth() + currentCalendarMonthOffset, 1);
  const monthsToRender = 1;
  const months = [];
  for (let index = 0; index < monthsToRender; index += 1) {
    const target = new Date(
      firstMonth.getFullYear(),
      firstMonth.getMonth() + index,
      1
    );
    months.push(buildCalendarMonth(target, ranges, today));
  }
  container.innerHTML = months.join("");

  if (calendarCurrentLabel) {
    calendarCurrentLabel.textContent = firstMonth.toLocaleDateString("fr-FR", {
      month: "long",
      year: "numeric",
    });
  }
  if (calendarPrevControl) {
    calendarPrevControl.disabled = currentCalendarMonthOffset <= 0;
  }
  if (calendarNextControl) {
    calendarNextControl.disabled = currentCalendarMonthOffset >= 11;
  }

  if (noteElement) {
    if (!hasReservations) {
      noteElement.textContent = "";
      noteElement.dataset.defaultNote = "";
      noteElement.classList.remove("is-warning");
      return;
    }
    let noteText = "";
    if (currentCalendarProperty) {
      const nextAvailability = computeNextAvailability(ranges, today);
      if (nextAvailability) {
        noteText = `Disponible dès le ${formatDisplayDate(nextAvailability)}.`;
      }
    } else {
      const nextArrival =
        ranges.find((range) => range.start >= today) || ranges[0];
      if (nextArrival) {
        noteText = `Prochaine arrivée : ${formatDisplayDate(nextArrival.start)}.`;
      }
    }
    noteElement.textContent = noteText;
    noteElement.dataset.defaultNote = noteText;
    noteElement.classList.remove("is-warning");
  }
}

function hasReservationConflict(propertyName, arrivalDate, departureDate) {
  const start = toStartOfDay(arrivalDate);
  const endExclusive = toStartOfDay(departureDate);
  if (!start || !endExclusive) return null;
  if (endExclusive <= start) return {
    start,
    endExclusive: addDays(start, 1),
    client: "",
    property: propertyName || "",
  };
  const ranges = getReservationRanges(propertyName);
  return (
    ranges.find(
      (range) =>
        range.start < endExclusive && range.endExclusive > start
    ) || null
  );
}

function renderClientProperties() {
  const container = document.querySelector("[data-client-properties]");
  if (!container) {
    return;
  }

  if (!clientProperties.length) {
    container.innerHTML = "<p class=\"card-empty\">Aucun logement disponible pour le moment.</p>";
    return;
  }

  const fallbackImage = "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1200&q=80";

  container.innerHTML = clientProperties
    .map((property) => {
      const primaryVisual = property.media?.find((item) => item.type === "image") || property.media?.[0];
      const coverSrc = primaryVisual?.src || fallbackImage;
      const bedrooms = property.bedrooms != null ? `${property.bedrooms} chambres` : "Chambres sur demande";
      const capacity = property.capacity != null ? `${property.capacity} personnes` : "Capacité modulable";
      const area = property.area != null ? `${property.area} m² d'espace` : "Surface adaptable";
      const location = property.location || "Localisation sur demande";
      const safeId = escapeHtml(property.id);
      const safeName = escapeHtml(property.name || "Appartement");
      const safeLocation = escapeHtml(location);
      const safeDescription = escapeHtml(property.description || "Découvrez un séjour sur-mesure.");

      return `
        <article class="card" data-property-id="${safeId}">
          <img src="${coverSrc}" alt="${safeName}" loading="lazy" />
          <div>
            <h3>${safeName}</h3>
            <span class="location">${safeLocation}</span>
          </div>
          <p class="card-summary">${safeDescription}</p>
          <ul>
            <li>${escapeHtml(bedrooms)}</li>
            <li>${escapeHtml(capacity)}</li>
            <li>${escapeHtml(area)}</li>
            <li>À partir de ${formatClientCurrency(property.priceNight)} / nuit</li>
          </ul>
          <div class="price">${formatClientCurrency(property.priceWeek)} / semaine</div>
          <div class="card-actions">
            <button
              class="btn"
              type="button"
              data-modal-target="reservation"
              data-property-name="${safeName}"
            >
              Reserver
            </button>
            <button
              class="btn btn-outline"
              type="button"
              data-modal-target="details"
              data-detail-id="${safeId}"
            >
              Voir les détails
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

function formatClientCurrency(value) {
  const number = Number(value || 0);
  if (Number.isNaN(number)) return "0 €";
  return propertyCurrencyFormatter.format(number);
}

function initSmoothScroll() {
  const anchors = document.querySelectorAll('a[href^="#"]');
  const scrollPaddingTop =
    parseInt(
      getComputedStyle(document.documentElement).scrollPaddingTop ||
        getComputedStyle(document.body).scrollPaddingTop,
      10
    ) || 0;

  anchors.forEach((anchor) => {
    anchor.addEventListener("click", (event) => {
      const targetId = anchor.getAttribute("href");
      if (!targetId || targetId === "#") return;

      const targetElement = document.querySelector(targetId);
      if (!targetElement) return;

      event.preventDefault();
      const targetTop =
        window.scrollY + targetElement.getBoundingClientRect().top - scrollPaddingTop;
      smoothScrollTo(targetTop);
    });
  });
}

function smoothScrollTo(targetY, duration = 600) {
  const startY = window.scrollY;
  const distance = targetY - startY;
  const startTime = performance.now();

  const easeInOut = (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  const step = (currentTime) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easeInOut(progress);
    window.scrollTo(0, startY + distance * easedProgress);
    if (progress < 1) {
      requestAnimationFrame(step);
    }
  };

  requestAnimationFrame(step);
}

function initReservationModal() {
  const modalOverlay = document.querySelector('[data-modal="reservation"]');
  if (!modalOverlay) return;

  const closeButton = modalOverlay.querySelector('.modal-close');
  const triggers = document.querySelectorAll('[data-modal-target="reservation"]');
  const propertyDisplay = modalOverlay.querySelector('[data-modal-selected]');
  const propertyContainer = modalOverlay.querySelector('[data-modal-selected-container]');
  const propertyField = modalOverlay.querySelector('[data-modal-selected-input]');
  const calendarNote = modalOverlay.querySelector('[data-reservation-calendar-note]');
  const calendarWrapper = modalOverlay.querySelector('[data-modal-calendar]');
  const calendarContainer = calendarWrapper?.querySelector('[data-reservation-calendar]');
  const arrivalInput = modalOverlay.querySelector('#reservation-arrivee');
  const departureInput = modalOverlay.querySelector('#reservation-depart');
  const reservationForm = modalOverlay.querySelector('.modal-form');
  const modalDateWrapper = modalOverlay.querySelector('.modal-date-wrapper');
  calendarPrevControl = modalOverlay.querySelector('[data-calendar-prev]');
  calendarNextControl = modalOverlay.querySelector('[data-calendar-next]');
  calendarCurrentLabel = modalOverlay.querySelector('[data-calendar-current]');
  const focusableSelector = 'input, textarea, select, button:not([disabled])';
  const firstField = modalOverlay.querySelector(focusableSelector);

  let currentModalProperty = "";
  let defaultCalendarNote = calendarNote?.textContent || "";
  let calendarActiveField = null;

  const clampMonthOffset = (value) => Math.min(Math.max(Number(value) || 0, 0), 11);

  const syncCalendarMonthWithDate = (date) => {
    if (!date) return;
    const base = toStartOfDay(date);
    const today = toStartOfDay(new Date());
    if (!base || !today) return;
    const diff =
      (base.getFullYear() - today.getFullYear()) * 12 +
      (base.getMonth() - today.getMonth());
    currentCalendarMonthOffset = clampMonthOffset(diff);
  };

  const closeCalendar = () => {
    calendarActiveField = null;
    if (calendarWrapper) {
      calendarWrapper.classList.remove("is-active");
      calendarWrapper.setAttribute("aria-hidden", "true");
      calendarWrapper.classList.remove("is-left", "is-right");
      calendarWrapper.style.left = "";
      calendarWrapper.style.right = "";
      calendarWrapper.style.top = "";
    }
  };

  const positionCalendarForField = (field) => {
    if (!calendarWrapper || !field || !modalDateWrapper) return;
    const hostRect = modalDateWrapper.getBoundingClientRect();
    const fieldRect = field.getBoundingClientRect();
    if (!hostRect || !fieldRect) return;
    const gap = 10;
    const calendarRect = calendarWrapper.getBoundingClientRect();
    let left = fieldRect.left - hostRect.left;
    if (!Number.isNaN(left) && calendarRect?.width) {
      const maxLeft = hostRect.width - calendarRect.width;
      if (left > maxLeft) {
        left = Math.max(0, maxLeft);
      }
      if (left < 0) {
        left = 0;
      }
    }
    const top = fieldRect.bottom - hostRect.top + gap;
    calendarWrapper.style.left = `${left}px`;
    calendarWrapper.style.right = "auto";
    calendarWrapper.style.top = `${top}px`;
  };

  const openCalendar = (target) => {
    if (!calendarWrapper) return;
    calendarActiveField = target;
    calendarWrapper.classList.add("is-active");
    calendarWrapper.classList.remove("is-left", "is-right");
    if (target === "arrival") {
      calendarWrapper.classList.add("is-left");
    } else {
      calendarWrapper.classList.add("is-right");
    }
    calendarWrapper.removeAttribute("aria-hidden");
    calendarWrapper.style.left = "";
    calendarWrapper.style.right = "";
    let referenceDate = null;
    if (target === "arrival") {
      referenceDate = currentCalendarSelection.arrival || new Date();
    } else if (target === "departure") {
      referenceDate =
        currentCalendarSelection.departure ||
        currentCalendarSelection.arrival ||
        addDays(new Date(), 1);
    } else {
      referenceDate = currentCalendarSelection.arrival || new Date();
    }
    syncCalendarMonthWithDate(referenceDate);
    renderReservationCalendar(currentModalProperty);
    const activeFieldNode =
      target === "arrival" ? arrivalInput : target === "departure" ? departureInput : null;
    requestAnimationFrame(() => {
      if (activeFieldNode) {
        positionCalendarForField(activeFieldNode);
      }
    });
  };

  const resetCalendarNote = () => {
    if (!calendarNote) return;
    const baseNote =
      calendarNote.dataset.defaultNote || defaultCalendarNote || "";
    calendarNote.textContent = baseNote;
    calendarNote.classList.remove("is-warning");
  };

  const showCalendarWarning = (message) => {
    if (!calendarNote) return;
    calendarNote.textContent = message;
    calendarNote.classList.add("is-warning");
  };

  const syncCalendarSelectionFromInputs = (shouldRender = false) => {
    const arrivalDate = parseInputDate(arrivalInput?.value);
    const departureDateRaw = parseInputDate(departureInput?.value);
    let departureDate = null;
    if (arrivalDate && departureDateRaw && departureDateRaw > arrivalDate) {
      departureDate = departureDateRaw;
    }
    currentCalendarSelection = {
      arrival: arrivalDate ? toStartOfDay(arrivalDate) : null,
      departure: departureDate ? toStartOfDay(departureDate) : null,
    };
    if (shouldRender) {
      renderReservationCalendar(currentModalProperty);
    }
  };

  const setCalendarSelection = (arrivalDate, departureDate, { updateInputs = true } = {}) => {
    currentCalendarSelection = {
      arrival: arrivalDate ? toStartOfDay(arrivalDate) : null,
      departure: departureDate ? toStartOfDay(departureDate) : null,
    };
    if (updateInputs) {
      if (arrivalInput) {
        arrivalInput.value = arrivalDate ? formatDateForInput(arrivalDate) : "";
      }
      if (departureInput) {
        departureInput.value = departureDate ? formatDateForInput(departureDate) : "";
      }
      handleDatesChange();
    } else {
      renderReservationCalendar(currentModalProperty);
    }
  };

  const handleCalendarClick = (event) => {
    const target = event.target instanceof Element ? event.target.closest("[data-calendar-date]") : null;
    if (!target || target.classList.contains("is-disabled")) {
      return;
    }
    const dateValue = target.getAttribute("data-calendar-date");
    const selectedDate = parseInputDate(dateValue);
    if (!selectedDate || isPastDate(selectedDate)) return;

    const arrival = currentCalendarSelection.arrival
      ? new Date(currentCalendarSelection.arrival)
      : null;
    const departure = currentCalendarSelection.departure
      ? new Date(currentCalendarSelection.departure)
      : null;

    if (calendarActiveField === "arrival") {
      const newDeparture =
        departure && selectedDate < departure ? departure : null;
      setCalendarSelection(selectedDate, newDeparture, { updateInputs: true });
      requestAnimationFrame(() => {
        if (departureInput) {
          departureInput.focus();
        } else {
          closeCalendar();
        }
      });
      return;
    }

    if (calendarActiveField === "departure") {
      if (!arrival || selectedDate <= arrival) {
        setCalendarSelection(selectedDate, null, { updateInputs: true });
        requestAnimationFrame(() => {
          if (departureInput) {
            departureInput.focus();
          }
        });
        return;
      }
      setCalendarSelection(arrival, selectedDate, { updateInputs: true });
      closeCalendar();
      return;
    }

    setCalendarSelection(selectedDate, null, { updateInputs: true });
    requestAnimationFrame(() => {
      if (departureInput) {
        departureInput.focus();
      } else {
        closeCalendar();
      }
    });
  };

  const updateDateConstraints = () => {
    if (!arrivalInput || !departureInput) return;
    const today = new Date();
    const todayString = formatDateForInput(today);
    arrivalInput.min = todayString;
    const arrivalDate = parseInputDate(arrivalInput.value);
    const minDeparture = arrivalDate ? addDays(arrivalDate, 1) : today;
    departureInput.min = formatDateForInput(minDeparture);
  };

  const handleDatesChange = () => {
    if (!arrivalInput || !departureInput) return;
    updateDateConstraints();
    const arrivalDate = parseInputDate(arrivalInput.value);
    const departureDate = parseInputDate(departureInput.value);

    if (arrivalDate && isPastDate(arrivalDate)) {
      const message = "La date d'arrivee doit etre posterieure a aujourd'hui.";
      arrivalInput.setCustomValidity(message);
      departureInput.setCustomValidity(message);
      showCalendarWarning(message);
      syncCalendarSelectionFromInputs(true);
      return;
    }

    if (departureDate && isPastDate(departureDate)) {
      const message = "La date de depart doit etre posterieure a aujourd'hui.";
      departureInput.setCustomValidity(message);
      showCalendarWarning(message);
      syncCalendarSelectionFromInputs(true);
      return;
    }

    if (!arrivalDate || !departureDate) {
      arrivalInput.setCustomValidity("");
      departureInput.setCustomValidity("");
      resetCalendarNote();
      syncCalendarSelectionFromInputs(true);
      return;
    }

    if (departureDate <= arrivalDate) {
      const message =
        "La date de depart doit etre posterieure a la date d'arrivee.";
      departureInput.setCustomValidity(message);
      arrivalInput.setCustomValidity(message);
      showCalendarWarning(message);
      syncCalendarSelectionFromInputs(true);
      return;
    }

    const conflict = currentModalProperty
      ? hasReservationConflict(currentModalProperty, arrivalDate, departureDate)
      : null;

    if (conflict) {
      const conflictEnd = addDays(conflict.endExclusive, -1);
      const message = `Ces dates sont deja reservees (${formatDisplayDate(
        conflict.start
      )} → ${formatDisplayDate(conflictEnd)}).`;
      arrivalInput.setCustomValidity(message);
      departureInput.setCustomValidity(message);
      showCalendarWarning(message);
    } else {
      arrivalInput.setCustomValidity("");
      departureInput.setCustomValidity("");
      resetCalendarNote();
    }
    syncCalendarSelectionFromInputs(true);
    if (currentCalendarSelection.arrival && currentCalendarSelection.departure) {
      closeCalendar();
    }
  };

  if (arrivalInput) {
    const handleArrivalFocus = () => {
      openCalendar("arrival");
    };
    arrivalInput.addEventListener("change", handleDatesChange);
    arrivalInput.addEventListener("input", handleDatesChange);
    arrivalInput.addEventListener("focus", handleArrivalFocus);
    arrivalInput.addEventListener("click", handleArrivalFocus);
  }
  if (departureInput) {
    const handleDepartureFocus = () => {
      openCalendar("departure");
    };
    departureInput.addEventListener("change", handleDatesChange);
    departureInput.addEventListener("input", handleDatesChange);
    departureInput.addEventListener("focus", handleDepartureFocus);
    departureInput.addEventListener("click", handleDepartureFocus);
  }
  window.addEventListener("resize", () => {
    if (!calendarActiveField) return;
    const activeFieldNode =
      calendarActiveField === "arrival"
        ? arrivalInput
        : calendarActiveField === "departure"
        ? departureInput
        : null;
    if (activeFieldNode) {
      positionCalendarForField(activeFieldNode);
    }
  });
  calendarContainer?.addEventListener("click", handleCalendarClick);
  if (calendarPrevControl) {
    calendarPrevControl.addEventListener("click", () => {
      if (currentCalendarMonthOffset > 0) {
        currentCalendarMonthOffset -= 1;
        renderReservationCalendar(currentModalProperty);
      }
    });
  }
  if (calendarNextControl) {
    calendarNextControl.addEventListener("click", () => {
      if (currentCalendarMonthOffset < 11) {
        currentCalendarMonthOffset += 1;
        renderReservationCalendar(currentModalProperty);
      }
    });
  }

  document.addEventListener("click", (event) => {
    if (!calendarWrapper?.classList.contains("is-active")) return;
    const target = event.target instanceof Element ? event.target : null;
    if (
      !target ||
      calendarWrapper.contains(target) ||
      target === arrivalInput ||
      target === departureInput
    ) {
      return;
    }
    closeCalendar();
  });

  modalOverlay.addEventListener("focusin", (event) => {
    if (!calendarWrapper || calendarWrapper.hasAttribute("hidden")) return;
    const target = event.target;
    if (
      target === arrivalInput ||
      target === departureInput ||
      calendarWrapper.contains(target)
    ) {
      return;
    }
    closeCalendar();
  });

  document.addEventListener("click", (event) => {
    if (!calendarWrapper || !calendarWrapper.classList.contains("is-active")) return;
    const target = event.target instanceof Element ? event.target : null;
    if (
      !target ||
      calendarWrapper.contains(target) ||
      target === arrivalInput ||
      target === departureInput
    ) {
      return;
    }
    closeCalendar();
  });

  const handleReservationSubmit = (event) => {
    if (!reservationForm) return;
    event.preventDefault();
    handleDatesChange();
    if (!reservationForm.reportValidity()) {
      const invalidField = reservationForm.querySelector(":invalid");
      invalidField?.focus();
      return;
    }
    const formData = new FormData(reservationForm);
    const arrivalValue = arrivalInput?.value || "";
    const departureValue = departureInput?.value || "";
    const arrivalDate = parseInputDate(arrivalValue);
    const departureDate = parseInputDate(departureValue);
    const nights =
      arrivalDate && departureDate
        ? Math.max(1, Math.round((departureDate - arrivalDate) / DAY_IN_MS))
        : 0;
    const propertyName = propertyField?.value?.trim() || "";
    const propertyInfo = propertyName
      ? clientProperties.find(
          (item) => item.name?.toLowerCase() === propertyName.toLowerCase()
        )
      : null;
    const estimatedAmount =
      propertyInfo && nights
        ? (Number(propertyInfo.priceNight) || 0) * nights
        : null;
    const customerName = (formData.get("nom") || "").toString().trim();
    const customerEmail = (formData.get("email") || "").toString().trim();
    const customerPhone = (formData.get("telephone") || "").toString().trim();
    const additionalNotes = (formData.get("message") || "").toString().trim();
    const travellersValue = (formData.get("voyageurs") || "").toString().trim() || "—";

    closeCalendar();

    closeModal();
    if (typeof window.openPaymentModal === "function") {
      window.openPaymentModal({
        property: propertyInfo?.name || propertyName || "Appartement",
        arrival: arrivalValue,
        departure: departureValue,
        nights,
        travellers: travellersValue,
        amount: estimatedAmount,
        endpoint: STRIPE_CHECKOUT_ENDPOINT,
        email: customerEmail || null,
        customerName,
        customerPhone,
        notes: additionalNotes,
        reservationId: crypto.randomUUID(),
      });
    }
  };

  reservationForm?.addEventListener("submit", handleReservationSubmit);

  const setSelectedProperty = (propertyName = "") => {
    const name = propertyName.trim();
    currentModalProperty = name;
    closeCalendar();
    if (propertyDisplay) {
      propertyDisplay.textContent = name || "Selectionnez un appartement";
    }
    if (propertyContainer) {
      propertyContainer.hidden = !name;
    }
    if (propertyField) {
      propertyField.value = name;
    }
    currentCalendarMonthOffset = 0;
    renderReservationCalendar(currentModalProperty);
    if (calendarNote) {
      defaultCalendarNote =
        calendarNote.dataset.defaultNote || calendarNote.textContent || "";
    }
    handleDatesChange();
    syncCalendarSelectionFromInputs(true);
  };

  const openModal = (propertyName = "") => {
    closeCalendar();
    setSelectedProperty(propertyName);
    modalOverlay.classList.add("is-visible");
    modalOverlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    if (firstField) {
      setTimeout(() => {
        if (typeof firstField.focus === "function") {
          try {
            firstField.focus({ preventScroll: true });
          } catch (error) {
            firstField.focus();
          }
        }
      }, 50);
    }
  };
  window.openReservationModal = (payload) => {
    let propertyName = "";
    if (payload instanceof Event) {
      payload.preventDefault();
      const origin =
        payload.currentTarget instanceof Element
          ? payload.currentTarget
          : payload.target instanceof Element
          ? payload.target
          : null;
      const trigger = origin?.closest('[data-modal-target="reservation"]');
      propertyName = trigger?.getAttribute("data-property-name") || "";
    } else if (typeof payload === "string") {
      propertyName = payload;
    }
    openModal(propertyName);
  };

  const closeModal = () => {
    closeCalendar();
    currentCalendarMonthOffset = 0;
    modalOverlay.classList.remove("is-visible");
    modalOverlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  };
  window.closeReservationModal = closeModal;

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      const propertyName = trigger.getAttribute("data-property-name") || "";
      openModal(propertyName);
    });
  });

  document.addEventListener("click", (event) => {
    const targetElement = event.target instanceof Element ? event.target : null;
    const delegateTarget = targetElement?.closest('[data-modal-target="reservation"]');
    if (!delegateTarget) return;
    event.preventDefault();
    const propertyName = delegateTarget.getAttribute("data-property-name") || "";
    openModal(propertyName);
  });

  if (closeButton) {
    closeButton.addEventListener("click", closeModal);
  }

  document.addEventListener("client-reservations:updated", () => {
    renderReservationCalendar(currentModalProperty);
    if (calendarNote) {
      defaultCalendarNote =
        calendarNote.dataset.defaultNote || calendarNote.textContent || "";
    }
    if (modalOverlay.classList.contains("is-visible")) {
      handleDatesChange();
      syncCalendarSelectionFromInputs(true);
    }
  });

  modalOverlay.addEventListener("click", (event) => {
    if (event.target === modalOverlay) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modalOverlay.classList.contains("is-visible")) {
      closeModal();
    }
  });
}

function initPaymentModal() {
  const paymentOverlay = document.querySelector('[data-modal="payment"]');
  if (!paymentOverlay) return;

  const closeButton = paymentOverlay.querySelector("[data-payment-close]");
  const cancelButton = paymentOverlay.querySelector("[data-payment-cancel]");
  const confirmButton = paymentOverlay.querySelector("[data-payment-confirm]");
  const propertyOutput = paymentOverlay.querySelector("[data-payment-property]");
  const datesOutput = paymentOverlay.querySelector("[data-payment-dates]");
  const nightsOutput = paymentOverlay.querySelector("[data-payment-nights]");
  const travellersOutput = paymentOverlay.querySelector("[data-payment-travellers]");
  const amountOutput = paymentOverlay.querySelector("[data-payment-amount]");

  let previousOverflow = "";
  let paymentContext = null;

  const lockScroll = () => {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  };

  const unlockScroll = () => {
    document.body.style.overflow = previousOverflow;
  };

  const formatDatesRange = (arrival, departure) => {
    const arrivalDate = parseInputDate(arrival);
    const departureDate = parseInputDate(departure);
    if (arrivalDate && departureDate) {
      return `${formatDisplayDate(arrivalDate)} → ${formatDisplayDate(departureDate)}`;
    }
    if (arrivalDate) {
      return formatDisplayDate(arrivalDate);
    }
    return "—";
  };

  const closeModal = () => {
    paymentContext = null;
    paymentOverlay.classList.remove("is-visible");
    paymentOverlay.setAttribute("aria-hidden", "true");
    unlockScroll();
  };

  const openModal = (details = {}) => {
    const nights = Number(details.nights) || 0;
    paymentContext = {
      property: details.property || "Appartement",
      arrival: details.arrival || "",
      departure: details.departure || "",
      nights,
      travellers: details.travellers || "—",
      amount: details.amount ?? null,
      endpoint: details.endpoint || STRIPE_CHECKOUT_ENDPOINT,
      email: details.email || null,
      customerName: details.customerName || "",
      customerPhone: details.customerPhone || "",
      notes: details.notes || "",
      reservationId: details.reservationId || null,
    };
    if (propertyOutput) {
      propertyOutput.textContent = paymentContext.property;
      propertyOutput.dataset.arrival = paymentContext.arrival;
      propertyOutput.dataset.departure = paymentContext.departure;
    }
    if (datesOutput) {
      datesOutput.textContent = formatDatesRange(paymentContext.arrival, paymentContext.departure);
    }
    if (nightsOutput) {
      nightsOutput.textContent =
        paymentContext.nights > 0
          ? `${paymentContext.nights} nuit${paymentContext.nights > 1 ? "s" : ""}`
          : "—";
    }
    if (travellersOutput) {
      travellersOutput.textContent = paymentContext.travellers;
    }
    if (amountOutput) {
      amountOutput.textContent =
        paymentContext.amount != null
          ? formatClientCurrency(paymentContext.amount)
          : "Calculé sur Stripe";
    }

    paymentOverlay.classList.add("is-visible");
    paymentOverlay.setAttribute("aria-hidden", "false");
    lockScroll();
    confirmButton?.focus();
  };

  const handleClose = () => {
    paymentContext = null;
    closeModal();
  };

  const handleConfirm = async () => {
    if (!paymentContext) {
      alert("Les informations de réservation sont manquantes.");
      return;
    }
    try {
      if (!STRIPE_PUBLISHABLE_KEY) {
        alert("Configurez d'abord la clé Stripe côté client.");
        return;
      }
      if (typeof window.Stripe !== "function") {
        alert("Stripe.js n'est pas chargé. Vérifiez l'inclusion du script Stripe.");
        return;
      }
      if (!STRIPE_CHECKOUT_ENDPOINT) {
        alert("Définissez l'endpoint serveur qui crée la session Checkout.");
        return;
      }

      confirmButton?.setAttribute("disabled", "true");

      const payload = {
        property: paymentContext?.property || "Appartement",
        arrival: paymentContext?.arrival || "",
        departure: paymentContext?.departure || "",
        nights: paymentContext?.nights || 0,
        travellers: paymentContext?.travellers || "—",
        amount: paymentContext?.amount,
        email: paymentContext?.email,
        customerName: paymentContext?.customerName || "",
        customerPhone: paymentContext?.customerPhone || "",
        notes: paymentContext?.notes || "",
        reservationId: paymentContext?.reservationId,
      };

      try {
        sessionStorage.setItem("wsline-reservation-data", JSON.stringify(payload));
      } catch (storageError) {
        console.warn("Impossible de mémoriser les données de réservation", storageError);
      }

      const response = await fetch(paymentContext.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      let result = null;
      try {
        result = responseText ? JSON.parse(responseText) : null;
      } catch (parseError) {
        console.error("Erreur de parsing JSON:", parseError, "Réponse:", responseText);
        throw new Error(`Réponse serveur invalide: ${responseText.substring(0, 200)}`);
      }

      if (!response.ok) {
        const errorMsg = result?.error || `Erreur serveur (${response.status})`;
        console.error("Erreur serveur:", errorMsg, result);
        throw new Error(errorMsg);
      }

      if (result?.sessionId) {
        const stripe = window.Stripe(STRIPE_PUBLISHABLE_KEY);
        const redirectResult = await stripe.redirectToCheckout({ sessionId: result.sessionId });
        if (redirectResult.error) {
          throw redirectResult.error;
        }
        return;
      }

      throw new Error("Réponse Stripe invalide. Fournissez 'checkoutUrl' ou 'sessionId'.");
    } catch (error) {
      console.error("Stripe checkout error", error);
      const errorMessage = error.message || "Erreur inconnue";
      alert(`Impossible de lancer le paiement Stripe.\n\nErreur: ${errorMessage}\n\nVérifiez la configuration serveur ou contactez le support.`);
    } finally {
      confirmButton?.removeAttribute("disabled");
    }
  };

  closeButton?.addEventListener("click", handleClose);
  cancelButton?.addEventListener("click", handleClose);
  confirmButton?.addEventListener("click", handleConfirm);

  paymentOverlay.addEventListener("click", (event) => {
    if (event.target === paymentOverlay) {
      handleClose();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && paymentOverlay.classList.contains("is-visible")) {
      handleClose();
    }
  });

  window.openPaymentModal = openModal;
}

function initConfirmationModal() {
  const overlay = document.querySelector('[data-modal="confirmation"]');
  if (!overlay) return;

  const titleEl = overlay.querySelector('[data-confirmation-title]');
  const messageEl = overlay.querySelector('[data-confirmation-message]');
  const closeButtons = overlay.querySelectorAll('[data-confirmation-close]');
  const submitButton = overlay.querySelector('[data-confirmation-submit]');
  const optionLabels = overlay.querySelectorAll('.caution-option');
  const resultOverlay = document.querySelector('[data-modal="result"]');
  const resultModal = resultOverlay?.querySelector('.modal-result');
  const resultTitle = resultOverlay?.querySelector('[data-result-title]');
  const resultMessage = resultOverlay?.querySelector('[data-result-message]');
  const resultSummary = resultOverlay?.querySelector('[data-result-summary]');
  const resultProperty = resultOverlay?.querySelector('[data-result-property]');
  const resultDates = resultOverlay?.querySelector('[data-result-dates]');
  const resultTravellers = resultOverlay?.querySelector('[data-result-travellers]');
  const resultAmount = resultOverlay?.querySelector('[data-result-amount]');
  const resultIcon = resultOverlay?.querySelector('[data-result-icon]');
  const resultPrimaryButton = resultOverlay?.querySelector('[data-result-primary]');
  const resultSecondaryButton = resultOverlay?.querySelector('[data-result-secondary]');
  const resultCloseButtons = resultOverlay ? resultOverlay.querySelectorAll('[data-result-close]') : null;
  let resultPrimaryAction = null;
  let resultSecondaryAction = null;
  let resultPreviousOverflow = '';
  const params = new URLSearchParams(window.location.search);
  const status = params.get('stripe');

  if (!status) {
    overlay.setAttribute('aria-hidden', 'true');
    return;
  }

  const storedCaution = sessionStorage.getItem('wsline-caution-choice') || 'cash';

  const closeModal = () => {
    overlay.classList.remove('is-visible');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    sessionStorage.removeItem('wsline-caution-choice');
    const newParams = new URLSearchParams(window.location.search);
    newParams.delete('stripe');
    const newUrl = `${window.location.pathname}${newParams.toString() ? `?${newParams}` : ''}${window.location.hash}`;
    window.history.replaceState({}, document.title, newUrl);
  };

  const readReservationData = () => {
    try {
      const raw = sessionStorage.getItem('wsline-reservation-data');
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn('Impossible de lire les informations de réservation', error);
      return null;
    }
  };

  const formatResultDates = (arrival, departure) => {
    const arrivalDate = parseInputDate(arrival);
    const departureDate = parseInputDate(departure);
    if (arrivalDate && departureDate) {
      return `${formatDisplayDate(arrivalDate)} → ${formatDisplayDate(departureDate)}`;
    }
    if (arrivalDate) return formatDisplayDate(arrivalDate);
    if (departureDate) return formatDisplayDate(departureDate);
    return '—';
  };

  const applyResultSummary = (data) => {
    if (!resultSummary) return;
    const hasData = data && (data.property || data.arrival || data.departure || data.travellers || data.amount != null);
    if (!hasData) {
      resultSummary.setAttribute('hidden', '');
      return;
    }
    resultSummary.removeAttribute('hidden');
    if (resultProperty) resultProperty.textContent = data.property || '—';
    if (resultDates) resultDates.textContent = formatResultDates(data.arrival, data.departure);
    if (resultTravellers) resultTravellers.textContent = data.travellers ? `${data.travellers}` : '—';
    if (resultAmount) {
      resultAmount.textContent = data.amount != null ? formatClientCurrency(data.amount) : '—';
    }
  };

  const closeResultModal = () => {
    if (!resultOverlay) return;
    resultOverlay.classList.remove('is-visible');
    resultOverlay.setAttribute('aria-hidden', 'true');
    if (resultModal) {
      resultModal.classList.remove('is-success', 'is-warning', 'is-info');
    }
    if (resultSecondaryButton) {
      resultSecondaryButton.setAttribute('hidden', '');
      resultSecondaryButton.textContent = '';
    }
    resultPrimaryAction = null;
    resultSecondaryAction = null;
    document.body.style.overflow = resultPreviousOverflow;
    resultPreviousOverflow = '';
  };

  const openResultModal = ({
    variant = 'success',
    title = 'Confirmation',
    message = '',
    reservation = null,
    primaryLabel = 'Fermer',
    primaryAction = null,
    secondaryLabel = null,
    secondaryAction = null,
    icon,
  } = {}) => {
    if (!resultOverlay || !resultModal) {
      if (message) {
        alert(message);
      }
      return;
    }
    resultPreviousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    resultOverlay.classList.add('is-visible');
    resultOverlay.setAttribute('aria-hidden', 'false');
    resultModal.classList.remove('is-success', 'is-warning', 'is-info');
    resultModal.classList.add(`is-${variant}`);
    if (resultTitle) resultTitle.textContent = title;
    if (resultMessage) resultMessage.textContent = message;
    applyResultSummary(reservation);
    if (resultIcon) {
      let symbol = icon;
      if (!symbol) {
        if (variant === 'warning') symbol = '!';
        else if (variant === 'info') symbol = 'ℹ';
        else symbol = '✓';
      }
      resultIcon.textContent = symbol;
    }
    resultPrimaryAction = typeof primaryAction === 'function' ? primaryAction : null;
    if (resultPrimaryButton) {
      resultPrimaryButton.textContent = primaryLabel || 'Fermer';
    }
    if (resultSecondaryButton) {
      if (secondaryLabel) {
        resultSecondaryButton.textContent = secondaryLabel;
        resultSecondaryButton.removeAttribute('hidden');
        resultSecondaryAction = typeof secondaryAction === 'function' ? secondaryAction : null;
      } else {
        resultSecondaryButton.setAttribute('hidden', '');
        resultSecondaryAction = null;
      }
    }
  };

  if (resultPrimaryButton) {
    resultPrimaryButton.addEventListener('click', () => {
      const action = resultPrimaryAction;
      closeResultModal();
      if (typeof action === 'function') {
        action();
      }
    });
  }

  if (resultSecondaryButton) {
    resultSecondaryButton.addEventListener('click', () => {
      const action = resultSecondaryAction;
      closeResultModal();
      if (typeof action === 'function') {
        action();
      }
    });
  }

  if (resultCloseButtons) {
    resultCloseButtons.forEach((btn) => {
      btn.addEventListener('click', closeResultModal);
    });
  }

  if (resultOverlay && !resultOverlay.dataset.resultModalInit) {
    resultOverlay.dataset.resultModalInit = 'true';
    resultOverlay.addEventListener('click', (event) => {
      if (event.target === resultOverlay) {
        closeResultModal();
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && resultOverlay.classList.contains('is-visible')) {
        closeResultModal();
      }
    });
  }

  const updateSelection = () => {
    optionLabels.forEach((label) => {
      const input = label.querySelector('input');
      if (!input) return;
      label.classList.toggle('is-selected', input.checked);
    });
    const selected = overlay.querySelector('input[name="confirmation-caution-option"]:checked');
    if (selected) {
      sessionStorage.setItem('wsline-caution-choice', selected.value);
    }
  };

  optionLabels.forEach((label) => {
    const input = label.querySelector('input');
    if (!input) return;
    input.addEventListener('change', updateSelection);
    if (input.value === storedCaution) {
      input.checked = true;
    }
  });
  updateSelection();

  const openModal = (title, message) => {
    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    overlay.classList.add('is-visible');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  };

  const showSelectionModal = () => {
    openModal('Paiement confirmé', 'Votre règlement a bien été enregistré. Sélectionnez la caution.');
    updateSelection();
  };

  const startStripeSetup = async () => {
    let reservationData = null;
    try {
      reservationData = JSON.parse(sessionStorage.getItem('wsline-reservation-data') || '{}');
    } catch (error) {
      console.warn("Impossible de lire les informations de réservation pour l'empreinte", error);
    }
    if (!reservationData) {
      alert('Les informations de réservation sont introuvables. Merci de recommencer.');
      return;
    }
    try {
      const response = await fetch(STRIPE_SETUP_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reservationData),
      });

      const responseText = await response.text();
      let result = null;
      try {
        result = responseText ? JSON.parse(responseText) : null;
      } catch (parseError) {
        console.warn('Réponse Stripe non JSON pour l\'empreinte', parseError, responseText);
      }

      if (!response.ok) {
        const errorMessage = result?.error || responseText || `HTTP ${response.status}`;
        console.error('Réponse brute setup Stripe', { status: response.status, body: responseText });
        throw new Error(`Création de session Stripe échouée (${response.status}) : ${errorMessage}`);
      }

      if (!result?.sessionId) {
        throw new Error(result?.error || 'Session Stripe invalide.');
      }
      const stripe = window.Stripe(STRIPE_PUBLISHABLE_KEY);
      const redirectResult = await stripe.redirectToCheckout({ sessionId: result.sessionId });
      if (redirectResult.error) {
        throw redirectResult.error;
      }
    } catch (error) {
      console.error('Erreur empreinte Stripe', error);
      alert(`Impossible de lancer l'empreinte Stripe : ${error.message}`);
    }
  };

  const fetchSetupDetails = async (sessionId) => {
    try {
      const response = await fetch(`${STRIPE_RETRIEVE_SESSION_ENDPOINT}?session_id=${encodeURIComponent(sessionId)}`);
      if (!response.ok) throw new Error(`Échec récupération session (${response.status})`);
      const data = await response.json();
      console.log('Stripe setup session:', data);
      return data;
    } catch (error) {
      console.error("Impossible de récupérer la session Stripe", error);
      return null;
    }
  };

  if (status === 'success') {
    const sessionId = params.get('session_id');
    const persistPromise = persistReservationFromSession({ status: 'pending', stripeSessionId: sessionId || undefined, sessionId, cautionType: null });
    persistPromise.finally(() => {
      refreshClientReservations(true);
    });
    showSelectionModal();
  } else if (status === 'cancel') {
    const reservationData = readReservationData();
    closeModal();
    openResultModal({
      variant: 'warning',
      title: 'Paiement annulé',
      message: 'Votre paiement Stripe a été interrompu. Vous pouvez relancer la réservation plus tard.',
      reservation: reservationData,
      primaryLabel: 'Fermer',
    });
    sessionStorage.removeItem('wsline-reservation-data');
  } else if (status === 'setup_success') {
    const sessionId = params.get('session_id');
    const reservationData = readReservationData();
    updateReservationSession({ status: 'paid', cautionType: 'stripe', stripeSessionId: sessionId || undefined, sessionId });
    const persistPromise = sessionId
      ? persistReservationFromSession({ status: 'paid', cautionType: 'stripe', stripeSessionId: sessionId, sessionId })
      : persistReservationFromSession({ status: 'paid', cautionType: 'stripe' });
    persistPromise.finally(() => {
      refreshClientReservations(true);
    });
    closeModal();
    openResultModal({
      variant: 'success',
      title: 'Empreinte Stripe confirmée',
      message: "Votre paiement et la caution sont finalisés. Nous vous confirmerons votre arrivée très prochainement.",
      reservation: reservationData,
      primaryLabel: 'Terminer',
    });
    sessionStorage.removeItem('wsline-reservation-data');
    if (sessionId) {
      fetchSetupDetails(sessionId);
    }
    return;
  } else if (status === 'setup_cancel') {
    const reservationData = readReservationData();
    closeModal();
    openResultModal({
      variant: 'warning',
      title: 'Validation Stripe annulée',
      message: "La carte n'a pas été enregistrée. Vous pouvez relancer Stripe ou choisir une autre caution.",
      reservation: reservationData,
      primaryLabel: 'Revenir au choix',
      primaryAction: () => {
        showSelectionModal();
      },
      secondaryLabel: 'Fermer',
    });
    return;
  }

  closeButtons.forEach((btn) => {
    btn.addEventListener('click', closeModal);
  });

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      closeModal();
    }
  });

  submitButton?.addEventListener('click', async () => {
    const selected = overlay.querySelector('input[name="confirmation-caution-option"]:checked')?.value || 'cash';
    if (selected === 'stripe') {
      updateReservationSession({ cautionType: 'stripe' });
      await startStripeSetup();
    } else {
      const reservationData = readReservationData();
      updateReservationSession({ status: 'pending', cautionType: selected });
      await persistReservationFromSession({ status: 'pending', cautionType: selected });
      closeModal();
      const cautionContent = selected === 'cash'
         ? {
             title: 'Caution à régler en espèces',
             message: "Présentez le montant exact au check-in. Aucun prélèvement n'est réalisé en ligne.",
           }
         : {
             title: "Caution par virement",
             message: "Nous vous envoyons l'IBAN par email pour réaliser le virement avant votre arrivée.",
           };
      openResultModal({
        variant: 'info',
        title: cautionContent.title,
        message: cautionContent.message,
        reservation: reservationData,
        primaryLabel: 'Terminer',
      });
      sessionStorage.removeItem('wsline-reservation-data');
    }
  });
}

function initDetailsModal() {
  const modalOverlay = document.querySelector('[data-modal="details"]');
  if (!modalOverlay) return;

  const closeButton = modalOverlay.querySelector(".modal-close");
  const contentContainer = modalOverlay.querySelector("[data-details-content]");
  const titleElement = modalOverlay.querySelector("[data-detail-title]");
  const focusableSelector = 'button:not([disabled]), a[href], video';

  const clearContent = () => {
    if (contentContainer) {
      contentContainer.innerHTML = "";
    }
  };

  const renderMediaGrid = (property) => {
    if (!property.media || !property.media.length) return "";
    const safeName = escapeHtml(property.name || "Appartement");
    const mediaHtml = property.media
      .map((item) => {
        if (item.type === "video") {
          return `<div class="modal-media-item"><video src="${item.src}" controls preload="metadata"></video></div>`;
        }
        return `<div class="modal-media-item"><img src="${item.src}" alt="${safeName}" loading="lazy" /></div>`;
      })
      .join("");
    return `
      <section class="modal-section modal-media-grid">
        <h4>Médias</h4>
        <div class="modal-media-collection">${mediaHtml}</div>
      </section>
    `;
  };

  const openModal = (property) => {
    if (!property) return;
    clearContent();

    if (titleElement) {
      titleElement.textContent = property.name || "Informations détaillées";
    }

    if (contentContainer) {
      const mediaSection = renderMediaGrid(property);
      const infoBedrooms = property.bedrooms != null ? `${property.bedrooms} chambres` : "Chambres sur demande";
      const infoCapacity = property.capacity != null ? `${property.capacity} personnes` : "Capacité modulable";
      const infoArea = property.area != null ? `${property.area} m²` : "Surface adaptable";
      const infoLocation = property.location || "Localisation sur demande";
      contentContainer.innerHTML = `
        <section class="modal-section">
          <p>${escapeHtml(property.description || "Découvrez nos services sur-mesure.")}</p>
        </section>
        <section class="modal-section modal-details-grid">
          <div>
            <h4>Informations</h4>
            <ul class="modal-list">
              <li>${escapeHtml(infoBedrooms)}</li>
              <li>${escapeHtml(infoCapacity)}</li>
              <li>${escapeHtml(infoArea)}</li>
              <li>${escapeHtml(infoLocation)}</li>
            </ul>
          </div>
          <div>
            <h4>Tarifs</h4>
            <ul class="modal-list">
              <li>${formatClientCurrency(property.priceNight)} / nuit</li>
              <li>${formatClientCurrency(property.priceWeek)} / semaine</li>
            </ul>
          </div>
        </section>
        ${mediaSection}
      `;
    }

    modalOverlay.classList.add("is-visible");
    modalOverlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    const firstFocusable = modalOverlay.querySelector(focusableSelector);
    if (firstFocusable && typeof firstFocusable.focus === "function") {
      setTimeout(() => {
        firstFocusable.focus();
      }, 50);
    }
  };

  const closeModal = () => {
    modalOverlay.classList.remove("is-visible");
    modalOverlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    clearContent();
  };

  document.addEventListener("click", (event) => {
    const targetElement = event.target instanceof Element ? event.target : null;
    const delegateTarget = targetElement?.closest('[data-modal-target="details"]');
    if (!delegateTarget) return;
    event.preventDefault();
    const propertyId = delegateTarget.getAttribute("data-detail-id");
    const property = clientProperties.find((item) => item.id === propertyId);
    openModal(property);
  });

  if (closeButton) {
    closeButton.addEventListener("click", closeModal);
  }

  modalOverlay.addEventListener("click", (event) => {
    if (event.target === modalOverlay) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modalOverlay.classList.contains("is-visible")) {
      closeModal();
    }
  });
}

function initTestimonialSlider() {
  const track = document.querySelector(".testimonial-track");
  if (!track) return;

  const slides = Array.from(track.children);
  if (slides.length === 0) return;

  const prevButton = document.querySelector(".slider-btn.prev");
  const nextButton = document.querySelector(".slider-btn.next");
  let index = 0;

  // Supprimer les anciens event listeners pour éviter les doublons
  const newPrevButton = prevButton?.cloneNode(true);
  const newNextButton = nextButton?.cloneNode(true);
  if (prevButton && newPrevButton) {
    prevButton.parentNode?.replaceChild(newPrevButton, prevButton);
  }
  if (nextButton && newNextButton) {
    nextButton.parentNode?.replaceChild(newNextButton, nextButton);
  }

  const updateSlider = () => {
    track.style.transform = `translateX(-${index * 100}%)`;
    const currentPrevButton = document.querySelector(".slider-btn.prev");
    const currentNextButton = document.querySelector(".slider-btn.next");
    if (currentPrevButton) currentPrevButton.disabled = index === 0;
    if (currentNextButton) currentNextButton.disabled = index === slides.length - 1;
  };

  const goToPrev = () => {
    index = Math.max(index - 1, 0);
    updateSlider();
  };

  const goToNext = () => {
    index = Math.min(index + 1, slides.length - 1);
    updateSlider();
  };

  const currentPrevButton = document.querySelector(".slider-btn.prev");
  const currentNextButton = document.querySelector(".slider-btn.next");
  if (currentPrevButton) {
    currentPrevButton.removeEventListener("click", goToPrev);
    currentPrevButton.addEventListener("click", goToPrev);
  }
  if (currentNextButton) {
    currentNextButton.removeEventListener("click", goToNext);
    currentNextButton.addEventListener("click", goToNext);
  }

  let touchStartX = 0;

  track.removeEventListener("touchstart", track._touchStartHandler);
  track.removeEventListener("touchend", track._touchEndHandler);

  track._touchStartHandler = (event) => {
    touchStartX = event.changedTouches[0].clientX;
  };

  track._touchEndHandler = (event) => {
    const touchEndX = event.changedTouches[0].clientX;
    const distance = touchEndX - touchStartX;
    if (Math.abs(distance) > 50) {
      if (distance > 0) {
        goToPrev();
      } else {
        goToNext();
      }
    }
  };

  track.addEventListener("touchstart", track._touchStartHandler);
  track.addEventListener("touchend", track._touchEndHandler);

  updateSlider();
}

function initGalleryScroll() {
  if (typeof cleanupGalleryScroll === "function") {
    cleanupGalleryScroll();
    cleanupGalleryScroll = null;
  }

  const container = document.querySelector(".img-group-container");
  const gallery = document.querySelector(".img-group");
  const progressBar = document.querySelector("[data-gallery-progress]") || document.querySelector(".progress");
  if (!container || !gallery || !progressBar) {
    return;
  }

  const items = gallery.querySelectorAll(".img-container");
  if (!items.length) {
    progressBar.style.opacity = "0";
    progressBar.style.transform = "scaleX(0)";
    return;
  }

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  const updateGallery = () => {
    const viewportHeight = window.innerHeight;
    const startScroll = container.offsetTop;
    const endScroll = startScroll + container.offsetHeight - viewportHeight;
    const totalScrollable = Math.max(endScroll - startScroll, 1);
    const progress = clamp((window.scrollY - startScroll) / totalScrollable, 0, 1);
    const translateVW = -progress * (items.length - 1) * 100;

    gallery.style.transform = `translateX(${translateVW}vw)`;
    progressBar.style.transform = `scaleX(${progress})`;
    progressBar.style.opacity = progress > 0 && progress < 1 ? "1" : "0";
  };

  const onScroll = () => requestAnimationFrame(updateGallery);
  const onResize = () => requestAnimationFrame(updateGallery);

  document.addEventListener("scroll", onScroll);
  window.addEventListener("resize", onResize);

  updateGallery();

  cleanupGalleryScroll = () => {
    document.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onResize);
  };
}

function mapServerReservation(record = {}) {
  const status = String(record.status || "paid").toLowerCase();
  const statusMap = {
    paid: { label: "Confirmée", variant: "available" },
    pending: { label: "En attente de paiement", variant: "reserved" },
    cancelled: { label: "Annulée", variant: "maintenance" },
  };
  const statusMeta = statusMap[status] || statusMap.paid;

  const id =
    record.reservationId ||
    record.reservation_uid ||
    record.stripeSessionId ||
    record.stripe_session_id ||
    record.stripe_payment_intent ||
    `reservation-${Math.random().toString(16).slice(2, 10)}`;

  return {
    id,
    reservationId: record.reservationId || record.reservation_uid || null,
    name: record.property || record.property_name || "Séjour",
    client: record.customer_name || record.customerName || record.email || "Client",
    email: record.email || record.customer_email || null,
    phone: record.customer_phone || record.customerPhone || null,
    notes: record.notes || record.customer_notes || null,
    arrivalDate: record.arrival || record.arrivalDate || "",
    departureDate: record.departure || record.departureDate || "",
    travellers: Number(record.travellers || 0),
    nights: Number(record.nights || 0),
    amount: record.amount != null ? Number(record.amount) : null,
    statusLabel: statusMeta.label,
    statusVariant: statusMeta.variant,
    status,
    cautionType: record.cautionType || record.caution_type || null,
  };
}

async function refreshClientReservations(fromServer = false) {
  if (!fromServer) {
    setClientReservations(loadClientReservations(true));
    renderReservationCalendar();
  }

  try {
    const response = await fetch(`${RESERVATIONS_LIST_ENDPOINT}?t=${Date.now()}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    const records = Array.isArray(payload?.reservations) ? payload.reservations : [];
    const normalized = records.map(mapServerReservation);
    setClientReservations(normalized);
    try {
      localStorage.setItem(RESERVATION_STORAGE_KEY, JSON.stringify(normalized));
    } catch (storageError) {
      console.warn("Impossible de stocker les réservations", storageError);
    }
    renderReservationCalendar();
  } catch (error) {
    console.warn("Synchronisation des réservations échouée", error);
    if (!fromServer) {
      renderReservationCalendar();
    }
  }
}

async function persistReservationFromSession(overrides = {}) {
  let reservationData = null;
  try {
    reservationData = JSON.parse(sessionStorage.getItem('wsline-reservation-data') || '{}');
  } catch (error) {
    console.warn('Impossible de lire les informations de réservation', error);
    reservationData = null;
  }
  if (!reservationData || !reservationData.reservationId) {
    return null;
  }

  const payload = {
    ...reservationData,
    ...overrides,
  };

  try {
    const response = await fetch(RESERVATIONS_CREATE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.error) {
      throw new Error(result?.error || `Erreur ${response.status}`);
    }
    return result;
  } catch (error) {
    console.warn("Enregistrement de la réservation impossible", error);
    return null;
  }
}

function updateReservationSession(partial = {}) {
  try {
    const raw = sessionStorage.getItem('wsline-reservation-data') || '{}';
    const existing = raw ? JSON.parse(raw) : {};
    const updated = { ...existing, ...partial };
    sessionStorage.setItem('wsline-reservation-data', JSON.stringify(updated));
    return updated;
  } catch (error) {
    console.warn('Impossible de mettre à jour les données de réservation', error);
    return null;
  }
}

