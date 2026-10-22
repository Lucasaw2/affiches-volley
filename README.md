# Affiches Volley

Petit site pour créer en 30 secondes les affiches **Fin de set** et **Fin de match** du club,
en format **Post 4:5** (1080×1350) et **Story 9:16** (1080×1920).

Aucune installation : c'est un site statique (HTML/CSS/JS) qui tourne sur GitHub Pages.

## Utilisation

1. Choisir **Fin de set** ou **Fin de match**.
2. Cocher le ou les formats, entrer les scores, les équipes (et le numéro du set).
   Les noms d'équipe et le petit texte du haut sont **mémorisés** pour la prochaine fois.
3. **Créer les affiches** :
   - sur PC : bouton **Télécharger**, ou **scanner le QR code** avec le téléphone pour récupérer les images dessus ;
   - sur téléphone : **Enregistrer / Partager** (puis « Enregistrer l'image » sur iPhone).

Les tailles de texte se calent toutes seules : le tiret reste au centre, chaque score est
collé au tiret avec le même espace des deux côtés, et en fin de set un score à 1 chiffre
prend un zéro devant (« 25 - 07 »). Chaque nom est centré sous son score, un nom trop
long passe sur 2 lignes.
« Fin de set » est proposé en Story par défaut ; chaque type retient ses formats.

## Changer le fond

Le fond est assemblé à partir des calques Photoshop exportés, du dessous vers le dessus :

| Story (`assets/story/`) | Post (`assets/post/`) | Rôle |
|---|---|---|
| `fond.webp` | `fond.webp` | fond bleu soie |
| `grain.webp` | `grain.webp` | grain, appliqué au fond seulement |
| `fumee-haut.png` (0, 0) | `fumee-gauche.png` (0, 0) | première fumée |
| `fumee-bas.png` (0, 870) | `fumee-droite.png` (437, 585) | seconde fumée |

Pour remplacer un calque, il suffit d'écraser le fichier (même nom). La liste des calques,
leur position et leur taille se règlent dans `js/config.js` (`formats → background`).
Si le fond est introuvable, un fond bleu de secours est généré automatiquement.

## Polices

Le site utilise les vraies polices **Arial**, **Arial Bold** et **Impact** (`fonts/*.ttf`),
pour un rendu identique à Photoshop. Si elles sont retirées, il bascule tout seul sur des
polices libres quasi identiques : **Anton** (≈ Impact) et **Arimo** (≈ Arial).

## Modifier les textes, tailles, positions

Tout est dans **`js/config.js`** (commenté), avec les mêmes unités que Photoshop :
pour chaque type d'affiche et chaque format (`types → set/match → layouts → story/post`),
chaque texte a une taille en pt (`size`), une approche (`tracking`) et la position de sa
ligne de base en px (`y`). Le trait a sa position, son épaisseur et sa longueur ; le tiret
du score sa taille et sa position. Les couleurs, l'opacité de « OPEN 4 », l'épaississement
des noms (`boost`) et l'alignement du score sont dans `style`.

Note : les approches ont été étalonnées en mesurant les affiches Photoshop au pixel ;
elles diffèrent un peu des valeurs du panneau Caractère (un navigateur n'espace pas les
lettres exactement comme Photoshop).

## Mettre en ligne (GitHub Pages)

1. Pousser ce dossier sur un dépôt GitHub.
2. Dans le dépôt : **Settings → Pages → Deploy from a branch → `main` / `(root)`**.
3. Le site est disponible sur `https://<compte>.github.io/<dépôt>/` après 1 à 2 minutes.

Le QR code ne marche qu'une fois le site en ligne (un téléphone ne peut pas ouvrir `localhost`).

## Tester en local

```bash
py -m http.server 8080
```

puis ouvrir http://localhost:8080
