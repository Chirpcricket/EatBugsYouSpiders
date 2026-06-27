# EBYS — Eat Bugs You Spider!

EBYS est une webradio générative autonome et un répertoire d'événements musicaux montréalais. Les deux systèmes sont liés : le site recense la scène, la radio en est la bande sonore permanente.

---

## 1. Répertoire d'événements

Un site web de recensement des événements musicaux montréalais — shows, soirées, concerts, performances. Web-scraped et alimenté manuellement par la communauté.

### Principes

- Pas de compte utilisateur obligatoire
- Pas de rétention de données personnelles
- Pas d'algorithme de recommandation
- Pas de hiérarchie éditoriale
- Conformité légale : cookies, vie privée, normes applicables

### Filtrage

- Par genre musical
- Par date / lieu
- Par artiste

### Upload audio

Les artistes peuvent soumettre leurs pistes audio directement depuis le site. Ces soumissions alimentent la bibliothèque de Cricket et deviennent matière première pour la radio générative.

Enjeux à résoudre :
- Durée de conservation des fichiers audio soumis
- Droits et responsabilités légales sur le contenu uploadé
- Système sans overhead : pas de comptes, pas de données conservées inutilement

---

## 2. Radio générative (Cricket)

La radio est un flux audio continu généré par Cricket — l'instrument de remixage neuronal. Elle tourne en fond du site, sans intervention humaine.

### Comportement

- Flux continu, sans tracklist fixe
- Remixage probabilistique en temps réel à partir des pistes soumises
- Sélection pilotée par les descripteurs audio [M, E, F, P, H, T]
- Pas de répétition exacte

### États internes

- Niveau d'énergie
- Densité spectrale
- Balance tonale
- Intensité rythmique

Ces états influencent la sélection des slices en continu.

### What Triggers the Remixing Engine

The most honest trigger is the city itself. The engine compares today's temperature against the 10-year rolling average for that exact date. Hotter than the historical norm, the engine remixes more. Cooler, it pulls back. The music changes because the city is warmer than it used to be.

The signal is deviation from a 10-year window — same date, same city, compared year over year. The baseline rolls forward each year so it tracks recent climate, not a fixed historical snapshot.

```
δT = T_today - avg(T_same_date, last 10 years)

entropy = clamp(0.5 + (δT / 5.0), 0.0, 1.0)
```

- **δT** = how much hotter today is vs. the 10-year average for that date
- **5.0** = scale — +5°C above average hits maximum entropy (1.0), -5°C hits minimum (0.0)
- **0.5** = neutral baseline — an average day runs at the midpoint
- **clamp** = keeps entropy between 0 and 1

An average day remixes at half intensity. A notably hot day pushes toward full generative complexity. A cold anomaly pulls back toward pure tracks.

Weather is the conductor. The radio is the orchestra.

Other possible triggers — to be defined:
- Number of active listeners
- Manual override by a curator
- Random probability that drifts in and out

### Relation avec le répertoire

La radio n'est pas séparée du site — elle en est le fond sonore vivant. Les artistes qui soumettent leurs pistes au répertoire alimentent directement la radio. La scène montréalaise devient sa propre bande sonore.

---

## 3. Interface (UI/UX)

### Structure de base

L'interface web est construite sans style par défaut — HTML brut, zéro CSS. Les skins transforment complètement l'apparence.

### Système de skins

- Une skin = un fichier CSS
- Les utilisateurs peuvent créer et partager leurs propres skins
- Aucune installation requise — juste un fichier CSS à charger
- Compatibilité totale avec l'esthétique terminal (monospace, fond sombre) ou n'importe quelle direction visuelle

### Légèreté

- Pas de framework lourd
- Pas d'overhead
- Tourne dans le navigateur
- Compatible desktop et mobile

---

## 4. Modèle économique

- Accès libre, aucune barrière
- Bouton de don volontaire (Ko-fi, Liberapay, ou Stripe direct)
- Les dons soutiennent l'infrastructure, pas le contenu

---

## 5. Licence

© Eat Bugs You Spider!
Distribué sous licence GNU Affero General Public License v3.0 (AGPL-3.0).
Le code est public. La radio est ouverte. La scène est à tout le monde.

https://www.gnu.org/licenses/agpl-3.0.html
