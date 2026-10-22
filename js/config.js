/*
 * ============================================================
 *  RÉGLAGES DES AFFICHES — c'est le seul fichier à modifier
 *  pour changer les textes, les fonds, les tailles ou les polices.
 * ============================================================
 *
 *  Les valeurs se lisent comme dans Photoshop (document en 72 ppp) :
 *   - size     : taille du texte en pt (= px)
 *   - tracking : approche (VA), en 1/1000 de cadratin
 *   - y        : position de la ligne de base du texte, en px depuis le haut
 *  Les textes sont toujours centrés horizontalement ; s'ils sont trop longs,
 *  ils rétrécissent tout seuls.
 */
window.FC_CONFIG = {

  // Types d'affiches proposés sur la page d'accueil.
  //  - {set} est remplacé par le numéro du set.
  //  - defaultFormats : formats cochés la première fois.
  //  - scoreDigits    : nombre minimum de chiffres du score (2 = "25 - 07"), 0 = tel quel.
  //  - layouts        : mise en page de chaque format.
  //      score.gap   = espace entre les chiffres et le tiret
  //      score.dash  = le tiret (pavé) : largeur, hauteur, y = haut du tiret
  //      line.width  = longueur fixe du trait ; sans width, le trait englobe
  //                    les scores et les noms (+ padding de chaque côté)
  types: {
    set: {
      name: 'Fin de set', title: 'FIN', subtitle: 'DU SET {set}',
      defaultFormats: ['story'], scoreDigits: 2,
      layouts: {
        // Repris du PSD "Story fin de set"
        story: {
          label:    { size: 28.96,  tracking: 560, y: 535 },
          title:    { size: 250.29, tracking: -20, y: 733 },
          subtitle: { size: 100.11, tracking: -50, y: 833 },
          score:    { size: 317.87, tracking: -15, y: 1163, gap: 55, dash: { width: 116, height: 61, y: 1020 } },
          line:     { y: 1214, thickness: 11, width: 385 },
          teams:    { size: 72.41,  tracking: -30, y: 1303 },
        },
        // Repris du PSD "Post fin de set"
        post: {
          label:    { size: 23.9,   tracking: 560, y: 305 },
          title:    { size: 209,    tracking: -27, y: 473 },
          subtitle: { size: 82.6,   tracking: -50, y: 555 },
          score:    { size: 260.8,  tracking: -15, y: 825, gap: 54, dash: { width: 96, height: 50, y: 708 } },
          line:     { y: 869, thickness: 8, width: 319 },
          teams:    { size: 59.7,   tracking: -30, y: 944 },
        },
      },
    },
    match: {
      name: 'Fin de match', title: 'FIN', subtitle: 'DU MATCH',
      defaultFormats: ['post', 'story'],
      layouts: {
        // Repris du PSD "Story fin de match"
        story: {
          label:    { size: 30.4,   tracking: 625, y: 485 },
          title:    { size: 285,    tracking: -38, y: 710 },
          subtitle: { size: 112,    tracking: -50, y: 821 },
          score:    { size: 352.5,  tracking: -15, y: 1185, gap: 63, dash: { width: 130, height: 68, y: 1028 } },
          line:     { y: 1245, thickness: 11, width: 870 },
          teams:    { size: 81.1,   tracking: -30, y: 1347 },
        },
        // Repris du PSD "Post fin de match"
        post: {
          label:    { size: 23.9,   tracking: 560, y: 305 },
          title:    { size: 209,    tracking: -27, y: 473 },
          subtitle: { size: 82.6,   tracking: -50, y: 555 },
          score:    { size: 260.8,  tracking: -15, y: 825, gap: 54, dash: { width: 96, height: 50, y: 708 } },
          line:     { y: 869, thickness: 8, width: 645 },
          teams:    { size: 59.7,   tracking: -30, y: 944 },
        },
      },
    },
  },

  // Style commun à toutes les affiches.
  //  - boost : épaississement en px (imite le lissage "Fort" de Photoshop), 0 = aucun
  //  - score.align : 'columns' = tiret au centre, chaque score dans une colonne de même largeur
  //                  'group'   = le bloc "25 - 7" entier est centré
  //  - score.pull  : (colonnes) 0 = petit score centré dans sa colonne,
  //                  1 = chaque score collé au tiret, même espace des deux côtés
  style: {
    label:    { font: 'arial',     color: 'rgba(255,255,255,0.62)', boost: 0 },
    title:    { font: 'arialBold', color: '#ffffff', boost: 0 },
    subtitle: { font: 'arial',     color: '#ffffff', boost: 0 },
    score:    { font: 'impact',    color: '#ffffff', align: 'columns', pull: 1 },
    line:     { color: 'rgba(255,255,255,0.94)' },
    teams:    { font: 'arial',     color: '#ffffff', boost: 1.5, gutter: 24 },
  },

  // Formats d'export.
  //  - margin     : marge minimale à gauche et à droite (px)
  //  - background : calques du fond, du dessous vers le dessus (fichiers dans assets/).
  //      { src }                    -> l'image remplit toute l'affiche
  //      { src, x, y, scale }       -> image placée à x / y (en px), à sa taille × scale
  //      { src, x, y, width, height }
  //    Si le premier calque est introuvable, un fond bleu est généré automatiquement.
  formats: {
    post: {
      name: 'Post', ratio: '4:5', width: 1080, height: 1350, margin: 70,
      background: [
        { src: 'assets/post/fond.webp' },
        { src: 'assets/post/grain.webp' },
        { src: 'assets/post/fumee-gauche.png', x: 0, y: 0 },
        { src: 'assets/post/fumee-droite.png', x: 437, y: 585 },
      ],
    },
    story: {
      name: 'Story', ratio: '9:16', width: 1080, height: 1920, margin: 70,
      background: [
        { src: 'assets/story/fond.webp' },
        { src: 'assets/story/grain.webp' },
        { src: 'assets/story/fumee-haut.png', x: 0, y: 0 },
        { src: 'assets/story/fumee-bas.png', x: 0, y: 870 },
      ],
    },
  },

  // Polices. Pour chaque police, les fichiers sont essayés dans l'ordre :
  // les vraies polices (fonts/impact.ttf, arial.ttf, arialbd.ttf) si elles sont là,
  // sinon des polices libres quasi identiques (Anton ≈ Impact, Arimo ≈ Arial).
  // Réglages propres à une police de remplacement :
  //   sizeAdjust = correction de taille, stretch = élargissement horizontal,
  //   tracking   = approche à utiliser à la place de celle des layouts.
  fonts: {
    impact:    { family: 'FC Impact',     weight: '400', files: ['fonts/impact.ttf', { url: 'fonts/anton-400.woff2', sizeAdjust: 0.94, stretch: 1.07, tracking: 0 }] },
    arial:     { family: 'FC Arial',      weight: '400', files: ['fonts/arial.ttf', 'fonts/arimo-400.woff2'] },
    arialBold: { family: 'FC Arial Bold', weight: '400', files: ['fonts/arialbd.ttf', 'fonts/arimo-700.woff2'] },
  },

  // Export des images.
  export: { type: 'image/jpeg', quality: 0.95, extension: 'jpg' },

  // Valeurs proposées la toute première fois.
  defaults: { label: 'OPEN 4', team1: 'Tomblaine', team2: '' },
};
