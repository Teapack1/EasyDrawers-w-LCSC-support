// Hamburger menu functionality
document.addEventListener('DOMContentLoaded', function () {
    // Tab Functionality
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            const tabId = button.getAttribute('data-tab') + '-tab';
            document.getElementById(tabId).classList.add('active');
        });
    });

    // Accordion Functionality
    const accordions = document.querySelectorAll('.accordion');

    accordions.forEach(accordion => {
        const header = accordion.querySelector('.accordion-header');

        header.addEventListener('click', () => {
            accordion.classList.toggle('active');
        });
    });

    // File Upload Display
    const fileInput = document.getElementById('csvFile');
    const fileNameDisplay = document.getElementById('selected-file-name');

    if (fileInput && fileNameDisplay) {
        fileInput.addEventListener('change', (event) => {
            if (event.target.files.length > 0) {
                fileNameDisplay.textContent = event.target.files[0].name;
            } else {
                fileNameDisplay.textContent = 'No file selected';
            }
        });
    }

    const menuButton = document.getElementById('menuButton');
    const menuItems = document.querySelector('.menu-items');

    menuButton.addEventListener('click', function () {
        menuButton.classList.toggle('active');
        menuItems.classList.toggle('active');
    });

    // Close menu when clicking outside
    document.addEventListener('click', function (event) {
        if (!event.target.closest('.hamburger-menu')) {
            menuButton.classList.remove('active');
            menuItems.classList.remove('active');
        }
    });

    // Handle menu item clicks
    document.getElementById('mapButtonMenu').addEventListener('click', function () {
        window.location.href = '/map';
    });

    document.getElementById('databaseButton').addEventListener('click', function () {
        window.location.href = '/database';
    });

    document.getElementById('changelogButton').addEventListener('click', function () {
        window.location.href = '/changelog';
    });

    // Map Modal Functionality
    const mapModal = document.getElementById('mapModal');
    const closeMapModalBtn = document.getElementById('closeMapModal');
    const assignBranchModal = document.getElementById('assignBranchModal');

    // --- Simplified Map Config Logic for Modal --- 
    // We still read from localStorage to maintain consistency if user set it elsewhere,
    // but we don't provide UI controls to change it within this modal.
    const MODAL_DEFAULT_ROWS = 6;
    const MODAL_DEFAULT_COLS = 8;
    const MODAL_MAP_CONFIG = {
        get rows() {
            return parseInt(localStorage.getItem('mapRows')) || MODAL_DEFAULT_ROWS;
        },
        get cols() {
            return parseInt(localStorage.getItem('mapCols')) || MODAL_DEFAULT_COLS;
        },
        drawerSize: 100, // Adjust size for modal if needed
        gap: 10,
    };

    let modalComponentConfig = {};
    let modalStorageData = {};
    // let modalCurrentAssignLocation = null; // No longer needed in modal

    // Function to open the map modal and load map data
    function openMapModal() {
        mapModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        document.body.classList.add('modal-open');
        initializeModalMap();
    }

    // Function to close the map modal
    function closeMapModal() {
        mapModal.classList.remove('active');
        document.body.style.overflow = '';
        document.body.classList.remove('modal-open');
        // closeAssignModal(); // Assign modal is no longer opened from here
        // Hide drawer info panel if open
        const infoPanel = mapModal.querySelector('.drawer-info-panel');
        if (infoPanel) infoPanel.style.display = 'none';
    }

    // --- Initialize Modal Map --- 
    async function initializeModalMap() {
        try {
            // Load component config if not already loaded
            if (Object.keys(modalComponentConfig).length === 0) {
                const configResponse = await fetch('/component_config');
                modalComponentConfig = await configResponse.json();
                populateModalFilterDropdowns();
            }

            const storagePlaces = extractStoragePlaces(modalComponentConfig);
            const mapGrid = mapModal.querySelector('.map-grid');
            if (!mapGrid) return;

            mapGrid.innerHTML = ''; // Clear previous grid

            // Use the read (or default) config for layout
            mapGrid.style.gridTemplateColumns = `repeat(${MODAL_MAP_CONFIG.cols}, ${MODAL_MAP_CONFIG.drawerSize}px)`;
            mapGrid.style.gridTemplateRows = `repeat(${MODAL_MAP_CONFIG.rows}, ${MODAL_MAP_CONFIG.drawerSize}px)`;
            mapGrid.style.gap = `${MODAL_MAP_CONFIG.gap}px`;

            const totalCells = MODAL_MAP_CONFIG.rows * MODAL_MAP_CONFIG.cols;

            // Create drawers
            storagePlaces.forEach((place, index) => {
                if (index < totalCells) {
                    mapGrid.appendChild(createModalDrawerElement(place));
                }
            });
            for (let i = storagePlaces.length; i < totalCells; i++) {
                mapGrid.appendChild(createModalDrawerElement(''));
            }

            await loadModalStorageData();
            setupModalMapEventListeners(); // Ensure listeners are set up

        } catch (error) {
            console.error('Error initializing modal map:', error);
        }
    }

    // --- Helper Functions for Modal Map --- 
    function createModalDrawerElement(location) {
        const drawer = document.createElement('div');
        drawer.className = 'drawer empty';
        drawer.setAttribute('data-location', location);
        const labelSpan = document.createElement('span');
        labelSpan.className = 'drawer-label';
        labelSpan.textContent = location || 'Empty';
        drawer.appendChild(labelSpan);

        // Simplified click listener: always show contents
        drawer.addEventListener('click', (event) => {
            if (location) { // Only clickable if it has a location
                handleModalDrawerClick(drawer, location, event);
            }
        });
        return drawer;
    }

    // Simplified handler - removed Shift-key check
    function handleModalDrawerClick(drawerElement, location, event) {
        showModalDrawerContents(drawerElement);
    }

    async function loadModalStorageData() {
        try {
            const response = await fetch('/storage_data');
            modalStorageData = await response.json();
            updateModalMapOccupancy();
        } catch (error) {
            console.error('Error loading modal storage data:', error);
        }
    }

    function updateModalMapOccupancy() {
        const mapGrid = mapModal.querySelector('.map-grid');
        if (!mapGrid) return;
        const drawers = mapGrid.querySelectorAll('.drawer');
        drawers.forEach(drawer => {
            const location = drawer.getAttribute('data-location');
            if (location) {
                const isOccupied = modalStorageData[location] && modalStorageData[location].length > 0;
                drawer.classList.remove('empty', 'occupied');
                drawer.classList.add(isOccupied ? 'occupied' : 'empty');
            }
        });
    }

    function populateModalFilterDropdowns() {
        const typeFilter = document.getElementById('modalComponentTypeFilter');
        if (!typeFilter) return;
        typeFilter.innerHTML = '<option value="">Select Component Type</option>';
        Object.keys(modalComponentConfig).sort().forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            typeFilter.appendChild(option);
        });
        const branchFilter = document.getElementById('modalComponentBranchFilter');
        if (branchFilter) {
            branchFilter.innerHTML = '<option value="">Select Component Branch</option>';
            branchFilter.disabled = true;
        }
    }

    function updateModalBranchFilter() {
        const typeFilter = document.getElementById('modalComponentTypeFilter');
        const branchFilter = document.getElementById('modalComponentBranchFilter');
        if (!typeFilter || !branchFilter) return;

        const selectedType = typeFilter.value;
        branchFilter.innerHTML = '<option value="">Select Component Branch</option>';

        if (selectedType && modalComponentConfig[selectedType] && modalComponentConfig[selectedType]['Component Branch']) {
            const branches = modalComponentConfig[selectedType]['Component Branch'];
            Object.keys(branches).sort().forEach(branch => {
                const option = document.createElement('option');
                option.value = branch;
                option.textContent = branch;
                branchFilter.appendChild(option);
            });
            branchFilter.disabled = false;
        } else {
            branchFilter.disabled = true;
        }
    }

    async function applyModalMapFilters() {
        const typeFilter = document.getElementById('modalComponentTypeFilter');
        const branchFilter = document.getElementById('modalComponentBranchFilter');
        if (!typeFilter || !branchFilter) return;

        const selectedType = typeFilter.value;
        const selectedBranch = branchFilter.value;

        const mapGrid = mapModal.querySelector('.map-grid');
        if (!mapGrid) return;

        mapGrid.querySelectorAll('.drawer').forEach(drawer => {
            drawer.classList.remove('highlighted');
        });

        if (!selectedType && !selectedBranch) return;

        if (Object.keys(modalStorageData).length === 0) {
            await loadModalStorageData();
        }

        Object.entries(modalStorageData).forEach(([location, components]) => {
            const hasMatch = components.some(component => {
                const typeMatch = !selectedType || component.component_type === selectedType;
                const branchMatch = !selectedBranch || component.component_branch === selectedBranch;
                return typeMatch && branchMatch;
            });

            if (hasMatch) {
                const drawer = mapGrid.querySelector(`.drawer[data-location="${location}"]`);
                if (drawer) {
                    drawer.classList.add('highlighted');
                }
            }
        });
    }

    async function searchComponentInModalMap(query) {
        try {
            const response = await fetch(`/search_component?query=${encodeURIComponent(query)}`);
            if (response.ok) {
                const results = await response.json();
                highlightModalStorageLocations(results);
            } else {
                alert('Component not found in database.');
                const mapGrid = mapModal.querySelector('.map-grid');
                if (mapGrid) {
                    mapGrid.querySelectorAll('.drawer').forEach(drawer => {
                        drawer.classList.remove('highlighted');
                    });
                }
            }
        } catch (error) {
            console.error('Error searching for component:', error);
            alert('Error searching for component.');
        }
    }

    function highlightModalStorageLocations(components) {
        const mapGrid = mapModal.querySelector('.map-grid');
        if (!mapGrid) return;

        mapGrid.querySelectorAll('.drawer').forEach(drawer => {
            drawer.classList.remove('highlighted');
        });

        if (!components || components.length === 0) return;

        const storageLocations = new Set();
        components.forEach(component => {
            if (component.storage_place) {
                storageLocations.add(component.storage_place);
            }
        });

        storageLocations.forEach(location => {
            const drawer = mapGrid.querySelector(`.drawer[data-location="${location}"]`);
            if (drawer) {
                drawer.classList.add('highlighted');
            }
        });
    }

    function showModalDrawerContents(drawer) {
        const location = drawer.getAttribute('data-location');
        const contents = modalStorageData[location] || [];

        const infoPanel = mapModal.querySelector('.drawer-info-panel'); // Target modal's panel
        if (!infoPanel) return;
        const infoContent = infoPanel.querySelector('.drawer-info-content');
        if (!infoContent) return;

        infoContent.innerHTML = '';
        if (contents.length === 0) {
            infoContent.innerHTML = '<p>No components stored here.</p>';
        } else {
            const groupedContents = contents.reduce((acc, component) => {
                const key = `${component.component_type || 'N/A'} - ${component.component_branch || 'N/A'}`;
                if (!acc[key]) acc[key] = [];
                acc[key].push(component);
                return acc;
            }, {});

            Object.entries(groupedContents).forEach(([group, components]) => {
                const section = document.createElement('div');
                section.className = 'content-section';
                section.innerHTML = `
                    <h4>${group}</h4>
                    <ul>
                        ${components.map(comp => `
                            <li>
                                <span>${comp.part_number}</span>
                                <small>${comp.description || ''}</small>
                                <span>Qty: ${comp.order_qty}</span>
                            </li>
                        `).join('')}
                    </ul>
                `;
                infoContent.appendChild(section);
            });
        }
        infoPanel.style.display = 'block';

        // Add temporary listener to close panel on outside click
        setTimeout(() => { // Use timeout to prevent immediate closing
            document.addEventListener('click', closeModalInfoPanelOnClickOutside, { once: true });
        }, 0);
    }

    // Function to close the modal info panel when clicking outside
    function closeModalInfoPanelOnClickOutside(event) {
        const infoPanel = mapModal.querySelector('.drawer-info-panel');
        // Check if the click is outside the infoPanel and not on a drawer
        if (infoPanel && !infoPanel.contains(event.target) && !event.target.closest('.drawer')) {
            infoPanel.style.display = 'none';
        } else if (infoPanel && infoPanel.style.display === 'block') {
            // If clicked inside or on a drawer, re-add the listener
            document.addEventListener('click', closeModalInfoPanelOnClickOutside, { once: true });
        }
    }

    // --- Assign Branch Modal Logic (Removed from Modal Context) ---
    // Functions openModalAssignModal, updateAssignBranchDropdown, assignBranch are removed
    // closeAssignModal remains as it's used by the Escape key listener
    function closeAssignModal() {
        if (assignBranchModal) assignBranchModal.style.display = 'none';
        // modalCurrentAssignLocation = null; // Variable removed
    }

    // --- Event Listeners --- 
    // General Modal Listeners
    const mapFloatingBtn = document.getElementById('mapFloatingBtn'); // Define mapFloatingBtn
    const mobileMapBtn = document.getElementById('mobileMapBtn'); // Define mobileMapBtn
    if (mapFloatingBtn) mapFloatingBtn.addEventListener('click', openMapModal);
    if (mobileMapBtn) mobileMapBtn.addEventListener('click', () => { setActiveMobileTab(mobileMapBtn); openMapModal(); });
    if (closeMapModalBtn) closeMapModalBtn.addEventListener('click', closeMapModal);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            // Close assign modal first if it's open (though it shouldn't open from here now)
            if (assignBranchModal && assignBranchModal.style.display === 'flex') {
                closeAssignModal();
            } else if (mapModal.classList.contains('active')) {
                closeMapModal();
            }
        }
    });
    mapModal.addEventListener('click', (event) => {
        if (event.target === mapModal) closeMapModal();
    });

    // Modal Map Specific Listeners (Setup function to avoid duplicates)
    let modalListenersSetup = false;
    function setupModalMapEventListeners() {
        if (modalListenersSetup) return;

        // Layout Apply Button REMOVED
        // const applyLayoutBtn = document.getElementById('modalApplyLayoutBtn');
        // ... listener removed ...

        // Search
        const modalSearchBtn = document.getElementById('modalSearchButton');
        const modalSearchInput = document.getElementById('modalPartNumberSearch');
        if (modalSearchBtn && modalSearchInput) {
            // ... (search listeners remain the same) ...
            modalSearchBtn.addEventListener('click', () => {
                const query = modalSearchInput.value.trim();
                if (query) searchComponentInModalMap(query);
                else highlightModalStorageLocations([]);
            });
            modalSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const query = modalSearchInput.value.trim();
                    if (query) searchComponentInModalMap(query);
                    else highlightModalStorageLocations([]);
                }
            });
        }

        // Filters
        const modalTypeFilter = document.getElementById('modalComponentTypeFilter');
        const modalBranchFilter = document.getElementById('modalComponentBranchFilter');
        if (modalTypeFilter) modalTypeFilter.addEventListener('change', () => { updateModalBranchFilter(); applyModalMapFilters(); });
        if (modalBranchFilter) modalBranchFilter.addEventListener('change', applyModalMapFilters);

        // Drawer Info Panel Close
        const drawerInfoCloseBtn = mapModal.querySelector('.drawer-info-panel .close-button');
        if (drawerInfoCloseBtn) drawerInfoCloseBtn.addEventListener('click', () => { mapModal.querySelector('.drawer-info-panel').style.display = 'none'; });

        // Assign Branch Modal Listeners REMOVED
        // const closeAssignBtn = document.getElementById('closeAssignModal');
        // ... listeners removed ...

        modalListenersSetup = true;
    }

    // Helper function to extract storage places (reusable)
    function extractStoragePlaces(config) {
        // ... (same as before) ...
        const storagePlaces = new Set();
        Object.values(config).forEach(type => {
            Object.values(type['Component Branch'] || {}).forEach(branch => {
                if (branch['Storage Place']) {
                    storagePlaces.add(branch['Storage Place']);
                }
            });
        });
        return Array.from(storagePlaces).sort();
    }

    // =============================
    // End Map Modal Functionality
    // =============================

    // Mobile tab bar functionality
    document.getElementById('mobileSearchBtn').addEventListener('click', function () {
        setActiveMobileTab(this);
        // Show search tab
        showTabContent('search');
    });

    document.getElementById('mobileAddBtn').addEventListener('click', function () {
        setActiveMobileTab(this);
        // Show add component tab
        showTabContent('add');
    });

    document.getElementById('mobileImportBtn').addEventListener('click', function () {
        setActiveMobileTab(this);
        // Show import tab
        showTabContent('import');
    });

    function setActiveMobileTab(activeTab) {
        document.querySelectorAll('.mobile-tab-btn').forEach(tab => {
            tab.classList.remove('active');
        });
        activeTab.classList.add('active');
    }

    function showTabContent(tabId) {
        // Update desktop tabs to match
        const tabButton = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
        if (tabButton) {
            tabButton.click();
        }
    }
});

let currentUser = localStorage.getItem('currentUser') || 'guest';
let componentConfig = {};

document.addEventListener("DOMContentLoaded", () => {
    // Load the component configuration from the server
    fetch('/component_config')
        .then(response => response.json())
        .then(config => {
            componentConfig = config;
            populateComponentTypes();
            populateFilterComponentTypes(); // Call the function here after componentConfig is loaded
        });

    // Existing event listeners...

    // User selection modal logic
    const userSelectionModal = document.getElementById("userSelectionModal");
    const userButtons = document.querySelectorAll(".user-button");

    userButtons.forEach(button => {
        button.addEventListener("click", () => {
            currentUser = button.getAttribute("data-user");
            localStorage.setItem("currentUser", currentUser);
            userSelectionModal.style.display = "none";
            document.getElementById("currentUserDisplay").textContent = `Current User: ${currentUser}`;
        });
    });

    // Remove auto-show of modal, only show when Login button is clicked
    userSelectionModal.style.display = "none";

    // Display current user
    document.getElementById("currentUserDisplay").textContent = `Current User: ${currentUser}`;

    // Check if user is already selected
    currentUser = localStorage.getItem("currentUser");
    if (currentUser) {
        userSelectionModal.style.display = "none";
    }

    document.getElementById("uploadCsvForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        const fileInput = document.getElementById("csvFile");
        const file = fileInput.files[0];
        const currentUser = localStorage.getItem('currentUser');

        if (!currentUser) {
            alert("Please log in first");
            return;
        }

        if (!file) {
            alert("Please select a CSV file to upload.");
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch(`/update_components_from_csv?user=${encodeURIComponent(currentUser)}`, {
                method: 'POST',
                body: formData
            });

            const contentType = response.headers.get("content-type");
            let result;

            if (contentType && contentType.includes("application/json")) {
                result = await response.json();
            } else {
                const text = await response.text();
                throw new Error(text);
            }

            if (response.ok) {
                alert(result.message);

                // Display the uploaded components in the search results
                if (result.components && result.components.length > 0) {
                    searchResults = result.components;
                    displaySearchResults(searchResults);

                    // Show summary of changes
                    let summary = "Uploaded components:\n\n";
                    result.components.forEach(comp => {
                        if (comp.action === 'update') {
                            summary += `${comp.part_number}: Updated quantity from ${comp.old_qty} to ${comp.new_qty}\n`;
                        } else {
                            summary += `${comp.part_number}: Added with quantity ${comp.new_qty}\n`;
                        }
                    });
                    console.log(summary);
                }

                // Clear the file input
                fileInput.value = '';
                if (fileNameDisplay) {
                    fileNameDisplay.textContent = 'No file selected';
                }

                // Switch to search tab after successful import
                const searchTabButton = document.querySelector('.tab-button[data-tab="search"]');
                if (searchTabButton) {
                    searchTabButton.click();
                }
            } else {
                alert(`Error: ${result.detail || 'Failed to upload components'}`);
            }
        } catch (error) {
            console.error('Upload error:', error);
            alert(`Error: ${error.message}`);
        }
    });

    document.getElementById("addComponentForm").addEventListener("submit", async (event) => {
        event.preventDefault();

        const requiredFields = ["componentType", "componentBranch", "partNumber", "storagePlace", "orderQty"];
        let allValid = true;

        requiredFields.forEach((fieldId) => {
            const field = document.getElementById(fieldId);
            if (!field || !field.value.trim()) {
                field.classList.add("invalid");
                allValid = false;
            } else {
                field.classList.remove("invalid");
            }
        });

        // Validate dynamic fields
        const dynamicFieldIds = Array.from(document.querySelectorAll("#dynamicFields input")).map(input => input.id);
        dynamicFieldIds.forEach((fieldId) => {
            const field = document.getElementById(fieldId);
            if (field.required) {
                // Special validation for resistance field
                if (fieldId === 'resistance') {
                    const value = field.value.trim();
                    // Check if the value contains only the Ω symbol or is empty
                    if (!value || value === 'Ω' || !/[0-9]/.test(value)) {
                        field.classList.add("invalid");
                        allValid = false;
                    } else {
                        field.classList.remove("invalid");
                    }
                } else if (!field.value.trim()) {
                    field.classList.add("invalid");
                    allValid = false;
                } else {
                    field.classList.remove("invalid");
                }
            }
        });

        if (!allValid) {
            alert("Please fill in all required fields with valid values. For resistance, please include a numeric value.");
            return;
        }

        // Collect form data with field names matching the server's expected field names
        const formData = {
            component_type: document.getElementById("componentType").value,
            component_branch: document.getElementById("componentBranch").value,
            part_number: document.getElementById("partNumber").value.trim(),
            storage_place: document.getElementById("storagePlace").value.trim(),
            order_qty: parseInt(document.getElementById("orderQty").value),
            unit_price: parseFloat(document.getElementById("unitPrice").value) || null,
            description: document.getElementById("description").value.trim() || null,
            package: document.getElementById("package").value.trim() || null,
            manufacturer: document.getElementById("manufacturer").value.trim() || null,
            manufacture_part_number: document.getElementById("manufacturePartNumber").value.trim() || null,
        };

        // Collect dynamic fields
        dynamicFieldIds.forEach((fieldId) => {
            const fieldName = fieldId.toLowerCase().replace('_', '');
            formData[fieldName] = document.getElementById(fieldId).value.trim();
        });

        try {
            const response = await fetch("/add_component", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                alert("Component added successfully.");
                document.getElementById("addComponentForm").reset();
                document.getElementById("searchQuery").value = formData.part_number;

                // Switch to search tab after successfully adding a component
                const searchTabButton = document.querySelector('.tab-button[data-tab="search"]');
                if (searchTabButton) {
                    searchTabButton.click();
                }

                // Run the search to show the newly added component
                searchComponent();
            } else {
                const error = await response.json();
                alert(`Error: ${error.detail}`);
            }
        } catch (error) {
            alert(`Unexpected error: ${error.message}`);
        }
    });

    document.getElementById("searchQuery").addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            searchComponent();
        }
    });

    // Added to support pressing Enter key on forms
    document.querySelectorAll("form").forEach((form) => {
        form.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                form.querySelector("button[type=submit]").click();
            }
        });
    });

    // Add event listeners for sortable headers
    document.querySelectorAll(".sortable").forEach(header => {
        header.addEventListener("click", () => {
            const column = header.getAttribute("data-column");
            sortResults(column);
        });
    });

    // Event listener for component type change
    document.getElementById("componentType").addEventListener("change", () => {
        populateComponentBranches();
        displayOptionalFields();
        displayDynamicFields();
    });

    // Event listener for component branch change
    document.getElementById("componentBranch").addEventListener("change", () => {
        displayOptionalFields();
        displayDynamicFields();
    });

    // Populate filter options
    populateFilterComponentTypes();

    // Event listener for filter Component Type change
    document.getElementById("filterComponentType").addEventListener("change", () => {
        populateFilterComponentBranches();
    });

    // Event listener for search button
    document.getElementById("searchButton").addEventListener("click", () => {
        searchComponent();
    });

    // Populate filter options from component_config.json
    function populateFilterComponentTypes() {
        const filterComponentTypeSelect = document.getElementById("filterComponentType");
        filterComponentTypeSelect.innerHTML = '<option value="">Select Component Type</option>';
        for (let type in componentConfig) {
            filterComponentTypeSelect.innerHTML += `<option value="${type}">${type}</option>`;
        }
    }

    function populateFilterComponentBranches() {
        const filterComponentBranchSelect = document.getElementById("filterComponentBranch");
        filterComponentBranchSelect.innerHTML = '<option value="">Select Component Branch</option>';
        const selectedType = document.getElementById("filterComponentType").value;
        if (selectedType && componentConfig[selectedType]) {
            const branches = componentConfig[selectedType]["Component Branch"];
            for (let branch in branches) {
                filterComponentBranchSelect.innerHTML += `<option value="${branch}">${branch}</option>`;
            }
            filterComponentBranchSelect.disabled = false;
        } else {
            filterComponentBranchSelect.disabled = true;
        }
    }

    // Initialize the filter dropdowns
    populateFilterComponentTypes();

    // Functions to populate dropdowns
    function populateComponentTypes() {
        const componentTypeSelect = document.getElementById("componentType");
        componentTypeSelect.innerHTML = '<option value="">Select Component Type</option>';

        Object.keys(componentConfig).forEach(type => {
            const option = document.createElement("option");
            option.value = type;
            option.textContent = type;
            componentTypeSelect.appendChild(option);
        });
    }

    function populateComponentBranches() {
        const componentBranchSelect = document.getElementById("componentBranch");
        componentBranchSelect.innerHTML = '<option value="">Select Component Branch</option>';

        const selectedType = document.getElementById("componentType").value;
        if (selectedType && componentConfig[selectedType]) {
            const branches = componentConfig[selectedType]["Component Branch"];
            Object.keys(branches).forEach(branch => {
                const option = document.createElement("option");
                option.value = branch;
                option.textContent = branch;
                componentBranchSelect.appendChild(option);
            });
            componentBranchSelect.disabled = false;
        } else {
            componentBranchSelect.disabled = true;
        }
    }

    function displayOptionalFields() {
        const optionalFieldsDiv = document.getElementById("optionalFields");
        optionalFieldsDiv.innerHTML = '';
        const selectedType = document.getElementById("componentType").value;
        const selectedBranch = document.getElementById("componentBranch").value;
        if (selectedType && selectedBranch && componentConfig[selectedType]) {
            const optionalFields = componentConfig[selectedType][selectedBranch]["optional_fields"];
            optionalFields.forEach((field) => {
                const label = document.createElement("label");
                label.setAttribute("for", field);
                label.textContent = field.charAt(0).toUpperCase() + field.slice(1) + ":";

                const input = document.createElement("input");
                input.setAttribute("id", field);
                input.setAttribute("name", field);
                input.setAttribute("type", "text");

                if (
                    (selectedBranch === "Resistors" && field === "resistance") ||
                    (selectedBranch === "Capacitors" && field === "capacitance") ||
                    (selectedBranch === "Inductors" && field === "inductance")
                ) {
                    input.required = true;
                }

                optionalFieldsDiv.appendChild(label);
                optionalFieldsDiv.appendChild(input);
            });

            const packageInput = document.getElementById("package");
            if (packageInput) {
                packageInput.required =
                    selectedBranch === "Resistors" ||
                    selectedBranch === "Capacitors" ||
                    selectedBranch === "Inductors";
            }
        }
    }

    function displayDynamicFields() {
        const dynamicFieldsDiv = document.getElementById("dynamicFields");
        dynamicFieldsDiv.innerHTML = '';
        const selectedType = document.getElementById("componentType").value;
        const selectedBranch = document.getElementById("componentBranch").value;

        if (selectedType && selectedBranch && componentConfig[selectedType]["Component Branch"][selectedBranch]) {
            const fieldsToShow = componentConfig[selectedType]["Component Branch"][selectedBranch]["Parameters"];

            fieldsToShow.forEach(field => {
                const fieldId = field.replace(/\s+/g, '_').toLowerCase();
                const label = document.createElement("label");
                label.setAttribute("for", fieldId);
                label.textContent = field + ":";

                const input = document.createElement("input");
                input.setAttribute("type", "text");
                input.setAttribute("id", fieldId);
                input.required = true;

                // Set default value to 'Ω' for the resistance field
                if (fieldId === "resistance") {
                    input.value = "Ω";
                }

                dynamicFieldsDiv.appendChild(label);
                dynamicFieldsDiv.appendChild(input);
            });
        }
    }

    document.getElementById("componentBranch").addEventListener("change", () => {
        const componentType = document.getElementById("componentType").value;
        const componentBranch = document.getElementById("componentBranch").value;
        let storagePlace = '';

        if (componentType && componentBranch) {
            const typeData = componentConfig[componentType];
            const branchData = typeData['Component Branch'][componentBranch];
            storagePlace = branchData['Storage Place'] || '';
        }

        // Set the storage place input value
        document.getElementById("storagePlace").value = storagePlace;
    });

    document.getElementById("toggleAddComponentButton").addEventListener("click", () => {
        const container = document.getElementById("addComponentContainer");
        if (container.style.display === "none" || container.style.display === "") {
            container.style.display = "block";
        } else {
            container.style.display = "none";
        }
    });

    // Add unit conversion helper function
    function extractNumber(value, unit) {
        if (!value) return 0;
        value = value.toLowerCase();
        const multipliers = {
            'p': 1e-12,
            'n': 1e-9,
            'u': 1e-6,
            'µ': 1e-6,
            'm': 1e-3,
            'k': 1e3,
            'meg': 1e6,
            'M': 1e6
        };

        // Extract numeric value and unit prefix
        const match = value.match(/([0-9.]+)([pnuµmkM])?/);
        if (!match) return 0;

        let num = parseFloat(match[1]);
        const prefix = match[2];

        // Apply multiplier if prefix exists
        if (prefix && multipliers[prefix]) {
            num *= multipliers[prefix];
        }

        return num;
    }

    // Update sort function
    function sortResults(column) {
        if (currentSortColumn === column) {
            sortOrderAsc = !sortOrderAsc;
        } else {
            currentSortColumn = column;
            sortOrderAsc = true;
        }

        const columnElement = document.querySelector(`.sortable[data-column="${column}"]`);
        const unit = columnElement ? columnElement.dataset.unit : null;

        searchResults.sort((a, b) => {
            let valA = a[column];
            let valB = b[column];

            if (unit) {
                valA = extractNumber(valA, unit);
                valB = extractNumber(valB, unit);
            } else {
                valA = valA !== null && valA !== undefined ? valA : '';
                valB = valB !== null && valB !== undefined ? valB : '';

                if (typeof valA === 'string') valA = valA.toLowerCase();
                if (typeof valB === 'string') valB = valB.toLowerCase();
            }

            if (valA < valB) return sortOrderAsc ? -1 : 1;
            if (valA > valB) return sortOrderAsc ? 1 : -1;
            return 0;
        });

        displaySearchResults(searchResults);

        // Update sort indicators
        document.querySelectorAll(".sort-indicator").forEach(indicator => {
            indicator.textContent = '';
        });

        const indicator = document.querySelector(`.sortable[data-column="${column}"] .sort-indicator`);
        if (indicator) {
            indicator.textContent = sortOrderAsc ? '▲' : '▼';
        }
    }

    // Initialize sorting controls
    const sortColumn = document.getElementById('sortColumn');
    const sortOrderBtn = document.getElementById('sortOrderBtn');
    let sortAscending = true;

    sortColumn.addEventListener('change', () => {
        if (sortColumn.value) {
            sortState.column = sortColumn.value;
            applyFiltersAndSort();
        }
    });

    sortOrderBtn.addEventListener('click', () => {
        sortAscending = !sortAscending;
        sortState.ascending = sortAscending;
        sortOrderBtn.classList.toggle('descending', !sortAscending);

        // Only sort if a column is selected
        if (sortState.column) {
            applyFiltersAndSort();
        }
    });

    function applyFiltersAndSort() {
        let results = [...searchResults];

        // Apply filters if active
        if (activeFilters.category && activeFilters.value) {
            results = results.filter(item => {
                const itemValue = item[activeFilters.category];
                if (itemValue === null || itemValue === undefined) return false;
                return String(itemValue).trim().toLowerCase() === String(activeFilters.value).trim().toLowerCase();
            });
        }

        // Apply sorting if active
        if (sortState.column) {
            const unit = sortColumn.selectedOptions[0]?.dataset.unit;
            results.sort((a, b) => {
                let valA = unit ? extractSortableValue(a[sortState.column], unit) : a[sortState.column];
                let valB = unit ? extractSortableValue(b[sortState.column], unit) : b[sortState.column];

                // Handle null/undefined values
                if (valA === null || valA === undefined) valA = '';
                if (valB === null || valB === undefined) valB = '';

                // Convert to comparable types
                if (typeof valA === 'string') valA = valA.toLowerCase();
                if (typeof valB === 'string') valB = valB.toLowerCase();

                const compareResult = valA < valB ? -1 : valA > valB ? 1 : 0;
                return sortState.ascending ? compareResult : -compareResult;
            });
        }

        displaySearchResults(results);
    }

    // Enhanced number extraction function for sorting
    function extractSortableValue(value, unit) {
        if (!value) return 0;
        value = value.toString().toLowerCase();

        // Multipliers for different units
        const multipliers = {
            'p': 1e-12,  // pico
            'n': 1e-9,   // nano
            'u': 1e-6,   // micro
            'µ': 1e-6,   // micro (alternative)
            'm': 1e-3,   // milli
            'k': 1e3,    // kilo
            'meg': 1e6,  // mega
            'M': 1e6     // mega
        };

        // Extract number and unit prefix
        const match = value.match(/(-?\d+\.?\d*)\s*([pnuµmkM])?/);
        if (!match) return 0;

        let [, num, prefix] = match;
        num = parseFloat(num);

        // Apply multiplier if prefix exists
        if (prefix && multipliers[prefix]) {
            num *= multipliers[prefix];
        }

        return num;
    }

    // References to new filter elements
    const filterColumnSelect = document.getElementById("filterColumn");
    const filterValueSelect = document.getElementById("filterValue");

    // Populate filterValueSelect whenever filterColumn changes
    filterColumnSelect.addEventListener("change", () => {
        populateFilterValues(filterColumnSelect.value);
        filterResults();
    });

    // Filter results whenever filterValue changes
    filterValueSelect.addEventListener("change", () => {
        filterResults();
    });

    // Filter function using column/value selections + existing sorts
    function filterResults() {
        const col = filterColumnSelect.value;
        const val = filterValueSelect.value;
        let filtered = [...searchResults];

        if (col && val) {
            filtered = filtered.filter(item => (item[col] || "") === val);
        }

        // Re-apply current sort (if applicable) on filtered results
        displaySearchResults(sortArray(filtered));
    }

    // Sort logic wrapped into a function for re-use
    function sortArray(array) {
        // Use currentSortColumn and sortOrderAsc from existing code
        if (!currentSortColumn) return array;
        return array.sort((a, b) => {
            // ...existing numeric/string comparison...
            // (Use the same logic from the existing sortResults function)
            let valA = a[currentSortColumn] || "";
            let valB = b[currentSortColumn] || "";
            if (!isNaN(parseFloat(valA)) && !isNaN(parseFloat(valB))) {
                valA = parseFloat(valA);
                valB = parseFloat(valB);
            } else {
                valA = valA.toString().toLowerCase();
                valB = valB.toString().toLowerCase();
            }
            if (valA < valB) return sortOrderAsc ? -1 : 1;
            if (valA > valB) return sortOrderAsc ? 1 : -1;
            return 0;
        });
    }

    // Populate filterValueSelect with unique values for the chosen column
    function populateFilterValues(column) {
        filterValueSelect.innerHTML = '<option value="">Select value...</option>';
        if (!column) return;

        const uniqueValues = new Set();
        searchResults.forEach(item => {
            if (item[column]) uniqueValues.add(item[column]);
        });

        uniqueValues.forEach(value => {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = value;
            filterValueSelect.appendChild(option);
        });
    }

    // Update sortOrderBtn to show arrow indicator more clearly
    // (Already present, but ensure there's an icon)
    // ...existing code to toggle 'descending' class...
    // Make sure .sort-icon is set to "↑" or "↓" accordingly

    initializeFilterAndSort();
});

// Add event listener for the "Login" button
document.getElementById("loginButton").addEventListener("click", () => {
    currentUser = null;
    const userSelectionModal = document.getElementById("userSelectionModal");
    userSelectionModal.style.display = "block";
});

let searchResults = []; // Store current search results
let currentSortColumn = null;
let sortOrderAsc = true; // Sort order flag

async function searchComponent() {
    const query = document.getElementById("searchQuery").value;
    const componentType = document.getElementById("filterComponentType").value;
    const componentBranch = document.getElementById("filterComponentBranch").value;
    const inStockOnly = document.getElementById("inStockCheckbox").checked;

    let url = `/search_component?query=${encodeURIComponent(query)}`;

    if (componentType) {
        url += `&component_type=${encodeURIComponent(componentType)}`;
    }
    if (componentBranch) {
        url += `&component_branch=${encodeURIComponent(componentBranch)}`;
    }
    if (inStockOnly) {
        url += `&in_stock=true`;
    }

    const response = await fetch(url);
    if (response.ok) {
        searchResults = await response.json(); // Save results for sorting
        displaySearchResults(searchResults);
    } else {
        const error = await response.json();
        alert(`Error: ${error.detail}`);
    }
}

// Existing function
function displaySearchResults(results) {
    const tableView = document.getElementById("tableViewContainer");
    const cardView = document.getElementById("cardViewContainer");
    const resultsGrid = cardView.querySelector(".results-grid");
    const tableBody = document.getElementById("resultsTableBody");

    // Clear previous results
    resultsGrid.innerHTML = "";
    tableBody.innerHTML = "";

    results.forEach(component => {
        // Create table row
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${component.part_number}</td>
            <td>${component.manufacture_part_number || ''}</td>
            <td>${component.manufacturer || ''}</td>
            <td>${component.package || ''}</td>
            <td>${component.description || ''}</td>
            <td>${component.unit_price || ''}</td>
            <td>${component.component_type || ''}</td>
            <td>${component.component_branch || ''}</td>
            <td>${component.capacitance || ''}</td>
            <td>${component.resistance || ''}</td>
            <td>${component.voltage || ''}</td>
            <td>${component.tolerance || ''}</td>
            <td>${component.inductance || ''}</td>
            <td>${component.current_power || ''}</td>
            <td class="order-qty">${component.order_qty}</td>
            <td>${component.storage_place || ''}</td>
            <td>
                <div class="actions-container">
                    <button class="add-to-cart-button" data-id="${component.id}"
                        data-tooltip="Add to cart">Add to Cart</button>
                    <div class="controls-row">
                        <div class="quantity-controls">
                            <button class="decrease" data-id="${component.id}" 
                                data-tooltip="Decrease stock quantity">-</button>
                            <input type="number" class="quantity-input" value="1" min="1">
                            <button class="increase" data-id="${component.id}"
                                data-tooltip="Increase stock quantity">+</button>
                        </div>
                        <button class="delete-button" data-id="${component.id}"
                            data-tooltip="Delete component">×</button>
                    </div>
                </div>
            </td>
        `;

        // Add click handler for row expansion
        row.addEventListener('click', (event) => {
            // Don't expand if clicking buttons or inputs
            if (event.target.tagName === 'BUTTON' ||
                event.target.tagName === 'INPUT' ||
                event.target.classList.contains('delete-button')) {
                return;
            }

            // Toggle expanded class
            row.classList.toggle('expanded');

            // If row is expanded, collapse any other expanded rows
            if (row.classList.contains('expanded')) {
                const otherExpandedRows = tableBody.querySelectorAll('tr.expanded');
                otherExpandedRows.forEach(otherRow => {
                    if (otherRow !== row) {
                        otherRow.classList.remove('expanded');
                    }
                });
            }
        });

        tableBody.appendChild(row);

        // Create card element (existing card creation code)
        const card = document.createElement("div");
        card.className = "component-card";

        // Essential info header
        card.innerHTML = `
            <div class="card-header">
                <span class="essential-field">${component.part_number}</span>
                <span>${component.order_qty} pcs</span>
            </div>
            <div class="card-content">
                <div class="essential-info">
                    <div><span class="card-label">Type:</span> ${component.component_type}</div>
                    <div><span class="card-label">Branch:</span> ${component.component_branch}</div>
                    <div><span class="card-label">Storage:</span> ${component.storage_place}</div>
                </div>
                <div class="specs-info">
                    ${component.resistance ? `<div><span class="card-label">Resistance:</span> ${component.resistance}</div>` : ''}
                    ${component.capacitance ? `<div><span class="card-label">Capacitance:</span> ${component.capacitance}</div>` : ''}
                    ${component.voltage ? `<div><span class="card-label">Voltage:</span> ${component.voltage}</div>` : ''}
                </div>
                <button class="show-more">Show More Details</button>
                <div class="optional-fields">
                    <div><span class="card-label">MPN:</span> ${component.manufacture_part_number}</div>
                    <div><span class="card-label">Manufacturer:</span> ${component.manufacturer}</div>
                    <div><span class="card-label">Package:</span> ${component.package}</div>
                    <div><span class="card-label">Description:</span> ${component.description}</div>
                </div>
            </div>
            <div class="card-actions">
                <div class="quantity-controls">
                    <button class="decrease" data-id="${component.id}">-</button>
                    <input type="number" class="quantity-input" value="1" min="1">
                    <button class="increase" data-id="${component.id}">+</button>
                </div>
                <button class="add-to-cart-button" data-id="${component.id}">Add</button>
                <button class="delete-button" data-id="${component.id}">Delete</button>
            </div>
        `;

        resultsGrid.appendChild(card);
    });

    // Add event listeners for show more/less
    document.querySelectorAll('.show-more').forEach(button => {
        button.addEventListener('click', (e) => {
            const optionalFields = e.target.nextElementSibling;
            if (optionalFields.style.display === 'none') {
                optionalFields.style.display = 'block';
                e.target.textContent = 'Show Less';
            } else {
                optionalFields.style.display = 'none';
                e.target.textContent = 'Show More Details';
            }
        });
    });

    // Add event listeners for quantity controls and delete buttons
    addQuantityControlEventListeners();
    addDeleteButtonEventListeners();

    // Add event listener for Add to Cart button
    document.querySelectorAll('.add-to-cart-button').forEach(button => {
        button.addEventListener('click', async (event) => {
            event.stopPropagation();
            if (!currentUser) {
                alert('Please log in first');
                return;
            }

            try {
                const response = await fetch('/add_to_cart', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        user: currentUser,
                        component_id: event.target.dataset.id
                    })
                });

                if (response.ok) {
                    alert('Item added to cart');
                    updateCartState(); // Update cart state after adding item
                } else {
                    const error = await response.json();
                    alert(error.detail);
                }
            } catch (error) {
                console.error('Error adding to cart:', error);
                alert('Failed to add item to cart');
            }
        });
    });
}

// View toggle handling
document.querySelectorAll('.view-button').forEach(button => {
    button.addEventListener('click', () => {
        const viewType = button.id;
        document.querySelectorAll('.view-button').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        document.querySelectorAll('.view-container').forEach(container => {
            container.style.display = container.id === viewType + 'Container' ? 'block' : 'none';
        });
    });
});

// Automatically switch to card view on mobile
function checkViewMode() {
    if (window.innerWidth <= 768) {
        document.getElementById('cardView').click();
    }
}

window.addEventListener('load', checkViewMode);
window.addEventListener('resize', checkViewMode);

async function updateOrderQuantity(id, change) {
    if (!currentUser) {
        alert("Please select a user before performing this action.");
        return;
    }

    const response = await fetch(`/update_order_quantity`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: id, change: change, user: currentUser }),
    });

    if (response.ok) {
        const updatedComponent = await response.json();
        const row = document.querySelector(`button[data-id="${id}"]`).closest("tr");
        row.querySelector(".order-qty").textContent = updatedComponent.order_qty;
    } else {
        const error = await response.json();
        alert(`Error: ${error.detail}`);
    }
}

function sortResults(column) {
    if (currentSortColumn === column) {
        // Toggle sort order if the same column is clicked
        sortOrderAsc = !sortOrderAsc;
    } else {
        // Sort in ascending order if a new column is clicked
        currentSortColumn = column;
        sortOrderAsc = true;
    }

    searchResults.sort((a, b) => {
        let valA = a[column];
        let valB = b[column];

        // Handle null or undefined values
        valA = valA !== null && valA !== undefined ? valA : '';
        valB = valB !== null && valB !== undefined ? valB : '';

        // Convert numeric strings to numbers for proper comparison
        const numA = parseFloat(valA);
        const numB = parseFloat(valB);
        if (!isNaN(numA) && !isNaN(numB)) {
            valA = numA;
            valB = numB;
        } else {
            valA = valA.toString().toLowerCase();
            valB = valB.toString().toLowerCase();
        }

        if (valA < valB) return sortOrderAsc ? -1 : 1;
        if (valA > valB) return sortOrderAsc ? 1 : -1;
        return 0;
    });

    displaySearchResults(searchResults);

    // Clear previous indicators
    document.querySelectorAll(".sort-indicator").forEach(indicator => {
        indicator.textContent = '';
    });

    // Update the indicator for the current column
    const currentIndicator = document.querySelector(`.sortable[data-column="${column}"] .sort-indicator`);
    if (currentIndicator) {
        currentIndicator.textContent = sortOrderAsc ? '▲' : '▼';
    }
}

function addQuantityControlEventListeners() {
    document.querySelectorAll(".quantity-controls .increase").forEach(button => {
        button.addEventListener("click", async (event) => {
            event.stopPropagation();
            const id = event.target.getAttribute("data-id");
            const quantityInput = event.target.closest("td").querySelector(".quantity-input");
            const change = parseInt(quantityInput.value) || 1;
            await updateOrderQuantity(id, change);
        });
    });

    document.querySelectorAll(".quantity-controls .decrease").forEach(button => {
        button.addEventListener("click", async (event) => {
            event.stopPropagation();
            const id = event.target.getAttribute("data-id");
            const quantityInput = event.target.closest("td").querySelector(".quantity-input");
            const change = parseInt(quantityInput.value) || 1;
            await updateOrderQuantity(id, -change);
        });
    });
}

function addStoragePlaceEventListeners() {
    document.querySelectorAll(".storage-place-input").forEach(input => {
        // Save the original value to detect changes
        input.addEventListener("focus", (event) => {
            event.target.dataset.originalValue = event.target.value;
        });

        input.addEventListener("change", async (event) => {
            const id = event.target.getAttribute("data-id");
            const newStoragePlace = event.target.value;
            const originalValue = event.target.dataset.originalValue;

            // Check if the value actually changed
            if (newStoragePlace === originalValue) {
                return; // No change, do nothing
            }

            // Update the storage place in the backend
            try {
                const response = await fetch(`/update_storage_place`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ id: id, storage_place: newStoragePlace }),
                });

                if (!response.ok) {
                    const error = await response.json();
                    alert(`Error: ${error.detail}`);
                    // Revert the input field to the original value
                    event.target.value = originalValue;
                } else {
                    // Update the original value
                    event.target.dataset.originalValue = newStoragePlace;
                }
            } catch (error) {
                alert(`Unexpected error: ${error.message}`);
                // Revert the input field to the original value
                event.target.value = originalValue;
            }
        });
    });
}

function addDeleteButtonEventListeners() {
    document.querySelectorAll(".delete-button").forEach(button => {
        button.addEventListener("click", async (event) => {
            event.stopPropagation();
            const id = event.target.getAttribute("data-id");
            const confirmDelete = confirm("Are you sure you want to delete this item?");
            if (confirmDelete) {
                if (!currentUser) {
                    alert("Please select a user before performing this action.");
                    return;
                }

                try {
                    const response = await fetch(`/delete_component`, {
                        method: "DELETE",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ component_id: id, user: currentUser }),
                    });

                    if (response.ok) {
                        // Remove the row from the table
                        event.target.closest("tr").remove();
                    } else {
                        const error = await response.json();
                        alert(`Error: ${error.detail}`);
                    }
                } catch (error) {
                    alert(`Unexpected error: ${error.message}`);
                }
            }
        });
    });
}

function populateComponentTypes() {
    const componentTypeSelect = document.getElementById("componentType");
    componentTypeSelect.innerHTML = '<option value="">Select Component Type</option>';

    Object.keys(componentConfig).forEach(type => {
        const option = document.createElement("option");
        option.value = type;
        option.textContent = type;
        componentTypeSelect.appendChild(option);
    });
}

function populateComponentBranches() {
    const componentBranchSelect = document.getElementById("componentBranch");
    componentBranchSelect.innerHTML = '<option value="">Select Component Branch</option>';

    const selectedType = document.getElementById("componentType").value;
    if (selectedType && componentConfig[selectedType]) {
        const branches = componentConfig[selectedType]["Component Branch"];
        Object.keys(branches).forEach(branch => {
            const option = document.createElement("option");
            option.value = branch;
            option.textContent = branch;
            componentBranchSelect.appendChild(option);
        });
        componentBranchSelect.disabled = false;
    } else {
        componentBranchSelect.disabled = true;
    }
}

function displayOptionalFields() {
    const optionalFieldsDiv = document.getElementById("optionalFields");
    optionalFieldsDiv.innerHTML = '';
    const selectedType = document.getElementById("componentType").value;
    const selectedBranch = document.getElementById("componentBranch").value;
    if (selectedType && selectedBranch && componentConfig[selectedType]) {
        const optionalFields = componentConfig[selectedType][selectedBranch]["optional_fields"];
        optionalFields.forEach((field) => {
            const label = document.createElement("label");
            label.setAttribute("for", field);
            label.textContent = field.charAt(0).toUpperCase() + field.slice(1) + ":";

            const input = document.createElement("input");
            input.setAttribute("id", field);
            input.setAttribute("name", field);
            input.setAttribute("type", "text");

            if (
                (selectedBranch === "Resistors" && field === "resistance") ||
                (selectedBranch === "Capacitors" && field === "capacitance") ||
                (selectedBranch === "Inductors" && field === "inductance")
            ) {
                input.required = true;
            }

            optionalFieldsDiv.appendChild(label);
            optionalFieldsDiv.appendChild(input);
        });

        const packageInput = document.getElementById("package");
        if (packageInput) {
            packageInput.required =
                selectedBranch === "Resistors" ||
                selectedBranch === "Capacitors" ||
                selectedBranch === "Inductors";
        }
    }
}

function displayDynamicFields() {
    const dynamicFieldsDiv = document.getElementById("dynamicFields");
    dynamicFieldsDiv.innerHTML = '';
    const selectedType = document.getElementById("componentType").value;
    const selectedBranch = document.getElementById("componentBranch").value;

    if (selectedType && selectedBranch && componentConfig[selectedType]["Component Branch"][selectedBranch]) {
        const fieldsToShow = componentConfig[selectedType]["Component Branch"][selectedBranch]["Parameters"];

        fieldsToShow.forEach(field => {
            const fieldId = field.replace(/\s+/g, '_').toLowerCase();
            const label = document.createElement("label");
            label.setAttribute("for", fieldId);
            label.textContent = field + ":";

            const input = document.createElement("input");
            input.setAttribute("type", "text");
            input.setAttribute("id", fieldId);
            input.required = true;

            // Set default value to 'Ω' for the resistance field
            if (fieldId === "resistance") {
                input.value = "Ω";
            }

            dynamicFieldsDiv.appendChild(label);
            dynamicFieldsDiv.appendChild(input);
        });
    }
}

document.getElementById("componentBranch").addEventListener("change", () => {
    displayDynamicFields();
});

document.getElementById("componentType").addEventListener("change", () => {
    // ...existing code to populate component branches...
    displayDynamicFields();
});

// Add event listener for Cart button
document.getElementById('cartButton').addEventListener('click', () => {
    window.location.href = '/cart';
});

// Initialize filtering and sorting controls
let activeFilters = {
    category: null,
    value: null
};
let sortState = {
    column: null,
    ascending: true
};

function initializeFilterAndSort() {
    const filterCategory = document.getElementById('filterCategory');
    const filterValue = document.getElementById('filterValue');
    const sortColumn = document.getElementById('sortColumn');
    const sortOrderBtn = document.getElementById('sortOrderBtn');

    // Filter category change handler - immediate effect
    filterCategory.addEventListener('change', () => {
        const category = filterCategory.value;
        activeFilters.category = category;

        if (category) {
            // Get unique values for the selected category
            const uniqueValues = [...new Set(searchResults
                .map(item => item[category])
                .filter(value => value !== null && value !== undefined)
                .map(value => String(value).trim())
                .filter(value => value !== '')
            )].sort((a, b) => {
                const numA = parseFloat(a);
                const numB = parseFloat(b);
                if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
                return a.localeCompare(b);
            });

            // Update filter value dropdown
            filterValue.innerHTML = '<option value="">Select value...</option>' +
                uniqueValues.map(value => `<option value="${value}">${value}</option>`).join('');
            filterValue.disabled = false;
        } else {
            filterValue.innerHTML = '<option value="">Select value...</option>';
            filterValue.disabled = true;
            activeFilters.value = null;
            applyFiltersAndSort(); // Apply immediately when clearing category
        }
    });

    // Filter value change handler - immediate effect
    filterValue.addEventListener('change', () => {
        activeFilters.value = filterValue.value;
        applyFiltersAndSort(); // Apply immediately when value changes
    });

    // Sort column change handler - sort ascending initially
    sortColumn.addEventListener('change', () => {
        const column = sortColumn.value;
        if (column) {
            sortState.column = column;
            sortState.ascending = true; // Always start with ascending
            sortOrderBtn.classList.remove('descending');
            applyFiltersAndSort();
        } else {
            sortState.column = null;
            applyFiltersAndSort();
        }
    });

    // Sort order button - toggle between ascending/descending
    sortOrderBtn.addEventListener('click', () => {
        if (sortState.column) {
            sortState.ascending = !sortState.ascending;
            sortOrderBtn.classList.toggle('descending', !sortState.ascending);
            applyFiltersAndSort();
        }
    });
}

function applyFiltersAndSort() {
    let results = [...searchResults];

    // Apply filters first
    if (activeFilters.category && activeFilters.value) {
        results = results.filter(item => {
            const itemValue = item[activeFilters.category];
            if (itemValue === null || itemValue === undefined) return false;
            return String(itemValue).trim().toLowerCase() === String(activeFilters.value).trim().toLowerCase();
        });
    }

    // Then apply sorting if a sort column is selected
    if (sortState.column) {
        const unit = document.getElementById('sortColumn').selectedOptions[0]?.dataset.unit;
        results.sort((a, b) => {
            let valA = unit ? extractSortableValue(a[sortState.column], unit) : a[sortState.column];
            let valB = unit ? extractSortableValue(b[sortState.column], unit) : b[sortState.column];

            // Handle null/undefined values
            if (valA === null || valA === undefined) valA = '';
            if (valB === null || valB === undefined) valB = '';

            // Convert to comparable types
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            const compareResult = valA < valB ? -1 : valA > valB ? 1 : 0;
            return sortState.ascending ? compareResult : -compareResult;
        });
    }

    displaySearchResults(results);
}

// Call this function when the document is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeFilterAndSort();
});

// Settings dropdown functionality
document.addEventListener('DOMContentLoaded', () => {
    const settingsBtn = document.getElementById('settingsButton');
    const settingsDropdown = document.getElementById('settingsDropdown');
    const databaseBtn = document.getElementById('databaseButton');
    let isOpen = false;

    // Toggle settings dropdown
    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isOpen = !isOpen;
        settingsDropdown.style.display = isOpen ? 'block' : 'none';
        settingsBtn.classList.toggle('active', isOpen);
    });

    // Handle database button click
    databaseBtn.addEventListener('click', () => {
        window.location.href = '/database';
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!settingsBtn.contains(e.target) && !settingsDropdown.contains(e.target)) {
            isOpen = false;
            settingsDropdown.style.display = 'none';
            settingsBtn.classList.remove('active');
        }
    });
});

// Remove all previous BOM upload event listeners
const oldButton = document.getElementById('uploadBomButton');
if (oldButton) {
    const newButton = oldButton.cloneNode(true);
    oldButton.parentNode.replaceChild(newButton, oldButton);

    // Add single BOM upload handler
    document.getElementById('uploadBomButton').addEventListener('click', async () => {
        const fileInput = document.getElementById('bomFile');
        const file = fileInput.files[0];

        if (!file) {
            alert('Please select a BOM file first.');
            return;
        }

        if (!currentUser) {
            alert('Please select a user first.');
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`/upload_bom?user=${currentUser}`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(error);
            }

            const result = await response.json();
            updateCartState(); // Update cart state after successful BOM upload

            // Create a modal for displaying results
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'block';

            const modalContent = document.createElement('div');
            modalContent.className = 'modal-content';

            // Add header
            const header = document.createElement('h2');
            header.textContent = 'BOM Upload Results';
            modalContent.appendChild(header);

            // Add found components section
            if (result.found_components && result.found_components.length > 0) {
                const foundHeader = document.createElement('h3');
                foundHeader.textContent = 'Found Components:';
                foundHeader.style.color = '#28a745';
                modalContent.appendChild(foundHeader);

                const foundList = document.createElement('ul');
                result.found_components.forEach(comp => {
                    const item = document.createElement('li');
                    item.textContent = `${comp.part_number} (${comp.designator}): ${comp.quantity} pcs`;
                    foundList.appendChild(item);
                });
                modalContent.appendChild(foundList);
            }

            // Add not found components section
            if (result.not_found_components && result.not_found_components.length > 0) {
                const notFoundHeader = document.createElement('h3');
                notFoundHeader.textContent = 'Not Found Components:';
                notFoundHeader.style.color = '#dc3545';
                modalContent.appendChild(notFoundHeader);

                const notFoundList = document.createElement('ul');
                result.not_found_components.forEach(comp => {
                    const item = document.createElement('li');
                    item.textContent = `${comp.supplier_part} (${comp.designator}): ${comp.quantity} pcs`;
                    notFoundList.appendChild(item);
                });
                modalContent.appendChild(notFoundList);
            }

            // Add buttons
            const buttonContainer = document.createElement('div');
            buttonContainer.style.marginTop = '20px';
            buttonContainer.style.textAlign = 'center';

            const viewCartButton = document.createElement('button');
            viewCartButton.textContent = 'View Cart';
            viewCartButton.onclick = () => {
                window.location.href = '/cart';
            };
            viewCartButton.style.marginRight = '10px';

            const closeButton = document.createElement('button');
            closeButton.textContent = 'Close';
            closeButton.onclick = () => {
                document.body.removeChild(modal);
            };

            buttonContainer.appendChild(viewCartButton);
            buttonContainer.appendChild(closeButton);
            modalContent.appendChild(buttonContainer);

            modal.appendChild(modalContent);
            document.body.appendChild(modal);

            // Clear the file input
            fileInput.value = '';

        } catch (error) {
            console.error('Error:', error);
            // Only show error message if it's not the formData undefined error
            if (!error.message.includes('formData is not defined')) {
                alert('Failed to upload BOM: ' + error.message);
            }
        }
    });
}

// Add cart state update to document ready
document.addEventListener('DOMContentLoaded', () => {
    // ... existing initialization code ...

    // Initialize cart state
    updateCartState();

    // Update cart state when user changes
    document.querySelectorAll('.user-button').forEach(button => {
        button.addEventListener('click', () => {
            setTimeout(updateCartState, 100); // Small delay to ensure user is updated
        });
    });
});

// Add this function to check cart state
async function updateCartState() {
    try {
        const currentUser = localStorage.getItem('currentUser') || 'guest';
        const response = await fetch(`/get_cart?user=${currentUser}`);
        if (response.ok) {
            const cartData = await response.json();
            const cartButton = document.getElementById('cartButton');

            if (cartData && cartData.length > 0) {
                cartButton.classList.add('has-items');
                cartButton.classList.remove('empty');
            } else {
                cartButton.classList.remove('has-items');
                cartButton.classList.add('empty');
            }
        }
    } catch (error) {
        console.error('Error updating cart state:', error);
    }
}