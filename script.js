/**
 * CampusSpend - Modern College Expense & Pocket Money Tracker
 * Single Page Application Architecture with Vanilla JavaScript
 */

(function () {
    'use strict';

    // ---------------------------------------------------------------------------
    // 1. CONSTANTS & DEFAULT STATE SCHEMA
    // ---------------------------------------------------------------------------
    const STORAGE_KEY_PREFIX = 'CampusSpend_State_';
    const CURRENT_USER_KEY = 'CampusSpend_ActiveUser';
    const SCHEMA_VERSION = 1;

    const DEFAULT_CATEGORIES = [
        'Canteen & Food',
        'Transport',
        'Study & Stationery',
        'College Fees',
        'Mobile & Internet',
        'Personal',
        'Hostel & Living',
        'Miscellaneous'
    ];

    // Default structure for new profiles
    function createNewUserState(name, email) {
        return {
            version: SCHEMA_VERSION,
            user: {
                name: name || 'Student',
                email: email || 'student@campus.edu',
                openingBalance: 0
            },
            categories: [...DEFAULT_CATEGORIES],
            transactions: [],
            budgets: {
                overall: 0,
                categories: {}
            },
            savingsGoals: [],
            settings: {
                theme: 'light'
            }
        };
    }

    // ---------------------------------------------------------------------------
    // 2. GLOBAL APP STATE & REPOSITORY
    // ---------------------------------------------------------------------------
    let activeUserId = null;
    let state = null;
    let currentView = 'landing';
    let calendarDate = new Date();

    // ---------------------------------------------------------------------------
    // 3. STORAGE & STATE PERSISTENCE (SAFE LOCAL STORAGE ENGINE)
    // ---------------------------------------------------------------------------
    function loadState(userId) {
        if (!userId) return null;
        try {
            const raw = localStorage.getItem(STORAGE_KEY_PREFIX + userId);
            if (!raw) return null;
            const parsed = JSON.parse(raw);

            // Version migration logic can go here if needed
            if (!parsed.version) parsed.version = SCHEMA_VERSION;
            if (!parsed.categories) parsed.categories = [...DEFAULT_CATEGORIES];
            if (!parsed.transactions) parsed.transactions = [];
            if (!parsed.budgets) parsed.budgets = { overall: 0, categories: {} };
            if (!parsed.savingsGoals) parsed.savingsGoals = [];

            return parsed;
        } catch (e) {
            console.error('Failed to parse state from localStorage:', e);
            showToast('Error loading profile data. Restoring defaults.', 'error');
            return null;
        }
    }

    function saveState() {
        if (!activeUserId || !state) return;
        try {
            localStorage.setItem(STORAGE_KEY_PREFIX + activeUserId, JSON.stringify(state));
        } catch (e) {
            console.error('Failed to save state to localStorage:', e);
            showToast('Storage quota exceeded or storage disabled.', 'error');
        }
    }

    function getCurrentUser() {
        return localStorage.getItem(CURRENT_USER_KEY);
    }

    function setCurrentUser(userId) {
        if (userId) {
            localStorage.setItem(CURRENT_USER_KEY, userId);
        } else {
            localStorage.removeItem(CURRENT_USER_KEY);
        }
    }

    // ---------------------------------------------------------------------------
    // 4. FORMATTERS & UTILS
    // ---------------------------------------------------------------------------
    const currencyFormatter = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2
    });

    function formatCurrency(amount) {
        return currencyFormatter.format(amount || 0);
    }

    function formatDateStr(dateString) {
        if (!dateString) return '';
        const d = new Date(dateString);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    function getTodayIso() {
        const today = new Date();
        return today.toISOString().split('T')[0];
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // ---------------------------------------------------------------------------
    // 5. UI TOAST & DIALOG SYSTEM
    // ---------------------------------------------------------------------------
    function showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    function showConfirm(title, message, onConfirm) {
        const modal = document.getElementById('confirm-modal');
        document.getElementById('confirm-modal-title').textContent = title;
        document.getElementById('confirm-modal-msg').textContent = message;
        modal.classList.remove('hidden');

        const btnOk = document.getElementById('confirm-modal-ok');
        const btnCancel = document.getElementById('confirm-modal-cancel');

        const cleanup = () => {
            modal.classList.add('hidden');
            btnOk.removeEventListener('click', handleOk);
            btnCancel.removeEventListener('click', handleCancel);
        };

        const handleOk = () => { cleanup(); onConfirm(); };
        const handleCancel = () => { cleanup(); };

        btnOk.addEventListener('click', handleOk);
        btnCancel.addEventListener('click', handleCancel);
    }

    // ---------------------------------------------------------------------------
    // 6. ROUTING & VIEW NAVIGATION
    // ---------------------------------------------------------------------------
    function navigateTo(viewName) {
        currentView = viewName;
        const views = document.querySelectorAll('.view-section');
        views.forEach(v => v.classList.remove('active'));

        const targetView = document.getElementById(`view-${viewName}`);
        if (targetView) targetView.classList.add('active');

        // Update Navigation UI states
        const navLinks = document.querySelectorAll('.desktop-nav .nav-link, .mobile-bottom-nav .m-nav-link');
        navLinks.forEach(link => {
            if (link.dataset.view === viewName) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        // Toggle nav bars depending on login state & view
        const isAuthOrLanding = (viewName === 'landing' || viewName === 'auth');
        const desktopNav = document.getElementById('desktop-app-nav');
        const mobileNav = document.getElementById('mobile-bottom-nav');
        const landingActions = document.getElementById('landing-nav-actions');
        const userActions = document.getElementById('user-nav-actions');

        if (isAuthOrLanding && !activeUserId) {
            desktopNav.classList.add('hidden');
            mobileNav.classList.add('hidden');
            landingActions.classList.remove('hidden');
            userActions.classList.add('hidden');
        } else {
            desktopNav.classList.remove('hidden');
            mobileNav.classList.remove('hidden');
            landingActions.classList.add('hidden');
            userActions.classList.remove('hidden');
        }

        // Refresh view specific components
        renderCurrentView();
        window.scrollTo(0, 0);
    }

    function renderCurrentView() {
        if (!state) return;
        switch (currentView) {
            case 'overview':
                renderOverview();
                break;
            case 'expenses':
                renderCollegeExpenses();
                break;
            case 'transactions':
                renderTransactionsTable();
                break;
            case 'budgets':
                renderBudgets();
                break;
            case 'analytics':
                renderAnalytics();
                break;
            case 'savings':
                renderSavingsGoals();
                break;
            case 'calendar':
                renderCalendar();
                break;
            case 'settings':
                renderSettings();
                break;
        }
    }

    // ---------------------------------------------------------------------------
    // 7. FINANCIAL CALCULATIONS ENGINE
    // ---------------------------------------------------------------------------
    function getFinancialTotals() {
        const opening = parseFloat(state.user.openingBalance) || 0;
        let totalIncome = 0;
        let totalExpense = 0;
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        let monthExpense = 0;

        state.transactions.forEach(tx => {
            const amt = parseFloat(tx.amount) || 0;
            const d = new Date(tx.date);
            if (tx.type === 'income') {
                totalIncome += amt;
            } else if (tx.type === 'expense') {
                totalExpense += amt;
                if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                    monthExpense += amt;
                }
            }
        });

        const netBalance = opening + totalIncome - totalExpense;

        // Daily allowance calculation
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const dayOfMonth = now.getDate();
        const remainingDays = Math.max(1, daysInMonth - dayOfMonth + 1);

        // Remaining overall budget or remaining net balance
        const overallBudget = parseFloat(state.budgets.overall) || 0;
        let budgetRemaining = overallBudget > 0 ? (overallBudget - monthExpense) : netBalance;
        if (budgetRemaining < 0) budgetRemaining = 0;

        const dailyAllowance = budgetRemaining / remainingDays;

        return {
            opening,
            totalIncome,
            totalExpense,
            monthExpense,
            netBalance,
            dailyAllowance
        };
    }

    // ---------------------------------------------------------------------------
    // 8. VIEW RENDERERS
    // ---------------------------------------------------------------------------

    // --- OVERVIEW VIEW ---
    function renderOverview() {
        const totals = getFinancialTotals();
        document.getElementById('overview-greeting').textContent = `Hello, ${state.user.name}`;
        document.getElementById('nav-user-name').textContent = state.user.name;

        document.getElementById('val-net-balance').textContent = formatCurrency(totals.netBalance);
        document.getElementById('val-opening-info').textContent = `Opening Carryover: ${formatCurrency(totals.opening)}`;
        document.getElementById('val-total-income').textContent = formatCurrency(totals.totalIncome);
        document.getElementById('val-total-expense').textContent = formatCurrency(totals.monthExpense);
        document.getElementById('val-daily-allowance').textContent = `${formatCurrency(totals.dailyAllowance)} / day`;

        renderSmartInsights(totals);
        renderOverviewCharts();
        renderTodayTransactions();
        renderOverviewBudgets();
    }

    function renderSmartInsights(totals) {
        const textEl = document.getElementById('smart-insight-text');
        if (state.transactions.length === 0) {
            textEl.textContent = "Welcome! Add your pocket money or initial expenses to unlock smart daily allowance insights.";
            return;
        }

        // Dynamic transparent JS rules
        const catTotals = {};
        state.transactions.filter(t => t.type === 'expense').forEach(t => {
            catTotals[t.category] = (catTotals[t.category] || 0) + parseFloat(t.amount);
        });

        let topCat = '';
        let maxAmt = 0;
        for (let c in catTotals) {
            if (catTotals[c] > maxAmt) {
                maxAmt = catTotals[c];
                topCat = c;
            }
        }

        if (totals.netBalance < 500 && totals.netBalance > 0) {
            textEl.textContent = `⚠️ Low Balance Warning: You have ${formatCurrency(totals.netBalance)} remaining. Try capping daily spending to ${formatCurrency(totals.dailyAllowance)}.`;
        } else if (topCat) {
            textEl.textContent = `💡 Category Notice: Your largest expense category is "${topCat}" (${formatCurrency(maxAmt)} spent). Keep track of your daily limit!`;
        } else {
            textEl.textContent = `✅ Spending looks steady! Your calculated safe daily limit is ${formatCurrency(totals.dailyAllowance)} for the rest of this month.`;
        }
    }

    function renderTodayTransactions() {
        const container = document.getElementById('today-tx-list');
        const badge = document.getElementById('today-total-badge');
        const todayStr = getTodayIso();

        const todayTxs = state.transactions.filter(t => t.date === todayStr);
        const todaySum = todayTxs.reduce((sum, t) => sum + (t.type === 'expense' ? parseFloat(t.amount) : 0), 0);

        badge.textContent = `${formatCurrency(todaySum)} spent today`;

        if (todayTxs.length === 0) {
            container.innerHTML = `<p class="text-muted text-center" style="padding:1rem;">No transactions logged today.</p>`;
            return;
        }

        container.innerHTML = todayTxs.map(t => `
      <div class="tx-item-row">
        <div class="tx-item-info">
          <span class="tx-item-title">${escapeHtml(t.merchant || t.category)}</span>
          <span class="tx-item-sub">${escapeHtml(t.category)} • ${t.payment}</span>
        </div>
        <span class="tx-item-amt ${t.type === 'expense' ? 'text-coral' : 'text-green'}">
          ${t.type === 'expense' ? '-' : '+'}${formatCurrency(t.amount)}
        </span>
      </div>
    `).join('');
    }

    function renderOverviewBudgets() {
        const container = document.getElementById('overview-budget-bars');
        const categories = state.categories;

        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        const spentByCat = {};
        state.transactions.forEach(t => {
            const d = new Date(t.date);
            if (t.type === 'expense' && d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                spentByCat[t.category] = (spentByCat[t.category] || 0) + parseFloat(t.amount);
            }
        });

        let html = '';
        categories.forEach(cat => {
            const budget = parseFloat(state.budgets.categories[cat]) || 0;
            if (budget > 0) {
                const spent = spentByCat[cat] || 0;
                const pct = Math.min(100, Math.round((spent / budget) * 100));
                let warnClass = '';
                if (pct >= 90) warnClass = 'warn-90';
                else if (pct >= 75) warnClass = 'warn-75';

                html += `
          <div class="b-bar-item">
            <div class="b-bar-header">
              <span><strong>${escapeHtml(cat)}</strong></span>
              <span>${formatCurrency(spent)} / ${formatCurrency(budget)} (${pct}%)</span>
            </div>
            <div class="b-bar-track">
              <div class="b-bar-fill ${warnClass}" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
            }
        });

        if (!html) {
            html = `<p class="text-muted subtext text-center">No category budgets set yet. Click Manage to set limits.</p>`;
        }
        container.innerHTML = html;
    }

    // --- CHARTS (PURE SVG / HTML) ---
    function renderOverviewCharts() {
        // 1. Monthly Bar Chart (Last 6 Months)
        const barContainer = document.getElementById('overview-bar-chart');
        const monthsData = getRecentMonthsData(5);

        let maxVal = 100;
        monthsData.forEach(m => {
            if (m.income > maxVal) maxVal = m.income;
            if (m.expense > maxVal) maxVal = m.expense;
        });

        let barsHtml = `<div style="display:flex; align-items:flex-end; justify-content:space-around; height:100%; padding-top:10px;">`;
        monthsData.forEach(m => {
            const incHeight = (m.income / maxVal) * 160;
            const expHeight = (m.expense / maxVal) * 160;
            barsHtml += `
        <div style="display:flex; flex-direction:column; align-items:center; gap:4px; height:100%; justify-content:flex-end;">
          <div style="display:flex; gap:4px; align-items:flex-end;">
            <div title="Income: ${formatCurrency(m.income)}" style="width:14px; height:${incHeight}px; background:var(--primary-green); border-radius:3px 3px 0 0;"></div>
            <div title="Expense: ${formatCurrency(m.expense)}" style="width:14px; height:${expHeight}px; background:var(--accent-coral); border-radius:3px 3px 0 0;"></div>
          </div>
          <span style="font-size:0.75rem; color:var(--text-muted);">${m.label}</span>
        </div>
      `;
        });
        barsHtml += `</div>`;
        barContainer.innerHTML = barsHtml;

        // 2. Category Donut Chart
        renderDonutChart('overview-donut-chart', 'overview-donut-legend');
    }

    function getRecentMonthsData(count) {
        const list = [];
        const now = new Date();
        for (let i = count - 1; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const mIdx = d.getMonth();
            const yVal = d.getFullYear();
            const label = d.toLocaleString('en-IN', { month: 'short' });

            let inc = 0, exp = 0;
            state.transactions.forEach(t => {
                const td = new Date(t.date);
                if (td.getMonth() === mIdx && td.getFullYear() === yVal) {
                    if (t.type === 'income') inc += parseFloat(t.amount);
                    if (t.type === 'expense') exp += parseFloat(t.amount);
                }
            });
            list.push({ label, income: inc, expense: exp });
        }
        return list;
    }

    function renderDonutChart(containerId, legendId) {
        const container = document.getElementById(containerId);
        const legend = document.getElementById(legendId);
        if (!container) return;

        const catSums = {};
        let totalExpense = 0;
        state.transactions.filter(t => t.type === 'expense').forEach(t => {
            const amt = parseFloat(t.amount);
            catSums[t.category] = (catSums[t.category] || 0) + amt;
            totalExpense += amt;
        });

        if (totalExpense === 0) {
            container.innerHTML = `<p class="text-muted subtext">No expenses recorded yet.</p>`;
            if (legend) legend.innerHTML = '';
            return;
        }

        const colors = [
            '#1B4D3E', '#E05A47', '#D97706', '#2563EB',
            '#7C3AED', '#DB2777', '#059669', '#4B5563'
        ];

        let cumulativePercent = 0;
        const slices = [];
        let colorIdx = 0;
        let legendHtml = '';

        for (let cat in catSums) {
            const val = catSums[cat];
            const pct = val / totalExpense;
            const color = colors[colorIdx % colors.length];
            colorIdx++;

            const startAngle = cumulativePercent * 360;
            cumulativePercent += pct;
            const endAngle = cumulativePercent * 360;

            slices.push({ cat, val, pct, color, startAngle, endAngle });

            if (legend) {
                legendHtml += `
          <div class="legend-item">
            <span class="legend-color" style="background:${color}"></span>
            <span>${escapeHtml(cat)} (${Math.round(pct * 100)}%)</span>
          </div>
        `;
            }
        }

        // Build SVG Conic / Arc Donut
        let svgHtml = `<svg viewBox="0 0 42 42" class="donut" style="width:140px; height:140px; transform: rotate(-90deg); border-radius:50%;">`;
        let offset = 0;

        slices.forEach(s => {
            const strokeDash = s.pct * 100;
            const strokeGap = 100 - strokeDash;
            svgHtml += `
        <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" 
                stroke="${s.color}" stroke-width="6" 
                stroke-dasharray="${strokeDash} ${strokeGap}" 
                stroke-dashoffset="-${offset}">
        </circle>
      `;
            offset += strokeDash;
        });

        svgHtml += `</svg>`;
        container.innerHTML = svgHtml;
        if (legend) legend.innerHTML = legendHtml;
    }

    // --- COLLEGE EXPENSES VIEW ---
    function renderCollegeExpenses() {
        const todayStr = getTodayIso();
        const now = new Date();
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));

        let sumToday = 0;
        let sumWeek = 0;
        let sumMonth = 0;

        const catSums = {};

        state.transactions.filter(t => t.type === 'expense').forEach(t => {
            const amt = parseFloat(t.amount);
            const d = new Date(t.date);

            if (t.date === todayStr) sumToday += amt;
            if (d >= startOfWeek) sumWeek += amt;
            if (d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear()) {
                sumMonth += amt;
            }

            catSums[t.category] = (catSums[t.category] || 0) + amt;
        });

        document.getElementById('college-stat-today').textContent = formatCurrency(sumToday);
        document.getElementById('college-stat-week').textContent = formatCurrency(sumWeek);
        document.getElementById('college-stat-month').textContent = formatCurrency(sumMonth);

        const listEl = document.getElementById('college-category-breakdown-list');
        let html = '';
        state.categories.forEach(cat => {
            const val = catSums[cat] || 0;
            html += `
        <div style="display:flex; justify-content:space-between; padding:0.5rem 0; border-bottom:1px solid var(--border-color);">
          <span style="font-size:0.9rem;">${escapeHtml(cat)}</span>
          <span style="font-weight:700;">${formatCurrency(val)}</span>
        </div>
      `;
        });
        listEl.innerHTML = html;
    }

    // --- TRANSACTIONS LEDGER VIEW ---
    function renderTransactionsTable() {
        const tbody = document.getElementById('tx-table-body');
        const emptyState = document.getElementById('tx-empty-state');

        // Populate Category Filter dropdown
        const catSelect = document.getElementById('filter-category');
        const currentFilterCat = catSelect.value;
        catSelect.innerHTML = `<option value="all">All Categories</option>` +
            state.categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
        catSelect.value = currentFilterCat || 'all';

        const search = document.getElementById('filter-search').value.toLowerCase();
        const typeFilter = document.getElementById('filter-type').value;
        const catFilter = document.getElementById('filter-category').value;
        const sortBy = document.getElementById('filter-sort').value;

        let filtered = state.transactions.filter(t => {
            const matchSearch = (t.merchant || '').toLowerCase().includes(search) ||
                (t.note || '').toLowerCase().includes(search) ||
                (t.category || '').toLowerCase().includes(search);
            const matchType = typeFilter === 'all' || t.type === typeFilter;
            const matchCat = catFilter === 'all' || t.category === catFilter;
            return matchSearch && matchType && matchCat;
        });

        // Sorting
        filtered.sort((a, b) => {
            if (sortBy === 'date-desc') return new Date(b.date) - new Date(a.date);
            if (sortBy === 'date-asc') return new Date(a.date) - new Date(b.date);
            if (sortBy === 'amount-desc') return parseFloat(b.amount) - parseFloat(a.amount);
            if (sortBy === 'amount-asc') return parseFloat(a.amount) - parseFloat(b.amount);
            return 0;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        tbody.innerHTML = filtered.map(t => `
      <tr>
        <td>${formatDateStr(t.date)}</td>
        <td><span class="badge">${escapeHtml(t.category)}</span></td>
        <td>
          <strong>${escapeHtml(t.merchant || t.category)}</strong>
          ${t.note ? `<br><small class="text-muted">${escapeHtml(t.note)}</small>` : ''}
        </td>
        <td>${escapeHtml(t.payment || 'Cash')}</td>
        <td>
          <span style="font-weight:600;" class="${t.type === 'expense' ? 'text-coral' : 'text-green'}">
            ${t.type === 'expense' ? 'Expense' : 'Income'}
          </span>
        </td>
        <td class="text-right font-weight-bold ${t.type === 'expense' ? 'text-coral' : 'text-green'}">
          ${t.type === 'expense' ? '-' : '+'}${formatCurrency(t.amount)}
        </td>
        <td class="text-center">
          <button class="btn-icon btn-edit-tx" data-id="${t.id}" title="Edit">&pencil;</button>
          <button class="btn-icon btn-delete-tx" data-id="${t.id}" title="Delete">&times;</button>
        </td>
      </tr>
    `).join('');
    }

    // --- BUDGETS VIEW ---
    function renderBudgets() {
        document.getElementById('budget-overall-input').value = state.budgets.overall || '';
        const container = document.getElementById('category-budget-list');

        container.innerHTML = state.categories.map(cat => {
            const currentVal = state.budgets.categories[cat] || '';
            return `
        <div class="budget-setting-row">
          <label style="font-weight:600; font-size:0.9rem;">${escapeHtml(cat)}</label>
          <div style="display:flex; gap:0.5rem; align-items:center;">
            <span>₹</span>
            <input type="number" class="cat-budget-input" data-cat="${escapeHtml(cat)}" value="${currentVal}" placeholder="No limit" style="width:130px;" min="0">
          </div>
        </div>
      `;
        }).join('') + `
      <div style="margin-top:1rem; text-align:right;">
        <button class="btn btn-primary" id="btn-save-cat-budgets">Save Category Budgets</button>
      </div>
    `;

        document.getElementById('btn-save-cat-budgets').addEventListener('click', () => {
            const inputs = document.querySelectorAll('.cat-budget-input');
            inputs.forEach(inp => {
                const cat = inp.dataset.cat;
                const val = parseFloat(inp.value) || 0;
                state.budgets.categories[cat] = val;
            });
            saveState();
            showToast('Category budgets updated!', 'info');
        });
    }

    // --- ANALYTICS VIEW ---
    function renderAnalytics() {
        renderDonutChart('analytics-donut-container', null);
    }

    // --- SAVINGS GOALS VIEW ---
    function renderSavingsGoals() {
        const grid = document.getElementById('savings-goals-grid');
        if (state.savingsGoals.length === 0) {
            grid.innerHTML = `<div class="content-card text-center text-muted" style="grid-column:1/-1;">No savings goals set yet. Click + New Goal to start saving!</div>`;
            return;
        }

        grid.innerHTML = state.savingsGoals.map(g => {
            const current = parseFloat(g.current) || 0;
            const target = parseFloat(g.target) || 1;
            const pct = Math.min(100, Math.round((current / target) * 100));

            return `
        <div class="goal-card">
          <div>
            <div class="goal-card-header">
              <span class="goal-card-title">${escapeHtml(g.title)}</span>
              <button class="btn-icon btn-delete-goal" data-id="${g.id}">&times;</button>
            </div>
            <div class="goal-target-val">Target: ${formatCurrency(target)} ${g.date ? `by ${formatDateStr(g.date)}` : ''}</div>
            <div style="margin:1rem 0;">
              <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom:0.25rem;">
                <span>Saved: ${formatCurrency(current)}</span>
                <span>${pct}%</span>
              </div>
              <div class="b-bar-track">
                <div class="b-bar-fill" style="width:${pct}%;"></div>
              </div>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm btn-full btn-add-contribution" data-id="${g.id}">+ Add Contribution</button>
        </div>
      `;
        }).join('');
    }

    // --- CALENDAR VIEW ---
    function renderCalendar() {
        const year = calendarDate.getFullYear();
        const month = calendarDate.getMonth();

        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        document.getElementById('cal-month-year').textContent = `${monthNames[month]} ${year}`;

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const grid = document.getElementById('calendar-days');
        grid.innerHTML = '';

        // Calculate daily expense map
        const dailyExpenses = {};
        state.transactions.forEach(t => {
            if (t.type === 'expense') {
                dailyExpenses[t.date] = (dailyExpenses[t.date] || 0) + parseFloat(t.amount);
            }
        });

        // Previous month filler days
        for (let i = 0; i < firstDay; i++) {
            const cell = document.createElement('div');
            cell.className = 'cal-day-cell other-month';
            grid.appendChild(cell);
        }

        // Days of current month
        for (let day = 1; day <= daysInMonth; day++) {
            const cell = document.createElement('div');
            cell.className = 'cal-day-cell';

            const mStr = String(month + 1).padStart(2, '0');
            const dStr = String(day).padStart(2, '0');
            const dateIso = `${year}-${mStr}-${dStr}`;

            const daySum = dailyExpenses[dateIso] || 0;

            cell.innerHTML = `
        <span class="cal-day-num">${day}</span>
        ${daySum > 0 ? `<span class="cal-day-sum">-${formatCurrency(daySum)}</span>` : ''}
      `;

            cell.addEventListener('click', () => {
                document.querySelectorAll('.cal-day-cell').forEach(c => c.classList.remove('selected'));
                cell.classList.add('selected');
                inspectCalendarDate(dateIso);
            });

            grid.appendChild(cell);
        }
    }

    function inspectCalendarDate(dateIso) {
        document.getElementById('cal-selected-date-str').textContent = formatDateStr(dateIso);
        const container = document.getElementById('cal-day-tx-list');
        const dayTxs = state.transactions.filter(t => t.date === dateIso);

        if (dayTxs.length === 0) {
            container.innerHTML = `<p class="text-muted">No transactions on this date.</p>`;
            return;
        }

        container.innerHTML = dayTxs.map(t => `
      <div class="tx-item-row">
        <div class="tx-item-info">
          <span class="tx-item-title">${escapeHtml(t.merchant || t.category)}</span>
          <span class="tx-item-sub">${escapeHtml(t.category)}</span>
        </div>
        <span class="tx-item-amt ${t.type === 'expense' ? 'text-coral' : 'text-green'}">
          ${t.type === 'expense' ? '-' : '+'}${formatCurrency(t.amount)}
        </span>
      </div>
    `).join('');
    }

    // --- SETTINGS VIEW ---
    function renderSettings() {
        document.getElementById('settings-name').value = state.user.name;
        document.getElementById('settings-opening-balance').value = state.user.openingBalance || 0;

        const catContainer = document.getElementById('settings-categories-list');
        catContainer.innerHTML = state.categories.map(c => `
      <span class="tag-item">
        ${escapeHtml(c)}
        <button class="btn-icon btn-remove-cat" data-cat="${escapeHtml(c)}" style="font-size:0.9rem;">&times;</button>
      </span>
    `).join('');
    }

    // ---------------------------------------------------------------------------
    // 9. TRANSACTION & FORM ACTIONS
    // ---------------------------------------------------------------------------
    function openTxModal(prefill = {}) {
        const modal = document.getElementById('tx-modal');
        const form = document.getElementById('tx-form');
        form.reset();

        // Populate category dropdown
        const catSelect = document.getElementById('tx-category');
        catSelect.innerHTML = state.categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

        document.getElementById('tx-id').value = prefill.id || '';
        document.getElementById('tx-type').value = prefill.type || 'expense';
        document.getElementById('tx-amount').value = prefill.amount || '';
        document.getElementById('tx-category').value = prefill.category || state.categories[0];
        document.getElementById('tx-date').value = prefill.date || getTodayIso();
        document.getElementById('tx-payment').value = prefill.payment || 'UPI';
        document.getElementById('tx-merchant').value = prefill.merchant || '';
        document.getElementById('tx-note').value = prefill.note || '';

        document.getElementById('tx-modal-title').textContent = prefill.id ? 'Edit Transaction' : 'Add Transaction';
        modal.classList.remove('hidden');
    }

    function closeTxModal() {
        document.getElementById('tx-modal').classList.add('hidden');
    }

    function handleSaveTransaction(e) {
        e.preventDefault();
        const id = document.getElementById('tx-id').value;
        const type = document.getElementById('tx-type').value;
        const amount = parseFloat(document.getElementById('tx-amount').value);
        const category = document.getElementById('tx-category').value;
        const date = document.getElementById('tx-date').value;
        const payment = document.getElementById('tx-payment').value;
        const merchant = document.getElementById('tx-merchant').value.trim();
        const note = document.getElementById('tx-note').value.trim();

        if (isNaN(amount) || amount <= 0) {
            showToast('Please enter a valid positive amount.', 'error');
            return;
        }

        if (!date) {
            showToast('Please select a valid date.', 'error');
            return;
        }

        if (id) {
            // Update existing
            const idx = state.transactions.findIndex(t => t.id === id);
            if (idx !== -1) {
                state.transactions[idx] = { id, type, amount, category, date, payment, merchant, note };
                showToast('Transaction updated successfully.', 'info');
            }
        } else {
            // Create new
            const newTx = {
                id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                type,
                amount,
                category,
                date,
                payment,
                merchant,
                note
            };
            state.transactions.push(newTx);
            showToast('Transaction added successfully.', 'info');
        }

        saveState();
        closeTxModal();
        renderCurrentView();
    }

    function deleteTransaction(id) {
        showConfirm('Delete Transaction', 'Are you sure you want to delete this record?', () => {
            state.transactions = state.transactions.filter(t => t.id !== id);
            saveState();
            renderCurrentView();
            showToast('Transaction deleted.', 'info');
        });
    }

    // ---------------------------------------------------------------------------
    // 10. IMPORT / EXPORT ENGINE
    // ---------------------------------------------------------------------------
    function exportCSV() {
        if (state.transactions.length === 0) {
            showToast('No transactions to export.', 'warning');
            return;
        }

        let csv = 'ID,Date,Type,Category,Merchant,Amount,Payment,Note\n';
        state.transactions.forEach(t => {
            const row = [
                t.id,
                t.date,
                t.type,
                `"${(t.category || '').replace(/"/g, '""')}"`,
                `"${(t.merchant || '').replace(/"/g, '""')}"`,
                t.amount,
                t.payment,
                `"${(t.note || '').replace(/"/g, '""')}"`
            ];
            csv += row.join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `CampusSpend_Export_${getTodayIso()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function exportJSON() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
        const dlAnchor = document.createElement('a');
        dlAnchor.setAttribute("href", dataStr);
        dlAnchor.setAttribute("download", `CampusSpend_Backup_${getTodayIso()}.json`);
        dlAnchor.click();
    }

    function importJSON(file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const parsed = JSON.parse(e.target.result);
                if (!parsed.transactions || !Array.isArray(parsed.transactions)) {
                    throw new Error('Invalid schema: Missing transactions array.');
                }
                state = parsed;
                saveState();
                renderCurrentView();
                showToast('Backup restored successfully!', 'info');
            } catch (err) {
                showToast('Failed to import JSON: Malformed or incompatible file.', 'error');
            }
        };
        reader.readAsText(file);
    }

    // ---------------------------------------------------------------------------
    // 11. INITIALIZATION & DEMO PROFILES
    // ---------------------------------------------------------------------------
    function initDemoData() {
        const demoState = createNewUserState('Demo Student', 'demo@campus.edu');
        demoState.user.openingBalance = 1500;

        // Add sample college transactions for testing criteria
        const today = getTodayIso();
        demoState.transactions = [
            { id: 'tx_d1', type: 'income', amount: 5000, category: 'College Fees', date: today, payment: 'UPI', merchant: 'Parents Pocket Allowance', note: 'Monthly allowance' },
            { id: 'tx_d2', type: 'expense', amount: 50, category: 'Canteen & Food', date: today, payment: 'Cash', merchant: 'Canteen Chai & Samosa', note: 'Break time' },
            { id: 'tx_d3', type: 'expense', amount: 40, category: 'Transport', date: today, payment: 'Cash', merchant: 'College Bus Pass', note: 'Daily ride' },
            { id: 'tx_d4', type: 'expense', amount: 30, category: 'Transport', date: today, payment: 'UPI', merchant: 'Auto Fare', note: 'Shared rickshaw' },
            { id: 'tx_d5', type: 'expense', amount: 80, category: 'Study & Stationery', date: today, payment: 'UPI', merchant: 'Practical Notebook', note: 'Physics lab file' }
        ];

        demoState.budgets.overall = 4000;
        demoState.budgets.categories = {
            'Canteen & Food': 1500,
            'Transport': 800,
            'Study & Stationery': 600
        };

        demoState.savingsGoals = [
            { id: 'g_1', title: 'Noise Cancelling Headphones', target: 2500, current: 800, date: '2026-12-15' }
        ];

        return demoState;
    }

    function setupEventListeners() {
        // Brand navigation
        document.getElementById('brand-logo').addEventListener('click', () => {
            if (activeUserId) navigateTo('overview');
            else navigateTo('landing');
        });

        // Top Navigation Links
        document.querySelectorAll('.desktop-nav .nav-link, .mobile-bottom-nav .m-nav-link').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                if (view) navigateTo(view);
            });
        });

        // Theme Toggle
        const toggleTheme = () => {
            const current = document.documentElement.getAttribute('data-theme') || 'light';
            const next = current === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', next);
            if (state) {
                state.settings.theme = next;
                saveState();
            }
        };
        document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
        document.getElementById('theme-toggle-app').addEventListener('click', toggleTheme);

        // Auth Switchers
        document.getElementById('nav-login-btn').addEventListener('click', () => {
            document.getElementById('auth-login-container').classList.remove('hidden');
            document.getElementById('auth-signup-container').classList.add('hidden');
            navigateTo('auth');
        });
        document.getElementById('nav-signup-btn').addEventListener('click', () => {
            document.getElementById('auth-signup-container').classList.remove('hidden');
            document.getElementById('auth-login-container').classList.add('hidden');
            navigateTo('auth');
        });
        document.getElementById('landing-cta-signup').addEventListener('click', () => {
            document.getElementById('auth-signup-container').classList.remove('hidden');
            document.getElementById('auth-login-container').classList.add('hidden');
            navigateTo('auth');
        });
        document.getElementById('link-to-signup').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('auth-login-container').classList.add('hidden');
            document.getElementById('auth-signup-container').classList.remove('hidden');
        });
        document.getElementById('link-to-login').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('auth-signup-container').classList.add('hidden');
            document.getElementById('auth-login-container').classList.remove('hidden');
        });

        // Password Visibility Toggles
        document.querySelectorAll('.toggle-pwd').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.dataset.target;
                const input = document.getElementById(targetId);
                if (input.type === 'password') {
                    input.type = 'text';
                    btn.textContent = 'Hide';
                } else {
                    input.type = 'password';
                    btn.textContent = 'Show';
                }
            });
        });

        // Form Auth Handlers
        document.getElementById('form-login').addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value.trim();
            const pwd = document.getElementById('login-password').value;
            if (!email || !pwd) {
                showToast('Please enter both email and password.', 'error');
                return;
            }
            activeUserId = 'usr_' + btoa(email).replace(/=/g, '');
            state = loadState(activeUserId) || createNewUserState('Campus Student', email);
            saveState();
            setCurrentUser(activeUserId);
            showToast('Signed in successfully!', 'info');
            navigateTo('overview');
        });

        document.getElementById('form-signup').addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('signup-name').value.trim();
            const email = document.getElementById('signup-email').value.trim();
            const pwd = document.getElementById('signup-password').value;

            if (!name || !email || pwd.length < 6) {
                showToast('Please provide valid details (Password min 6 chars).', 'error');
                return;
            }

            activeUserId = 'usr_' + btoa(email).replace(/=/g, '');
            state = createNewUserState(name, email);
            saveState();
            setCurrentUser(activeUserId);
            showToast('Profile created successfully!', 'info');
            navigateTo('overview');
        });

        // Demo Mode Buttons
        const launchDemo = () => {
            activeUserId = 'demo_user_profile';
            state = loadState(activeUserId) || initDemoData();
            saveState();
            setCurrentUser(activeUserId);
            showToast('Loaded Demo Mode with sample college transactions.', 'info');
            navigateTo('overview');
        };

        document.getElementById('landing-cta-demo').addEventListener('click', launchDemo);
        document.getElementById('btn-demo-login').addEventListener('click', launchDemo);
        document.getElementById('btn-demo-signup').addEventListener('click', launchDemo);

        // Logout
        const logoutHandler = () => {
            activeUserId = null;
            state = null;
            setCurrentUser(null);
            showToast('Logged out.', 'info');
            navigateTo('landing');
        };
        document.getElementById('nav-logout-btn').addEventListener('click', logoutHandler);

        // Quick Action Modals
        document.getElementById('btn-quick-add-income').addEventListener('click', () => {
            openTxModal({ type: 'income', category: 'College Fees', merchant: 'Pocket Money Received' });
        });
        document.getElementById('btn-quick-add-expense').addEventListener('click', () => openTxModal({ type: 'expense' }));
        document.getElementById('btn-ledger-add').addEventListener('click', () => openTxModal());
        document.getElementById('close-tx-modal').addEventListener('click', closeTxModal);
        document.getElementById('cancel-tx-modal').addEventListener('click', closeTxModal);
        document.getElementById('tx-form').addEventListener('submit', handleSaveTransaction);

        // Quick Entry Chips (College Expense View)
        document.querySelectorAll('.chip-btn').forEach(chip => {
            chip.addEventListener('click', () => {
                const cat = chip.dataset.cat;
                const title = chip.dataset.title;
                const amount = chip.dataset.amount;
                openTxModal({ type: 'expense', category: cat, merchant: title, amount: amount });
            });
        });

        // Filter Listeners
        document.getElementById('filter-search').addEventListener('input', renderTransactionsTable);
        document.getElementById('filter-type').addEventListener('change', renderTransactionsTable);
        document.getElementById('filter-category').addEventListener('change', renderTransactionsTable);
        document.getElementById('filter-sort').addEventListener('change', renderTransactionsTable);
        document.getElementById('btn-reset-filters').addEventListener('click', () => {
            document.getElementById('filter-search').value = '';
            document.getElementById('filter-type').value = 'all';
            document.getElementById('filter-category').value = 'all';
            document.getElementById('filter-sort').value = 'date-desc';
            renderTransactionsTable();
        });

        // Delegate Table Actions (Edit / Delete)
        document.getElementById('tx-table-body').addEventListener('click', (e) => {
            const editBtn = e.target.closest('.btn-edit-tx');
            const deleteBtn = e.target.closest('.btn-delete-tx');
            if (editBtn) {
                const id = editBtn.dataset.id;
                const tx = state.transactions.find(t => t.id === id);
                if (tx) openTxModal(tx);
            }
            if (deleteBtn) {
                deleteTransaction(deleteBtn.dataset.id);
            }
        });

        // Savings Goals Handlers
        document.getElementById('btn-new-goal').addEventListener('click', () => {
            document.getElementById('goal-form').reset();
            document.getElementById('goal-id').value = '';
            document.getElementById('goal-modal').classList.remove('hidden');
        });
        document.getElementById('close-goal-modal').addEventListener('click', () => document.getElementById('goal-modal').classList.add('hidden'));
        document.getElementById('cancel-goal-modal').addEventListener('click', () => document.getElementById('goal-modal').classList.add('hidden'));

        document.getElementById('goal-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const title = document.getElementById('goal-title').value.trim();
            const target = parseFloat(document.getElementById('goal-target').value);
            const current = parseFloat(document.getElementById('goal-current').value) || 0;
            const date = document.getElementById('goal-date').value;

            if (!title || isNaN(target) || target <= 0) {
                showToast('Please enter a valid goal title and target amount.', 'error');
                return;
            }

            state.savingsGoals.push({
                id: 'g_' + Date.now(),
                title, target, current, date
            });

            saveState();
            document.getElementById('goal-modal').classList.add('hidden');
            renderSavingsGoals();
            showToast('Savings goal created!', 'info');
        });

        document.getElementById('savings-goals-grid').addEventListener('click', (e) => {
            const delBtn = e.target.closest('.btn-delete-goal');
            const contribBtn = e.target.closest('.btn-add-contribution');

            if (delBtn) {
                const id = delBtn.dataset.id;
                showConfirm('Delete Goal', 'Are you sure you want to remove this goal?', () => {
                    state.savingsGoals = state.savingsGoals.filter(g => g.id !== id);
                    saveState();
                    renderSavingsGoals();
                });
            }

            if (contribBtn) {
                const id = contribBtn.dataset.id;
                const goal = state.savingsGoals.find(g => g.id === id);
                if (goal) {
                    const addAmtStr = prompt(`Add saved amount for "${goal.title}":`, "100");
                    const addAmt = parseFloat(addAmtStr);
                    if (!isNaN(addAmt) && addAmt > 0) {
                        goal.current = (parseFloat(goal.current) || 0) + addAmt;
                        saveState();
                        renderSavingsGoals();
                        showToast(`Added ${formatCurrency(addAmt)} to ${goal.title}`, 'info');
                    }
                }
            }
        });

        // Calendar Controls
        document.getElementById('cal-prev').addEventListener('click', () => {
            calendarDate.setMonth(calendarDate.getMonth() - 1);
            renderCalendar();
        });
        document.getElementById('cal-next').addEventListener('click', () => {
            calendarDate.setMonth(calendarDate.getMonth() + 1);
            renderCalendar();
        });

        // Overall Budget Save
        document.getElementById('btn-save-overall-budget').addEventListener('click', () => {
            const val = parseFloat(document.getElementById('budget-overall-input').value) || 0;
            state.budgets.overall = val;
            saveState();
            showToast('Target budget updated!', 'info');
        });

        // Export / Import / Print
        document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
        document.getElementById('btn-export-json').addEventListener('click', exportJSON);
        document.getElementById('import-json-file').addEventListener('change', (e) => {
            if (e.target.files.length > 0) importJSON(e.target.files[0]);
        });
        document.getElementById('btn-print-report').addEventListener('click', () => window.print());

        // Settings Profile Form
        document.getElementById('form-settings-profile').addEventListener('submit', (e) => {
            e.preventDefault();
            state.user.name = document.getElementById('settings-name').value.trim();
            state.user.openingBalance = parseFloat(document.getElementById('settings-opening-balance').value) || 0;
            saveState();
            showToast('Settings saved successfully.', 'info');
            renderCurrentView();
        });

        // Custom Category Addition & Removal
        document.getElementById('btn-add-category').addEventListener('click', () => {
            const inp = document.getElementById('new-cat-name');
            const val = inp.value.trim();
            if (val && !state.categories.includes(val)) {
                state.categories.push(val);
                inp.value = '';
                saveState();
                renderSettings();
                showToast(`Category "${val}" added.`, 'info');
            }
        });

        document.getElementById('settings-categories-list').addEventListener('click', (e) => {
            const rmBtn = e.target.closest('.btn-remove-cat');
            if (rmBtn) {
                const cat = rmBtn.dataset.cat;
                state.categories = state.categories.filter(c => c !== cat);
                saveState();
                renderSettings();
            }
        });

        // Reset Data
        document.getElementById('btn-reset-data').addEventListener('click', () => {
            showConfirm('Reset Profile Data', 'This will wipe all transactions, custom categories, and budgets for this profile. Continue?', () => {
                state = createNewUserState(state.user.name, state.user.email);
                saveState();
                renderCurrentView();
                showToast('Profile data reset.', 'warning');
            });
        });

        document.getElementById('link-manage-budgets').addEventListener('click', () => navigateTo('budgets'));
    }

    // ---------------------------------------------------------------------------
    // 12. ENTRY POINT
    // ---------------------------------------------------------------------------
    function initApp() {
        setupEventListeners();

        const storedUser = getCurrentUser();
        if (storedUser) {
            activeUserId = storedUser;
            state = loadState(activeUserId);
        }

        if (state) {
            if (state.settings && state.settings.theme) {
                document.documentElement.setAttribute('data-theme', state.settings.theme);
            }
            navigateTo('overview');
        } else {
            navigateTo('landing');
        }
    }

    // Boot on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }

})();