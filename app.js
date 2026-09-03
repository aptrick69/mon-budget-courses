// ============================================================
//  MON BUDGET COURSES V2 — APPLICATION PRINCIPALE
//  Données réelles uniquement. Zéro valeur fictive.
//  Toutes les pages partagent le même état global.
// ============================================================

'use strict';

/* ============================================================
   1. ÉTAT GLOBAL & PERSISTANCE
   ============================================================ */
const App = {

  // État en mémoire — source unique de vérité
  state: null,

  // Clé localStorage
  STORAGE_KEY: 'mbc_v2',

  /* ---- Initialisation ---- */
  init() {
    this.loadState();
    this.applySettings();
    this.registerSW();
    this.bindNav();
    this.bindGlobalEvents();
    this.navigate('home');
  },

  /* ---- Chargement depuis localStorage ---- */
  loadState() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        this.state = JSON.parse(raw);
        // Migration : s'assurer que tous les champs existent
        const init = getInitialState();
        this.state.budget    = { ...init.budget,    ...this.state.budget    };
        this.state.household = { ...init.household, ...this.state.household };
        this.state.settings  = { ...init.settings,  ...this.state.settings  };
        if (!Array.isArray(this.state.stock))   this.state.stock   = [];
        if (!Array.isArray(this.state.list))    this.state.list    = [];
        if (!Array.isArray(this.state.history)) this.state.history = [];
        if (!Array.isArray(this.state.budget.depenses)) this.state.budget.depenses = [];
      } else {
        // Premier lancement : état vide, zéro fausse donnée
        this.state = getInitialState();
      }
    } catch(e) {
      console.warn('Erreur chargement état:', e);
      this.state = getInitialState();
    }
  },

  /* ---- Sauvegarde ---- */
  save() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
    } catch(e) {
      console.warn('Erreur sauvegarde:', e);
    }
  },

  /* ---- Appliquer les paramètres visuels ---- */
  applySettings() {
    const s = this.state.settings;
    document.documentElement.setAttribute('data-theme', s.darkMode ? 'dark' : 'light');
    document.body.className = (s.fontSize && s.fontSize !== 'normal') ? `text-${s.fontSize}` : '';
  },

  /* ---- Service Worker ---- */
  registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  },

  /* ============================================================
     2. CALCULS BUDGÉTAIRES — SIMPLES ET FIABLES
     ============================================================ */

  /*
    Formules :
    - disponible      = total - reserve
    - totalDepenses   = somme de toutes les dépenses
    - restant         = disponible - totalDepenses
    - pct             = totalDepenses / disponible * 100
  */
  getBudgetCalc() {
    const b = this.state.budget;
    const total         = this.num(b.total);
    const reserve       = this.num(b.reserve);
    const disponible    = Math.max(0, total - reserve);
    const depenses      = Array.isArray(b.depenses) ? b.depenses : [];
    const totalDepenses = depenses.reduce((s, d) => s + this.num(d.montant), 0);
    const restant       = disponible - totalDepenses;
    const pct           = disponible > 0 ? Math.min(100, (totalDepenses / disponible) * 100) : 0;
    return { total, reserve, disponible, totalDepenses, restant, pct };
  },

  /* Total estimé de la liste */
  getListTotal() {
    return this.state.list.reduce((s, i) => s + this.num(i.priceReal ?? i.priceEst), 0);
  },

  /* Total coché (mode courses) */
  getCheckedTotal() {
    return this.state.list.filter(i => i.checked)
      .reduce((s, i) => s + this.num(i.priceReal ?? i.priceEst), 0);
  },

  /* Nombre de personnes */
  getPersons() {
    const h = this.state.household;
    return (this.num(h.adults) + this.num(h.children) + this.num(h.babies)) || 1;
  },

  /* ============================================================
     3. NAVIGATION
     ============================================================ */
  navigate(page) {
    // Masquer toutes les pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    // Désactiver tous les boutons nav
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const el  = document.getElementById('page-' + page);
    const nav = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (el)  el.classList.add('active');
    if (nav) nav.classList.add('active');

    this.state.currentPage = page;
    window.scrollTo(0, 0);

    // Rendu de la page
    const renders = {
      home:      () => this.renderHome(),
      list:      () => this.renderList(),
      stock:     () => this.renderStock(),
      budget:    () => this.renderBudget(),
      profile:   () => this.renderProfile(),
      shopping:  () => this.renderShopping(),
      butcher:   () => this.renderButcher(),
      compare:   () => this.renderCompare(),
      recipes:   () => this.renderRecipes(),
      assistant: () => this.renderAssistant(),
      history:   () => this.renderHistory(),
    };
    if (renders[page]) renders[page]();
  },

  bindNav() {
    document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
      btn.addEventListener('click', () => this.navigate(btn.dataset.page));
    });
    document.querySelector('.nav-add-btn')?.addEventListener('click', () => this.openModal('modal-add-item'));
  },

  bindGlobalEvents() {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) this.closeModal(overlay.id);
      });
    });
  },

  /* ============================================================
     4. ACCUEIL — TABLEAU DE BORD
     ============================================================ */
  renderHome() {
    const c   = this.getBudgetCalc();
    const h   = this.state.household;
    const persons = this.getPersons();
    const listTotal = this.getListTotal();
    const listCount = this.state.list.length;
    const checkedCount = this.state.list.filter(i => i.checked).length;
    const expiring = this.getExpiringSoon();
    const lowStock = this.getLowStock();

    // Couleur barre de progression
    const barClass = c.pct >= 100 ? 'red blink' : c.pct >= 90 ? 'red' : c.pct >= 70 ? 'orange' : '';
    const tickerClass = c.pct >= 100 ? 'danger' : c.pct >= 90 ? 'warning' : '';

    // Phrase budget
    let phrase = '';
    if (c.total === 0) {
      phrase = '👉 Configurez votre budget pour commencer.';
    } else if (c.pct >= 100) {
      phrase = `🚨 Budget dépassé de <strong>${this.fmt(Math.abs(c.restant))}</strong> !`;
    } else if (c.pct >= 90) {
      phrase = `⚠️ Il reste seulement <strong>${this.fmt(c.restant)}</strong> — budget presque atteint.`;
    } else {
      phrase = `💚 Il vous reste <strong>${this.fmt(c.restant)}</strong> sur <strong>${this.fmt(c.disponible)}</strong> disponibles.`;
    }

    document.getElementById('home-content').innerHTML = `

      ${c.total === 0 ? `
        <div class="alert alert-orange" style="margin-top:10px">
          <span class="alert-icon">💡</span>
          <span>Aucun budget configuré. Appuyez sur <strong>Budget</strong> pour commencer.</span>
        </div>` : ''}

      <!-- Widget budget principal -->
      <div class="budget-widget">
        <div class="bw-row">
          <div>
            <div class="bw-label">💰 Budget disponible</div>
            <div class="bw-amount">${this.fmt(c.disponible)}</div>
            <div class="bw-sub">Budget total : ${this.fmt(c.total)} · Réserve : ${this.fmt(c.reserve)}</div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div class="bw-label">Dépensé</div>
            <div class="bw-amount" style="font-size:1.4rem">${this.fmt(c.totalDepenses)}</div>
            <div class="bw-sub" style="color:${c.restant < 0 ? '#ff8a80' : 'inherit'}">
              Reste : ${this.fmt(c.restant)}
            </div>
          </div>
        </div>
        <div class="progress-wrap" role="progressbar" aria-valuenow="${Math.round(c.pct)}" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-bar ${barClass}" style="width:${Math.min(100,c.pct)}%"></div>
        </div>
        <div class="bw-phrase">${phrase}</div>
      </div>

      <!-- Alertes -->
      ${c.pct >= 100 ? `<div class="alert alert-red"><span class="alert-icon">🚨</span><span>Budget dépassé ! Retirez des dépenses ou augmentez votre budget.</span></div>` : ''}
      ${c.pct >= 90 && c.pct < 100 ? `<div class="alert alert-orange"><span class="alert-icon">⚠️</span><span>Vous avez utilisé ${Math.round(c.pct)} % de votre budget disponible.</span></div>` : ''}
      ${expiring.length > 0 ? `<div class="alert alert-orange"><span class="alert-icon">⏰</span><span>${expiring.length} produit(s) bientôt périmé(s) dans votre stock.</span></div>` : ''}
      ${lowStock.length > 0 ? `<div class="alert alert-orange"><span class="alert-icon">📉</span><span>${lowStock.length} produit(s) en stock faible.</span></div>` : ''}

      <!-- Stats simples -->
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-icon">👥</span>
          <span class="stat-value">${persons}</span>
          <span class="stat-label">Personnes</span>
        </div>
        <div class="stat-card">
          <span class="stat-icon">📅</span>
          <span class="stat-value">${this.num(h.days)} j</span>
          <span class="stat-label">Durée prévue</span>
        </div>
        <div class="stat-card">
          <span class="stat-icon">🛒</span>
          <span class="stat-value">${listCount}</span>
          <span class="stat-label">Articles liste</span>
        </div>
        <div class="stat-card">
          <span class="stat-icon">✅</span>
          <span class="stat-value">${checkedCount}/${listCount}</span>
          <span class="stat-label">Cochés</span>
        </div>
      </div>

      <!-- Boutons principaux -->
      <div style="padding:0 14px;display:flex;flex-direction:column;gap:9px;margin-bottom:10px">
        <button class="btn btn-primary btn-lg btn-full" onclick="App.navigate('list')">
          🛒 Ma liste de courses
        </button>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px">
          <button class="btn btn-secondary btn-full" onclick="App.navigate('stock')">📦 Mon stock</button>
          <button class="btn btn-orange btn-full" onclick="App.navigate('shopping')">🏪 Mode courses</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px">
          <button class="btn btn-outline btn-full" onclick="App.navigate('butcher')">⚖️ Calculateur</button>
          <button class="btn btn-outline btn-full" onclick="App.navigate('recipes')">👨‍🍳 Recettes</button>
        </div>
      </div>

      <!-- Produits bientôt périmés -->
      ${expiring.length > 0 ? `
      <div class="card">
        <div class="card-title">⏰ Bientôt périmés</div>
        ${expiring.slice(0,3).map(i => `
          <div style="display:flex;align-items:center;gap:9px;padding:8px 0;border-bottom:1px solid var(--border)">
            <span style="font-size:1.1rem">${i.icon||'📦'}</span>
            <div style="flex:1">
              <div style="font-weight:600;font-size:0.88rem">${i.name}</div>
              <div class="${this.expiryStatus(i)==='urgent'?'expiry-urgent':'expiry-soon'}" style="font-size:0.72rem">${this.expiryLabel(i)}</div>
            </div>
          </div>`).join('')}
      </div>` : ''}
    `;
  },

  /* ============================================================
     5. BUDGET — REFAIT SIMPLEMENT
     ============================================================ */
  renderBudget() {
    const b = this.state.budget;
    const c = this.getBudgetCalc();
    const el = document.getElementById('budget-content');

    el.innerHTML = `
      <!-- Résumé en haut -->
      <div class="budget-widget" style="margin-top:10px">
        <div class="bw-row">
          <div>
            <div class="bw-label">Budget total</div>
            <div class="bw-amount">${this.fmt(c.total)}</div>
          </div>
          <div style="text-align:right">
            <div class="bw-label">Disponible (hors réserve)</div>
            <div class="bw-amount" style="font-size:1.4rem">${this.fmt(c.disponible)}</div>
          </div>
        </div>
        <div class="progress-wrap">
          <div class="progress-bar ${c.pct>=100?'red blink':c.pct>=90?'red':c.pct>=70?'orange':''}" style="width:${Math.min(100,c.pct)}%"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:0.82rem;opacity:0.9">
          <span>Dépensé : ${this.fmt(c.totalDepenses)}</span>
          <span>Reste : <strong>${this.fmt(c.restant)}</strong></span>
        </div>
      </div>

      <!-- Formulaire budget -->
      <div class="card">
        <div class="card-title">💰 Paramètres du budget</div>

        <div class="form-group">
          <label class="form-label" for="b-total">Budget total <span class="req">*</span></label>
          <div class="input-group">
            <input type="number" class="form-input" id="b-total"
              value="${c.total > 0 ? c.total : ''}"
              min="0" step="0.01" placeholder="Ex : 150"
              oninput="App.onBudgetInput()">
            <span class="input-addon">€</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="b-reserve">Réserve pour imprévus</label>
          <div class="input-group">
            <input type="number" class="form-input" id="b-reserve"
              value="${c.reserve > 0 ? c.reserve : ''}"
              min="0" step="0.01" placeholder="Ex : 20"
              oninput="App.onBudgetInput()">
            <span class="input-addon">€</span>
          </div>
          <div class="form-hint">Montant mis de côté — non utilisable pour les courses.</div>
        </div>

        <!-- Calcul en direct -->
        <div id="budget-live" style="background:var(--green-pale);border-radius:var(--radius-sm);padding:12px;margin-bottom:12px">
          ${this.renderBudgetLive(c)}
        </div>

        <button class="btn btn-primary btn-full btn-lg" onclick="App.saveBudgetParams()">
          💾 Enregistrer
        </button>
      </div>

      <!-- Dépenses -->
      <div class="card">
        <div class="card-title">💸 Mes dépenses</div>

        <!-- Formulaire ajout dépense -->
        <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
          <input type="text" class="form-input" id="dep-label" placeholder="Description (ex: Carrefour)" style="flex:2;min-width:120px">
          <div class="input-group" style="flex:1;min-width:90px">
            <input type="number" class="form-input" id="dep-montant" placeholder="0,00" min="0" step="0.01">
            <span class="input-addon">€</span>
          </div>
          <button class="btn btn-primary" onclick="App.addDepense()" style="flex-shrink:0">+ Ajouter</button>
        </div>

        <!-- Liste des dépenses -->
        <div id="depenses-list">
          ${this.renderDepenses()}
        </div>

        ${b.depenses.length === 0 ? `
          <div style="text-align:center;padding:16px;color:var(--text-muted);font-size:0.85rem">
            Aucune dépense enregistrée.
          </div>` : ''}

        <!-- Total dépenses -->
        ${b.depenses.length > 0 ? `
          <div style="display:flex;justify-content:space-between;padding:10px 0 0;border-top:2px solid var(--border);font-weight:700;margin-top:4px">
            <span>Total dépensé</span>
            <span style="color:var(--red)">${this.fmt(c.totalDepenses)}</span>
          </div>` : ''}
      </div>

      <!-- Bouton terminer les courses -->
      ${b.depenses.length > 0 ? `
      <div style="padding:0 14px 14px">
        <button class="btn btn-outline btn-full" onclick="App.terminerCourses()">
          📋 Enregistrer dans l'historique
        </button>
      </div>` : ''}
    `;
  },

  renderBudgetLive(c) {
    if (!c) c = this.getBudgetCalc();
    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div>
          <div style="font-size:0.72rem;color:var(--text-light)">Budget total</div>
          <div style="font-weight:800;font-size:1.05rem;color:var(--green)">${this.fmt(c.total)}</div>
        </div>
        <div>
          <div style="font-size:0.72rem;color:var(--text-light)">Réserve</div>
          <div style="font-weight:800;font-size:1.05rem">${this.fmt(c.reserve)}</div>
        </div>
        <div>
          <div style="font-size:0.72rem;color:var(--text-light)">Disponible (hors réserve)</div>
          <div style="font-weight:800;font-size:1.05rem;color:var(--green)">${this.fmt(c.disponible)}</div>
        </div>
        <div>
          <div style="font-size:0.72rem;color:var(--text-light)">Dépensé</div>
          <div style="font-weight:800;font-size:1.05rem;color:var(--red)">${this.fmt(c.totalDepenses)}</div>
        </div>
        <div style="grid-column:1/-1">
          <div style="font-size:0.72rem;color:var(--text-light)">Budget restant</div>
          <div style="font-weight:800;font-size:1.3rem;color:${c.restant < 0 ? 'var(--red)' : 'var(--green)'}">${this.fmt(c.restant)}</div>
        </div>
      </div>`;
  },

  onBudgetInput() {
    // Mise à jour en direct du résumé sans sauvegarder
    const total   = this.num(document.getElementById('b-total')?.value);
    const reserve = this.num(document.getElementById('b-reserve')?.value);
    const depenses = this.state.budget.depenses || [];
    const totalDep = depenses.reduce((s,d) => s + this.num(d.montant), 0);
    const disponible = Math.max(0, total - reserve);
    const restant    = disponible - totalDep;
    const pct        = disponible > 0 ? Math.min(100, (totalDep / disponible) * 100) : 0;
    const liveEl = document.getElementById('budget-live');
    if (liveEl) liveEl.innerHTML = this.renderBudgetLive({ total, reserve, disponible, totalDepenses: totalDep, restant, pct });
  },

  saveBudgetParams() {
    const total   = this.num(document.getElementById('b-total')?.value);
    const reserve = this.num(document.getElementById('b-reserve')?.value);
    if (total < 0) { this.toast('⚠️ Le budget ne peut pas être négatif.', 'error'); return; }
    if (reserve < 0) { this.toast('⚠️ La réserve ne peut pas être négative.', 'error'); return; }
    if (reserve > total && total > 0) { this.toast('⚠️ La réserve ne peut pas dépasser le budget total.', 'error'); return; }
    this.state.budget.total   = total;
    this.state.budget.reserve = reserve;
    this.save();
    this.toast('✅ Budget enregistré !', 'success');
    this.renderBudget();
    this.renderHome();
  },

  renderDepenses() {
    const deps = this.state.budget.depenses || [];
    if (deps.length === 0) return '';
    return deps.map(d => `
      <div class="depense-row" id="dep-${d.id}">
        <div style="flex:1;min-width:0">
          <div class="depense-label">${this.esc(d.label) || 'Dépense'}</div>
          <div class="depense-date">${this.formatDate(d.date)}</div>
        </div>
        <span class="depense-amount">− ${this.fmt(d.montant)}</span>
        <button class="depense-del" onclick="App.removeDepense('${d.id}')" aria-label="Supprimer cette dépense">🗑️</button>
      </div>`).join('');
  },

  addDepense() {
    const labelEl   = document.getElementById('dep-label');
    const montantEl = document.getElementById('dep-montant');
    const label   = labelEl?.value.trim() || 'Dépense';
    const montant = this.num(montantEl?.value);
    if (montant <= 0) { this.toast('⚠️ Saisissez un montant valide.', 'error'); return; }
    const dep = newDepense({ label, montant });
    this.state.budget.depenses.push(dep);
    this.save();
    if (labelEl)   labelEl.value   = '';
    if (montantEl) montantEl.value = '';
    this.renderBudget();
    this.renderHome();
    this.toast('✅ Dépense ajoutée.', 'success');
  },

  removeDepense(id) {
    if (!confirm('Supprimer cette dépense ?')) return;
    this.state.budget.depenses = this.state.budget.depenses.filter(d => d.id !== id);
    this.save();
    this.renderBudget();
    this.renderHome();
    this.toast('Dépense supprimée.', 'warning');
  },

  terminerCourses() {
    const c = this.getBudgetCalc();
    if (c.total === 0) { this.toast('⚠️ Configurez d\'abord un budget.', 'error'); return; }
    if (!confirm('Enregistrer ces courses dans l\'historique ?')) return;
    const entry = newHistoryEntry({
      budget:  c.disponible,
      spent:   c.totalDepenses,
      items:   this.state.list.filter(i => i.checked).length,
      persons: this.getPersons(),
      days:    this.num(this.state.household.days),
      label:   'Courses du ' + new Date().toLocaleDateString('fr-FR'),
    });
    this.state.history.unshift(entry);
    // Réinitialiser les dépenses après enregistrement
    this.state.budget.depenses = [];
    // Décocher tous les articles
    this.state.list.forEach(i => { i.checked = false; i.priceReal = null; });
    this.save();
    this.renderBudget();
    this.renderHome();
    this.toast('✅ Courses enregistrées dans l\'historique !', 'success');
  },

  /* ============================================================
     6. LISTE DE COURSES
     ============================================================ */
  renderList() {
    const list = this.state.list;
    const total = this.getListTotal();
    const c = this.getBudgetCalc();
    const pct = c.disponible > 0 ? Math.min(100, (total / c.disponible) * 100) : 0;
    const barClass = pct >= 100 ? 'red' : pct >= 90 ? 'red' : pct >= 70 ? 'orange' : '';

    // Grouper par rayon
    const byAisle = {};
    list.forEach(item => {
      const a = item.aisle || 'Divers';
      if (!byAisle[a]) byAisle[a] = [];
      byAisle[a].push(item);
    });

    document.getElementById('list-content').innerHTML = `
      <!-- Barre budget liste -->
      <div style="background:var(--white);padding:12px 14px;border-bottom:1px solid var(--border);position:sticky;top:56px;z-index:90">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-weight:700;font-size:0.9rem">Total estimé</span>
          <span style="font-size:1.15rem;font-weight:800;color:${pct>=100?'var(--red)':'var(--green)'}">${this.fmt(total)}</span>
        </div>
        <div class="bar-wrap">
          <div class="bar-fill ${barClass}" style="width:${Math.min(100,pct)}%"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--text-light);margin-top:3px">
          <span>${Math.round(pct)}% du budget disponible</span>
          <span>Reste : ${this.fmt(Math.max(0, c.disponible - total))}</span>
        </div>
      </div>

      <!-- Filtres -->
      <div style="display:flex;gap:7px;padding:9px 14px;overflow-x:auto">
        <button class="tag selected" id="f-all" onclick="App.filterList('all',this)">Tous (${list.length})</button>
        <button class="tag" id="f-1" onclick="App.filterList(1,this)">🔴 Indispensable</button>
        <button class="tag" id="f-2" onclick="App.filterList(2,this)">🟠 Utile</button>
        <button class="tag" id="f-3" onclick="App.filterList(3,this)">⚪ Facultatif</button>
      </div>

      ${list.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">📝</div>
          <h3>Liste vide</h3>
          <p>Appuyez sur + pour ajouter votre premier article.</p>
          <br>
          <button class="btn btn-primary" onclick="App.openModal('modal-add-item')">+ Ajouter un article</button>
        </div>` : ''}

      <div id="list-items">
        ${Object.entries(byAisle).map(([aisle, items]) => `
          <div class="section-title">${aisle}</div>
          <ul class="item-list">
            ${items.map(i => this.renderListItem(i)).join('')}
          </ul>`).join('')}
      </div>

      <div style="padding:10px 14px;display:flex;flex-direction:column;gap:8px">
        <button class="btn btn-primary btn-full" onclick="App.openModal('modal-add-item')">+ Ajouter un article</button>
        ${pct >= 90 ? `<button class="btn btn-orange btn-full" onclick="App.optimizeList()">💡 Optimiser pour le budget</button>` : ''}
      </div>
    `;
  },

  renderListItem(item) {
    const price = this.num(item.priceReal ?? item.priceEst);
    const isEst = item.priceReal === null || item.priceReal === undefined;
    return `
      <li class="item-row ${item.checked?'checked':''}" id="row-${item.id}">
        <button class="item-check ${item.checked?'checked':''}"
          onclick="App.toggleItem('${item.id}')"
          aria-label="${item.checked?'Décocher':'Cocher'} ${this.esc(item.name)}"
          aria-pressed="${item.checked}">
          ${item.checked ? '✓' : ''}
        </button>
        <div class="item-info">
          <div class="item-name">${this.esc(item.name)}</div>
          <div class="item-meta">${item.qty} ${item.unit}${item.alt ? ` · Alt: ${this.esc(item.alt)}` : ''}</div>
        </div>
        <span class="priority-badge p${item.priority}">
          ${item.priority===1?'Indispensable':item.priority===2?'Utile':'Facultatif'}
        </span>
        <div style="text-align:right;flex-shrink:0">
          <div class="item-price">${this.fmt(price)}</div>
          ${isEst?'<div style="font-size:0.62rem;color:var(--text-muted)">estimé</div>':''}
        </div>
        <button onclick="App.removeListItem('${item.id}')"
          style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1rem;padding:3px 5px;flex-shrink:0"
          aria-label="Supprimer ${this.esc(item.name)}">✕</button>
      </li>`;
  },

  toggleItem(id) {
    const item = this.state.list.find(i => i.id === id);
    if (!item) return;
    item.checked = !item.checked;
    if (item.checked) {
      const priceStr = prompt(
        `Prix réel de "${item.name}" ?\n(Laissez vide pour garder l'estimation : ${this.fmt(item.priceEst)})`,
        item.priceEst || ''
      );
      if (priceStr !== null && priceStr.trim() !== '') {
        const p = this.num(priceStr);
        if (p >= 0) item.priceReal = p;
      }
    } else {
      item.priceReal = null;
    }
    this.save();
    this.renderList();
    this.renderShopping();
    this.renderHome();
  },

  addListItem(item) {
    // Vérifier si déjà en stock en quantité suffisante
    const inStock = this.state.stock.find(s =>
      s.name.toLowerCase().trim() === item.name.toLowerCase().trim() && s.qty >= (item.qty || 1)
    );
    if (inStock) {
      if (!confirm(`"${item.name}" est déjà en stock (${inStock.qty} ${inStock.unit}). Ajouter quand même à la liste ?`)) return;
    }
    this.state.list.push(item);
    this.save();
    this.renderList();
    this.renderHome();
    this.toast('✅ Article ajouté à la liste.', 'success');
  },

  removeListItem(id) {
    if (!confirm('Retirer cet article de la liste ?')) return;
    this.state.list = this.state.list.filter(i => i.id !== id);
    this.save();
    this.renderList();
    this.renderHome();
  },

  filterList(priority, btn) {
    document.querySelectorAll('#list-content .tag').forEach(b => b.classList.remove('selected'));
    if (btn) btn.classList.add('selected');
    document.querySelectorAll('.item-row').forEach(row => {
      if (priority === 'all') { row.style.display = ''; return; }
      const id = row.id.replace('row-', '');
      const item = this.state.list.find(i => i.id === id);
      row.style.display = (item && item.priority === priority) ? '' : 'none';
    });
  },

  optimizeList() {
    const optional = this.state.list.filter(i => !i.checked && i.priority === 3);
    if (optional.length === 0) { this.toast('Aucun article facultatif à retirer.', 'warning'); return; }
    const names = optional.map(i => `• ${i.name} (${this.fmt(this.num(i.priceEst))})`).join('\n');
    if (confirm(`Pour respecter votre budget, vous pourriez retirer :\n\n${names}\n\nConfirmer ?`)) {
      optional.forEach(i => { this.state.list = this.state.list.filter(l => l.id !== i.id); });
      this.save();
      this.renderList();
      this.toast('✅ Articles facultatifs retirés.', 'success');
    }
  },

  /* ============================================================
     7. STOCK
     ============================================================ */
  renderStock() {
    const stock = this.state.stock;
    const byLoc = {};
    LOCATIONS.forEach(l => { byLoc[l.id] = []; });
    stock.forEach(i => {
      const loc = i.location || 'autre';
      if (!byLoc[loc]) byLoc[loc] = [];
      byLoc[loc].push(i);
    });

    document.getElementById('stock-content').innerHTML = `
      <div style="padding:9px 14px">
        <input type="search" class="form-input" id="stock-search"
          placeholder="🔍 Rechercher un produit…"
          oninput="App.filterStock(this.value)">
      </div>
      <div style="display:flex;gap:7px;padding:0 14px 9px;overflow-x:auto">
        <button class="tag selected" onclick="App.filterStockLoc('all',this)">Tout</button>
        ${LOCATIONS.map(l => `<button class="tag" onclick="App.filterStockLoc('${l.id}',this)">${l.icon} ${l.name}</button>`).join('')}
      </div>
      <div id="stock-list">
        ${LOCATIONS.map(loc => {
          const items = byLoc[loc.id];
          if (!items || items.length === 0) return '';
          return `
            <div class="section-title">${loc.icon} ${loc.name} (${items.length})</div>
            ${items.map(i => this.renderStockItem(i)).join('')}`;
        }).join('')}
        ${stock.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">📦</div>
            <h3>Stock vide</h3>
            <p>Ajoutez vos produits disponibles à la maison.</p>
          </div>` : ''}
      </div>
      <div style="padding:10px 14px">
        <button class="btn btn-primary btn-full" onclick="App.openModal('modal-add-stock')">+ Ajouter un produit au stock</button>
      </div>
    `;
  },

  renderStockItem(item) {
    const status = this.expiryStatus(item);
    const expiryClass = status === 'urgent' ? 'expiry-urgent' : status === 'soon' ? 'expiry-soon' : '';
    const low = item.qty <= item.minQty;
    return `
      <div class="stock-item" id="stock-${item.id}">
        <span class="stock-icon">${item.icon||'📦'}</span>
        <div class="stock-info">
          <div class="stock-name">${this.esc(item.name)}${item.brand ? ` <span style="font-weight:400;color:var(--text-muted);font-size:0.78rem">${this.esc(item.brand)}</span>` : ''}</div>
          <div class="stock-meta">
            ${this.locationName(item.location)}
            ${item.expiryDate ? ` · <span class="${expiryClass}">${this.expiryLabel(item)}</span>` : ''}
            ${low ? ` · <span style="color:var(--orange);font-weight:600">⚠️ Stock faible</span>` : ''}
          </div>
        </div>
        <div class="stock-qty">
          <button class="qty-btn" onclick="App.updateStockQty('${item.id}',-1)" aria-label="Diminuer">−</button>
          <span class="qty-val">${item.qty}<br><span style="font-size:0.62rem;color:var(--text-muted)">${item.unit}</span></span>
          <button class="qty-btn" onclick="App.updateStockQty('${item.id}',1)" aria-label="Augmenter">+</button>
        </div>
        <button onclick="App.removeFromStock('${item.id}')"
          style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:0.95rem;padding:3px 5px;flex-shrink:0"
          aria-label="Supprimer ${this.esc(item.name)}">🗑️</button>
      </div>`;
  },

  updateStockQty(id, delta) {
    const item = this.state.stock.find(i => i.id === id);
    if (!item) return;
    item.qty = Math.max(0, item.qty + delta);
    this.save();
    this.renderStock();
    this.renderHome();
  },

  removeFromStock(id) {
    if (!confirm('Supprimer ce produit du stock ?')) return;
    this.state.stock = this.state.stock.filter(i => i.id !== id);
    this.save();
    this.renderStock();
    this.renderHome();
    this.toast('Produit supprimé du stock.', 'warning');
  },

  filterStock(query) {
    const q = query.toLowerCase();
    document.querySelectorAll('.stock-item').forEach(el => {
      const name = el.querySelector('.stock-name')?.textContent.toLowerCase() || '';
      el.style.display = name.includes(q) ? '' : 'none';
    });
  },

  filterStockLoc(loc, btn) {
    document.querySelectorAll('#stock-content .tag').forEach(b => b.classList.remove('selected'));
    if (btn) btn.classList.add('selected');
    document.querySelectorAll('.stock-item').forEach(el => {
      if (loc === 'all') { el.style.display = ''; return; }
      const id = el.id.replace('stock-', '');
      const item = this.state.stock.find(i => i.id === id);
      el.style.display = (item && item.location === loc) ? '' : 'none';
    });
  },

  getExpiringSoon() {
    return this.state.stock.filter(i => {
      const s = this.expiryStatus(i);
      return s === 'urgent' || s === 'soon';
    }).sort((a,b) => new Date(a.expiryDate) - new Date(b.expiryDate));
  },

  getLowStock() {
    return this.state.stock.filter(i => i.qty <= i.minQty);
  },

  /* ============================================================
     8. MODE COURSES
     ============================================================ */
  renderShopping() {
    const list = this.state.list;
    const checkedTotal = this.getCheckedTotal();
    const c = this.getBudgetCalc();
    const pct = c.disponible > 0 ? Math.min(100, (checkedTotal / c.disponible) * 100) : 0;
    const tickerClass = pct >= 100 ? 'danger' : pct >= 90 ? 'warning' : '';

    const byAisle = {};
    list.forEach(item => {
      const a = item.aisle || 'Divers';
      if (!byAisle[a]) byAisle[a] = [];
      byAisle[a].push(item);
    });

    document.getElementById('shopping-content').innerHTML = `
      <div class="budget-ticker ${tickerClass}" role="status" aria-live="polite">
        <div>
          <div class="ticker-label">Budget disponible : ${this.fmt(c.disponible)}</div>
          <div class="ticker-label">Total actuel : ${this.fmt(checkedTotal)}</div>
        </div>
        <div style="text-align:right">
          <div class="ticker-label">Reste</div>
          <div class="ticker-val">${this.fmt(Math.max(0, c.disponible - checkedTotal))}</div>
        </div>
      </div>
      <div style="padding:7px 14px;background:var(--white);border-bottom:1px solid var(--border)">
        <div class="bar-wrap">
          <div class="bar-fill ${pct>=100?'red blink':pct>=90?'red':pct>=70?'orange':''}" style="width:${Math.min(100,pct)}%"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--text-light);margin-top:3px">
          <span>${list.filter(i=>i.checked).length} / ${list.length} articles cochés</span>
          <span>${Math.round(pct)}% du budget</span>
        </div>
      </div>

      ${list.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">🛒</div>
          <h3>Liste vide</h3>
          <p>Ajoutez des articles dans l'onglet Liste.</p>
        </div>` : ''}

      <div style="padding-bottom:8px">
        ${Object.entries(byAisle).map(([aisle, items]) => `
          <div class="section-title">${aisle}</div>
          <ul class="item-list">
            ${items.map(i => this.renderShoppingItem(i)).join('')}
          </ul>`).join('')}
      </div>

      <div style="padding:10px 14px">
        <button class="btn btn-orange btn-full btn-lg" onclick="App.navigate('butcher')">
          ⚖️ Combien de grammes pour mon budget ?
        </button>
      </div>
    `;
  },

  renderShoppingItem(item) {
    const price = this.num(item.priceReal ?? item.priceEst);
    const isEst = item.priceReal === null || item.priceReal === undefined;
    return `
      <li class="item-row ${item.checked?'checked':''}" style="padding:13px 14px">
        <button class="item-check ${item.checked?'checked':''}"
          onclick="App.toggleItem('${item.id}')"
          style="width:34px;height:34px;font-size:1rem">
          ${item.checked ? '✓' : ''}
        </button>
        <div class="item-info">
          <div class="item-name" style="font-size:0.98rem">${this.esc(item.name)}</div>
          <div class="item-meta">${item.qty} ${item.unit}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <input type="number" value="${price.toFixed(2)}" min="0" step="0.01"
            style="width:70px;padding:5px 7px;border:2px solid var(--border);border-radius:8px;text-align:right;font-weight:700;font-size:0.88rem;background:var(--white);color:var(--text)"
            onchange="App.updateItemPrice('${item.id}',this.value)"
            aria-label="Prix de ${this.esc(item.name)}">
          ${isEst?'<div style="font-size:0.62rem;color:var(--text-muted)">estimé</div>':''}
        </div>
      </li>`;
  },

  updateItemPrice(id, val) {
    const item = this.state.list.find(i => i.id === id);
    if (!item) return;
    const p = this.num(val);
    if (p < 0) { this.toast('⚠️ Le prix ne peut pas être négatif.', 'error'); return; }
    item.priceReal = p;
    this.save();
    this.renderShopping();
    this.renderHome();
  },

  /* ============================================================
     9. CALCULATEUR BOUCHER
     ============================================================ */
  renderButcher() {
    document.getElementById('butcher-content').innerHTML = `
      <div class="card">
        <div class="card-title">💰 Budget → Grammes</div>
        <div class="form-group">
          <label class="form-label">Prix au kilogramme (€/kg)</label>
          <div class="input-group">
            <input type="number" class="form-input" id="b-price-kg" placeholder="Ex : 24,00" min="0" step="0.01" oninput="App.calcButcher()">
            <span class="input-addon">€/kg</span>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Mon budget maximum</label>
          <div class="input-group">
            <input type="number" class="form-input" id="b-budget-max" placeholder="Ex : 8,00" min="0" step="0.01" oninput="App.calcButcher()">
            <span class="input-addon">€</span>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Arrondi</label>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px">
            ${[{v:'10',l:'10 g'},{v:'50',l:'50 g'},{v:'portion',l:'Portion'},{v:'exact',l:'Exact'}].map(r =>
              `<button class="tag ${r.v==='10'?'selected':''}" data-round="${r.v}" onclick="App.setRound('${r.v}')">${r.l}</button>`
            ).join('')}
          </div>
        </div>
        <div class="calc-display" id="butcher-display">
          <div class="calc-result" id="butcher-grams">—</div>
          <div class="calc-unit">grammes</div>
        </div>
        <div class="calc-phrase" id="butcher-phrase">Saisissez le prix et votre budget.</div>
        <button class="btn btn-primary btn-full" id="btn-big" onclick="App.showBigDisplay()" style="display:none;margin-top:8px">
          📺 Afficher en grand
        </button>
      </div>

      <div class="card">
        <div class="card-title">⚖️ Grammes → Prix</div>
        <div class="form-group">
          <label class="form-label">Prix au kilogramme (€/kg)</label>
          <div class="input-group">
            <input type="number" class="form-input" id="b2-price-kg" placeholder="Ex : 24,00" min="0" step="0.01" oninput="App.calcButcher2()">
            <span class="input-addon">€/kg</span>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Poids souhaité (grammes)</label>
          <div class="input-group">
            <input type="number" class="form-input" id="b2-grams" placeholder="Ex : 350" min="0" step="10" oninput="App.calcButcher2()">
            <span class="input-addon">g</span>
          </div>
        </div>
        <div class="calc-display">
          <div class="calc-result" id="butcher2-price">—</div>
          <div class="calc-unit">euros estimés</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">⚡ Raccourcis</div>
        <div class="shortcut-grid">
          ${BUTCHER_SHORTCUTS.map(s =>
            `<button class="shortcut-btn" onclick="App.applyShortcut(${s.priceKg})">${s.label}<br><span style="font-size:0.68rem;color:var(--text-muted)">~${s.priceKg}€/kg</span></button>`
          ).join('')}
        </div>
      </div>
    `;
    this._roundMode = '10';
  },

  _roundMode: '10',
  _lastPhrase: '',

  setRound(mode) {
    this._roundMode = mode;
    document.querySelectorAll('[data-round]').forEach(b => b.classList.toggle('selected', b.dataset.round === mode));
    this.calcButcher();
  },

  calcButcher() {
    const priceKg = this.num(document.getElementById('b-price-kg')?.value);
    const budget  = this.num(document.getElementById('b-budget-max')?.value);
    const gramsEl  = document.getElementById('butcher-grams');
    const phraseEl = document.getElementById('butcher-phrase');
    const btnBig   = document.getElementById('btn-big');
    if (!priceKg || priceKg <= 0 || !budget || budget <= 0) {
      if (gramsEl)  gramsEl.textContent  = '—';
      if (phraseEl) phraseEl.textContent = 'Saisissez le prix et votre budget.';
      if (btnBig)   btnBig.style.display = 'none';
      return;
    }
    const raw     = (budget / priceKg) * 1000;
    const rounded = this.roundGrams(raw, this._roundMode);
    if (gramsEl)  gramsEl.textContent = rounded;
    const phrase = `Bonjour, je voudrais environ ${rounded} grammes, s'il vous plaît.`;
    if (phraseEl) phraseEl.textContent = phrase;
    this._lastPhrase = phrase;
    if (btnBig) btnBig.style.display = '';
  },

  calcButcher2() {
    const priceKg = this.num(document.getElementById('b2-price-kg')?.value);
    const grams   = this.num(document.getElementById('b2-grams')?.value);
    const el = document.getElementById('butcher2-price');
    if (!priceKg || priceKg <= 0 || !grams || grams <= 0) {
      if (el) el.textContent = '—'; return;
    }
    const price = (grams / 1000) * priceKg;
    if (el) el.textContent = price.toFixed(2) + ' €';
  },

  roundGrams(g, mode) {
    if (mode === 'exact')   return Math.floor(g);
    if (mode === '10')      return Math.floor(g / 10) * 10;
    if (mode === '50')      return Math.floor(g / 50) * 50;
    if (mode === 'portion') {
      const p = [100,125,150,175,200,250,300,350,400,500];
      return p.filter(x => x <= g).pop() || Math.floor(g);
    }
    return Math.floor(g / 10) * 10;
  },

  applyShortcut(priceKg) {
    const el  = document.getElementById('b-price-kg');
    const el2 = document.getElementById('b2-price-kg');
    if (el)  el.value  = priceKg;
    if (el2) el2.value = priceKg;
    document.querySelectorAll('.shortcut-btn').forEach(b => b.classList.remove('active'));
    event?.target?.closest('.shortcut-btn')?.classList.add('active');
    this.calcButcher();
  },

  showBigDisplay() {
    document.getElementById('big-phrase-text').textContent = this._lastPhrase || '—';
    this.openModal('modal-big');
  },

  /* ============================================================
     10. COMPARATEUR DE PRIX
     ============================================================ */
  renderCompare() {
    document.getElementById('compare-content').innerHTML = `
      <div class="card">
        <div class="card-title">🔍 Comparer jusqu'à 3 produits</div>
        <p style="font-size:0.82rem;color:var(--text-light);margin-bottom:12px">Trouvez le meilleur rapport qualité/prix.</p>
        ${[1,2,3].map(n => `
          <div style="background:var(--beige);border-radius:var(--radius-sm);padding:11px;margin-bottom:9px">
            <div style="font-weight:700;margin-bottom:7px;font-size:0.85rem">Produit ${n}</div>
            <input type="text" class="form-input" id="cp${n}-name" placeholder="Nom (ex : Yaourt nature)" style="margin-bottom:6px">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
              <div>
                <label class="form-label" style="font-size:0.72rem">Prix (€)</label>
                <input type="number" class="form-input" id="cp${n}-price" placeholder="2,50" min="0" step="0.01" oninput="App.calcCompare()">
              </div>
              <div>
                <label class="form-label" style="font-size:0.72rem">Quantité</label>
                <input type="number" class="form-input" id="cp${n}-qty" placeholder="500" min="0" oninput="App.calcCompare()">
              </div>
              <div>
                <label class="form-label" style="font-size:0.72rem">Unité</label>
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
              <label class="form-label" style="font-size:0.72rem">Promotion</label>
              <select class="form-select" id="cp${n}-promo" onchange="App.calcCompare()">
                <option value="none">Aucune</option>
                <option value="2for3">2 achetés = 3ème offert</option>
                <option value="50pct">2ème à −50%</option>
                <option value="10pct">−10%</option>
                <option value="20pct">−20%</option>
                <option value="30pct">−30%</option>
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
      const price = this.num(document.getElementById(`cp${n}-price`)?.value);
      const qty   = this.num(document.getElementById(`cp${n}-qty`)?.value);
      const unit  = document.getElementById(`cp${n}-unit`)?.value || 'g';
      const promo = document.getElementById(`cp${n}-promo`)?.value || 'none';
      if (!price || !qty) return null;
      let ep = price;
      if (promo==='2for3') ep = (price*2)/3;
      else if (promo==='50pct') ep = (price+price*0.5)/2;
      else if (promo==='10pct') ep = price*0.9;
      else if (promo==='20pct') ep = price*0.8;
      else if (promo==='30pct') ep = price*0.7;
      let ref = Infinity;
      let refLabel = '';
      if (unit==='g')  { ref = (ep/qty)*100;  refLabel = '€/100g'; }
      else if (unit==='kg') { ref = (ep/qty);  refLabel = '€/kg'; }
      else if (unit==='mL') { ref = (ep/qty)*100; refLabel = '€/100mL'; }
      else if (unit==='L')  { ref = (ep/qty);  refLabel = '€/L'; }
      else { ref = ep/qty; refLabel = '€/unité'; }
      return { name, price, ep, qty, unit, promo, ref, refLabel };
    }).filter(Boolean);

    if (products.length < 2) { document.getElementById('compare-results').innerHTML = ''; return; }

    const minRef  = Math.min(...products.map(p => p.ref));
    const bestIdx = products.findIndex(p => p.ref === minRef);

    document.getElementById('compare-results').innerHTML = `
      <div class="section-title">Résultats</div>
      <div style="display:flex;flex-direction:column;gap:9px;padding:0 14px 14px">
        ${products.map((p,i) => {
          const isBest = i === bestIdx;
          const saving = !isBest ? ((p.ref - minRef) / p.ref * 100).toFixed(0) : null;
          return `
            <div class="compare-card ${isBest?'best':''}">
              ${isBest ? '<div class="best-badge">✅ Meilleur prix</div>' : ''}
              <div style="font-weight:700;margin-bottom:5px">${this.esc(p.name)}</div>
              <div class="compare-price-unit">${p.ref.toFixed(2)} ${p.refLabel}</div>
              <div class="compare-detail">
                Prix : ${this.fmt(p.price)}${p.promo!=='none'?` → après promo : ${this.fmt(p.ep)}`:''}
                · ${p.qty} ${p.unit}
              </div>
              ${saving ? `<div style="color:var(--orange);font-size:0.78rem;margin-top:3px">⚠️ ${saving}% plus cher que le meilleur prix</div>` : ''}
            </div>`;
        }).join('')}
      </div>`;
  },

  /* ============================================================
     11. RECETTES
     ============================================================ */
  renderRecipes() {
    document.getElementById('recipes-content').innerHTML = `
      <div style="padding:9px 14px">
        <input type="search" class="form-input" placeholder="🔍 Rechercher une recette…" oninput="App.filterRecipes(this.value)">
      </div>
      <div style="display:flex;gap:7px;padding:0 14px 9px;overflow-x:auto">
        ${['Toutes','Économique','Végétarien','Rapide','Anti-gaspi'].map((t,i) =>
          `<button class="tag ${i===0?'selected':''}" onclick="App.filterRecipeTag('${t}',this)">${t}</button>`
        ).join('')}
      </div>
      <div id="recipes-list">
        ${DEMO_RECIPES.map(r => this.renderRecipeCard(r)).join('')}
      </div>
    `;
  },

  renderRecipeCard(r) {
    return `
      <div class="recipe-card" data-tags="${r.tags.join(',')}">
        <div class="recipe-header">
          <span class="recipe-emoji">${r.emoji}</span>
          <div style="flex:1">
            <div class="recipe-title">${r.name}</div>
            <div class="recipe-meta">⏱ ${r.time} min · 👥 ${r.portions} portions</div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div class="recipe-cost">${this.fmt(r.costTotal)}</div>
            <div style="font-size:0.7rem;color:var(--text-light)">${this.fmt(r.costPer)}/pers.</div>
          </div>
        </div>
        <div class="recipe-body">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:9px">
            <div>
              <div style="font-size:0.72rem;font-weight:700;color:var(--green);margin-bottom:3px">✅ En stock</div>
              ${r.inStock.map(i => `<div style="font-size:0.78rem">• ${i}</div>`).join('')}
            </div>
            <div>
              <div style="font-size:0.72rem;font-weight:700;color:var(--orange);margin-bottom:3px">🛒 À acheter</div>
              ${r.toBuy.map(i => `<div style="font-size:0.78rem">• ${i}</div>`).join('')}
            </div>
          </div>
          <div class="recipe-tags">
            ${r.tags.map(t => `<span class="badge badge-green">${t}</span>`).join('')}
          </div>
          <button class="btn btn-outline btn-sm btn-full" style="margin-top:9px" onclick="App.showRecipeDetail('${r.id}')">
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
    if (btn) btn.classList.add('selected');
    document.querySelectorAll('.recipe-card').forEach(el => {
      if (tag === 'Toutes') { el.style.display = ''; return; }
      el.style.display = (el.dataset.tags||'').toLowerCase().includes(tag.toLowerCase()) ? '' : 'none';
    });
  },

  showRecipeDetail(id) {
    const r = DEMO_RECIPES.find(x => x.id === id);
    if (!r) return;
    document.getElementById('recipe-detail-content').innerHTML = `
      <div style="text-align:center;margin-bottom:14px">
        <div style="font-size:2.8rem">${r.emoji}</div>
        <h2 style="font-size:1.1rem;margin-top:7px">${r.name}</h2>
        <div style="color:var(--text-light);font-size:0.82rem">⏱ ${r.time} min · 👥 ${r.portions} portions · ${this.fmt(r.costTotal)} (${this.fmt(r.costPer)}/pers.)</div>
      </div>
      <div style="margin-bottom:12px">
        <div style="font-weight:700;margin-bottom:5px">✅ Ingrédients en stock</div>
        ${r.inStock.map(i => `<div style="padding:3px 0;border-bottom:1px solid var(--border);font-size:0.88rem">• ${i}</div>`).join('')}
      </div>
      <div style="margin-bottom:12px">
        <div style="font-weight:700;margin-bottom:5px;color:var(--orange)">🛒 À acheter</div>
        ${r.toBuy.map(i => `<div style="padding:3px 0;border-bottom:1px solid var(--border);font-size:0.88rem">• ${i}</div>`).join('')}
      </div>
      <div style="margin-bottom:12px">
        <div style="font-weight:700;margin-bottom:7px">📋 Préparation</div>
        ${r.steps.map((s,i) => `
          <div style="display:flex;gap:9px;padding:7px 0;border-bottom:1px solid var(--border)">
            <span style="background:var(--green);color:#fff;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:700;flex-shrink:0">${i+1}</span>
            <span style="font-size:0.88rem">${s}</span>
          </div>`).join('')}
      </div>
      ${r.leftovers ? `<div class="alert alert-green"><span class="alert-icon">♻️</span><span>${r.leftovers}</span></div>` : ''}
      <button class="btn btn-primary btn-full" style="margin-top:10px" onclick="App.addRecipeToList('${r.id}')">
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
      const clean = name.replace(/\s*\(.*\)/, '').trim();
      const exists = this.state.list.find(i => i.name.toLowerCase().includes(clean.toLowerCase()));
      if (!exists) {
        this.state.list.push(newListItem({ name: clean, priority: 1, essential: true, aisle: 'Épicerie' }));
        added++;
      }
    });
    this.save();
    this.closeModal('modal-recipe');
    this.toast(`✅ ${added} ingrédient(s) ajouté(s) à la liste.`, 'success');
    this.navigate('list');
  },

  /* ============================================================
     12. ASSISTANT
     ============================================================ */
  renderAssistant() {
    const el = document.getElementById('assistant-content');
    if (el.querySelector('.chat-wrap')) return;
    el.innerHTML = `
      <div class="chat-wrap">
        <div class="chat-messages" id="chat-messages">
          <div class="chat-bubble bot">
            👋 Bonjour ! Je suis votre assistant budget courses.<br><br>
            Je peux vous aider à :<br>
            • Calculer des grammes selon votre budget<br>
            • Vérifier votre budget restant<br>
            • Trouver des recettes économiques<br>
            • Voir les produits bientôt périmés<br><br>
            Que puis-je faire pour vous ?
          </div>
        </div>
        <div class="chat-suggestions">
          ${[
            'Il me reste combien ?',
            'Quels produits vont bientôt périmer ?',
            'Combien de grammes de poulet à 13,90€/kg pour 6€ ?',
            'Propose des recettes végétariennes',
            'Remplace le saumon par quelque chose de moins cher',
          ].map(s => `<button class="chat-sug" onclick="App.sendChat('${s.replace(/'/g,"\\'")}')">${s}</button>`).join('')}
        </div>
        <div class="chat-input-wrap">
          <input type="text" class="chat-input" id="chat-input"
            placeholder="Posez votre question…"
            onkeydown="if(event.key==='Enter')App.sendChat()">
          <button class="chat-send" onclick="App.sendChat()" aria-label="Envoyer">➤</button>
        </div>
      </div>`;
  },

  sendChat(text) {
    const input = document.getElementById('chat-input');
    const msg = text || (input ? input.value.trim() : '');
    if (!msg) return;
    if (input) input.value = '';
    this.appendChat(msg, 'user');
    setTimeout(() => this.appendChat(this.processChat(msg), 'bot'), 350);
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
    const c = this.getBudgetCalc();

    // Calcul grammes
    const pkgMatch = m.match(/(\d+[,.]?\d*)\s*(?:€\s*)?(?:le\s*)?(?:kilo|kg)/);
    const budMatch = m.match(/(?:budget|pour)\s*(?:de\s*)?(\d+[,.]?\d*)\s*€/);
    if ((m.includes('gramme') || m.includes('kilo')) && pkgMatch && budMatch) {
      const priceKg = this.num(pkgMatch[1]);
      const budget  = this.num(budMatch[1]);
      if (priceKg > 0 && budget > 0) {
        const grams = this.roundGrams((budget / priceKg) * 1000, '10');
        return `⚖️ Avec <strong>${this.fmt(budget)}</strong> à <strong>${this.fmt(priceKg)}/kg</strong>, vous pouvez demander environ <strong>${grams} grammes</strong>.<br><br>💬 <em>"Bonjour, je voudrais environ ${grams} grammes, s'il vous plaît."</em>`;
      }
    }

    // Budget restant
    if (m.includes('reste') || m.includes('budget')) {
      if (c.total === 0) return '⚠️ Vous n\'avez pas encore configuré de budget. Allez dans l\'onglet <strong>Budget</strong>.';
      return `💰 Budget total : <strong>${this.fmt(c.total)}</strong><br>Réserve : <strong>${this.fmt(c.reserve)}</strong><br>Disponible : <strong>${this.fmt(c.disponible)}</strong><br>Dépensé : <strong>${this.fmt(c.totalDepenses)}</strong><br>Reste : <strong style="color:${c.restant<0?'#ff4444':'#4a7c59'}">${this.fmt(c.restant)}</strong>`;
    }

    // Produits périmés
    if (m.includes('périm') || m.includes('expir')) {
      const exp = this.getExpiringSoon();
      if (exp.length === 0) return '✅ Aucun produit ne périme prochainement. Bravo !';
      return `⏰ Produits bientôt périmés :<br><br>${exp.map(i => `• <strong>${i.name}</strong> — ${this.expiryLabel(i)}`).join('<br>')}`;
    }

    // Recettes végétariennes
    if (m.includes('végétar') || m.includes('vegetar')) {
      const veg = DEMO_RECIPES.filter(r => r.tags.includes('végétarien'));
      return `🥗 Recettes végétariennes :<br><br>${veg.map(r => `• <strong>${r.emoji} ${r.name}</strong> — ${this.fmt(r.costPer)}/pers. (${r.time} min)`).join('<br>')}`;
    }

    // Remplacer produit
    if (m.includes('remplace') || m.includes('moins cher') || m.includes('alternative')) {
      return `💡 Alternatives économiques :<br><br>• 🐟 Saumon → Thon en boîte (économie ~4€)<br>• 🥩 Bœuf → Poulet ou œufs (économie ~3€)<br>• 🧀 Fromage AOP → Fromage MDD (économie ~2€)<br>• 🥛 Lait bio → Lait standard (économie ~0,50€)`;
    }

    return `🤔 Je peux vous aider avec :<br><br>• <strong>Grammes</strong> : "Combien de grammes de bœuf à 18€/kg pour 7€ ?"<br>• <strong>Budget</strong> : "Il me reste combien ?"<br>• <strong>Péremptions</strong> : "Quels produits vont périmer ?"<br>• <strong>Recettes</strong> : "Recettes végétariennes"`;
  },

  /* ============================================================
     13. HISTORIQUE — ZÉRO FAUSSE DONNÉE
     ============================================================ */
  renderHistory() {
    const history = this.state.history;
    const el = document.getElementById('history-content');

    if (history.length === 0) {
      el.innerHTML = `
        <div class="empty-state" style="padding-top:60px">
          <div class="empty-icon">📋</div>
          <h3>Aucun historique</h3>
          <p>Vos courses apparaîtront ici après avoir appuyé sur<br><strong>"Enregistrer dans l'historique"</strong> dans l'onglet Budget.</p>
        </div>`;
      return;
    }

    const totalSaved = history.reduce((s,h) => s + Math.max(0, h.budget - h.spent), 0);
    const avgSpent   = history.reduce((s,h) => s + h.spent, 0) / history.length;

    el.innerHTML = `
      <div class="stats-grid" style="margin-top:10px">
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
      ${history.map(h => {
        const saved = h.budget - h.spent;
        const pct   = h.budget > 0 ? Math.round((h.spent / h.budget) * 100) : 0;
        return `
          <div class="history-row">
            <div class="history-date">${this.formatDate(h.date)}</div>
            <div class="history-info">
              <div class="history-title">${this.esc(h.label)}</div>
              <div class="history-sub">${h.persons} pers. · ${h.days} j · ${h.items} articles</div>
              <div style="margin-top:3px">
                <div class="bar-wrap" style="height:4px">
                  <div class="bar-fill ${pct>=100?'red':pct>=90?'red':pct>=70?'orange':''}" style="width:${Math.min(100,pct)}%"></div>
                </div>
              </div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div class="history-amount">${this.fmt(h.spent)}</div>
              <div style="font-size:0.7rem;color:${saved>=0?'var(--green)':'var(--red)'}">
                ${saved>=0 ? `économisé ${this.fmt(saved)}` : `dépassé ${this.fmt(Math.abs(saved))}`}
              </div>
            </div>
          </div>`;
      }).join('')}
    `;
  },

  /* ============================================================
     14. PROFIL — AFFICHAGE CORRIGÉ MOBILE
     ============================================================ */
  renderProfile() {
    const s = this.state.settings;
    const h = this.state.household;
    document.getElementById('profile-content').innerHTML = `
      <div class="card">
        <div class="card-title">🏠 Mon foyer</div>
        <div class="form-group">
          <label class="form-label" for="hh-name">Nom du foyer</label>
          <input type="text" class="form-input" id="hh-name" value="${this.esc(h.name)}" onchange="App.saveHousehold()">
        </div>
        <div class="form-group">
          <label class="form-label" for="hh-days">Durée habituelle des courses (jours)</label>
          <input type="number" class="form-input" id="hh-days" value="${h.days||7}" min="1" max="90" onchange="App.saveHousehold()">
        </div>
        <div class="form-group">
          <label class="form-label" for="hh-store">Magasin principal</label>
          <select class="form-select" id="hh-store" onchange="App.saveHousehold()">
            ${STORES.map(s => `<option value="${s}" ${h.store===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>

        <!-- Composition foyer — 3 colonnes fixes, responsive -->
        <label class="form-label">Composition du foyer</label>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:4px">
          <div style="text-align:center">
            <div style="font-size:0.78rem;font-weight:600;margin-bottom:6px;color:var(--text-light)">👨‍👩 Adultes</div>
            <div class="stepper" style="justify-content:center">
              <button class="stepper-btn" onclick="App.stepHH('adults',-1)" aria-label="Moins d'adultes">−</button>
              <div class="stepper-val"><input type="number" id="hh-adults" value="${h.adults||1}" min="0" max="20" onchange="App.saveHousehold()" style="width:36px"></div>
              <button class="stepper-btn" onclick="App.stepHH('adults',1)" aria-label="Plus d'adultes">+</button>
            </div>
          </div>
          <div style="text-align:center">
            <div style="font-size:0.78rem;font-weight:600;margin-bottom:6px;color:var(--text-light)">👧 Enfants</div>
            <div class="stepper" style="justify-content:center">
              <button class="stepper-btn" onclick="App.stepHH('children',-1)" aria-label="Moins d'enfants">−</button>
              <div class="stepper-val"><input type="number" id="hh-children" value="${h.children||0}" min="0" max="20" onchange="App.saveHousehold()" style="width:36px"></div>
              <button class="stepper-btn" onclick="App.stepHH('children',1)" aria-label="Plus d'enfants">+</button>
            </div>
          </div>
          <div style="text-align:center">
            <div style="font-size:0.78rem;font-weight:600;margin-bottom:6px;color:var(--text-light)">👶 Bébés</div>
            <div class="stepper" style="justify-content:center">
              <button class="stepper-btn" onclick="App.stepHH('babies',-1)" aria-label="Moins de bébés">−</button>
              <div class="stepper-val"><input type="number" id="hh-babies" value="${h.babies||0}" min="0" max="10" onchange="App.saveHousehold()" style="width:36px"></div>
              <button class="stepper-btn" onclick="App.stepHH('babies',1)" aria-label="Plus de bébés">+</button>
            </div>
          </div>
        </div>
        <button class="btn btn-primary btn-full" style="margin-top:14px" onclick="App.saveHousehold()">💾 Enregistrer le profil</button>
      </div>

      <div class="card">
        <div class="card-title">⚙️ Apparence</div>
        <div class="switch-row">
          <span class="switch-label">🌙 Mode sombre</span>
          <div class="switch ${s.darkMode?'on':''}" role="switch" aria-checked="${s.darkMode}" tabindex="0"
            onclick="App.toggleDark()" onkeydown="if(event.key==='Enter'||event.key===' ')App.toggleDark()"></div>
        </div>
        <div class="divider"></div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Taille du texte</label>
          <div class="tag-group">
            ${[{v:'sm',l:'Petit'},{v:'normal',l:'Normal'},{v:'lg',l:'Grand'},{v:'xl',l:'Très grand'}].map(t =>
              `<button class="tag ${s.fontSize===t.v?'selected':''}" onclick="App.setFontSize('${t.v}')">${t.l}</button>`
            ).join('')}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">🧭 Accès rapide</div>
        <div style="display:flex;flex-direction:column;gap:7px">
          ${[
            {icon:'⚖️', label:'Calculateur poids/grammes', page:'butcher'},
            {icon:'🔍', label:'Comparateur de prix',       page:'compare'},
            {icon:'👨‍🍳', label:'Recettes économiques',     page:'recipes'},
            {icon:'🤖', label:'Assistant intelligent',     page:'assistant'},
            {icon:'📋', label:'Historique des courses',    page:'history'},
          ].map(item => `
            <button class="btn btn-secondary btn-full" onclick="App.navigate('${item.page}')"
              style="justify-content:flex-start;gap:10px">
              <span style="font-size:1.1rem">${item.icon}</span> ${item.label}
            </button>`).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-title">🗑️ Réinitialisation</div>
        <p style="font-size:0.82rem;color:var(--text-light);margin-bottom:12px">
          Supprime toutes vos données : budget, dépenses, stock, liste, historique et profil.
        </p>
        <button class="btn btn-red btn-full" onclick="App.resetData()">
          🗑️ Réinitialiser toutes les données
        </button>
      </div>
    `;
  },

  saveHousehold() {
    const h = this.state.household;
    h.name     = document.getElementById('hh-name')?.value.trim()    || 'Mon Foyer';
    h.days     = Math.max(1, parseInt(document.getElementById('hh-days')?.value)    || 7);
    h.store    = document.getElementById('hh-store')?.value           || 'Carrefour';
    h.adults   = Math.max(0, parseInt(document.getElementById('hh-adults')?.value)   || 0);
    h.children = Math.max(0, parseInt(document.getElementById('hh-children')?.value) || 0);
    h.babies   = Math.max(0, parseInt(document.getElementById('hh-babies')?.value)   || 0);
    this.save();
    this.renderHome();
    this.toast('✅ Profil enregistré !', 'success');
  },

  stepHH(field, delta) {
    const el = document.getElementById(`hh-${field}`);
    if (!el) return;
    const min = parseInt(el.min) || 0;
    el.value = Math.max(min, (parseInt(el.value) || 0) + delta);
    this.saveHousehold();
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

  /* ---- Réinitialisation complète ---- */
  resetData() {
    const confirmed = confirm(
      'Voulez-vous vraiment supprimer toutes vos données ?\n\n' +
      'Cela supprimera :\n• Budget et dépenses\n• Stock\n• Liste de courses\n• Historique\n• Profil\n\n' +
      'Cette action est irréversible.'
    );
    if (!confirmed) return;
    localStorage.removeItem(this.STORAGE_KEY);
    this.state = getInitialState();
    this.save();
    this.applySettings();
    this.toast('✅ Données réinitialisées.', 'success');
    this.navigate('home');
  },

  /* ============================================================
     15. MODALS
     ============================================================ */
  openModal(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.add('open'); document.body.style.overflow = 'hidden'; }
  },

  closeModal(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.remove('open'); document.body.style.overflow = ''; }
  },

  submitAddItem() {
    const name    = document.getElementById('ai-name')?.value.trim();
    const qty     = this.num(document.getElementById('ai-qty')?.value) || 1;
    const unit    = document.getElementById('ai-unit')?.value || 'pcs';
    const price   = this.num(document.getElementById('ai-price')?.value);
    const prio    = parseInt(document.getElementById('ai-priority')?.value) || 2;
    const aisle   = document.getElementById('ai-aisle')?.value.trim() || 'Divers';
    if (!name) { this.toast('⚠️ Saisissez un nom de produit.', 'error'); return; }
    if (price < 0) { this.toast('⚠️ Le prix ne peut pas être négatif.', 'error'); return; }
    this.addListItem(newListItem({ name, qty, unit, priceEst: price, priority: prio, aisle, essential: prio === 1 }));
    this.closeModal('modal-add-item');
    // Réinitialiser le formulaire
    ['ai-name','ai-qty','ai-price','ai-aisle'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = id === 'ai-qty' ? '1' : '';
    });
  },

  submitAddStock() {
    const name     = document.getElementById('as-name')?.value.trim();
    const qty      = this.num(document.getElementById('as-qty')?.value) || 1;
    const unit     = document.getElementById('as-unit')?.value || 'pcs';
    const location = document.getElementById('as-location')?.value || 'placard';
    const expiry   = document.getElementById('as-expiry')?.value || null;
    const price    = this.num(document.getElementById('as-price')?.value);
    const minQty   = this.num(document.getElementById('as-minqty')?.value) || 1;
    if (!name) { this.toast('⚠️ Saisissez un nom de produit.', 'error'); return; }
    const item = newStockItem({ name, qty, unit, location, expiryDate: expiry, price, minQty, icon: '📦' });
    this.state.stock.push(item);
    this.save();
    this.renderStock();
    this.renderHome();
    this.closeModal('modal-add-stock');
    this.toast('✅ Produit ajouté au stock.', 'success');
    ['as-name','as-qty','as-price','as-expiry','as-minqty'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = id === 'as-qty' ? '1' : '';
    });
  },

  /* ============================================================
     16. UTILITAIRES
     ============================================================ */

  /* Formater un nombre en euros */
  fmt(n) {
    const v = parseFloat(n) || 0;
    return v.toFixed(2).replace('.', ',') + ' €';
  },

  /* Parser un nombre (gère virgule française) */
  num(str) {
    if (str === null || str === undefined || str === '') return 0;
    const v = parseFloat(String(str).replace(',', '.'));
    return isNaN(v) ? 0 : v;
  },

  /* Échapper le HTML */
  esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;');
  },

  /* Nom d'un emplacement */
  locationName(id) {
    return LOCATIONS.find(l => l.id === id)?.name || id || '';
  },

  /* Statut de péremption */
  expiryStatus(item) {
    if (!item.expiryDate) return 'ok';
    const days = Math.ceil((new Date(item.expiryDate) - new Date()) / 86400000);
    if (days < 0)  return 'expired';
    if (days <= 2) return 'urgent';
    if (days <= 5) return 'soon';
    return 'ok';
  },

  /* Label de péremption */
  expiryLabel(item) {
    if (!item.expiryDate) return '';
    const days = Math.ceil((new Date(item.expiryDate) - new Date()) / 86400000);
    if (days < 0)   return `Périmé depuis ${Math.abs(days)} jour(s)`;
    if (days === 0) return 'Périme aujourd\'hui !';
    if (days === 1) return 'Périme demain !';
    return `Périme dans ${days} jour(s)`;
  },

  /* Formater une date */
  formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' });
    } catch { return dateStr; }
  },

  /* Toast notification */
  toast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${msg}</span>`;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  },
};

/* ============================================================
   DÉMARRAGE
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => App.init());