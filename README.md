# WS Line Location - Application React

Application React moderne et luxueuse pour la présentation des appartements d'exception WS Line Location à Rouen.

## 🚀 Technologies

- **React 18** - Framework UI
- **Vite** - Build tool et dev server
- **Tailwind CSS** - Framework CSS utilitaire
- **Framer Motion** - Bibliothèque d'animations

## 📦 Installation

1. Installer les dépendances :
```bash
npm install
```

2. Lancer le serveur de développement :
```bash
npm run dev
```

3. Ouvrir [http://localhost:5173](http://localhost:5173) dans votre navigateur

## 🏗️ Structure du projet

```
wsline/
├── src/
│   ├── components/
│   │   ├── Navbar.jsx          # Navigation principale
│   │   ├── Hero.jsx            # Section hero (accueil)
│   │   ├── ApartmentsSection.jsx  # Section appartements
│   │   ├── ServicesSection.jsx     # Section services
│   │   ├── ReviewsSection.jsx      # Section avis clients
│   │   ├── FAQSection.jsx         # Section FAQ
│   │   ├── ContactSection.jsx     # Section contact
│   │   └── Footer.jsx             # Pied de page
│   ├── App.jsx                 # Composant principal
│   ├── main.jsx                # Point d'entrée React
│   └── index.css               # Styles globaux (Tailwind)
├── index.html                  # HTML minimal
├── package.json
├── vite.config.js
├── tailwind.config.js          # Configuration Tailwind
└── postcss.config.js
```

## 🎨 Thème

Le site utilise un thème sombre premium avec accents dorés :

- **Couleur de fond principale** : `#0d0d0d` (presque noir)
- **Couleur d'accent** : `#d4af37` (doré)
- **Typographie** : Poppins (sans-serif) pour le texte, Merriweather (serif) pour les titres

Les couleurs sont configurées dans `tailwind.config.js`.

## ✨ Fonctionnalités

- ✅ Navigation smooth scroll vers les sections
- ✅ Menu burger responsive pour mobile
- ✅ Animations Framer Motion (fade-in, scroll animations, hover effects)
- ✅ Sections : Hero, Appartements, Services, Avis, FAQ, Contact
- ✅ Formulaire de contact fonctionnel
- ✅ Design responsive (mobile, tablette, desktop)
- ✅ Thème sombre avec accents dorés

## 🛠️ Scripts disponibles

- `npm run dev` - Lance le serveur de développement
- `npm run build` - Build de production
- `npm run preview` - Prévisualise le build de production

## 📝 Notes

- Les données des appartements sont actuellement en dur dans `ApartmentsSection.jsx`. Elles peuvent être remplacées par des appels API.
- Le formulaire de contact affiche une alerte pour l'instant. Il faudra connecter un backend pour l'envoi réel des emails.
- Les images utilisent des URLs Unsplash. Vous pouvez les remplacer par vos propres images.

## 🎯 Prochaines étapes

1. Connecter le formulaire de contact à un backend
2. Remplacer les données statiques par des appels API
3. Ajouter un système de réservation
4. Optimiser les images (utiliser des images locales optimisées)

