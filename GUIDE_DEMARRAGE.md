# 🚀 Guide de démarrage rapide

## Installation

1. **Installer les dépendances** :
```bash
npm install
```

2. **Lancer le serveur de développement** :
```bash
npm run dev
```

3. **Ouvrir dans le navigateur** :
   - Le site sera accessible sur `http://localhost:5173`
   - Vite rechargera automatiquement la page lors des modifications

## 📁 Structure des composants

Tous les composants sont dans `src/components/` :

- **Navbar.jsx** - Navigation avec menu burger mobile
- **Hero.jsx** - Section d'accueil avec CTA
- **ApartmentsSection.jsx** - Liste des appartements
- **ServicesSection.jsx** - Services exclusifs
- **ReviewsSection.jsx** - Carrousel d'avis clients
- **FAQSection.jsx** - Questions fréquentes (accordéons)
- **ContactSection.jsx** - Formulaire de contact
- **Footer.jsx** - Pied de page

## 🎨 Personnalisation des couleurs

Les couleurs sont définies dans `tailwind.config.js` :

```javascript
colors: {
  bg: {
    primary: '#0d0d0d',  // Fond principal (presque noir)
    alt: '#141414',       // Fond alternatif
    card: '#141414',      // Fond des cartes
  },
  gold: {
    DEFAULT: '#d4af37',   // Doré principal
    light: '#e4c45c',     // Doré clair
    dark: '#b8941f',      // Doré foncé
  },
  text: {
    primary: '#f7f7f7',   // Texte principal
    muted: '#cfcfcf',     // Texte secondaire
  },
}
```

## ✨ Modifier le contenu

### Hero Section
Modifier `src/components/Hero.jsx` pour changer :
- Le badge
- Le titre principal
- La description
- Les textes des boutons CTA

### Appartements
Modifier `src/components/ApartmentsSection.jsx` :
- Le tableau `apartments` contient les données
- Ajouter/modifier des appartements dans ce tableau

### Services
Modifier `src/components/ServicesSection.jsx` :
- Le tableau `services` contient les services
- Changer les icônes, titres et descriptions

### Avis clients
Modifier `src/components/ReviewsSection.jsx` :
- Le tableau `reviews` contient les avis
- Ajouter/modifier des avis

### FAQ
Modifier `src/components/FAQSection.jsx` :
- Le tableau `faqs` contient les questions/réponses

### Contact
Modifier `src/components/ContactSection.jsx` :
- Les coordonnées (email, téléphone, adresse)
- Les réseaux sociaux
- Le handler `handleSubmit` pour connecter le formulaire à un backend

## 🎬 Animations

Les animations utilisent **Framer Motion** :

- **Fade-in au scroll** : Utilise `useInView` hook
- **Hover effects** : `whileHover` sur les boutons et cartes
- **Stagger animations** : Animations en cascade pour les listes

Pour modifier les animations, voir la documentation Framer Motion : https://www.framer.com/motion/

## 📱 Responsive

Le site est entièrement responsive :
- **Mobile** : Menu burger, colonnes empilées
- **Tablette** : Layout adaptatif
- **Desktop** : Layout complet avec grilles

Les breakpoints Tailwind par défaut sont utilisés :
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px

## 🐛 Dépannage

### Le site est vide/blanc
1. Vérifier que `npm install` a bien installé toutes les dépendances
2. Vérifier la console du navigateur pour les erreurs
3. Vérifier que `src/main.jsx` importe bien `App.jsx`

### Les styles ne s'appliquent pas
1. Vérifier que Tailwind est bien configuré dans `tailwind.config.js`
2. Vérifier que `postcss.config.js` est présent
3. Vérifier que `src/index.css` contient les directives `@tailwind`

### Les animations ne fonctionnent pas
1. Vérifier que `framer-motion` est installé : `npm list framer-motion`
2. Vérifier que les composants importent bien `framer-motion`

## 📦 Build de production

Pour créer un build de production :

```bash
npm run build
```

Les fichiers seront générés dans le dossier `dist/`.

Pour prévisualiser le build :

```bash
npm run preview
```

## 🔄 Migration depuis l'ancien site

Les anciens fichiers (`script.js` et `styles.css`) sont conservés mais ne sont plus utilisés.

Pour récupérer du contenu de l'ancien site :
1. Ouvrir `script.js` et chercher les données
2. Copier les données dans les composants React correspondants
3. Adapter le format si nécessaire

## 📝 Notes importantes

- Le formulaire de contact affiche une alerte pour l'instant. Il faudra connecter un backend.
- Les images utilisent des URLs Unsplash. Remplacer par vos propres images.
- Les données sont en dur dans les composants. Pour une vraie app, utiliser un state management (Context API, Redux, etc.) ou des appels API.

