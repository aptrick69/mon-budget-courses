// ============================================================
//  MON BUDGET COURSES — DONNÉES DE DÉMONSTRATION & MODÈLES
// ============================================================

const DEFAULT_CATEGORIES = [
  { id:'fruits-legumes',  name:'Fruits & Légumes',    icon:'🥦', pct:0.15, max:0.20 },
  { id:'viandes-poissons',name:'Viandes & Poissons',  icon:'🥩', pct:0.20, max:0.28 },
  { id:'laitiers',        name:'Produits Laitiers',   icon:'🧀', pct:0.10, max:0.15 },
  { id:'feculents',       name:'Féculents',            icon:'🍝', pct:0.08, max:0.12 },
  { id:'epicerie',        name:'Épicerie',             icon:'🥫', pct:0.10, max:0.15 },
  { id:'petit-dejeuner',  name:'Petit-déjeuner',      icon:'🥐', pct:0.07, max:0.10 },
  { id:'boissons',        name:'Boissons',             icon:'🧃', pct:0.06, max:0.10 },
  { id:'hygiene',         name:'Hygiène',              icon:'🧴', pct:0.06, max:0.10 },
  { id:'entretien',       name:'Entretien',            icon:'🧹', pct:0.04, max:0.08 },
  { id:'bebe',            name:'Produits Bébé',        icon:'🍼', pct:0.00, max:0.10 },
  { id:'animaux',         name:'Animaux',              icon:'🐾', pct:0.00, max:0.08 },
  { id:'plaisirs',        name:'Plaisirs & Extras',   icon:'🍫', pct:0.05, max:0.10 },
  { id:'reserve',         name:'Réserve Imprévus',    icon:'🛡️', pct:0.09, max:0.15 },
];

const DEMO_STOCK = [
  { id:'s1',  name:'Pâtes spaghetti',    cat:'feculents',       qty:1000, unit:'g',   location:'placard',  minQty:500,  expiryDate:'2027-03-02', price:1.20, icon:'🍝', brand:'Barilla' },
  { id:'s2',  name:'Œufs',               cat:'laitiers',        qty:6,    unit:'pcs', location:'frigo',    minQty:6,    expiryDate:'2026-09-17', price:2.80, icon:'🥚', brand:'' },
  { id:'s3',  name:'Tomates pelées',     cat:'epicerie',        qty:2,    unit:'boîte',location:'placard', minQty:1,    expiryDate:'2027-09-03', price:0.85, icon:'🍅', brand:'Mutti' },
  { id:'s4',  name:'Lait demi-écrémé',   cat:'laitiers',        qty:1,    unit:'L',   location:'frigo',    minQty:1,    expiryDate:'2026-09-07', price:1.05, icon:'🥛', brand:'Lactel' },
  { id:'s5',  name:'Farine T55',         cat:'feculents',       qty:500,  unit:'g',   location:'placard',  minQty:500,  expiryDate:'2026-12-01', price:0.90, icon:'🌾', brand:'' },
  { id:'s6',  name:'Huile d\'olive',     cat:'epicerie',        qty:500,  unit:'mL',  location:'placard',  minQty:250,  expiryDate:'2027-09-03', price:4.50, icon:'🫒', brand:'Puget' },
  { id:'s7',  name:'Riz basmati',        cat:'feculents',       qty:800,  unit:'g',   location:'placard',  minQty:500,  expiryDate:'2027-09-03', price:2.10, icon:'🍚', brand:'' },
  { id:'s8',  name:'Yaourt nature',      cat:'laitiers',        qty:4,    unit:'pcs', location:'frigo',    minQty:4,    expiryDate:'2026-09-05', price:1.60, icon:'🥛', brand:'Danone' },
  { id:'s9',  name:'Carottes',           cat:'fruits-legumes',  qty:500,  unit:'g',   location:'frigo',    minQty:300,  expiryDate:'2026-09-10', price:0.90, icon:'🥕', brand:'' },
  { id:'s10', name:'Oignons',            cat:'fruits-legumes',  qty:3,    unit:'pcs', location:'placard',  minQty:2,    expiryDate:'2026-09-24', price:0.60, icon:'🧅', brand:'' },
  { id:'s11', name:'Ail',                cat:'epicerie',        qty:1,    unit:'pcs', location:'placard',  minQty:1,    expiryDate:'2026-10-03', price:0.50, icon:'🧄', brand:'' },
  { id:'s12', name:'Sel fin',            cat:'epicerie',        qty:500,  unit:'g',   location:'placard',  minQty:100,  expiryDate:'2030-01-01', price:0.45, icon:'🧂', brand:'' },
  { id:'s13', name:'Beurre doux',        cat:'laitiers',        qty:125,  unit:'g',   location:'frigo',    minQty:125,  expiryDate:'2026-09-05', price:1.80, icon:'🧈', brand:'Elle&Vire' },
  { id:'s14', name:'Café moulu',         cat:'petit-dejeuner',  qty:200,  unit:'g',   location:'placard',  minQty:100,  expiryDate:'2026-11-03', price:3.20, icon:'☕', brand:'Lavazza' },
  { id:'s15', name:'Savon liquide',      cat:'hygiene',         qty:300,  unit:'mL',  location:'sdb',      minQty:100,  expiryDate:'2027-09-03', price:2.10, icon:'🧴', brand:'' },
];

const DEMO_LIST_ITEMS = [
  { id:'l1',  name:'Poulet entier',       cat:'viandes-poissons', qty:1,   unit:'pcs', priceEst:7.50,  priceReal:null, priority:1, essential:true,  aisle:'Boucherie',  alt:'Cuisses de poulet (moins cher)', checked:false },
  { id:'l2',  name:'Saumon frais',        cat:'viandes-poissons', qty:400, unit:'g',   priceEst:6.80,  priceReal:null, priority:2, essential:false, aisle:'Poissonnerie',alt:'Thon en boîte (économique)',    checked:false },
  { id:'l3',  name:'Pommes de terre',     cat:'fruits-legumes',   qty:2,   unit:'kg',  priceEst:2.40,  priceReal:null, priority:1, essential:true,  aisle:'Fruits & Légumes', alt:'',                         checked:false },
  { id:'l4',  name:'Tomates cerises',     cat:'fruits-legumes',   qty:500, unit:'g',   priceEst:2.20,  priceReal:null, priority:2, essential:false, aisle:'Fruits & Légumes', alt:'Tomates rondes (moins cher)',checked:false },
  { id:'l5',  name:'Bananes',             cat:'fruits-legumes',   qty:1,   unit:'kg',  priceEst:1.80,  priceReal:null, priority:2, essential:false, aisle:'Fruits & Légumes', alt:'',                         checked:false },
  { id:'l6',  name:'Fromage râpé',        cat:'laitiers',         qty:200, unit:'g',   priceEst:1.90,  priceReal:null, priority:1, essential:true,  aisle:'Crèmerie',   alt:'Fromage MDD (économique)',       checked:false },
  { id:'l7',  name:'Crème fraîche',       cat:'laitiers',         qty:1,   unit:'pcs', priceEst:1.20,  priceReal:null, priority:2, essential:false, aisle:'Crèmerie',   alt:'',                               checked:false },
  { id:'l8',  name:'Pain de mie',         cat:'petit-dejeuner',   qty:1,   unit:'pcs', priceEst:1.50,  priceReal:null, priority:1, essential:true,  aisle:'Boulangerie',alt:'',                               checked:false },
  { id:'l9',  name:'Céréales enfants',    cat:'petit-dejeuner',   qty:1,   unit:'pcs', priceEst:3.20,  priceReal:null, priority:3, essential:false, aisle:'Épicerie',   alt:'Flocons d\'avoine (économique)', checked:false },
  { id:'l10', name:'Jus d\'orange',       cat:'boissons',         qty:1,   unit:'L',   priceEst:2.10,  priceReal:null, priority:2, essential:false, aisle:'Boissons',   alt:'Eau + sirop (économique)',       checked:false },
  { id:'l11', name:'Eau minérale (6x1,5L)',cat:'boissons',        qty:1,   unit:'pack',priceEst:3.50,  priceReal:null, priority:1, essential:true,  aisle:'Boissons',   alt:'Eau du robinet filtrée',         checked:false },
  { id:'l12', name:'Lessive liquide',     cat:'entretien',        qty:1,   unit:'pcs', priceEst:5.90,  priceReal:null, priority:2, essential:false, aisle:'Entretien',  alt:'Lessive MDD (économique)',       checked:false },
  { id:'l13', name:'Chocolat noir 70%',   cat:'plaisirs',         qty:2,   unit:'pcs', priceEst:3.60,  priceReal:null, priority:3, essential:false, aisle:'Épicerie',   alt:'Chocolat MDD',                   checked:false },
  { id:'l14', name:'Steak haché 5%MG',    cat:'viandes-poissons', qty:4,   unit:'pcs', priceEst:5.20,  priceReal:null, priority:1, essential:true,  aisle:'Boucherie',  alt:'Steak haché MDD',                checked:false },
  { id:'l15', name:'Courgettes',          cat:'fruits-legumes',   qty:3,   unit:'pcs', priceEst:1.80,  priceReal:null, priority:1, essential:true,  aisle:'Fruits & Légumes', alt:'',                         checked:false },
];

const DEMO_RECIPES = [
  {
    id:'r1', name:'Pâtes à la bolognaise', emoji:'🍝',
    portions:4, time:30, costTotal:5.80, costPer:1.45,
    tags:['économique','rapide','familial'],
    inStock:['Pâtes spaghetti','Tomates pelées','Oignons','Ail','Huile d\'olive'],
    toBuy:['Viande hachée (400g)','Carottes'],
    steps:[
      'Faire revenir l\'oignon et l\'ail dans l\'huile d\'olive.',
      'Ajouter la viande hachée et faire dorer.',
      'Incorporer les tomates pelées et les carottes râpées.',
      'Laisser mijoter 20 min à feu doux.',
      'Cuire les pâtes al dente et servir avec la sauce.'
    ],
    leftovers:'La sauce se conserve 3 jours au frigo ou se congèle.'
  },
  {
    id:'r2', name:'Omelette aux légumes', emoji:'🍳',
    portions:2, time:15, costTotal:2.40, costPer:1.20,
    tags:['végétarien','rapide','économique'],
    inStock:['Œufs','Carottes','Oignons','Beurre doux'],
    toBuy:['Poivron (1 pcs)'],
    steps:[
      'Émincer les légumes et les faire revenir au beurre.',
      'Battre les œufs avec sel et poivre.',
      'Verser les œufs sur les légumes.',
      'Cuire à feu moyen jusqu\'à prise complète.'
    ],
    leftovers:'Se mange froide le lendemain en sandwich.'
  },
  {
    id:'r3', name:'Soupe de carottes au gingembre', emoji:'🥕',
    portions:4, time:25, costTotal:2.80, costPer:0.70,
    tags:['végétarien','économique','anti-gaspi'],
    inStock:['Carottes','Oignons','Huile d\'olive'],
    toBuy:['Gingembre frais','Bouillon de légumes'],
    steps:[
      'Éplucher et couper les carottes et l\'oignon.',
      'Faire revenir dans l\'huile 5 min.',
      'Ajouter le bouillon et le gingembre râpé.',
      'Cuire 20 min puis mixer.'
    ],
    leftovers:'Se congèle très bien en portions.'
  },
  {
    id:'r4', name:'Riz sauté aux œufs', emoji:'🍚',
    portions:3, time:20, costTotal:2.10, costPer:0.70,
    tags:['anti-gaspi','rapide','économique'],
    inStock:['Riz basmati','Œufs','Oignons','Huile d\'olive'],
    toBuy:['Sauce soja (petite bouteille)'],
    steps:[
      'Cuire le riz et laisser refroidir.',
      'Faire revenir l\'oignon dans l\'huile.',
      'Ajouter le riz froid et faire sauter à feu vif.',
      'Creuser un puits, casser les œufs et mélanger.',
      'Assaisonner avec la sauce soja.'
    ],
    leftovers:'Idéal pour utiliser du riz de la veille.'
  },
];

const DEMO_HISTORY = [
  { id:'h1', date:'2026-08-20', label:'Courses semaine 34', budget:95, spent:87.40, items:28, persons:4, days:7 },
  { id:'h2', date:'2026-08-06', label:'Courses semaine 32', budget:100, spent:102.30, items:31, persons:4, days:7 },
  { id:'h3', date:'2026-07-23', label:'Courses quinzaine',  budget:180, spent:164.80, items:52, persons:4, days:14 },
  { id:'h4', date:'2026-07-02', label:'Courses juillet',    budget:200, spent:193.20, items:61, persons:4, days:14 },
];

const PREFERENCES_OPTIONS = [
  'Végétarien','Végétalien','Sans gluten','Sans lactose',
  'Halal','Casher','Faible en sel','Diabétique',
  'Repas rapides','Cuisine du monde','Bio privilégié','Local & saison'
];

const ALLERGENS = [
  'Gluten','Lait','Œufs','Arachides','Fruits à coque',
  'Soja','Poisson','Crustacés','Sésame','Moutarde','Céleri','Sulfites'
];

const STORES = [
  'Carrefour','Leclerc','Intermarché','Lidl','Aldi',
  'Monoprix','Casino','Super U','Franprix','Marché local','Autre'
];

const UNITS = ['pcs','g','kg','mL','L','boîte','paquet','bouteille','sachet','barquette'];

const LOCATIONS = [
  { id:'frigo',    name:'Réfrigérateur', icon:'❄️' },
  { id:'congelateur',name:'Congélateur', icon:'🧊' },
  { id:'placard',  name:'Placard',       icon:'🗄️' },
  { id:'cave',     name:'Cave',          icon:'🍷' },
  { id:'sdb',      name:'Salle de bain', icon:'🚿' },
  { id:'buanderie',name:'Buanderie',     icon:'🧺' },
  { id:'autre',    name:'Autre',         icon:'📦' },
];

const BUTCHER_SHORTCUTS = [
  { label:'🥩 Viande',       priceKg:18 },
  { label:'🥓 Charcuterie',  priceKg:22 },
  { label:'🐟 Poisson',      priceKg:20 },
  { label:'🧀 Fromage',      priceKg:24 },
  { label:'🥦 Légumes',      priceKg:3  },
  { label:'🌾 Vrac',         priceKg:5  },
];

// Modèle vide pour un nouveau budget
function newBudget() {
  return {
    id: Date.now().toString(),
    total: 0,
    reserve: 0,
    adults: 2,
    children: 0,
    babies: 0,
    days: 7,
    mealsPerDay: 2,
    store: 'Carrefour',
    preferences: [],
    allergens: [],
    forbidden: '',
    goal: 'economiser',
    categories: [],
    spent: 0,
    createdAt: new Date().toISOString(),
  };
}

// Modèle vide pour un article de liste
function newListItem(overrides={}) {
  return {
    id: 'i' + Date.now() + Math.random().toString(36).slice(2,6),
    name: '',
    cat: 'epicerie',
    qty: 1,
    unit: 'pcs',
    priceEst: 0,
    priceReal: null,
    priority: 2,
    essential: false,
    aisle: '',
    alt: '',
    note: '',
    checked: false,
    ...overrides
  };
}

// Modèle vide pour un produit en stock
function newStockItem(overrides={}) {
  return {
    id: 's' + Date.now() + Math.random().toString(36).slice(2,6),
    name: '',
    cat: 'epicerie',
    qty: 1,
    unit: 'pcs',
    location: 'placard',
    minQty: 1,
    expiryDays: 30,
    expiryDate: null,
    price: 0,
    icon: '📦',
    brand: '',
    note: '',
    ...overrides
  };
}