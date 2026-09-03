// ============================================================
//  MON BUDGET COURSES V2 — DONNÉES & MODÈLES
//  Zéro fausse donnée. Tout part de zéro au premier lancement.
// ============================================================

'use strict';

// ---------- CATÉGORIES DE PRODUITS ----------
const CATEGORIES = [
  { id:'fruits-legumes',   name:'Fruits & Légumes',   icon:'🥦' },
  { id:'viandes-poissons', name:'Viandes & Poissons',  icon:'🥩' },
  { id:'laitiers',         name:'Produits Laitiers',   icon:'🧀' },
  { id:'feculents',        name:'Féculents',            icon:'🍝' },
  { id:'epicerie',         name:'Épicerie',             icon:'🥫' },
  { id:'petit-dejeuner',   name:'Petit-déjeuner',      icon:'🥐' },
  { id:'boissons',         name:'Boissons',             icon:'🧃' },
  { id:'hygiene',          name:'Hygiène',              icon:'🧴' },
  { id:'entretien',        name:'Entretien',            icon:'🧹' },
  { id:'bebe',             name:'Produits Bébé',        icon:'🍼' },
  { id:'animaux',          name:'Animaux',              icon:'🐾' },
  { id:'plaisirs',         name:'Plaisirs & Extras',   icon:'🍫' },
  { id:'autre',            name:'Autre',                icon:'📦' },
];

// ---------- EMPLACEMENTS STOCK ----------
const LOCATIONS = [
  { id:'frigo',       name:'Réfrigérateur', icon:'❄️'  },
  { id:'congelateur', name:'Congélateur',   icon:'🧊'  },
  { id:'placard',     name:'Placard',       icon:'🗄️' },
  { id:'cave',        name:'Cave',          icon:'🍷'  },
  { id:'sdb',         name:'Salle de bain', icon:'🚿'  },
  { id:'buanderie',   name:'Buanderie',     icon:'🧺'  },
  { id:'autre',       name:'Autre',         icon:'📦'  },
];

// ---------- UNITÉS ----------
const UNITS = [
  { id:'pcs',      name:'pièce(s)'    },
  { id:'g',        name:'grammes'     },
  { id:'kg',       name:'kilogrammes' },
  { id:'mL',       name:'millilitres' },
  { id:'L',        name:'litres'      },
  { id:'boite',    name:'boîte(s)'    },
  { id:'paquet',   name:'paquet(s)'   },
  { id:'bouteille',name:'bouteille(s)'},
  { id:'sachet',   name:'sachet(s)'   },
];

// ---------- MAGASINS ----------
const STORES = [
  'Carrefour','Leclerc','Intermarché','Lidl','Aldi',
  'Monoprix','Casino','Super U','Franprix','Marché local','Autre'
];

// ---------- RACCOURCIS BOUCHER ----------
const BUTCHER_SHORTCUTS = [
  { label:'🥩 Viande',      priceKg:18 },
  { label:'🥓 Charcuterie', priceKg:22 },
  { label:'🐟 Poisson',     priceKg:20 },
  { label:'🧀 Fromage',     priceKg:24 },
  { label:'🥦 Légumes',     priceKg:3  },
  { label:'🌾 Vrac',        priceKg:5  },
];

// ---------- RECETTES DE DÉMONSTRATION ----------
const DEMO_RECIPES = [
  {
    id:'r1', name:'Pâtes à la bolognaise', emoji:'🍝',
    portions:4, time:30, costTotal:5.80, costPer:1.45,
    tags:['économique','rapide','familial'],
    inStock:['Pâtes','Tomates pelées','Oignons','Ail','Huile d\'olive'],
    toBuy:['Viande hachée (400g)','Carottes'],
    steps:[
      'Faire revenir l\'oignon et l\'ail dans l\'huile d\'olive.',
      'Ajouter la viande hachée et faire dorer 5 min.',
      'Incorporer les tomates pelées et les carottes râpées.',
      'Laisser mijoter 20 min à feu doux.',
      'Cuire les pâtes al dente et servir avec la sauce.',
    ],
    leftovers:'La sauce se conserve 3 jours au frigo ou se congèle.'
  },
  {
    id:'r2', name:'Omelette aux légumes', emoji:'🍳',
    portions:2, time:15, costTotal:2.40, costPer:1.20,
    tags:['végétarien','rapide','économique'],
    inStock:['Œufs','Beurre'],
    toBuy:['Poivron (1 pcs)','Courgette (1 pcs)'],
    steps:[
      'Émincer les légumes et les faire revenir au beurre 5 min.',
      'Battre les œufs avec sel et poivre.',
      'Verser les œufs sur les légumes.',
      'Cuire à feu moyen jusqu\'à prise complète.',
    ],
    leftovers:'Se mange froide le lendemain en sandwich.'
  },
  {
    id:'r3', name:'Soupe de carottes', emoji:'🥕',
    portions:4, time:25, costTotal:2.80, costPer:0.70,
    tags:['végétarien','économique','anti-gaspi'],
    inStock:['Carottes','Oignons','Huile d\'olive'],
    toBuy:['Bouillon de légumes (1 cube)'],
    steps:[
      'Éplucher et couper les carottes et l\'oignon.',
      'Faire revenir dans l\'huile 5 min.',
      'Ajouter le bouillon et couvrir d\'eau.',
      'Cuire 20 min puis mixer.',
    ],
    leftovers:'Se congèle très bien en portions.'
  },
  {
    id:'r4', name:'Riz sauté aux œufs', emoji:'🍚',
    portions:3, time:20, costTotal:2.10, costPer:0.70,
    tags:['anti-gaspi','rapide','économique'],
    inStock:['Riz','Œufs','Oignons','Huile'],
    toBuy:['Sauce soja (petite bouteille)'],
    steps:[
      'Cuire le riz et laisser refroidir.',
      'Faire revenir l\'oignon dans l\'huile.',
      'Ajouter le riz froid et faire sauter à feu vif.',
      'Creuser un puits, casser les œufs et mélanger.',
      'Assaisonner avec la sauce soja.',
    ],
    leftovers:'Idéal pour utiliser du riz de la veille.'
  },
];

// ---------- ÉTAT INITIAL (premier lancement) ----------
function getInitialState() {
  return {
    // Budget
    budget: {
      total:   0,    // Budget total saisi par l'utilisateur
      reserve: 0,    // Réserve pour imprévus
      depenses: [],  // Liste des dépenses [{id, label, montant, date}]
    },

    // Foyer
    household: {
      name:     'Mon Foyer',
      adults:   1,
      children: 0,
      babies:   0,
      days:     7,
      store:    'Carrefour',
    },

    // Stock (vide au départ)
    stock: [],

    // Liste de courses (vide au départ)
    list: [],

    // Historique (vide au départ — jamais de fausses données)
    history: [],

    // Paramètres
    settings: {
      darkMode:      false,
      fontSize:      'normal',
      alertsEnabled: true,
    },
  };
}

// ---------- MODÈLES ----------
function newDepense(overrides = {}) {
  return {
    id:      'dep_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
    label:   '',
    montant: 0,
    date:    new Date().toISOString().split('T')[0],
    ...overrides,
  };
}

function newListItem(overrides = {}) {
  return {
    id:        'li_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
    name:      '',
    cat:       'epicerie',
    qty:       1,
    unit:      'pcs',
    priceEst:  0,
    priceReal: null,
    priority:  2,       // 1=indispensable 2=utile 3=facultatif
    essential: false,
    aisle:     '',
    alt:       '',
    note:      '',
    checked:   false,
    ...overrides,
  };
}

function newStockItem(overrides = {}) {
  return {
    id:         'st_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
    name:       '',
    cat:        'epicerie',
    qty:        1,
    unit:       'pcs',
    location:   'placard',
    minQty:     1,
    expiryDate: null,
    price:      0,
    icon:       '📦',
    brand:      '',
    note:       '',
    ...overrides,
  };
}

function newHistoryEntry(overrides = {}) {
  return {
    id:      'hist_' + Date.now(),
    date:    new Date().toISOString().split('T')[0],
    label:   'Courses du ' + new Date().toLocaleDateString('fr-FR'),
    budget:  0,
    spent:   0,
    items:   0,
    persons: 1,
    days:    7,
    ...overrides,
  };
}