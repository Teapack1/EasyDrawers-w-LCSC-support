let currentUser = localStorage.getItem('currentUser') || 'guest';
let componentConfig = {};
let searchResults = []; // Store current search results
let currentSortColumn = null;
let sortOrderAsc = true; // Sort order flag
let branchCountsMain = {};

// Utility: Convert engineering values with SI prefixes (e.g., 1uF, 10kΩ) to a base-number for comparison
function engineeringToNumber(value) {
    if (value === undefined || value === null) return NaN;

    // Accept native numbers directly
    if (typeof value === 'number') return value;

    // Normalise string - keep units for parsing
    let str = String(value).trim()
        .replace(/µ/gi, 'u')
        .replace(/\s+/g, '');

    // Basic numeric without units?
    if (!isNaN(parseFloat(str)) && !/[a-zA-Z]/.test(str)) return parseFloat(str);

    // Match: number + prefix + unit (e.g., "100nF", "1uF", "4.7kΩ")
    // OR: number + unit without prefix (e.g., "47F", "100Ω")
    const match = str.match(/^([0-9]*\.?[0-9]+)\s*([pnufmkKMgtT]?)([a-zA-ZΩ]+)$/i);
    if (!match) {
        // Fallback: try just number + prefix without explicit unit
        const fallback = str.match(/^([0-9]*\.?[0-9]+)\s*([pnufmkKMgtT])$/i);
        if (fallback) {
            const numeric = parseFloat(fallback[1]);
            const prefix = fallback[2] || '';
            const SI = {
                '':   1,
                'p':  1e-12,
                'n':  1e-9,
                'u':  1e-6,
                'm':  1e-3,
                'f':  1e-15,
                'k':  1e3,
                'K':  1e3,
                'M':  1e6,
                'g':  1e9,
                'G':  1e9,
                't':  1e12,
                'T':  1e12
            };
            return numeric * (SI[prefix] ?? 1);
        }
        return NaN;
    }

    const numeric = parseFloat(match[1]);
    const prefix = match[2] || '';
    const unit = match[3] || '';

    const SI = {
        '':   1,
        'p':  1e-12,
        'n':  1e-9,
        'u':  1e-6,
        'm':  1e-3,
        'f':  1e-15,
        'k':  1e3,
        'K':  1e3,
        'M':  1e6,
        'g':  1e9,
        'G':  1e9,
        't':  1e12,
        'T':  1e12
    };

    return numeric * (SI[prefix] ?? 1);
}

document.addEventListener('DOMContentLoaded', function () {
    //
    // --- 1. INITIAL SETUP AND EVENT LISTENERS ---
    //
    
    // Tab Switching
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(button.dataset.tab + '-tab').classList.add('active');
        });
    });

    // Mobile Tab Bar
    document.getElementById('mobileSearchBtn')?.addEventListener('click', function () { setActiveMobileTab(this); showTabContent('search'); });
    document.getElementById('mobileAddBtn')?.addEventListener('click', function () { setActiveMobileTab(this); showTabContent('add'); });
    document.getElementById('mobileImportBtn')?.addEventListener('click', function () { setActiveMobileTab(this); showTabContent('import'); });

    // Hamburger Menu
    const menuButton = document.getElementById('menuButton');
    const menuItems = document.querySelector('.menu-items');
    if(menuButton && menuItems) {
        menuButton.addEventListener('click', () => {
        menuButton.classList.toggle('active');
        menuItems.classList.toggle('active');
    });
        document.addEventListener('click', (event) => {
        if (!event.target.closest('.hamburger-menu')) {
            menuButton.classList.remove('active');
            menuItems.classList.remove('active');
        }
    });
    }

    // Main navigation buttons
    document.getElementById('mapButtonMenu')?.addEventListener('click', () => window.location.href = '/map');
    document.getElementById('databaseButton')?.addEventListener('click', () => window.location.href = '/database');
    document.getElementById('changelogButton')?.addEventListener('click', () => window.location.href = '/changelog');

    // Cart button (top bar) – open cart page
    document.getElementById('cartButton')?.addEventListener('click', () => window.location.href = '/cart');

    // User Management
    const userSelectionModal = document.getElementById("userSelectionModal");
    if (userSelectionModal) userSelectionModal.style.display = 'none'; // keep hidden by default
    document.getElementById('loginButton')?.addEventListener("click", () => {
        if (userSelectionModal) userSelectionModal.style.display = "flex";
    });
    document.querySelectorAll(".user-button").forEach(button => {
        button.addEventListener("click", () => {
            currentUser = button.dataset.user;
            localStorage.setItem("currentUser", currentUser);
            userSelectionModal.style.display = "none";
            document.getElementById("currentUserDisplay").textContent = `Current User: ${currentUser}`;
            updateCartState();
        });
    });

    // Form Submissions
    document.getElementById("uploadCsvForm")?.addEventListener("submit", handleLCSCImport);
    document.getElementById("addComponentForm")?.addEventListener("submit", handleAddComponent);
    document.getElementById("uploadBomButton")?.addEventListener('click', handleBomToCart);
    document.getElementById("searchButton")?.addEventListener("click", searchComponent);
    document.getElementById("searchQuery")?.addEventListener("keydown", (e) => { if (e.key === "Enter") searchComponent() });

    // View Toggles & Filters
    initializeFilterAndSort();
    document.getElementById('tableView')?.addEventListener('click', () => switchView('tableView'));
    document.getElementById('cardView')?.addEventListener('click', () => switchView('cardView'));
    window.addEventListener('resize', checkViewMode);

    // Modals
    initializeMapModal();
    initializeHelpModal();
    
    //
    // --- 2. INITIAL DATA LOAD AND UI STATE ---
    //
    fetch('/component_config')
        .then(res => res.json())
        .then(cfg => {
            componentConfig = cfg;
            return fetch('/branch_counts');
        })
        .then(res => res.json())
        .then(counts => {
            branchCountsMain = counts || {};
            // Initial dropdown population
            populateComponentTypes();
            populateFilterComponentTypes();

            document.getElementById("componentType")?.addEventListener("change", () => {
                populateComponentBranches();
                displayDynamicFields();
            });
            document.getElementById("componentBranch")?.addEventListener("change", displayDynamicFields);
        })
        .catch(err => console.error('Init load failed', err));

    document.getElementById("currentUserDisplay").textContent = `Current User: ${currentUser}`;
    displayWithdrawalSummary();
    updateCartState();
    checkViewMode();
});


//
// --- CORE FUNCTIONS (DEFINED GLOBALLY) ---
//

//
// --- MODAL INITIALIZATION & HANDLING ---
//
function initializeMapModal() {
    const mapModal = document.getElementById('mapModal');
    if (!mapModal) return;

    const openMapButtons = [document.getElementById('mapFloatingBtn'), document.getElementById('mobileMapBtn')];
    const closeMapModalBtn = document.getElementById('closeMapModal');
    
    const openMapModal = () => {
        mapModal.classList.add('active');
        document.body.classList.add('modal-open');
        if(!mapModal.dataset.initialized) {
            lazyInitializeModalMap(); // Load map content on first open
            mapModal.dataset.initialized = 'true';
        }
        // Sync map modal with current search state
        syncMapWithSearch();
    };
    const closeMapModal = () => {
        mapModal.classList.remove('active');
        document.body.classList.remove('modal-open');
    };

    openMapButtons.forEach(btn => btn?.addEventListener('click', openMapModal));
    closeMapModalBtn?.addEventListener('click', closeMapModal);
    mapModal.addEventListener('click', e => { if(e.target === mapModal) closeMapModal(); });
    document.addEventListener('keydown', e => { if(e.key === 'Escape' && mapModal.classList.contains('active')) closeMapModal(); });
}

function initializeHelpModal() {
    const helpModal = document.getElementById('helpModal');
    if (!helpModal) return;
    
    const closeHelpModalBtn = document.getElementById('closeHelpModal');
    const helpModalTitle = document.getElementById('helpModalTitle');
    const helpModalBody = document.getElementById('helpModalBody');
    const helpLinks = document.querySelectorAll('.help-link');

    const openHelpModal = (e) => {
        e.preventDefault();
        const helpTopic = e.currentTarget.dataset.help;
        const contentTemplate = document.getElementById(`help-${helpTopic}`);

        if (contentTemplate && helpModalTitle && helpModalBody) {
            const titleText = helpTopic === 'bom-to-cart' ? 'How BOM-to-Cart Works' : 'CSV Format Guide';
            helpModalTitle.textContent = titleText;
            helpModalBody.innerHTML = contentTemplate.innerHTML;
            helpModal.style.display = 'flex';
        }
    };

    const closeHelpModal = () => {
        helpModal.style.display = 'none';
    };

    helpLinks.forEach(link => link.addEventListener('click', openHelpModal));
    closeHelpModalBtn?.addEventListener('click', closeHelpModal);
    helpModal.addEventListener('click', e => { if(e.target === helpModal) closeHelpModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && helpModal.style.display === 'flex') closeHelpModal(); });
}

//
// --- FORM HANDLERS & ASYNC LOGIC ---
//
async function handleLCSCImport(event) {
        event.preventDefault();
        const fileInput = document.getElementById("csvFile");
        const file = fileInput.files[0];
    const user = localStorage.getItem('currentUser');
    if (!user) return alert("Please log in first");
    if (!file) return alert("Please select a CSV file.");

        const formData = new FormData();
        formData.append("file", file);

        try {
        const response = await fetch(`/update_components_from_csv?user=${encodeURIComponent(user)}`, { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || 'Failed to upload components');
        
                alert(result.message);
        if (result.components?.length > 0) {
                    searchResults = result.components;
            if (typeof populateFilterComponentTypes === 'function') {
                populateFilterComponentTypes();
                populateFilterComponentBranches();
            }
            if (typeof updateFilterValueOptions === 'function') updateFilterValueOptions();
            applyFiltersAndSort();
        }
                fileInput.value = '';
        document.getElementById('selected-file-name').textContent = 'No file selected';
        showTabContent('search');
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
}

async function handleAddComponent(event) {
    event.preventDefault();
    // This is a simplified version. The original file has more complex validation and data gathering.
        const formData = {
            component_type: document.getElementById("componentType").value,
            component_branch: document.getElementById("componentBranch").value,
            part_number: document.getElementById("partNumber").value.trim(),
            storage_place: document.getElementById("storagePlace").value.trim(),
            order_qty: parseInt(document.getElementById("orderQty").value),
    };

        try {
            const response = await fetch("/add_component", {
                method: "POST",
            headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail);
        }
                alert("Component added successfully.");
                document.getElementById("addComponentForm").reset();
                document.getElementById("searchQuery").value = formData.part_number;
        showTabContent('search');
                searchComponent();
        } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function handleBomToCart() {
    const fileInput = document.getElementById('bomFile');
    const file = fileInput.files[0];
    const user = localStorage.getItem('currentUser');
    if (!user) return alert('Please select a user first.');
    if (!file) return alert('Please select a BOM file first.');

    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch(`/upload_bom?user=${user}`, { method: 'POST', body: formData });
        if (!response.ok) throw new Error(await response.text());
        
        const result = await response.json();
        updateCartState();

        showBomResultModal(result);
        fileInput.value = '';
    } catch (error) {
        alert('Failed to upload BOM: ' + error.message);
    }
}

function showBomResultModal(result) {
    // Remove existing if any
    const existing = document.getElementById('bomResultModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'bomResultModal';
    modal.style.display = 'flex';

    const content = document.createElement('div');
    content.className = 'modal-content';

    const header = document.createElement('div');
    header.className = 'modal-header';
    header.innerHTML = '<h2>BOM Import Results</h2>';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-modal-btn';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => modal.remove();
    header.appendChild(closeBtn);

    const body = document.createElement('div');
    body.className = 'modal-body';

    // Found components
    if (result.found_components && result.found_components.length > 0) {
        const h = document.createElement('h3');
        h.textContent = 'Found Components';
        h.className = 'found-header';
        body.appendChild(h);
        const ul = document.createElement('ul');
        result.found_components.forEach(c => {
            const li = document.createElement('li');
            li.innerHTML = `
              <div class="item-main"><span>${c.part_number} (${c.designator})</span><span>${c.quantity} pcs</span></div>
              ${c.description ? `<small>${c.description}</small>` : ''}`;
            ul.appendChild(li);
        });
        body.appendChild(ul);
    }

    // Not found components
    if (result.not_found_components && result.not_found_components.length > 0) {
        const h = document.createElement('h3');
        h.textContent = 'Not Found Components';
        h.className = 'notfound-header';
        body.appendChild(h);
        const ul = document.createElement('ul');
        result.not_found_components.forEach(c => {
            const li = document.createElement('li');
            li.innerHTML = `
              <div class="item-main"><span>${c.supplier_part || c.part_number} (${c.designator})</span><span>${c.quantity} pcs</span></div>
              ${c.description ? `<small>${c.description}</small>` : ''}`;
            ul.appendChild(li);
        });
        body.appendChild(ul);

        // copy to clipboard button
        const copyBtn = document.createElement('button');
        copyBtn.textContent = 'Copy Not-Found List';
        copyBtn.className = 'copy-btn';
        copyBtn.onclick = () => {
            const text = result.not_found_components.map(c => `${c.supplier_part || c.part_number} (${c.designator}) x${c.quantity}`).join('\n');
            navigator.clipboard.writeText(text).then(() => alert('List copied to clipboard'));
        };
        body.appendChild(copyBtn);
    }

    content.appendChild(header);
    content.appendChild(body);
    modal.appendChild(content);
    document.body.appendChild(modal);

    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.addEventListener('keydown', escHandler);
    function escHandler(e) { if (e.key==='Escape') { modal.remove(); document.removeEventListener('keydown', escHandler);} }
}

//
// --- UI & DATA MANIPULATION ---
//
function setActiveMobileTab(activeTab) {
    document.querySelectorAll('.mobile-tab-btn').forEach(tab => tab.classList.remove('active'));
    activeTab.classList.add('active');
}

function showTabContent(tabId) {
    document.querySelector(`.tab-button[data-tab="${tabId}"]`)?.click();
}

function switchView(viewId) {
    document.querySelectorAll('.view-button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(viewId)?.classList.add('active');
    document.querySelectorAll('.view-container').forEach(container => {
        container.style.display = container.id === viewId + 'Container' ? 'block' : 'none';
    });
}

function checkViewMode() {
    if (window.innerWidth <= 768) {
        switchView('cardView');
            } else {
        switchView('tableView');
    }
}

async function searchComponent() {
    const query = document.getElementById("searchQuery").value;
    const componentType = document.getElementById("filterComponentType").value;
    const componentBranch = document.getElementById("filterComponentBranch").value;
    const inStockOnly = document.getElementById("inStockCheckbox").checked;

    let url = `/search_component?query=${encodeURIComponent(query)}&component_type=${encodeURIComponent(componentType)}&component_branch=${encodeURIComponent(componentBranch)}&in_stock=${inStockOnly}`;
    
    try {
    const response = await fetch(url);
        if (!response.ok) throw new Error('Search failed');
        searchResults = await response.json();
        if (typeof populateFilterComponentTypes === 'function') {
            populateFilterComponentTypes();
            populateFilterComponentBranches();
        }
        if (typeof updateFilterValueOptions === 'function') updateFilterValueOptions();
        applyFiltersAndSort();
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

function displaySearchResults(results) {
    const tableView = document.getElementById("tableViewContainer");
    const cardView = document.getElementById("cardViewContainer");
    const resultsGrid = cardView.querySelector(".results-grid");
    const tableBody = document.getElementById("resultsTableBody");

    // Clear previous results
    resultsGrid.innerHTML = "";
    tableBody.innerHTML = "";

    results.forEach(component => {
        // ---- TABLE VIEW ROW ----
        const row = document.createElement("tr");
        row.innerHTML = `
            <td class="lcsc-col">${component.part_number}</td>
            <td class="mpn-cell" title="${component.manufacture_part_number || ''}">${component.manufacture_part_number || ''}</td>
            <td>${component.component_branch || ''}</td>
            <td class="key-col capacitance-col">${component.capacitance || ''}</td>
            <td class="key-col resistance-col">${component.resistance || ''}</td>
            <td class="key-col voltage-col">${component.voltage || ''}</td>
            <td class="key-col inductance-col">${component.inductance || ''}</td>
            <td class="key-col package-col">${component.package || ''}</td>
            <td class="order-qty">${component.order_qty}</td>
            <td>
                <button class="add-to-cart-button icon-only" data-id="${component.id}" data-tooltip="Add to cart">
                    <span class="material-icons" style="font-size:18px;vertical-align:middle;">add_shopping_cart</span>
                </button>
            </td>`;

        // Expandable details
        row.addEventListener('click', (event) => {
            if (event.target.tagName === 'BUTTON' || event.target.closest('.add-to-cart-button')) return;
            row.classList.toggle('expanded');
            if (row.classList.contains('expanded')) {
                tableBody.querySelectorAll('tr.detail-row').forEach(r => r.remove());
                tableBody.querySelectorAll('tr.expanded').forEach(other => { if (other!==row) other.classList.remove('expanded'); });
                const detail = document.createElement('tr');
                detail.className = 'detail-row';
                detail.innerHTML = `
                    <td colspan="9">
                        <div class="detail-content compact-detail-content">
                            <div class="detail-fields">
                                <strong>MPN:</strong> ${component.manufacture_part_number || ''} &nbsp; 
                                <strong>Manufacturer:</strong> ${component.manufacturer || ''} &nbsp; 
                                <strong>Description:</strong> ${component.description || ''} &nbsp; 
                                <strong>Unit Price($):</strong> ${component.unit_price || ''} &nbsp; 
                                <strong>Component Type:</strong> ${component.component_type || ''} &nbsp; 
                                <strong>Tolerance:</strong> ${component.tolerance || ''} &nbsp; 
                                <strong>Current/Power:</strong> ${component.current_power || ''} &nbsp; 
                                <strong>Storage Place:</strong> ${component.storage_place || ''}
                            </div>
                        </div>
                    </td>
                    <td class="expanded-actions-cell">
                        <div class="expanded-actions-row">
                            <input type="number" class="quantity-input" value="1" min="1" max="${component.order_qty}">
                            <button class="delete-button" data-id="${component.id}" data-tooltip="Delete component">×</button>
                        </div>
                   </td>`;
                row.after(detail);

                // --- Attach listeners for the newly added controls ---
                addAddToCartButtonEventListeners();
                addDeleteButtonEventListeners();
            } else {
                if (row.nextSibling && row.nextSibling.classList.contains('detail-row')) row.nextSibling.remove();
            }
        });

        tableBody.appendChild(row);

        // ---- CARD VIEW ELEMENT ----
        const card = document.createElement("div");
        card.className = "component-card";
        card.innerHTML = `
            <div class="card-header">
                <span class="essential-field">${component.part_number}</span>
                <span>${component.order_qty} pcs</span>
            </div>
            <div class="card-content">
                <div class="essential-info">
                    <div><span class="card-label">Branch:</span> ${component.component_branch || ''}</div>
                    <div><span class="card-label">Storage:</span> ${component.storage_place || 'N/A'}</div>
                </div>
                <div class="specs-info">
                    ${component.resistance ? `<div><span class="card-label">R:</span> ${component.resistance}</div>` : ''}
                    ${component.capacitance ? `<div><span class="card-label">C:</span> ${component.capacitance}</div>` : ''}
                    ${component.voltage ? `<div><span class="card-label">V:</span> ${component.voltage}</div>` : ''}
                    ${component.inductance ? `<div><span class="card-label">L:</span> ${component.inductance}</div>` : ''}
                    ${component.package ? `<div><span class="card-label">Pkg:</span> ${component.package}</div>` : ''}
                </div>
                <button class="show-more">More Details</button>
                <div class="optional-fields" style="display: none;">
                    <div><span class="card-label">MPN:</span> ${component.manufacture_part_number || ''}</div>
                    <div><span class="card-label">Manuf:</span> ${component.manufacturer || ''}</div>
                    <div><span class="card-label">Desc:</span> ${component.description || ''}</div>
                    <div><span class="card-label">Type:</span> ${component.component_type || ''}</div>
                    <div><span class="card-label">Tol:</span> ${component.tolerance || ''}</div>
                    <div><span class="card-label">Pwr:</span> ${component.current_power || ''}</div>
                    <div><span class="card-label">Price:</span> ${component.unit_price || ''}</div>
                </div>
            </div>
            <div class="card-actions">
                <div class="quantity-controls">
                    <button class="decrease" data-id="${component.id}">-</button>
                    <input type="number" class="quantity-input" value="1" min="1" max="${component.order_qty}">
                    <button class="increase" data-id="${component.id}">+</button>
                </div>
                <button class="add-to-cart-button" data-id="${component.id}">Add</button>
                <button class="delete-button" data-id="${component.id}">Del</button>
            </div>`;
        resultsGrid.appendChild(card);
    });

    // Card view show more toggles
    document.querySelectorAll('#cardViewContainer .show-more').forEach(btn=>{
        btn.addEventListener('click',e=>{
            const opts=e.target.nextElementSibling;
            if (opts.style.display==='none'||!opts.style.display){ opts.style.display='block'; btn.textContent='Less Details';}
            else {opts.style.display='none'; btn.textContent='More Details';}
        });
    });

    addQuantityControlEventListeners();
    addDeleteButtonEventListeners();
    addAddToCartButtonEventListeners();
}

function applyFiltersAndSort() {
    let results = [...searchResults];

    // Category filter values
    const type = document.getElementById('filterComponentType')?.value || '';
    const branch = document.getElementById('filterComponentBranch')?.value || '';

    // Generic filter dropdowns (resistance, package, etc.)
    const filterCat = document.getElementById('filterCategory')?.value || '';
    const minValSel = document.getElementById('filterMinValue');
    const maxValSel = document.getElementById('filterMaxValue');
    const minVal = minValSel && !minValSel.disabled ? minValSel.value : '';
    const maxVal = maxValSel && !maxValSel.disabled ? maxValSel.value : '';

    // Apply type / branch filters
    if (type) results = results.filter(r => r.component_type === type);
    if (branch) results = results.filter(r => r.component_branch === branch);

    // Apply numeric filters if applicable
    if (filterCat) {
        const unitCategories = new Set(['capacitance','resistance','inductance','voltage']);
        const numeric = unitCategories.has(filterCat) || results.every(r => !isNaN(parseFloat(r[filterCat])));

        results = results.filter(r => {
            const v = r[filterCat];
            if (v === undefined || v === null || v === '') return false;

            if (numeric) {
                const num = unitCategories.has(filterCat) ? engineeringToNumber(v) : parseFloat(v);
                const minN = minVal ? (unitCategories.has(filterCat) ? engineeringToNumber(minVal) : parseFloat(minVal)) : null;
                const maxN = maxVal ? (unitCategories.has(filterCat) ? engineeringToNumber(maxVal) : parseFloat(maxVal)) : null;

                if (minN !== null && maxN !== null) return num >= minN && num <= maxN;
                if (minN !== null) return num >= minN;
                return true;
    } else {
                // Non-numeric: treat minVal as exact match
                if (minVal && v !== minVal) return false;
                return true;
            }
        });
    }

    // Sorting
    const sortCat = document.getElementById('sortCategory')?.value || '';
    const sortOrder = document.getElementById('sortOrder')?.value || 'asc';
    if (sortCat) {
        const unitCategories = new Set(['capacitance','resistance','inductance','voltage']);
        const numericSort = unitCategories.has(sortCat) || results.every(r => !isNaN(parseFloat(r[sortCat])));

        results.sort((a, b) => {
            const va = a[sortCat] ?? '';
            const vb = b[sortCat] ?? '';

            if (numericSort) {
                const na = unitCategories.has(sortCat) ? engineeringToNumber(va) : parseFloat(va);
                const nb = unitCategories.has(sortCat) ? engineeringToNumber(vb) : parseFloat(vb);
                return sortOrder === 'asc' ? na - nb : nb - na;
            }

            return sortOrder === 'asc'
                ? String(va).localeCompare(String(vb), undefined, { numeric: true })
                : String(vb).localeCompare(String(va), undefined, { numeric: true });
        });
    }

    displaySearchResults(results);
}


async function updateCartState() {
    try {
        const user = localStorage.getItem('currentUser') || 'guest';
        const response = await fetch(`/get_cart?user=${user}`);
    if (response.ok) {
            const cartData = await response.json();
            const cartButton = document.getElementById('cartButton');
            if (cartButton) {
                cartButton.classList.toggle('has-items', cartData.length > 0);
                cartButton.classList.toggle('empty', cartData.length === 0);
            }
                }
            } catch (error) {
        console.error('Error updating cart state:', error);
    }
}

function displayWithdrawalSummary() {
    // ... logic from original file ...
}

function addQuantityControlEventListeners() {
    document.querySelectorAll(".quantity-controls .increase").forEach(btn=>{
        btn.addEventListener('click',async e=>{
            e.stopPropagation();
            const id=e.target.dataset.id;
            const qtyInput=e.target.closest('.quantity-controls').querySelector('.quantity-input');
            qtyInput.value=parseInt(qtyInput.value)+1;
        });
    });
    document.querySelectorAll(".quantity-controls .decrease").forEach(btn=>{
        btn.addEventListener('click',e=>{
            e.stopPropagation();
            const qtyInput=e.target.closest('.quantity-controls').querySelector('.quantity-input');
            qtyInput.value=Math.max(1,parseInt(qtyInput.value)-1);
        });
    });
}

function addDeleteButtonEventListeners() {
    document.querySelectorAll('.delete-button').forEach(btn=>{
        btn.addEventListener('click',async e=>{
            e.stopPropagation();
            const id=btn.dataset.id;
            if (!currentUser) {alert('Login first'); return;}
            const ok=confirm('Delete this component?');
            if(!ok) return;
            try {
                await fetch('/delete_component',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({component_id:id,user:currentUser})});
                // Remove from searchResults
                searchResults = searchResults.filter(c=>String(c.id)!==String(id));
                // Remove table rows
                const mainRow=btn.closest('tr');
                const next=mainRow?.nextSibling;
                mainRow?.remove();
                if(next?.classList?.contains('detail-row')) next.remove();
                // Remove card view element
                document.querySelectorAll('.component-card').forEach(card=>{
                    if(card.querySelector('.delete-button')?.dataset.id===String(id)) card.remove();
                });
            } catch(err){ alert('Delete failed'); }
        });
    });
}

function addAddToCartButtonEventListeners() {
    document.querySelectorAll('.add-to-cart-button').forEach(btn=>{
        if(btn.dataset.listenerAttached) return;
        btn.addEventListener('click',async e=>{
            e.stopPropagation();
            if (!currentUser) {alert('Please log in first'); return;}
            const id=btn.dataset.id;
            let qty=1;

            // 1) If button is inside an expanded detail row, grab qty directly
            const detailRow = btn.closest('tr.detail-row');
            if(detailRow){
                const qi = detailRow.querySelector('.quantity-input');
                if(qi) qty = parseInt(qi.value) || 1;
            } else {
                // 2) If button is in main row that is expanded, look at its sibling detail row
                const mainRow = btn.closest('tr.expanded');
                if(mainRow){
                    const qi = mainRow.nextSibling?.querySelector('.quantity-input');
                    if(qi) qty = parseInt(qi.value) || 1;
                }
            }

            // 3) Card view
            const card = btn.closest('.component-card');
            if(card){ const qi=card.querySelector('.quantity-input'); if(qi) qty=parseInt(qi.value)||1; }

            try{
                await fetch('/add_to_cart',{
                    method:'POST',
                    headers:{'Content-Type':'application/json'},
                    body:JSON.stringify({user:currentUser,component_id:id,quantity:qty})
                });
                // --- Update UI stock quantity ---
                // Update searchResults array
                const comp = searchResults.find(c=>String(c.id)===String(id));
                if(comp){ comp.order_qty = Math.max(0, (parseInt(comp.order_qty)||0) - qty); }

                // Update table view cell
                document.querySelectorAll(`#resultsTableBody tr`).forEach(r=>{
                    const btn=r.querySelector('.add-to-cart-button');
                    if(btn && btn.dataset.id===String(id)){
                        const qtyCell=r.querySelector('.order-qty');
                        if(qtyCell) qtyCell.textContent = comp? comp.order_qty : '';
                        if((comp?.order_qty||0)<=0){ r.remove(); r.nextSibling?.classList.contains('detail-row')&&r.nextSibling.remove(); }
                    }
                });
                // Update card view element
                document.querySelectorAll('.component-card').forEach(cardEl=>{
                    const btn=cardEl.querySelector('.add-to-cart-button');
                    if(btn && btn.dataset.id===String(id)){
                        const headerSpan=cardEl.querySelector('.card-header span:nth-child(2)');
                        if(headerSpan) headerSpan.textContent = `${comp?comp.order_qty:0} pcs`;
                        if((comp?.order_qty||0)<=0){ cardEl.remove(); }
                    }
                });

                alert('Added to cart');
                updateCartState();
            }catch(err){
                alert('Failed to add');
            }
        });
        btn.dataset.listenerAttached='true';
    });
}

function populateComponentTypes() {
    const sel = document.getElementById('componentType');
    if (!sel || !componentConfig) return;
    sel.innerHTML = '<option value="">Select Component Type</option>';
    Object.keys(componentConfig).sort().forEach(t => {
        const opt=document.createElement('option'); opt.value=t; opt.textContent=t; sel.appendChild(opt);
    });
}

function populateComponentBranches() {
    const typeSel = document.getElementById('componentType');
    const branchSel = document.getElementById('componentBranch');
    if (!typeSel || !branchSel) return;
    const type = typeSel.value;
    branchSel.innerHTML = '<option value="">Select Component Branch</option>';
    if (type && componentConfig[type]) {
        Object.keys(componentConfig[type]['Component Branch']).sort().forEach(br => {
            const opt=document.createElement('option'); opt.value=br; opt.textContent=br; branchSel.appendChild(opt);
        });
        branchSel.disabled=false;
    } else branchSel.disabled=true;
}

function populateFilterComponentTypes() {
    const sel = document.getElementById('filterComponentType');
    if (!sel) return;

    // Build counts from current searchResults if available; otherwise fall back to componentConfig
    const counts = {};
    if (Array.isArray(searchResults) && searchResults.length) {
        searchResults.forEach(c => {
            if (c.component_type) counts[c.component_type] = (counts[c.component_type] || 0) + 1;
        });
    } else if (Object.keys(branchCountsMain).length) {
        Object.entries(branchCountsMain).forEach(([type, branchObj]) => {
            const cnt = Object.values(branchObj).reduce((a, b) => a + b, 0);
            if (cnt) counts[type] = cnt;
        });
    } else if (typeof componentConfig === 'object') {
        // Fallback to config structure
        Object.entries(componentConfig).forEach(([t, tData]) => {
            const branches = tData['Component Branch'] || {};
            const cnt = Object.values(branches).length;
            if (cnt) counts[t] = cnt;
        });
    }

    // Preserve current selection
    const currentVal = sel.value;

    sel.innerHTML = '<option value="">All Component Types</option>';
    Object.entries(counts)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([type, cnt]) => {
            if (cnt > 0) {
                const opt = document.createElement('option');
                opt.value = type;
                opt.textContent = `${type} (${cnt})`;
                sel.appendChild(opt);
            }
        });

    sel.value = currentVal; // restore if still present

    // onchange handler
    sel.onchange = () => {
        populateFilterComponentBranches();
        applyFiltersAndSort();
    };
}

function populateFilterComponentBranches() {
    const typeSel = document.getElementById('filterComponentType');
    const branchSel = document.getElementById('filterComponentBranch');
    if (!typeSel || !branchSel) return;

    const selectedType = typeSel.value;

    // Build branch counts from searchResults based on selected type (or overall if none)
    const branchCounts = {};
    if (Array.isArray(searchResults) && searchResults.length) {
        searchResults.forEach(c => {
            if ((!selectedType || c.component_type === selectedType) && c.component_branch) {
                const key = c.component_branch;
                branchCounts[key] = (branchCounts[key] || 0) + 1;
            }
        });
    } else if (selectedType && branchCountsMain[selectedType]) {
        Object.entries(branchCountsMain[selectedType]).forEach(([br, cnt]) => {
            branchCounts[br] = cnt;
        });
    } else if (selectedType && componentConfig[selectedType]) {
        Object.keys(componentConfig[selectedType]['Component Branch']).forEach(br => {
            branchCounts[br] = 1;
        });
    }

    const currentVal = branchSel.value;

    branchSel.innerHTML = '<option value="">All Component Branches</option>';
    Object.entries(branchCounts)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([branch, cnt]) => {
            if (cnt > 0) {
                const opt = document.createElement('option');
                opt.value = branch;
                opt.textContent = `${branch} (${cnt})`;
                branchSel.appendChild(opt);
            }
        });

    branchSel.disabled = Object.keys(branchCounts).length === 0;
    branchSel.value = currentVal;

    branchSel.onchange = () => applyFiltersAndSort();
}

function displayDynamicFields() { /* keep empty for now */ }

function initializeFilterAndSort() {
    const filterCategorySel = document.getElementById('filterCategory');
    const filterMinSel = document.getElementById('filterMinValue');
    const filterMaxSel = document.getElementById('filterMaxValue');
    const sortCatSel = document.getElementById('sortCategory');
    const sortOrderSel = document.getElementById('sortOrder');

    if (!filterCategorySel) return; // controls not present (safety)

    // Populate value selects whenever category changes
    filterCategorySel.onchange = () => {
        updateFilterValueOptions();
        applyFiltersAndSort();
    };

    // Trigger filtering when min / max change
    [filterMinSel, filterMaxSel].forEach(sel => sel && (sel.onchange = applyFiltersAndSort));

    // Sorting controls
    if (sortCatSel) sortCatSel.onchange = () => { applyFiltersAndSort(); };
    if (sortOrderSel) sortOrderSel.onchange = () => { applyFiltersAndSort(); };
}

function updateFilterValueOptions() {
    const filterCategorySel = document.getElementById('filterCategory');
    const filterMinSel = document.getElementById('filterMinValue');
    const filterMaxSel = document.getElementById('filterMaxValue');

    if (!filterCategorySel || !filterMinSel || !filterMaxSel) return;

    const cat = filterCategorySel.value;
    if (!cat) {
        filterMinSel.disabled = true;
        filterMaxSel.disabled = true;
        filterMinSel.innerHTML = '<option value="">Min/Exact value...</option>';
        filterMaxSel.innerHTML = '<option value="">Max value (optional)...</option>';
        return;
    }

    // Gather unique values from current searchResults for selected category
    const values = [...new Set(searchResults.map(r => r[cat]).filter(v => v !== undefined && v !== null && v !== ''))];

    const unitCategories = new Set(['capacitance','resistance','inductance','voltage']);
    const numeric = unitCategories.has(cat) || values.every(v => !isNaN(parseFloat(v)));

    // Sort list appropriately
    if (numeric) {
        if (unitCategories.has(cat)) values.sort((a,b)=>engineeringToNumber(a)-engineeringToNumber(b));
        else values.sort((a,b)=>parseFloat(a)-parseFloat(b));
    } else {
        values.sort((a,b)=>String(a).localeCompare(String(b), undefined, {numeric:true}));
    }

    const buildOptions = (includeBlank=true) => {
        let html = includeBlank ? '<option value="">-- Any --</option>' : '';
        values.forEach(v => { html += `<option value="${v}">${v}</option>`; });
        return html;
    };

    filterMinSel.innerHTML = buildOptions();
    filterMaxSel.innerHTML = buildOptions();
    filterMinSel.disabled = false;
    filterMaxSel.disabled = false;
}

// Sync map modal with current search state
function syncMapWithSearch() {
    const mapModal = document.getElementById('mapModal');
    if (!mapModal || !mapModal.dataset.initialized) return;

    // Get current search state
    const searchQuery = document.getElementById("searchQuery")?.value?.trim() || '';
    const currentType = document.getElementById("filterComponentType")?.value || '';
    const currentBranch = document.getElementById("filterComponentBranch")?.value || '';

    // Get modal filter elements
    const modalTypeFilter = document.getElementById('modalComponentTypeFilter');
    const modalBranchFilter = document.getElementById('modalComponentBranchFilter');
    const modalSearchInput = document.getElementById('modalPartNumberSearch');

    if (!modalTypeFilter) return; // Modal not fully initialized yet

    // Clear previous highlights
    const gridEl = mapModal.querySelector('.map-grid');
    if (gridEl) {
        gridEl.querySelectorAll('.drawer').forEach(dr => dr.classList.remove('highlighted'));
    }

    // Case 1: Text search with results - highlight first result's location
    if (searchQuery && searchResults && searchResults.length > 0) {
        const firstResult = searchResults[0];
        if (firstResult.storage_place) {
            const drawer = gridEl?.querySelector(`.drawer[data-location="${firstResult.storage_place}"]`);
            if (drawer) {
                drawer.classList.add('highlighted');
            }
        }
        // Also set the search input in modal to show what was searched
        if (modalSearchInput) {
            modalSearchInput.value = searchQuery;
        }
        return; // Don't apply type/branch filters when doing text search
    }

    // Case 2: Type/Branch filtering - sync the dropdowns and apply filters
    if (currentType || currentBranch) {
        // Set modal type filter
        if (modalTypeFilter && currentType) {
            modalTypeFilter.value = currentType;
            // Trigger change event to populate branch dropdown
            modalTypeFilter.dispatchEvent(new Event('change'));
            
            // Wait a moment for branch dropdown to populate, then set branch
            setTimeout(() => {
                if (modalBranchFilter && currentBranch) {
                    modalBranchFilter.value = currentBranch;
                    modalBranchFilter.dispatchEvent(new Event('change'));
                }
            }, 50);
        }
    }

    // Clear modal search input if we're doing type/branch filtering
    if (modalSearchInput && !searchQuery) {
        modalSearchInput.value = '';
    }
}

async function lazyInitializeModalMap() {
    const mapModal = document.getElementById('mapModal');
    if (!mapModal) return;

    const gridEl = mapModal.querySelector('.map-grid');
    if (!gridEl) return;

    // Fetch component config (layout) and storage data (occupancy)
    try {
        const [cfgRes, dataRes] = await Promise.all([
            fetch('/component_config'),
            fetch('/storage_data')
        ]);
        const cfg = await cfgRes.json();
        const storageData = await dataRes.json();

        // Determine unique storage places from config so empty drawers are still shown
        const storagePlaces = new Set();
        Object.values(cfg).forEach(type => {
            Object.values(type['Component Branch'] || {}).forEach(branch => {
                if (branch['Storage Place']) storagePlaces.add(branch['Storage Place']);
    });
});

        // Use persisted layout size or defaults
        const rows = parseInt(localStorage.getItem('mapRows')) || 6;
        const cols = parseInt(localStorage.getItem('mapCols')) || 8;
        const extras = parseInt(localStorage.getItem('mapExtra')) || 0; // extra drawers (U1…)

        // Apply CSS grid variables
        gridEl.style.setProperty('--map-cols', cols);
        gridEl.style.setProperty('--map-rows', rows);
        gridEl.style.setProperty('--map-drawer-size', '90px');
        gridEl.style.setProperty('--map-gap', '8px');

        // Clear existing
        gridEl.innerHTML = '';

        // Build main grid
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for (let r = 0; r < rows; r++) {
            for (let c = 1; c <= cols; c++) {
                const loc = `${alphabet[r]}${c}`;
                storagePlaces.add(loc); // ensure config completeness
            }
        }

        // Render drawers in sorted order
        Array.from(storagePlaces).sort((a,b) => a.localeCompare(b, undefined,{numeric:true})).forEach(loc => {
            gridEl.appendChild(createDrawer(loc, storageData[loc]));
        });

        // Separator + extra drawers
        if (extras > 0) {
            const sep = document.createElement('div');
            sep.className = 'grid-separator';
            sep.style.gridColumn = '1 / -1';
            gridEl.appendChild(sep);
            for (let i=1;i<=extras;i++) {
                const loc = `U${i}`;
                gridEl.appendChild(createDrawer(loc, storageData[loc]));
            }
        }

        // Populate type filter dropdown
        const typeSel = document.getElementById('modalComponentTypeFilter');
        if (typeSel) {
            typeSel.innerHTML = '<option value="">Select Component Type</option>';
            Object.keys(cfg).sort().forEach(t => {
                const opt = document.createElement('option'); opt.value=t; opt.textContent=t; typeSel.appendChild(opt);
            });
            typeSel.onchange = () => updateBranchFilter(cfg, storageData);
        }

        document.getElementById('modalComponentBranchFilter')?.addEventListener('change', () => applyMapFilters(cfg, storageData));

        // Search by part number
        document.getElementById('modalSearchButton')?.addEventListener('click', () => searchInMap());

        // Add Enter key support for modal search
        document.getElementById('modalPartNumberSearch')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchInMap();
            }
        });

    } catch(e) { console.error('Init modal map failed',e); }

    function createDrawer(location, contents) {
        const d = document.createElement('div');
        d.className = 'drawer ' + ((contents && contents.length)?'occupied':'empty');
        d.dataset.location = location;
        const label = document.createElement('span'); label.className="drawer-label"; label.textContent=location;
        d.appendChild(label);
        d.onclick = () => showDrawerContents(location, contents||[]);
        return d;
    }

    function showDrawerContents(location, comps) {
        const panel = mapModal.querySelector('.drawer-info-panel');
        if (!panel) return;
        const body = panel.querySelector('.drawer-info-content');
        body.innerHTML = '';
        if (comps.length===0) { body.innerHTML='<p>No components stored here.</p>'; }
        else {
            const grouped = {};
            comps.forEach(c=>{
                const key = `${c.component_type||'N/A'} - ${c.component_branch||'N/A'}`;
                grouped[key] = grouped[key]||[]; grouped[key].push(c);
            });
            Object.entries(grouped).forEach(([g,arr])=>{
                const sec = document.createElement('div'); sec.className='content-section';
                sec.innerHTML = `<h4>${g}</h4><ul>${arr.map(c=>`<li><span>${c.part_number}</span><small>${c.description||''}</small><span>Qty: ${c.order_qty}</span></li>`).join('')}</ul>`;
                body.appendChild(sec);
            });
        }
        // Use flex for consistency (matches standalone map page)
        panel.style.display='flex';

        // Defer attaching outside-click listener so the current click doesn't immediately close the panel
        setTimeout(() => {
            document.addEventListener('click', closeInfoPanelOnClickOutside, { once: true });
        }, 0);
    }

    // Close info panel when clicking outside of it (but not when clicking another drawer)
    function closeInfoPanelOnClickOutside(event) {
        const infoPanel = mapModal.querySelector('.drawer-info-panel');
        if (!infoPanel) return;
        if (!infoPanel.contains(event.target) && !event.target.closest('.drawer')) {
            infoPanel.style.display = 'none';
        } else if (infoPanel.style.display === 'flex') {
            // If the click was inside, re-attach listener for the next outside click
            document.addEventListener('click', closeInfoPanelOnClickOutside, { once: true });
        }
    }

    // Attach X-button close handler once after DOM is ready
    const drawerInfoCloseBtn = mapModal.querySelector('.drawer-info-panel .close-button');
    if (drawerInfoCloseBtn) {
        drawerInfoCloseBtn.addEventListener('click', () => {
            const infoPanel = mapModal.querySelector('.drawer-info-panel');
            if (infoPanel) infoPanel.style.display = 'none';
            document.removeEventListener('click', closeInfoPanelOnClickOutside);
        });
    }

    // Allow Escape key to close the drawer info panel
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const infoPanel = mapModal.querySelector('.drawer-info-panel');
            if (infoPanel && infoPanel.style.display === 'flex') {
                infoPanel.style.display = 'none';
                document.removeEventListener('click', closeInfoPanelOnClickOutside);
            }
        }
    });

    function updateBranchFilter(cfg, data = storageData) {
        const typeSel=document.getElementById('modalComponentTypeFilter');
        const branchSel=document.getElementById('modalComponentBranchFilter');
        branchSel.innerHTML='<option value="">Select Component Branch</option>';
        const t=typeSel.value;
        if (t && cfg[t]) {
            Object.keys(cfg[t]['Component Branch']).sort().forEach(b=>{
                const opt=document.createElement('option'); opt.value=b; opt.textContent=b; branchSel.appendChild(opt);
            });
            branchSel.disabled=false;
        } else branchSel.disabled=true;
        applyMapFilters(cfg, data);
    }

    function applyMapFilters(cfg, data) {
        const t=document.getElementById('modalComponentTypeFilter').value;
        const b=document.getElementById('modalComponentBranchFilter').value;
        gridEl.querySelectorAll('.drawer').forEach(dr=>dr.classList.remove('highlighted'));
        if (!t && !b) return;
        Object.entries(data).forEach(([loc, comps])=>{
            const match = comps.some(c=>(!t||c.component_type===t)&&(!b||c.component_branch===b));
            if(match){ gridEl.querySelector(`.drawer[data-location="${loc}"]`)?.classList.add('highlighted'); }
        });
    }

    async function searchInMap() {
        const q=document.getElementById('modalPartNumberSearch').value.trim();
        if (!q) { gridEl.querySelectorAll('.drawer').forEach(d=>d.classList.remove('highlighted')); return; }
        try {
            const res = await fetch(`/search_component?query=${encodeURIComponent(q)}`);
            if (!res.ok) throw new Error();
            const comps= await res.json();
            const locs=new Set(comps.map(c=>c.storage_place).filter(Boolean));
            gridEl.querySelectorAll('.drawer').forEach(d=>d.classList.remove('highlighted'));
            locs.forEach(l=>gridEl.querySelector(`.drawer[data-location="${l}"]`)?.classList.add('highlighted'));
        } catch(e){ alert('Component not found'); }
    }
}

// Note: All other helper functions from the original file should be included here at the top level.
// This is a structural representation.