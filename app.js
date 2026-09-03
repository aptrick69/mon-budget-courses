// ============================================================
//  MON BUDGET COURSES — APPLICATION PRINCIPALE
//  État global, localStorage, calculs, navigation, UI
// ============================================================

'use strict';

/* ============================================================
   1. ÉTAT GLOBAL
   ============================================================ */
const App = {
  state: {
    currentPage: 'home',
    budget: null,
    stock: [],
    list: [],
    history: [],
    alerts: [],
    settings: {
      darkMode: false,
      fontSize: 'normal',
      alertsEnabled: true,
      currency: '€',
    },
    household: {
      name: 'Mon Foyer',
      adults: 2,
      children: 2,
      babies: 0,
    },
  },

  /* ---- Initialisation ---- */
  init() {
    this.loadFromStorage();
    this.applySettings();
    this.registerServiceWorker();
    this.bindNav();
    this.bindGlobalEvents();
    this.renderAll();
    this.navigate('home');
    this.checkAlerts();
  },

  /* ---- Persistance ---- */
  loadFromStorage() {
    try {
      const saved = localStorage.getItem('mbc_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.state = { ...this.state, ...parsed };
      } else {
        // Données de démo au premier lancement
        this.state.budget = {
          id: '1',
          total: 120,
          reserve: 10,
          adults: 2,
          children: 2,
          babies: 0,
          days: 7,
          mealsPerDay: 2,
          store: 'Carrefour',
          preferences: ['Repas rapides'],
          allergens: [],
          forbidden: '',
          goal: 'economiser',
          categories: this.buildCategories(120, 10),
          spent: 81.50,
          createdAt: new Date().toISOString(),
        };
        this.state.stock = JSON.parse(JSON.stringify(DEMO_STOCK));
        this.state.list  = JSON.parse(JSON.stringify(DEMO_LIST_ITEMS));
        this.state.history = JSON.parse(JSON.stringify(DEMO_HISTORY));
        this.state.household = { name:'Mon Foyer', adults:2, children:2, babies:0 };
        this.save();
      }
    } catch(e) { console.warn('Erreur chargement:', e); }
  },

  save() {
    try { localStorage.setItem('mbc_state', JSON.stringify(this.state)); }
    catch(e) { console.warn('Erreur sauvegarde:', e); }
  },

  applySettings() {
    const s = this.state.settings;
    document.documentElement.setAttribute('data-theme', s.darkMode ? 'dark' : 'light');
    document.body.className = s.fontSize !== 'normal' ? `text-${s.fontSize}` : '';
  },

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  },

  /* ============================================================
     2. CALCULS BUDGÉTAIRES
     ============================================================ */
  calcBudget(b) {
    if (!b) return {};
    const persons = (b.adults||0) + (b.children||0) + (b.babies||0);
    const available = Math.max(0, b.total - b.reserve);
    const perPerson = persons > 0 ? available / persons : 0;
    const perDay    = b.days > 0  ? available / b.days  : 0;
    const meals     = b.days * (b.mealsPerDay||2) * Math.max(1, persons);
    const perMeal   = meals > 0   ? available / meals   : 0;
    const listTotal = this.calcListTotal();
    const spent     = b.spent || 0;
    const remaining = available - spent;
    const pct       = available > 0 ? Math.min(100, (spent / available) * 100) : 0;
    return { persons, available, perPerson, perDay, perMeal, meals, listTotal, spent, remaining, pct };
  },

  calcListTotal() {
    return this.state.list.reduce((sum, item) => {
      const p = parseFloat(item.priceReal ?? item.priceEst) || 0;
      return sum + p;
    }, 0);
  },

  calcListCheckedTotal() {
    return this.state.list
      .filter(i => i.checked)
      .reduce((sum, i) => sum + (parseFloat(i.priceReal ?? i.priceEst) || 0), 0);
  },

  buildCategories(total, reserve) {
    const available = Math.max(0, total - reserve);
    return DEFAULT_CATEGORIES.map(c => ({
      ...c,
      budgetRec:  Math.round(available * c.pct * 100) / 100,
      budgetMax:  Math.round(available * c.max * 100) / 100,
      budgetPlan: Math.round(available * c.pct * 100) / 100,
      spent: 0,
    }));
  },

  /* Calcul boucher */
  calcGrams(priceKg, budget) {
    if (!priceKg || priceKg <= 0) return null;
    return (budget / priceKg) * 1000;
  },
  calcPrice(priceKg, grams) {
    if (!priceKg || priceKg <= 0) return null;
    return (grams / 1000) * priceKg;
  },
  roundGrams(g, mode) {
    if (mode === 'exact')  return Math.floor(g);
    if (mode === '10')     return Math.floor(g / 10) * 10;
    if (mode === '50')     return Math.floor(g / 50) * 50;
    if (mode === 'portion') {
      const portions = [100,125,150,175,200,250,300,350,400,500];
      return portions.filter(p => p <= g).pop() || Math.floor(g);
    }
    return Math.floor(g / 10) * 10;
  },

  /* Comparateur */
  calcUnitPrice(price, qty, unit) {
    if (!price || !qty || qty <= 0) return null;
    if (unit === 'kg' || unit === 'g') {
      const grams = unit === 'kg' ? qty * 1000 : qty;
      return { per100g: (price / grams) * 100, perKg: (price / grams) * 1000 };
    }
    if (unit === 'L' || unit === 'mL') {
      const ml = unit === 'L' ? qty * 1000 : qty;
      return { per100ml: (price / ml) * 100, perL: (price / ml) * 1000 };
    }
    return { perUnit: price / qty };
  },

  /* ============================================================
     3. GESTION DU STOCK
     ============================================================ */
  getExpiryStatus(item) {
    if (!item.expiryDate) return 'ok';
    const days = Math.ceil((new Date(item.expiryDate) - new Date()) / 86400000);
    if (days < 0)  return 'expired';
    if (days <= 2) return 'urgent';
    if (days <= 5) return 'soon';
    return 'ok';
  },

  getExpiringSoon() {
    return this.state.stock.filter(i => {
      const s = this.getExpiryStatus(i);
      return s === 'urgent' || s === 'soon';
    }).sort((a,b) => new Date(a.expiryDate) - new Date(b.expiryDate));
  },

  getLowStock() {
    return this.state.stock.filter(i => i.qty <= i.minQty);
  },

  updateStockQty(id, delta) {
    const item = this.state.stock.find(i => i.id === id);
    if (!item) return;
    item.qty = Math.max(0, item.qty + delta);
    this.save();
    this.renderStock();
    this.renderHome();
  },

  addToStock(item) {
    this.state.stock.push(item);
    this.save();
    this.renderStock();
    this.showToast('✅ Produit ajouté au stock', 'success');
  },

  removeFromStock(id) {
    if (!confirm('Supprimer ce produit du stock ?')) return;
    this.state.stock = this.state.stock.filter(i => i.id !== id);
    this.save();
    this.renderStock();
    this.showToast('Produit supprimé', 'warning');
  },

  /* ============================================================
     4. GESTION DE LA LISTE
     ============================================================ */
  toggleItem(id) {
    const item = this.state.list.find(i => i.id === id);
    if (!item) return;
    item.checked = !item.checked;
    if (item.checked && !item.priceReal) {
      this.askItemPrice(item);
    }
    this.save();
    this.renderList();
    this.renderShoppingMode();
    this.renderHome();
    this.checkBudgetAlert();
  },

  askItemPrice(item) {
    const priceStr = prompt(
      `Prix réel de "${item.name}" ?\n(Laissez vide pour garder l'estimation : ${this.fmt(item.priceEst)})`,
      item.priceEst
    );
    if (priceStr !== null && priceStr.trim() !== '') {
      const p = this.parseNum(priceStr);
      if (p >= 0) { item.priceReal = p; this.save(); }
    }
  },

  addListItem(item) {
    // Vérifier si déjà en stock en quantité suffisante
    const inStock = this.state.stock.find(s =>
      s.name.toLowerCase() === item.name.toLowerCase() && s.qty >= (item.qty || 1)
    );
    if (inStock) {
      this.showAlert(`"${item.name}" semble déjà disponible dans votre ${this.locationName(inStock.location)}.`, 'orange');
      if (!confirm(`"${item.name}" est déjà en stock (${inStock.qty} ${inStock.unit}). Ajouter quand même ?`)) return;
    }
    this.state.list.push(item);
    this.save();
    this.renderList();
    this.renderHome();
    this.showToast('✅ Article ajouté à la liste', 'success');
    this.checkBudgetAlert();
  },

  removeListItem(id) {
    if (!confirm('Retirer cet article de la liste ?')) return;
    this.state.list = this.state.list.filter(i => i.id !== id);
    this.save();
    this.renderList();
    this.renderHome();
  },

  updateItemPrice(id, price) {
    const item = this.state.list.find(i => i.id === id);
    if (!item) return;
    item.priceReal = this.parseNum(price);
    this.save();
    this.renderList();
    this.renderShoppingMode();
    this.checkBudgetAlert();
  },

  checkBudgetAlert() {
    if (!this.state.budget) return;
    const calc = this.calcBudget(this.state.budget);
    const pct = calc.pct;
    if (pct >= 100) {
      this.showToast('🚨 Budget dépassé ! Retirez des articles ou utilisez la réserve.', 'error');
    } else if (pct >= 90) {
      this.showToast('⚠️ Vous avez utilisé 90 % de votre budget.', 'warning');
    } else if (pct >= 70) {
      this.showToast('📊 Vous avez utilisé 70 % de votre budget.', 'warning');
    }
  },

  /* ============================================================
     5. NAVIGATION
     ============================================================ */
  navigate(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const el = document.getElementById('page-' + page);
    if (el) el.classList.add('active');
    const nav = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (nav) nav.classList.add('active');
    this.state.currentPage = page;
    window.scrollTo(0, 0);
    // Rendu spécifique
    const renders = {
      home: () => this.renderHome(),
      list: () => this.renderList(),
      stock: () => this.renderStock(),
      budget: () => this.renderBudget(),
      profile: () => this.renderProfile(),
      shopping: () => this.renderShoppingMode(),
      butcher: () => this.renderButcher(),
      compare: () => this.renderCompare(),
      recipes: () => this.renderRecipes(),
      assistant: () => this.renderAssistant(),
      history: () => this.renderHistory(),
    };
    if (renders[page]) renders[page]();
  },

  bindNav() {
    document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
      btn.addEventListener('click', () => this.navigate(btn.dataset.page));
    });
    document.querySelector('.nav-add-btn')?.addEventListener('click', () => this.openAddModal());
  },

  bindGlobalEvents() {
    // Fermeture modals
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) this.closeModal(overlay.id);
      });
    });
    // Thème
    document.getElementById('toggle-dark')?.addEventListener('click', () => {
      this.state.settings.darkMode = !this.state.settings.darkMode;
      this.applySettings();
      this.save();
      this.renderProfile();
    });
  },

  /* ============================================================
     6. RENDU — ACCUEIL
     ============================================================ */
  renderHome() {
    const b = this.state.budget;
    if (!b) {
      document.getElementById('home-content').innerHTML = this.renderNoBudget();
      return;
    }
    const c = this.calcBudget(b);
    const pctColor = c.pct >= 100 ? 'red blink' : c.pct >= 90 ? 'red' : c.pct >= 70 ? 'orange' : '';
    const expiring = this.getExpiringSoon();
    const lowStock = this.getLowStock();
    const checkedCount = this.state.list.filter(i => i.checked).length;

    document.getElementById('home-content').innerHTML = `
      <!-- Widget budget -->
      <div class="budget-widget" role="region" aria-label="Résumé du budget">
        <div class="budget-row">
          <div>
            <div class="amount-label">💰 Budget disponible</div>
            <div class="amount-main">${this.fmt(c.available)}</div>
          </div>
          <div style="text-align:right">
            <div class="amount-label">Dépensé</div>
            <div class="amount-main" style="font-size:1.3rem">${this.fmt(c.spent)}</div>
          </div>
        </div>
        <div class="progress-bar-wrap" role="progressbar" aria-valuenow="${Math.round(c.pct)}" aria-valuemin="0" aria-valuemax="100" aria-label="Budget utilisé">
          <div class="progress-bar ${pctColor}" style="width:${Math.min(100,c.pct)}%"></div>
        </div>
        <div class="budget-phrase">
          ${this.budgetPhrase(c, b)}
        </div>
      </div>

      <!-- Alertes -->
      ${this.renderHomeAlerts(c, expiring, lowStock)}

      <!-- Stats -->
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-icon">👥</span>
          <span class="stat-value">${c.persons}</span>
          <span class="stat-label">Personnes</span>
        </div>
        <div class="stat-card">
          <span class="stat-icon">📅</span>
          <span class="stat-value">${b.days} j</span>
          <span class="stat-label">Durée prévue</span>
        </div>
        <div class="stat-card">
          <span class="stat-icon">🛒</span>
          <span class="stat-value">${this.state.list.length}</span>
          <span class="stat-label">Articles liste</span>
        </div>
        <div class="stat-card">
          <span class="stat-icon">🍽️</span>
          <span class="stat-value">${Math.round(c.meals)}</span>
          <span class="stat-label">Repas couverts</span>
        </div>
        <div class="stat-card">
          <span class="stat-icon">💵</span>
          <span class="stat-value">${this.fmt(c.perDay)}</span>
          <span class="stat-label">Par jour</span>
        </div>
        <div class="stat-card">
          <span class="stat-icon">✅</span>
          <span class="stat-value">${checkedCount}/${this.state.list.length}</span>
          <span class="stat-label">Cochés</span>
        </div>
      </div>

      <!-- Boutons principaux -->
      <div style="padding:0 16px;display:flex;flex-direction:column;gap:10px;margin-bottom:12px">
        <button class="btn btn-primary btn-lg btn-full" onclick="App.navigate('list')">
          🛒 Créer / Voir ma liste de courses
        </button>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <button class="btn btn-secondary btn-full" onclick="App.navigate('stock')">
            📦 Mon stock
          </button>
          <button class="btn btn-orange btn-full" onclick="App.navigate('shopping')">
            🏪 Mode courses
          </button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <button class="btn btn-outline btn-full" onclick="App.navigate('butcher')">
            ⚖️ Calculateur poids
          </button>
          <button class="btn btn-outline btn-full" onclick="App.navigate('recipes')">
            👨‍🍳 Recettes
          </button>
        </div>
      </div>

      <!-- Produits bientôt périmés -->
      ${expiring.length > 0 ? `
      <div class="card">
        <div class="card-title">⏰ Bientôt périmés</div>
        ${expiring.slice(0,3).map(i => `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
            <span style="font-size:1.2rem">${i.icon}</span>
            <div style="flex:1">
              <div style="font-weight:600;font-size:0.9rem">${i.name}</div>
              <div class="${this.getExpiryStatus(i)==='urgent'?'expiry-urgent':'expiry-soon'}" style="font-size:0.75rem">
                ${this.expiryLabel(i)}
              </div>
            </div>
            <button class="btn btn-sm btn-outline" onclick="App.navigate('recipes')">Recette</button>
          </div>
        `).join('')}
      </div>` : ''}

      <!-- Produits bientôt épuisés -->
      ${lowStock.length > 0 ? `
      <div class="card">
        <div class="card-title">📉 Stock faible</div>
        ${lowStock.slice(0,3).map(i => `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
            <span style="font-size:1.2rem">${i.icon}</span>
            <div style="flex:1">
              <div style="font-weight:600;font-size:0.9rem">${i.name}</div>
              <div style="font-size:0.75rem;color:var(--text-light)">${i.qty} ${i.unit} restant(s)</div>
            </div>
            <button class="btn btn-sm btn-primary" onclick="App.addToListFromStock('${i.id}')">+ Liste</button>
          </div>
        `).join('')}
      </div>` : ''}
    `;
  },

  renderNoBudget() {
    return `
      <div class="empty-state" style="padding-top:60px">
        <div class="empty-icon">🛒</div>
        <h3>Bienvenue dans Mon Budget Courses !</h3>
        <p>Commencez par configurer votre budget pour profiter de toutes les fonctionnalités.</p>
        <br>
        <button class="btn btn-primary btn-lg" onclick="App.navigate('budget')">
          💰 Configurer mon budget
        </button>
      </div>`;
  },

  renderHomeAlerts(c, expiring, lowStock) {
    const alerts = [];
    if (c.pct >= 100) alerts.push({ type:'red',   icon:'🚨', msg:`Budget dépassé de ${this.fmt(Math.abs(c.remaining))} ! Retirez des articles ou utilisez la réserve.` });
    else if (c.pct >= 90) alerts.push({ type:'red',    icon:'⚠️', msg:`Vous avez utilisé ${Math.round(c.pct)} % de votre budget. Il reste ${this.fmt(c.remaining)}.` });
    else if (c.pct >= 70) alerts.push({ type:'orange', icon:'📊', msg:`Vous avez utilisé ${Math.round(c.pct)} % de votre budget. Il reste ${this.fmt(c.remaining)}.` });
    if (expiring.length > 0) alerts.push({ type:'orange', icon:'⏰', msg:`${expiring.length} produit(s) bientôt périmé(s) dans votre stock.` });
    if (lowStock.length > 0) alerts.push({ type:'orange', icon:'📉', msg:`${lowStock.length} produit(s) en stock faible.` });
    return alerts.map(a => `
      <div class="alert alert-${a.type}" role="alert">
        <span class="alert-icon">${a.icon}</span>
        <span>${a.msg}</span>
      </div>`).join('');
  },

  budgetPhrase(c, b) {
    if (c.pct >= 100) return `🚨 Budget dépassé de <strong>${this.fmt(Math.abs(c.remaining))}</strong>.`;
    if (c.pct >= 90)  return `⚠️ Il vous reste seulement <strong>${this.fmt(c.remaining)}</strong> sur ${this.fmt(b.total)}.`;
    return `💚 Il vous reste <strong>${this.fmt(c.remaining)}</strong> sur un budget de <strong>${this.fmt(b.total)}</strong>.`;
  },

  addToListFromStock(stockId) {
    const s = this.state.stock.find(i => i.id === stockId);
    if (!s) return;
    const item = newListItem({ name: s.name, cat: s.cat, unit: s.unit, priceEst: s.price, priority: 1, essential: true });
    this.addListItem(item);
  },

  /* ============================================================
     7. RENDU — BUDGET
     ============================================================ */
  renderBudget() {
    const b = this.state.budget || newBudget();
    const c = this.calcBudget(b);
    const el = document.getElementById('budget-content');
    el.innerHTML = `
      <div class="card">
        <div class="card-title">💰 Configuration du budget</div>

        <div class="form-group">
          <label class="form-label">Budget total <span class="required">*</span></label>
          <div class="input-group">
            <input type="number" class="form-input" id="b-total" value="${b.total}" min="0" step="0.01" placeholder="Ex: 120">
            <span class="input-addon">€</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Réserve pour imprévus</label>
          <div class="input-group">
            <input type="number" class="form-input" id="b-reserve" value="${b.reserve}" min="0" step="0.01" placeholder="Ex: 10">
            <span class="input-addon">€</span>
          </div>
          <div class="form-hint">Montant mis de côté pour les imprévus.</div>
        </div>

        <div class="form-group">
          <label class="form-label">Durée des courses</label>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
            ${[3,7,14,30].map(d => `
              <button class="tag ${b.days===d?'selected':''}" onclick="App.setBudgetDays(${d})" data-days="${d}">
                ${d===3?'3 jours':d===7?'1 semaine':d===14?'2 semaines':'1 mois'}
              </button>`).join('')}
          </div>
          <div style="margin-top:8px">
            <input type="number" class="form-input" id="b-days" value="${b.days}" min="1" max="90" placeholder="Nombre de jours">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Repas pris à la maison par jour</label>
          <div class="stepper">
            <button class="stepper-btn" onclick="App.stepBudget('mealsPerDay',-1)">−</button>
            <input class="stepper-val" id="b-meals" type="number" value="${b.mealsPerDay}" min="1" max="5">
            <button class="stepper-btn" onclick="App.stepBudget('mealsPerDay',1)">+</button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">👥 Composition du foyer</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
          <div>
            <label class="form-label" style="text-align:center;display:block">👨‍👩 Adultes</label>
            <div class="stepper">
              <button class="stepper-btn" onclick="App.stepBudget('adults',-1)">−</button>
              <input class="stepper-val" id="b-adults" type="number" value="${b.adults}" min="0" max="20">
              <button class="stepper-btn" onclick="App.stepBudget('adults',1)">+</button>
            </div>
          </div>
          <div>
            <label class="form-label" style="text-align:center;display:block">👧 Enfants</label>
            <div class="stepper">
              <button class="stepper-btn" onclick="App.stepBudget('children',-1)">−</button>
              <input class="stepper-val" id="b-children" type="number" value="${b.children}" min="0" max="20">
              <button class="stepper-btn" onclick="App.stepBudget('children',1)">+</button>
            </div>
          </div>
          <div>
            <label class="form-label" style="text-align:center;display:block">👶 Bébés</label>
            <div class="stepper">
              <button class="stepper-btn" onclick="App.stepBudget('babies',-1)">−</button>
              <input class="stepper-val" id="b-babies" type="number" value="${b.babies}" min="0" max="10">
              <button class="stepper-btn" onclick="App.stepBudget('babies',1)">+</button>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">🏪 Magasin principal</div>
        <select class="form-select" id="b-store">
          ${STORES.map(s => `<option value="${s}" ${b.store===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>

      <div class="card">
        <div class="card-title">🥗 Préférences alimentaires</div>
        <div class="tag-group" id="b-prefs">
          ${PREFERENCES_OPTIONS.map(p => `
            <button class="tag ${b.preferences.includes(p)?'selected':''}" onclick="App.togglePref('${p}')">${p}</button>
          `).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-title">⚠️ Allergies</div>
        <div class="tag-group" id="b-allergens">
          ${ALLERGENS.map(a => `
            <button class="tag ${b.allergens.includes(a)?'selected':''}" onclick="App.toggleAllergen('${a}')">${a}</button>
          `).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-title">🎯 Objectif prioritaire</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${[
            {v:'economiser',    l:'💰 Économiser au maximum'},
            {v:'equilibre',     l:'🥗 Manger équilibré'},
            {v:'rapide',        l:'⚡ Cuisiner rapidement'},
            {v:'anti-gaspi',    l:'♻️ Limiter le gaspillage'},
            {v:'combine',       l:'🌟 Combiner plusieurs objectifs'},
          ].map(o => `
            <label class="radio-item">
              <input type="radio" name="b-goal" value="${o.v}" ${b.goal===o.v?'checked':''} onchange="App.setBudgetGoal('${o.v}')">
              <label>${o.l}</label>
            </label>`).join('')}
        </div>
      </div>

      <!-- Résumé calculé -->
      <div class="card" id="budget-summary" style="background:var(--green-pale);border:2px solid var(--green)">
        <div class="card-title" style="color:var(--green)">📊 Résumé calculé</div>
        <div id="budget-calc-display">${this.renderBudgetCalc(b)}</div>
      </div>

      <div style="padding:0 16px 16px;display:flex;gap:10px">
        <button class="btn btn-primary btn-full btn-lg" onclick="App.saveBudget()">
          💾 Enregistrer le budget
        </button>
      </div>

      <!-- Répartition par catégorie -->
      <div class="card">
        <div class="card-title">📂 Répartition par catégorie</div>
        <div id="cat-list">${this.renderCategories(b)}</div>
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);display:flex;justify-content:space-between;font-weight:700">
          <span>Total réparti</span>
          <span id="cat-total-display">${this.fmt(this.catTotal(b))}</span>
        </div>
      </div>
    `;

    // Listeners live
    ['b-total','b-reserve','b-days','b-meals','b-adults','b-children','b-babies'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => this.updateBudgetCalc());
    });
  },

  renderBudgetCalc(b) {
    const c = this.calcBudget(b);
    const tight = c.available > 0 && c.perMeal < 1.5;
    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div><div style="font-size:0.75rem;color:var(--text-light)">Disponible (hors réserve)</div><div style="font-weight:800;font-size:1.1rem;color:var(--green)">${this.fmt(c.available)}</div></div>
        <div><div style="font-size:0.75rem;color:var(--text-light)">Par personne</div><div style="font-weight:800;font-size:1.1rem">${this.fmt(c.perPerson)}</div></div>
        <div><div style="font-size:0.75rem;color:var(--text-light)">Par jour</div><div style="font-weight:800;font-size:1.1rem">${this.fmt(c.perDay)}</div></div>
        <div><div style="font-size:0.75rem;color:var(--text-light)">Par repas</div><div style="font-weight:800;font-size:1.1rem">${this.fmt(c.perMeal)}</div></div>
        <div><div style="font-size:0.75rem;color:var(--text-light)">Repas couverts</div><div style="font-weight:800;font-size:1.1rem">${Math.round(c.meals)}</div></div>
        <div><div style="font-size:0.75rem;color:var(--text-light)">Réserve</div><div style="font-weight:800;font-size:1.1rem">${this.fmt(b.reserve||0)}</div></div>
      </div>
      ${tight ? `<div class="alert alert-orange" style="margin:10px 0 0"><span class="alert-icon">⚠️</span><span>Votre budget est serré. L'application va privilégier les produits essentiels et les recettes économiques.</span></div>` : ''}
    `;
  },

  renderCategories(b) {
    if (!b.categories || b.categories.length === 0) return '<p style="color:var(--text-muted);font-size:0.85rem;padding:8px 0">Enregistrez le budget pour voir la répartition.</p>';
    return b.categories.map(c => {
      const pct = c.budgetPlan > 0 ? Math.min(100, (c.spent / c.budgetPlan) * 100) : 0;
      const color = pct >= 100 ? 'red' : pct >= 80 ? 'orange' : '';
      return `
        <div class="cat-row">
          <span class="cat-icon">${c.icon}</span>
          <div class="cat-info">
            <div class="cat-name">${c.name}</div>
            <div class="cat-amounts">Prévu: ${this.fmt(c.budgetPlan)} · Dépensé: ${this.fmt(c.spent)} · Reste: ${this.fmt(Math.max(0,c.budgetPlan-c.spent))}</div>
            <div class="cat-bar">
              <div class="progress-bar-wrap" style="height:6px">
                <div class="progress-bar ${color}" style="width:${pct}%"></div>
              </div>
            </div>
          </div>
          <input type="number" class="cat-budget-input" value="${c.budgetPlan.toFixed(2)}"
            min="0" step="0.50"
            onchange="App.updateCatBudget('${c.id}', this.value)"
            aria-label="Budget ${c.name}">
        </div>`;
    }).join('');
  },

  catTotal(b) {
    if (!b.categories) return 0;
    return b.categories.reduce((s, c) => s + (c.budgetPlan || 0), 0);
  },

  updateCatBudget(catId, val) {
    const b = this.state.budget;
    if (!b) return;
    const cat = b.categories.find(c => c.id === catId);
    if (!cat) return;
    cat.budgetPlan = Math.max(0, this.parseNum(val));
    document.getElementById('cat-total-display').textContent = this.fmt(this.catTotal(b));
    this.save();
  },

  updateBudgetCalc() {
    const b = this.getBudgetFormValues();
    document.getElementById('budget-calc-display').innerHTML = this.renderBudgetCalc(b);
  },

  getBudgetFormValues() {
    const b = this.state.budget ? { ...this.state.budget } : newBudget();
    b.total      = this.parseNum(document.getElementById('b-total')?.value) || 0;
    b.reserve    = this.parseNum(document.getElementById('b-reserve')?.value) || 0;
    b.days       = parseInt(document.getElementById('b-days')?.value) || 7;
    b.mealsPerDay= parseInt(document.getElementById('b-meals')?.value) || 2;
    b.adults     = parseInt(document.getElementById('b-adults')?.value) || 0;
    b.children   = parseInt(document.getElementById('b-children')?.value) || 0;
    b.babies     = parseInt(document.getElementById('b-babies')?.value) || 0;
    b.store      = document.getElementById('b-store')?.value || 'Carrefour';
    return b;
  },

  saveBudget() {
    const b = this.getBudgetFormValues();
    if (b.total <= 0) { this.showToast('⚠️ Veuillez saisir un budget valide.', 'error'); return; }
    if ((b.adults + b.children + b.babies) === 0) { this.showToast('⚠️ Indiquez au moins une personne.', 'error'); return; }
    b.categories = this.buildCategories(b.total, b.reserve);
    this.state.budget = b;
    this.save();
    this.showToast('✅ Budget enregistré !', 'success');
    this.renderBudget();
    this.renderHome();
  },

  setBudgetDays(d) {
    document.getElementById('b-days').value = d;
    document.querySelectorAll('[data-days]').forEach(el => {
      el.classList.toggle('selected', parseInt(el.dataset.days) === d);
    });
    this.updateBudgetCalc();
  },

  stepBudget(field, delta) {
    const el = document.getElementById(`b-${field === 'mealsPerDay' ? 'meals' : field}`);
    if (!el) return;
    const min = parseInt(el.min) || 0;
    el.value = Math.max(min, (parseInt(el.value) || 0) + delta);
    this.updateBudgetCalc();
  },

  setBudgetGoal(goal) {
    if (this.state.budget) { this.state.budget.goal = goal; this.save(); }
  },

  togglePref(pref) {
    const b = this.state.budget || newBudget();
    const idx = b.preferences.indexOf(pref);
    if (idx >= 0) b.preferences.splice(idx, 1); else b.preferences.push(pref);
    if (!this.state.budget) this.state.budget = b;
    document.querySelectorAll('#b-prefs .tag').forEach(t => {
      t.classList.toggle('selected', b.preferences.includes(t.textContent));
    });
  },

  toggleAllergen(a) {
    const b = this.state.budget || newBudget();
    const idx = b.allergens.indexOf(a);
    if (idx >= 0) b.allergens.splice(idx, 1); else b.allergens.push(a);
    if (!this.state.budget) this.state.budget = b;
    document.querySelectorAll('#b-allergens .tag').forEach(t => {
      t.classList.toggle('selected', b.allergens.includes(t.textContent));
    });
  },

  /* ============================================================
     8. RENDU — LISTE DE COURSES
     ============================================================ */
  renderList() {
    const list = this.state.list;
    const total = this.calcListTotal();
    const b = this.state.budget;
    const available = b ? (b.total - (b.reserve||0)) : 0;
    const pct = available > 0 ? Math.min(100, (total / available) * 100) : 0;
    const pctColor = pct >= 100 ? 'red' : pct >= 90 ? 'red' : pct >= 70 ? 'orange' : '';

    // Grouper par rayon
    const byAisle = {};
    list.forEach(item => {
      const aisle = item.aisle || 'Divers';
      if (!byAisle[aisle]) byAisle[aisle] = [];
      byAisle[aisle].push(item);
    });

    const el = document.getElementById('list-content');
    el.innerHTML = `
      <!-- Résumé budget liste -->
      <div style="background:var(--white);padding:14px 16px;border-bottom:1px solid var(--border);position:sticky;top:60px;z-index:90">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-weight:700">Total estimé</span>
          <span style="font-size:1.2rem;font-weight:800;color:${pct>=100?'var(--red)':'var(--green)'}">${this.fmt(total)}</span>
        </div>
        <div class="progress-bar-wrap">
          <div class="progress-bar ${pctColor}" style="width:${Math.min(100,pct)}%"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.78rem;color:var(--text-light);margin-top:4px">
          <span>${Math.round(pct)}% du budget</span>
          <span>Reste: ${this.fmt(Math.max(0, available - total))}</span>
        </div>
      </div>

      <!-- Filtres priorité -->
      <div style="display:flex;gap:8px;padding:10px 16px;overflow-x:auto">
        <button class="tag selected" id="filter-all" onclick="App.filterList('all')">Tous (${list.length})</button>
        <button class="tag" id="filter-1" onclick="App.filterList(1)">🔴 Indispensable</button>
        <button class="tag" id="filter-2" onclick="App.filterList(2)">🟠 Utile</button>
        <button class="tag" id="filter-3" onclick="App.filterList(3)">⚪ Facultatif</button>
      </div>

      ${list.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">📝</div>
          <h3>Liste vide</h3>
          <p>Ajoutez des articles ou générez une liste automatiquement.</p>
          <br>
          <button class="btn btn-primary" onclick="App.openAddModal()">+ Ajouter un article</button>
        </div>` : ''}

      <!-- Articles par rayon -->
      <div id="list-items">
        ${Object.entries(byAisle).map(([aisle, items]) => `
          <div class="section-title">${aisle}</div>
          <ul class="item-list">
            ${items.map(item => this.renderListItem(item)).join('')}
          </ul>
        `).join('')}
      </div>

      <!-- Boutons d'action -->
      <div style="padding:12px 16px;display:flex;flex-direction:column;gap:8px">
        <button class="btn btn-primary btn-full" onclick="App.openAddModal()">+ Ajouter un article</button>
        <button class="btn btn-secondary btn-full" onclick="App.generateAutoList()">✨ Générer liste automatique</button>
        ${pct >= 90 ? `<button class="btn btn-orange btn-full" onclick="App.optimizeList()">💡 Optimiser pour le budget</button>` : ''}
      </div>
    `;
  },

  renderListItem(item) {
    const price = parseFloat(item.priceReal ?? item.priceEst) || 0;
    const isEst = item.priceReal === null || item.priceReal === undefined;
    return `
      <li class="item-row ${item.checked ? 'checked' : ''}" id="row-${item.id}">
        <button class="item-check ${item.checked ? 'checked' : ''}"
          onclick="App.toggleItem('${item.id}')"
          aria-label="${item.checked ? 'Décocher' : 'Cocher'} ${item.name}"
          aria-pressed="${item.checked}">
          ${item.checked ? '✓' : ''}
        </button>
        <div class="item-info">
          <div class="item-name">${item.name}</div>
          <div class="item-meta">
            ${item.qty} ${item.unit}
            ${item.alt ? `· <span style="color:var(--green);font-size:0.72rem">Alt: ${item.alt}</span>` : ''}
          </div>
        </div>
        <span class="item-priority priority-${item.priority}">
          ${item.priority===1?'Indispensable':item.priority===2?'Utile':'Facultatif'}
        </span>
        <div style="text-align:right">
          <div class="item-price">${this.fmt(price)}</div>
          ${isEst ? '<div style="font-size:0.65rem;color:var(--text-muted)">estimé</div>' : ''}
        </div>
        <button onclick="App.removeListItem('${item.id}')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1.1rem;padding:4px" aria-label="Supprimer ${item.name}">✕</button>
      </li>`;
  },

  filterList(priority) {
    document.querySelectorAll('[id^="filter-"]').forEach(b => b.classList.remove('selected'));
    document.getElementById(`filter-${priority}`)?.classList.add('selected');
    document.querySelectorAll('.item-row').forEach(row => {
      if (priority === 'all') { row.style.display = ''; return; }
      const id = row.id.replace('row-', '');
      const item = this.state.list.find(i => i.id === id);
      row.style.display = (item && item.priority === priority) ? '' : 'none';
    });
  },

  generateAutoList() {
    const b = this.state.budget;
    if (!b) { this.showToast('⚠️ Configurez d\'abord votre budget.', 'error'); return; }
    // Ajouter des articles de base non déjà en stock
    const basics = [
      { name:'Poulet rôti', cat:'viandes-poissons', qty:1, unit:'pcs', priceEst:6.50, priority:1, essential:true, aisle:'Boucherie', alt:'Cuisses de poulet' },
      { name:'Pommes de terre', cat:'fruits-legumes', qty:2, unit:'kg', priceEst:2.20, priority:1, essential:true, aisle:'Fruits & Légumes', alt:'' },
      { name:'Carottes', cat:'fruits-legumes', qty:1, unit:'kg', priceEst:1.20, priority:1, essential:true, aisle:'Fruits & Légumes', alt:'' },
      { name:'Yaourts nature x8', cat:'laitiers', qty:1, unit:'pcs', priceEst:2.40, priority:2, essential:false, aisle:'Crèmerie', alt:'Yaourts MDD' },
      { name:'Pain complet', cat:'petit-dejeuner', qty:1, unit:'pcs', priceEst:1.80, priority:1, essential:true, aisle:'Boulangerie', alt:'' },
    ];
    let added = 0;
    basics.forEach(base => {
      const exists = this.state.list.find(i => i.name.toLowerCase() === base.name.toLowerCase());
      const inStock = this.state.stock.find(s => s.name.toLowerCase() === base.name.toLowerCase() && s.qty >= 1);
      if (!exists && !inStock) {
        this.state.list.push(newListItem(base));
        added++;
      }
    });
    this.save();
    this.renderList();
    this.showToast(`✅ ${added} article(s) ajouté(s) automatiquement.`, 'success');
  },

  optimizeList() {
    const optional = this.state.list.filter(i => !i.checked && i.priority === 3);
    if (optional.length === 0) { this.showToast('Aucun article facultatif à retirer.', 'warning'); return; }
    const names = optional.map(i => `• ${i.name} (${this.fmt(parseFloat(i.priceEst)||0)})`).join('\n');
    if (confirm(`Pour respecter votre budget, vous pourriez retirer ces articles facultatifs :\n\n${names}\n\nConfirmer la suppression ?`)) {
      optional.forEach(i => { this.state.list = this.state.list.filter(l => l.id !== i.id); });
      this.save();
      this.renderList();
      this.showToast('✅ Articles facultatifs retirés.', 'success');
    }
  },

  /* ============================================================
     9. RENDU — STOCK
     ============================================================ */
  renderStock() {
    const stock = this.state.stock;
    const byLocation = {};
    LOCATIONS.forEach(l => { byLocation[l.id] = []; });
    stock.forEach(i => {
      const loc = i.location || 'autre';
      if (!byLocation[loc]) byLocation[loc] = [];
      byLocation[loc].push(i);
    });

    const el = document.getElementById('stock-content');
    el.innerHTML = `
      <!-- Recherche -->
      <div style="padding:10px 16px">
        <input type="search" class="form-input" id="stock-search" placeholder="🔍 Rechercher un produit..." oninput="App.filterStock(this.value)">
      </div>

      <!-- Filtres -->
      <div style="display:flex;gap:8px;padding:0 16px 10px;overflow-x:auto">
        <button class="tag selected" onclick="App.filterStockLoc('all')">Tout</button>
        ${LOCATIONS.map(l => `<button class="tag" onclick="App.filterStockLoc('${l.id}')">${l.icon} ${l.name}</button>`).join('')}
      </div>

      <div id="stock-list">
        ${LOCATIONS.map(loc => {
          const items = byLocation[loc.id];
          if (items.length === 0) return '';
          return `
            <div class="section-title">${loc.icon} ${loc.name} (${items.length})</div>
            ${items.map(i => this.renderStockItem(i)).join('')}
          `;
        }).join('')}
        ${stock.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">📦</div>
            <h3>Stock vide</h3>
            <p>Ajoutez vos produits disponibles à la maison.</p>
          </div>` : ''}
      </div>

      <div style="padding:12px 16px">
        <button class="btn btn-primary btn-full" onclick="App.openAddStockModal()">+ Ajouter un produit au stock</button>
      </div>
    `;
  },

  renderStockItem(item) {
    const status = this.getExpiryStatus(item);
    const expiryClass = status === 'urgent' ? 'expiry-urgent' : status === 'soon' ? 'expiry-soon' : '';
    const lowStock = item.qty <= item.minQty;
    return `
      <div class="stock-item" id="stock-${item.id}">
        <span class="stock-icon">${item.icon || '📦'}</span>
        <div class="stock-info">
          <div class="stock-name">${item.name} ${item.brand ? `<span style="font-weight:400;color:var(--text-muted);font-size:0.8rem">${item.brand}</span>` : ''}</div>
          <div class="stock-meta">
            ${item.location ? this.locationName(item.location) : ''}
            ${item.expiryDate ? `· <span class="${expiryClass}">${this.expiryLabel(item)}</span>` : ''}
            ${lowStock ? `· <span style="color:var(--orange);font-weight:600">⚠️ Stock faible</span>` : ''}
          </div>
        </div>
        <div class="stock-qty">
          <button class="qty-btn" onclick="App.updateStockQty('${item.id}',-1)" aria-label="Diminuer quantité">−</button>
          <span class="qty-val">${item.qty}<br><span style="font-size:0.65rem;color:var(--text-muted)">${item.unit}</span></span>
          <button class="qty-btn" onclick="App.updateStockQty('${item.id}',1)" aria-label="Augmenter quantité">+</button>
        </div>
        <button onclick="App.removeFromStock('${item.id}')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1rem;padding:4px 6px" aria-label="Supprimer ${item.name}">🗑️</button>
      </div>`;
  },

  filterStock(query) {
    const q = query.toLowerCase();
    document.querySelectorAll('.stock-item').forEach(el => {
      const name = el.querySelector('.stock-name')?.textContent.toLowerCase() || '';
      el.style.display = name.includes(q) ? '' : 'none';
    });
  },

  filterStockLoc(loc) {
    document.querySelectorAll('.tag').forEach(t => t.classList.remove('selected'));
    event.target.classList.add('selected');
    document.querySelectorAll('.stock-item').forEach(el => {
      if (loc === 'all') { el.style.display = ''; return; }
      const id = el.id.replace('stock-', '');
      const item = this.state.stock.find(i => i.id === id);
      el.style.display = (item && item.location === loc) ? '' : 'none';
    });
  },

  /* ============================================================
     10. RENDU — MODE COURSES
     ============================================================ */
  renderShoppingMode() {
    const list = this.state.list;
    const checkedTotal = this.calcListCheckedTotal();
    const b = this.state.budget;
    const available = b ? (b.total - (b.reserve||0)) : 0;
    const remaining = available - checkedTotal;
    const pct = available > 0 ? Math.min(100, (checkedTotal / available) * 100) : 0;
    const tickerClass = pct >= 100 ? 'danger' : pct >= 90 ? 'warning' : '';

    // Grouper par rayon
    const byAisle = {};
    list.forEach(item => {
      const aisle = item.aisle || 'Divers';
      if (!byAisle[aisle]) byAisle[aisle] = [];
      byAisle[aisle].push(item);
    });

    const el = document.getElementById('shopping-content');
    el.innerHTML = `
      <!-- Ticker budget -->
      <div class="budget-ticker ${tickerClass}" role="status" aria-live="polite">
        <div>
          <div class="ticker-label">💰 Budget initial: ${this.fmt(available)}</div>
          <div class="ticker-label">Total actuel: ${this.fmt(checkedTotal)}</div>
        </div>
        <div style="text-align:right">
          <div class="ticker-label">Reste disponible</div>
          <div class="ticker-val">${this.fmt(Math.max(0, remaining))}</div>
        </div>
      </div>

      <!-- Barre de progression -->
      <div style="padding:8px 16px;background:var(--white);border-bottom:1px solid var(--border)">
        <div class="progress-bar-wrap">
          <div class="progress-bar ${pct>=100?'red blink':pct>=90?'red':pct>=70?'orange':''}" style="width:${Math.min(100,pct)}%"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--text-light);margin-top:4px">
          <span>${list.filter(i=>i.checked).length} / ${list.length} articles cochés</span>
          <span>${Math.round(pct)}% du budget</span>
        </div>
      </div>

      <!-- Liste mode courses -->
      <div class="shopping-mode">
        ${Object.entries(byAisle).map(([aisle, items]) => `
          <div class="section-title">${aisle}</div>
          <ul class="item-list">
            ${items.map(item => this.renderShoppingItem(item)).join('')}
          </ul>
        `).join('')}
      </div>

      <!-- Bouton calculateur boucher -->
      <div style="padding:12px 16px">
        <button class="btn btn-orange btn-full btn-lg" onclick="App.navigate('butcher')">
          ⚖️ Combien de grammes pour mon budget ?
        </button>
      </div>
    `;
  },

  renderShoppingItem(item) {
    const price = parseFloat(item.priceReal ?? item.priceEst) || 0;
    const isEst = item.priceReal === null || item.priceReal === undefined;
    return `
      <li class="item-row ${item.checked ? 'checked' : ''}" style="padding:14px 16px">
        <button class="item-check ${item.checked ? 'checked' : ''}"
          onclick="App.toggleItem('${item.id}')"
          aria-label="${item.checked ? 'Décocher' : 'Cocher'} ${item.name}"
          style="width:36px;height:36px;font-size:1.1rem">
          ${item.checked ? '✓' : ''}
        </button>
        <div class="item-info">
          <div class="item-name" style="font-size:1rem">${item.name}</div>
          <div class="item-meta">${item.qty} ${item.unit}</div>
        </div>
        <div style="text-align:right;min-width:80px">
          <input type="number" value="${price.toFixed(2)}" min="0" step="0.01"
            style="width:72px;padding:6px;border:2px solid var(--border);border-radius:8px;text-align:right;font-weight:700;font-size:0.9rem;background:var(--white);color:var(--text)"
            onchange="App.updateItemPrice('${item.id}', this.value)"
            aria-label="Prix de ${item.name}">
          ${isEst ? '<div style="font-size:0.65rem;color:var(--text-muted)">estimé</div>' : ''}
        </div>
      </li>`;
  },

  /* ============================================================
     11. RENDU — CALCULATEUR BOUCHER
     ============================================================ */
  renderButcher() {
    const el = document.getElementById('butcher-content');
    el.innerHTML = `
      <!-- Mode 1 : Budget → Grammes -->
      <div class="card">
        <div class="card-title">💰 Budget → Grammes</div>
        <div class="form-group">
          <label class="form-label">Prix au kilogramme (€/kg)</label>
          <div class="input-group">
            <input type="number" class="form-input" id="b-price-kg" placeholder="Ex: 24.00" min="0" step="0.01" oninput="App.calcButcher()">
            <span class="input-addon">€/kg</span>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Mon budget maximum</label>
          <div class="input-group">
            <input type="number" class="form-input" id="b-budget-max" placeholder="Ex: 8.00" min="0" step="0.01" oninput="App.calcButcher()">
            <span class="input-addon">€</span>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Arrondi</label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            ${[
              {v:'10',l:'10 g près'},
              {v:'50',l:'50 g près'},
              {v:'portion',l:'Portion'},
              {v:'exact',l:'Exact'},
            ].map(r => `<button class="tag ${r.v==='10'?'selected':''}" data-round="${r.v}" onclick="App.setRound('${r.v}')">${r.l}</button>`).join('')}
          </div>
        </div>

        <!-- Résultat -->
        <div class="calc-display" id="butcher-result-display">
          <div class="calc-result" id="butcher-grams">—</div>
          <div class="calc-unit">grammes</div>
        </div>

        <div class="calc-phrase" id="butcher-phrase">
          Saisissez le prix et votre budget pour calculer.
        </div>

        <button class="btn btn-primary btn-full" id="btn-big-display" onclick="App.showBigDisplay()" style="display:none">
          📺 Afficher en grand
        </button>
      </div>

      <!-- Mode 2 : Grammes → Prix -->
      <div class="card">
        <div class="card-title">⚖️ Grammes → Prix</div>
        <div class="form-group">
          <label class="form-label">Prix au kilogramme (€/kg)</label>
          <div class="input-group">
            <input type="number" class="form-input" id="b2-price-kg" placeholder="Ex: 24.00" min="0" step="0.01" oninput="App.calcButcher2()">
            <span class="input-addon">€/kg</span>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Poids souhaité (grammes)</label>
          <div class="input-group">
            <input type="number" class="form-input" id="b2-grams" placeholder="Ex: 350" min="0" step="10" oninput="App.calcButcher2()">
            <span class="input-addon">g</span>
          </div>
        </div>
        <div class="calc-display" id="butcher2-result-display">
          <div class="calc-result" id="butcher2-price">—</div>
          <div class="calc-unit">euros estimés</div>
        </div>
      </div>

      <!-- Raccourcis -->
      <div class="card">
        <div class="card-title">⚡ Raccourcis produits</div>
        <div class="shortcut-grid">
          ${BUTCHER_SHORTCUTS.map(s => `
            <button class="shortcut-btn" onclick="App.applyShortcut(${s.priceKg})">
              ${s.label}<br><span style="font-size:0.7rem;color:var(--text-muted)">~${s.priceKg}€/kg</span>
            </button>`).join('')}
        </div>
      </div>
    `;
    this._roundMode = '10';
  },

  _roundMode: '10',

  setRound(mode) {
    this._roundMode = mode;
    document.querySelectorAll('[data-round]').forEach(b => {
      b.classList.toggle('selected', b.dataset.round === mode);
    });
    this.calcButcher();
  },

  calcButcher() {
    const priceKg = this.parseNum(document.getElementById('b-price-kg')?.value);
    const budget  = this.parseNum(document.getElementById('b-budget-max')?.value);
    const gramsEl = document.getElementById('butcher-grams');
    const phraseEl= document.getElementById('butcher-phrase');
    const btnBig  = document.getElementById('btn-big-display');

    if (!priceKg || priceKg <= 0 || !budget || budget <= 0) {
      if (gramsEl) gramsEl.textContent = '—';
      if (phraseEl) phraseEl.textContent = 'Saisissez le prix et votre budget pour calculer.';
      if (btnBig) btnBig.style.display = 'none';
      return;
    }
    const rawGrams = this.calcGrams(priceKg, budget);
    const rounded  = this.roundGrams(rawGrams, this._roundMode);
    if (gramsEl) gramsEl.textContent = rounded;
    const phrase = `Bonjour, je voudrais environ ${rounded} grammes, s'il vous plaît.`;
    if (phraseEl) phraseEl.textContent = phrase;
    this._lastPhrase = phrase;
    this._lastGrams  = rounded;
    if (btnBig) btnBig.style.display = '';
  },

  calcButcher2() {
    const priceKg = this.parseNum(document.getElementById('b2-price-kg')?.value);
    const grams   = this.parseNum(document.getElementById('b2-grams')?.value);
    const priceEl = document.getElementById('butcher2-price');
    if (!priceKg || priceKg <= 0 || !grams || grams <= 0) {
      if (priceEl) priceEl.textContent = '—';
      return;
    }
    const price = this.calcPrice(priceKg, grams);
    if (priceEl) priceEl.textContent = price.toFixed(2) + ' €';
  },

  applyShortcut(priceKg) {
    const el = document.getElementById('b-price-kg');
    if (el) { el.value = priceKg; this.calcButcher(); }
    const el2 = document.getElementById('b2-price-kg');
    if (el2) el2.value = priceKg;
    document.querySelectorAll('.shortcut-btn').forEach(b => b.classList.remove('active'));
    event.target.closest('.shortcut-btn')?.classList.add('active');
  },

  showBigDisplay() {
    const phrase = this._lastPhrase || '';
    const overlay = document.getElementById('modal-big');
    document.getElementById('big-phrase-text').textContent = phrase;
    this.openModal('modal-big');
  },

  /* ============================================================
     12. RENDU — COMPARATEUR DE PRIX
     ============================================================ */
  renderCompare() {
    const el = document.getElementById('compare-content');
    el.innerHTML = `
      <div class="card">
        <div class="card-title">🔍 Comparer des produits</div>
        <p style="font-size:0.85rem;color:var(--text-light);margin-bottom:12px">
          Saisissez jusqu'à 3 produits pour trouver le meilleur rapport qualité/prix.
        </p>
        ${[1,2,3].map(n => `
          <div style="background:var(--beige);border-radius:var(--radius-sm);padding:12px;margin-bottom:10px">
            <div style="font-weight:700;margin-bottom:8px;font-size:0.88rem">Produit ${n}</div>
            <div class="form-group" style="margin-bottom:8px">
              <input type="text" class="form-input" id="cp${n}-name" placeholder="Nom (ex: Yaourt nature)" style="margin-bottom:6px">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
              <div>
                <label class="form-label" style="font-size:0.75rem">Prix (€)</label>
                <input type="number" class="form-input" id="cp${n}-price" placeholder="2.50" min="0" step="0.01" oninput="App.calcCompare()">
              </div>
              <div>
                <label class="form-label" style="font-size:0.75rem">Quantité</label>
                <input type="number" class="form-input" id="cp${n}-qty" placeholder="500" min="0" step="1" oninput="App.calcCompare()">
              </div>
              <div>
                <label class="form-label" style="font-size:0.75rem">Unité</label>
                <select class="form-select" id="cp${n}-unit" onchange="App.calcCompare()">
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                  <option value="mL">mL</option>
                  <option value="L">L</option>
                  <option value="pcs">pcs</option>
                </select>
              </div>
            </div>
            <div style="margin-top:6px">
              <label class="form-label" style="font-size:0.75rem">Promotion</label>
              <select class="form-select" id="cp${n}-promo" onchange="App.calcCompare()">
                <option value="none">Aucune</option>
                <option value="2for3">2 achetés = 3ème offert</option>
                <option value="50pct">2ème à -50%</option>
                <option value="10pct">-10%</option>
                <option value="20pct">-20%</option>
                <option value="30pct">-30%</option>
              </select>
            </div>
          </div>`).join('')}
        <button class="btn btn-primary btn-full" onclick="App.calcCompare()">⚖️ Comparer</button>
      </div>

      <div id="compare-results"></div>
    `;
  },

  calcCompare() {
    const products = [1,2,3].map(n => {
      const name  = document.getElementById(`cp${n}-name`)?.value || `Produit ${n}`;
      const price = this.parseNum(document.getElementById(`cp${n}-price`)?.value);
      const qty   = this.parseNum(document.getElementById(`cp${n}-qty`)?.value);
      const unit  = document.getElementById(`cp${n}-unit`)?.value || 'g';
      const promo = document.getElementById(`cp${n}-promo`)?.value || 'none';
      if (!price || !qty) return null;
      let effectivePrice = price;
      if (promo === '2for3') effectivePrice = (price * 2) / 3;
      else if (promo === '50pct') effectivePrice = (price + price * 0.5) / 2;
      else if (promo === '10pct') effectivePrice = price * 0.9;
      else if (promo === '20pct') effectivePrice = price * 0.8;
      else if (promo === '30pct') effectivePrice = price * 0.7;
      const unitPrice = this.calcUnitPrice(effectivePrice, qty, unit);
      return { name, price, effectivePrice, qty, unit, promo, unitPrice };
    }).filter(Boolean);

    if (products.length < 2) {
      document.getElementById('compare-results').innerHTML = '';
      return;
    }

    // Trouver le meilleur
    const getRef = p => {
      if (!p.unitPrice) return Infinity;
      return p.unitPrice.perKg || p.unitPrice.perL || p.unitPrice.perUnit || Infinity;
    };
    const refs = products.map(getRef);
    const minRef = Math.min(...refs);
    const bestIdx = refs.indexOf(minRef);

    document.getElementById('compare-results').innerHTML = `
      <div class="section-title">Résultats de la comparaison</div>
      <div style="display:flex;flex-direction:column;gap:10px;padding:0 16px 16px">
        ${products.map((p, i) => {
          const ref = refs[i];
          const isBest = i === bestIdx;
          const saving = !isBest && ref !== Infinity ? ((ref - minRef) / ref * 100).toFixed(0) : null;
          return `
            <div class="compare-card ${isBest ? 'best' : ''}">
              ${isBest ? '<div class="best-badge">✅ Meilleur prix</div>' : ''}
              <div style="font-weight:700;margin-bottom:6px">${p.name}</div>
              <div class="compare-price-unit">
                ${ref !== Infinity ? (p.unitPrice?.perKg ? `${ref.toFixed(2)} €/kg` : p.unitPrice?.perL ? `${ref.toFixed(2)} €/L` : `${ref.toFixed(2)} €/unité`) : '—'}
              </div>
              <div class="compare-detail">
                Prix payé: ${this.fmt(p.price)}
                ${p.promo !== 'none' ? ` → après promo: ${this.fmt(p.effectivePrice)}` : ''}
                · ${p.qty} ${p.unit}
              </div>
              ${saving ? `<div style="color:var(--orange);font-size:0.8rem;margin-top:4px">⚠️ ${saving}% plus cher que le meilleur prix</div>` : ''}
            </div>`;
        }).join('')}
      </div>
    `;
  },

  /* ============================================================
     13. RENDU — RECETTES
     ============================================================ */
  renderRecipes() {
    const el = document.getElementById('recipes-content');
    el.innerHTML = `
      <div style="padding:10px 16px">
        <input type="search" class="form-input" placeholder="🔍 Rechercher une recette..." oninput="App.filterRecipes(this.value)">
      </div>
      <div style="display:flex;gap:8px;padding:0 16px 10px;overflow-x:auto">
        ${['Toutes','Économique','Végétarien','Rapide','Anti-gaspi'].map((t,i) =>
          `<button class="tag ${i===0?'selected':''}" onclick="App.filterRecipeTag('${t}', this)">${t}</button>`
        ).join('')}
      </div>
      <div id="recipes-list">
        ${DEMO_RECIPES.map(r => this.renderRecipeCard(r)).join('')}
      </div>
      <div style="padding:12px 16px">
        <button class="btn btn-outline btn-full" onclick="App.openAssistantWithPrompt('Propose-moi 3 recettes économiques avec mon stock actuel.')">
          ✨ Générer des recettes avec mon stock
        </button>
      </div>
    `;
  },

  renderRecipeCard(r) {
    return `
      <div class="recipe-card" data-tags="${r.tags.join(',')}">
        <div class="recipe-header">
          <span class="recipe-emoji">${r.emoji}</span>
          <div>
            <div class="recipe-title">${r.name}</div>
            <div class="recipe-meta">⏱ ${r.time} min · 👥 ${r.portions} portions</div>
          </div>
          <div style="margin-left:auto;text-align:right">
            <div class="recipe-cost">${this.fmt(r.costTotal)}</div>
            <div style="font-size:0.72rem;color:var(--text-light)">${this.fmt(r.costPer)}/pers.</div>
          </div>
        </div>
        <div class="recipe-body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
            <div>
              <div style="font-size:0.75rem;font-weight:700;color:var(--green);margin-bottom:4px">✅ En stock</div>
              ${r.inStock.map(i => `<div style="font-size:0.8rem">• ${i}</div>`).join('')}
            </div>
            <div>
              <div style="font-size:0.75rem;font-weight:700;color:var(--orange);margin-bottom:4px">🛒 À acheter</div>
              ${r.toBuy.map(i => `<div style="font-size:0.8rem">• ${i}</div>`).join('')}
            </div>
          </div>
          <div class="recipe-tags">
            ${r.tags.map(t => `<span class="badge badge-green">${t}</span>`).join('')}
          </div>
          <button class="btn btn-outline btn-sm btn-full" style="margin-top:10px"
            onclick="App.showRecipeDetail('${r.id}')">
            Voir la recette complète
          </button>
        </div>
      </div>`;
  },

  filterRecipes(q) {
    const query = q.toLowerCase();
    document.querySelectorAll('.recipe-card').forEach(el => {
      const name = el.querySelector('.recipe-title')?.textContent.toLowerCase() || '';
      el.style.display = name.includes(query) ? '' : 'none';
    });
  },

  filterRecipeTag(tag, btn) {
    document.querySelectorAll('#recipes-content .tag').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    document.querySelectorAll('.recipe-card').forEach(el => {
      if (tag === 'Toutes') { el.style.display = ''; return; }
      const tags = (el.dataset.tags || '').toLowerCase();
      el.style.display = tags.includes(tag.toLowerCase()) ? '' : 'none';
    });
  },

  showRecipeDetail(id) {
    const r = DEMO_RECIPES.find(x => x.id === id);
    if (!r) return;
    document.getElementById('recipe-detail-content').innerHTML = `
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:3rem">${r.emoji}</div>
        <h2 style="font-size:1.2rem;margin-top:8px">${r.name}</h2>
        <div style="color:var(--text-light);font-size:0.85rem">⏱ ${r.time} min · 👥 ${r.portions} portions · ${this.fmt(r.costTotal)} (${this.fmt(r.costPer)}/pers.)</div>
      </div>
      <div style="margin-bottom:14px">
        <div style="font-weight:700;margin-bottom:6px">✅ Ingrédients en stock</div>
        ${r.inStock.map(i => `<div style="padding:4px 0;border-bottom:1px solid var(--border);font-size:0.9rem">• ${i}</div>`).join('')}
      </div>
      <div style="margin-bottom:14px">
        <div style="font-weight:700;margin-bottom:6px;color:var(--orange)">🛒 À acheter</div>
        ${r.toBuy.map(i => `<div style="padding:4px 0;border-bottom:1px solid var(--border);font-size:0.9rem">• ${i}</div>`).join('')}
      </div>
      <div style="margin-bottom:14px">
        <div style="font-weight:700;margin-bottom:8px">📋 Préparation</div>
        ${r.steps.map((s,i) => `
          <div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
            <span style="background:var(--green);color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;flex-shrink:0">${i+1}</span>
            <span style="font-size:0.9rem">${s}</span>
          </div>`).join('')}
      </div>
      ${r.leftovers ? `<div class="alert alert-green"><span class="alert-icon">♻️</span><span>${r.leftovers}</span></div>` : ''}
      <button class="btn btn-primary btn-full" style="margin-top:12px" onclick="App.addRecipeToList('${r.id}')">
        🛒 Ajouter les ingrédients manquants à la liste
      </button>
    `;
    this.openModal('modal-recipe');
  },

  addRecipeToList(id) {
    const r = DEMO_RECIPES.find(x => x.id === id);
    if (!r) return;
    let added = 0;
    r.toBuy.forEach(name => {
      const exists = this.state.list.find(i => i.name.toLowerCase().includes(name.toLowerCase().split('(')[0].trim()));
      if (!exists) {
        this.state.list.push(newListItem({ name: name.replace(/\s*\(.*\)/, '').trim(), priority: 1, essential: true, aisle: 'Épicerie' }));
        added++;
      }
    });
    this.save();
    this.closeModal('modal-recipe');
    this.showToast(`✅ ${added} ingrédient(s) ajouté(s) à la liste.`, 'success');
    this.navigate('list');
  },

  /* ============================================================
     14. RENDU — ASSISTANT
     ============================================================ */
  renderAssistant() {
    const el = document.getElementById('assistant-content');
    if (el.querySelector('.chat-wrap')) return; // déjà rendu
    el.innerHTML = `
      <div class="chat-wrap">
        <div class="chat-messages" id="chat-messages">
          <div class="chat-bubble bot">
            👋 Bonjour ! Je suis votre assistant budget courses. Je peux vous aider à :<br><br>
            • Préparer une liste de courses<br>
            • Calculer des quantités<br>
            • Trouver des recettes économiques<br>
            • Optimiser votre budget<br><br>
            Que puis-je faire pour vous ?
          </div>
        </div>
        <div class="chat-suggestions">
          ${[
            'Prépare une liste pour 4 personnes, 7 jours, 80€',
            'Il me reste 15€, que puis-je enlever ?',
            'Quels produits vont bientôt périmer ?',
            'Combien de grammes de poulet à 13,90€/kg pour 6€ ?',
            'Propose 3 recettes végétariennes économiques',
          ].map(s => `<button class="chat-sug" onclick="App.sendChat('${s.replace(/'/g,"\\'")}')">💬 ${s}</button>`).join('')}
        </div>
        <div class="chat-input-wrap">
          <input type="text" class="chat-input" id="chat-input" placeholder="Posez votre question..." onkeydown="if(event.key==='Enter')App.sendChat()">
          <button class="chat-send" onclick="App.sendChat()" aria-label="Envoyer">➤</button>
        </div>
      </div>
    `;
  },

  openAssistantWithPrompt(prompt) {
    this.navigate('assistant');
    setTimeout(() => this.sendChat(prompt), 100);
  },

  sendChat(text) {
    const input = document.getElementById('chat-input');
    const msg = text || (input ? input.value.trim() : '');
    if (!msg) return;
    if (input) input.value = '';
    this.appendChat(msg, 'user');
    setTimeout(() => {
      const reply = this.processChat(msg);
      this.appendChat(reply, 'bot');
    }, 400);
  },

  appendChat(msg, role) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    const div = document.createElement('div');
    div.className = `chat-bubble ${role}`;
    div.innerHTML = msg;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  },

  processChat(msg) {
    const m = msg.toLowerCase();
    const b = this.state.budget;

    // Calcul grammes
    const gramsMatch = m.match(/(\d+[,.]?\d*)\s*€?\s*(?:le\s*)?kilo(?:gramme)?.*?(\d+[,.]?\d*)\s*€/);
    const gramsMatch2 = m.match(/(\d+[,.]?\d*)\s*€\s*(?:le\s*)?kg.*?(\d+[,.]?\d*)\s*€/);
    const gm = gramsMatch || gramsMatch2;
    if (gm || m.includes('gramme') || m.includes('kilo')) {
      const pkgMatch = m.match(/(\d+[,.]?\d*)\s*(?:€\s*)?(?:le\s*)?(?:kilo|kg)/);
      const budMatch = m.match(/(?:budget|pour)\s*(?:de\s*)?(\d+[,.]?\d*)\s*€/);
      if (pkgMatch && budMatch) {
        const priceKg = this.parseNum(pkgMatch[1]);
        const budget  = this.parseNum(budMatch[1]);
        const grams   = this.roundGrams(this.calcGrams(priceKg, budget), '10');
        return `⚖️ Avec un budget de <strong>${this.fmt(budget)}</strong> et un prix de <strong>${this.fmt(priceKg)}/kg</strong>, vous pouvez demander environ <strong>${grams} grammes</strong>.<br><br>💬 <em>"Bonjour, je voudrais environ ${grams} grammes, s'il vous plaît."</em>`;
      }
    }

    // Produits périmés
    if (m.includes('périm') || m.includes('expir')) {
      const exp = this.getExpiringSoon();
      if (exp.length === 0) return '✅ Aucun produit ne périme prochainement dans votre stock. Bravo !';
      return `⏰ Produits bientôt périmés :<br><br>${exp.map(i => `• <strong>${i.name}</strong> — ${this.expiryLabel(i)}`).join('<br>')}`;
    }

    // Budget restant
    if (m.includes('reste') && (m.includes('€') || m.includes('euro') || m.includes('budget'))) {
      if (!b) return '⚠️ Vous n\'avez pas encore configuré de budget. Allez dans l\'onglet Budget pour commencer.';
      const c = this.calcBudget(b);
      const optional = this.state.list.filter(i => !i.checked && i.priority === 3);
      const optTotal = optional.reduce((s,i) => s + (parseFloat(i.priceEst)||0), 0);
      return `💰 Il vous reste <strong>${this.fmt(c.remaining)}</strong> sur votre budget.<br><br>${optional.length > 0 ? `💡 En retirant les ${optional.length} article(s) facultatif(s), vous économiseriez environ <strong>${this.fmt(optTotal)}</strong>.<br>Voulez-vous que je les retire ?` : '✅ Votre liste ne contient que des articles essentiels.'}`;
    }

    // Générer liste
    if (m.includes('liste') && (m.includes('personne') || m.includes('jour') || m.includes('€'))) {
      const persMatch = m.match(/(\d+)\s*personne/);
      const daysMatch = m.match(/(\d+)\s*jour/);
      const budgMatch = m.match(/(\d+[,.]?\d*)\s*€/);
      const pers = persMatch ? parseInt(persMatch[1]) : 4;
      const days = daysMatch ? parseInt(daysMatch[1]) : 7;
      const budg = budgMatch ? this.parseNum(budgMatch[1]) : 80;
      return `📝 Je prépare une liste pour <strong>${pers} personne(s)</strong> pendant <strong>${days} jours</strong> avec un budget de <strong>${this.fmt(budg)}</strong>.<br><br>Budget par personne : <strong>${this.fmt(budg/pers)}</strong><br>Budget par jour : <strong>${this.fmt(budg/days)}</strong><br>Budget par repas : <strong>${this.fmt(budg/(days*2*pers))}</strong><br><br>💡 Je vous recommande de configurer ces paramètres dans l'onglet <strong>Budget</strong> pour générer la liste automatiquement.`;
    }

    // Recettes végétariennes
    if (m.includes('végétar') || m.includes('vegetar')) {
      const veg = DEMO_RECIPES.filter(r => r.tags.includes('végétarien'));
      return `🥗 Voici des recettes végétariennes économiques :<br><br>${veg.map(r => `• <strong>${r.emoji} ${r.name}</strong> — ${this.fmt(r.costPer)}/pers. (${r.time} min)`).join('<br>')}`;
    }

    // Remplacer produit
    if (m.includes('remplace') || m.includes('alternative') || m.includes('moins cher')) {
      return `💡 Pour réduire votre budget, voici quelques alternatives :<br><br>• 🐟 Saumon → Thon en boîte (économie ~4€)<br>• 🥩 Bœuf → Poulet ou œufs (économie ~3€)<br>• 🧀 Fromage AOP → Fromage MDD (économie ~2€)<br>• 🥛 Lait bio → Lait standard (économie ~0,50€)<br><br>Quel produit souhaitez-vous remplacer spécifiquement ?`;
    }

    // Ajouter produit avec limite
    if (m.includes('ajoute') && m.includes('ne pas dépasser')) {
      return `✅ Compris ! J'ajouterai le produit en vérifiant que le budget de la catégorie n'est pas dépassé. Rendez-vous dans l'onglet <strong>Liste</strong> pour ajouter manuellement avec contrôle du budget.`;
    }

    // Réponse générique
    return `🤔 Je comprends votre demande. Voici ce que je peux faire :<br><br>• <strong>Calculer des grammes</strong> : "Combien de grammes de bœuf à 18€/kg pour 7€ ?"<br>• <strong>Vérifier le budget</strong> : "Il me reste combien ?"<br>• <strong>Trouver des recettes</strong> : "Recettes avec des pâtes et des œufs"<br>• <strong>Alertes stock</strong> : "Quels produits vont périmer ?"<br><br>Reformulez votre question et je ferai de mon mieux ! 😊`;
  },

  /* ============================================================
     15. RENDU — HISTORIQUE
     ============================================================ */
  renderHistory() {
    const history = this.state.history;
    const el = document.getElementById('history-content');

    const totalSaved = history.reduce((s, h) => s + Math.max(0, h.budget - h.spent), 0);
    const avgSpent   = history.length > 0 ? history.reduce((s,h) => s+h.spent, 0) / history.length : 0;

    el.innerHTML = `
      <div class="stats-grid" style="margin-top:12px">
        <div class="stat-card">
          <span class="stat-icon">💰</span>
          <span class="stat-value">${this.fmt(totalSaved)}</span>
          <span class="stat-label">Économies totales</span>
        </div>
        <div class="stat-card">
          <span class="stat-icon">📊</span>
          <span class="stat-value">${this.fmt(avgSpent)}</span>
          <span class="stat-label">Dépense moyenne</span>
        </div>
      </div>

      <div class="section-title">Historique des courses</div>
      ${history.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <h3>Aucun historique</h3>
          <p>Vos courses passées apparaîtront ici.</p>
        </div>` :
        history.map(h => {
          const saved = h.budget - h.spent;
          const pct   = Math.round((h.spent / h.budget) * 100);
          return `
            <div class="history-row">
              <div class="history-date">${this.formatDate(h.date)}</div>
              <div class="history-info">
                <div class="history-title">${h.label}</div>
                <div class="history-sub">${h.persons} pers. · ${h.days} jours · ${h.items} articles</div>
                <div style="margin-top:4px">
                  <div class="progress-bar-wrap" style="height:5px">
                    <div class="progress-bar ${pct>=100?'red':pct>=90?'red':pct>=70?'orange':''}" style="width:${Math.min(100,pct)}%"></div>
                  </div>
                </div>
              </div>
              <div style="text-align:right">
                <div class="history-amount">${this.fmt(h.spent)}</div>
                <div style="font-size:0.72rem;color:${saved>=0?'var(--green)':'var(--red)'}">
                  ${saved >= 0 ? `économisé ${this.fmt(saved)}` : `dépassé ${this.fmt(Math.abs(saved))}`}
                </div>
              </div>
            </div>`;
        }).join('')
      }
    `;
  },

  /* ============================================================
     16. RENDU — PROFIL
     ============================================================ */
  renderProfile() {
    const s = this.state.settings;
    const h = this.state.household;
    const el = document.getElementById('profile-content');
    el.innerHTML = `
      <div class="card">
        <div class="card-title">🏠 Mon foyer</div>
        <div class="form-group">
          <label class="form-label">Nom du foyer</label>
          <input type="text" class="form-input" id="hh-name" value="${h.name}" onchange="App.saveHousehold()">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
          <div>
            <label class="form-label" style="text-align:center;display:block">👨‍👩 Adultes</label>
            <div class="stepper">
              <button class="stepper-btn" onclick="App.stepHousehold('adults',-1)">−</button>
              <input class="stepper-val" id="hh-adults" type="number" value="${h.adults}" min="0">
              <button class="stepper-btn" onclick="App.stepHousehold('adults',1)">+</button>
            </div>
          </div>
          <div>
            <label class="form-label" style="text-align:center;display:block">👧 Enfants</label>
            <div class="stepper">
              <button class="stepper-btn" onclick="App.stepHousehold('children',-1)">−</button>
              <input class="stepper-val" id="hh-children" type="number" value="${h.children}" min="0">
              <button class="stepper-btn" onclick="App.stepHousehold('children',1)">+</button>
            </div>
          </div>
          <div>
            <label class="form-label" style="text-align:center;display:block">👶 Bébés</label>
            <div class="stepper">
              <button class="stepper-btn" onclick="App.stepHousehold('babies',-1)">−</button>
              <input class="stepper-val" id="hh-babies" type="number" value="${h.babies}" min="0">
              <button class="stepper-btn" onclick="App.stepHousehold('babies',1)">+</button>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">⚙️ Apparence</div>
        <div class="switch-wrap">
          <span class="switch-label">🌙 Mode sombre</span>
          <div class="switch ${s.darkMode?'on':''}" id="toggle-dark" role="switch" aria-checked="${s.darkMode}" tabindex="0" onclick="App.toggleDark()" onkeydown="if(event.key==='Enter'||event.key===' ')App.toggleDark()"></div>
        </div>
        <div class="divider"></div>
        <div class="form-group">
          <label class="form-label">Taille du texte</label>
          <div style="display:flex;gap:8px">
            ${[{v:'sm',l:'Petit'},{v:'normal',l:'Normal'},{v:'lg',l:'Grand'},{v:'xl',l:'Très grand'}].map(t =>
              `<button class="tag ${s.fontSize===t.v?'selected':''}" onclick="App.setFontSize('${t.v}')">${t.l}</button>`
            ).join('')}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">🔔 Alertes</div>
        <div class="switch-wrap">
          <span class="switch-label">Activer les alertes</span>
          <div class="switch ${s.alertsEnabled?'on':''}" onclick="App.toggleAlerts()" role="switch" aria-checked="${s.alertsEnabled}" tabindex="0"></div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">🧭 Navigation rapide</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${[
            {icon:'⚖️', label:'Calculateur poids/grammes', page:'butcher'},
            {icon:'🔍', label:'Comparateur de prix', page:'compare'},
            {icon:'👨‍🍳', label:'Recettes économiques', page:'recipes'},
            {icon:'🤖', label:'Assistant intelligent', page:'assistant'},
            {icon:'📋', label:'Historique des courses', page:'history'},
          ].map(item => `
            <button class="btn btn-secondary btn-full" onclick="App.navigate('${item.page}')" style="justify-content:flex-start;gap:12px">
              <span style="font-size:1.2rem">${item.icon}</span> ${item.label}
            </button>`).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-title">🗑️ Données</div>
        <button class="btn btn-red btn-full" onclick="App.resetData()">Réinitialiser toutes les données</button>
      </div>
    `;
  },

  toggleDark() {
    this.state.settings.darkMode = !this.state.settings.darkMode;
    this.applySettings();
    this.save();
    this.renderProfile();
  },

  setFontSize(size) {
    this.state.settings.fontSize = size;
    this.applySettings();
    this.save();
    this.renderProfile();
  },

  toggleAlerts() {
    this.state.settings.alertsEnabled = !this.state.settings.alertsEnabled;
    this.save();
    this.renderProfile();
  },

  saveHousehold() {
    this.state.household.name = document.getElementById('hh-name')?.value || 'Mon Foyer';
    this.save();
  },

  stepHousehold(field, delta) {
    const el = document.getElementById(`hh-${field}`);
    if (!el) return;
    const val = Math.max(0, (parseInt(el.value)||0) + delta);
    el.value = val;
    this.state.household[field] = val;
    this.save();
  },

  resetData() {
    if (!confirm('⚠️ Toutes vos données seront supprimées. Continuer ?')) return;
    localStorage.removeItem('mbc_state');
    location.reload();
  },

  /* ============================================================
     17. MODALS
     ============================================================ */
  openModal(id) {
    const overlay = document.getElementById(id);
    if (overlay) { overlay.classList.add('open'); document.body.style.overflow = 'hidden'; }
  },

  closeModal(id) {
    const overlay = document.getElementById(id);
    if (overlay) { overlay.classList.remove('open'); document.body.style.overflow = ''; }
  },

  openAddModal() {
    document.getElementById('add-item-form').reset?.();
    document.getElementById('add-item-name').value = '';
    document.getElementById('add-item-price').value = '';
    document.getElementById('add-item-qty').value = '1';
    this.openModal('modal-add-item');
  },

  submitAddItem() {
    const name  = document.getElementById('add-item-name').value.trim();
    const price = this.parseNum(document.getElementById('add-item-price').value);
    const qty   = this.parseNum(document.getElementById('add-item-qty').value) || 1;
    const unit  = document.getElementById('add-item-unit').value;
    const prio  = parseInt(document.getElementById('add-item-priority').value) || 2;
    const aisle = document.getElementById('add-item-aisle').value.trim();
    if (!name) { this.showToast('⚠️ Saisissez un nom de produit.', 'error'); return; }
    if (price < 0) { this.showToast('⚠️ Le prix ne peut pas être négatif.', 'error'); return; }
    const item = newListItem({ name, priceEst: price, qty, unit, priority: prio, aisle: aisle || 'Divers', essential: prio === 1 });
    this.addListItem(item);
    this.closeModal('modal-add-item');
  },

  openAddStockModal() {
    this.openModal('modal-add-stock');
  },

  submitAddStock() {
    const name     = document.getElementById('as-name').value.trim();
    const qty      = this.parseNum(document.getElementById('as-qty').value) || 1;
    const unit     = document.getElementById('as-unit').value;
    const location = document.getElementById('as-location').value;
    const expiry   = document.getElementById('as-expiry').value;
    const price    = this.parseNum(document.getElementById('as-price').value) || 0;
    if (!name) { this.showToast('⚠️ Saisissez un nom de produit.', 'error'); return; }
    const item = newStockItem({ name, qty, unit, location, expiryDate: expiry || null, price, icon: '📦' });
    this.addToStock(item);
    this.closeModal('modal-add-stock');
  },

  /* ============================================================
     18. UTILITAIRES
     ============================================================ */
  fmt(n) {
    const num = parseFloat(n) || 0;
    return num.toFixed(2).replace('.', ',') + ' €';
  },

  parseNum(str) {
    if (str === null || str === undefined || str === '') return 0;
    return parseFloat(String(str).replace(',', '.')) || 0;
  },

  locationName(id) {
    return LOCATIONS.find(l => l.id === id)?.name || id;
  },

  expiryLabel(item) {
    if (!item.expiryDate) return '';
    const days = Math.ceil((new Date(item.expiryDate) - new Date()) / 86400000);
    if (days < 0)  return `Périmé depuis ${Math.abs(days)} jour(s)`;
    if (days === 0) return 'Périme aujourd\'hui !';
    if (days === 1) return 'Périme demain !';
    return `Périme dans ${days} jour(s)`;
  },

  formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day:'2-digit', month:'short' });
  },

  showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  },

  showAlert(msg, type = 'orange') {
    const container = document.getElementById('home-content');
    if (!container) return;
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = `<span class="alert-icon">${type==='red'?'🚨':type==='orange'?'⚠️':'✅'}</span><span>${msg}</span><button class="alert-close" onclick="this.parentElement.remove()">✕</button>`;
    container.prepend(alert);
  },

  checkAlerts() {
    const b = this.state.budget;
    if (!b) return;
    const c = this.calcBudget(b);
    if (c.pct >= 90 && this.state.settings.alertsEnabled) {
      this.showToast(`⚠️ Vous avez utilisé ${Math.round(c.pct)}% de votre budget.`, 'warning');
    }
  },

  renderAll() {
    // Pré-rendu des pages statiques
  },
};

/* ============================================================
   INITIALISATION AU CHARGEMENT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => App.init());