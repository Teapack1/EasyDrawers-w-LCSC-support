// Map configuration
const DEFAULT_ROWS = 6;
const DEFAULT_COLS = 8;
const DEFAULT_EXTRA = 0; // Default extra drawers

const MAP_CONFIG = {
    get rows() {
        return parseInt(localStorage.getItem('mapRows')) || DEFAULT_ROWS;
    },
    get cols() {
        return parseInt(localStorage.getItem('mapCols')) || DEFAULT_COLS;
    },
    get extra() { // Add getter for extra drawers
        return parseInt(localStorage.getItem('mapExtra')) || DEFAULT_EXTRA;
    },
    drawerSize: 100, // Base size, CSS can adjust
    gap: 10,
};

document.addEventListener('DOMContentLoaded', () => {
    // Initialize the storage map
    initializeMap();

    // Load component configuration
    loadComponentConfig();

    // Set up event listeners
    setupEventListeners();

    // Display current user
    const currentUser = localStorage.getItem('currentUser') || 'guest';
    document.getElementById('currentUserDisplay').textContent = `Current User: ${currentUser}`;

    // Set layout input values from localStorage or defaults
    const mapRowsInput = document.getElementById('mapRows');
    const mapColsInput = document.getElementById('mapCols');
    const mapExtraInput = document.getElementById('mapExtra'); // Get extra input
    if (mapRowsInput) mapRowsInput.value = MAP_CONFIG.rows;
    if (mapColsInput) mapColsInput.value = MAP_CONFIG.cols;
    if (mapExtraInput) mapExtraInput.value = MAP_CONFIG.extra; // Set initial extra value

    // Apply Layout button event
    const applyLayoutBtn = document.getElementById('applyLayoutBtn');
    if (applyLayoutBtn) {
        applyLayoutBtn.addEventListener('click', () => {
            // Read and clamp values
            const rows = Math.max(1, Math.min(20, parseInt(mapRowsInput.value) || DEFAULT_ROWS));
            const cols = Math.max(1, Math.min(20, parseInt(mapColsInput.value) || DEFAULT_COLS));
            const extra = Math.max(0, Math.min(10, parseInt(mapExtraInput.value) || DEFAULT_EXTRA)); // Read and clamp extra

            // Save to localStorage
            localStorage.setItem('mapRows', rows);
            localStorage.setItem('mapCols', cols);
            localStorage.setItem('mapExtra', extra); // Save extra

            // Update input fields (in case values were clamped)
            mapRowsInput.value = rows;
            mapColsInput.value = cols;
            mapExtraInput.value = extra; // Update extra input

            // Re-initialize the map grid
            initializeMap();
        });
    }
});

let componentConfig = {};
let storageData = {};
let currentAssignLocation = null; // To store the location being assigned

async function loadComponentConfig() {
    try {
        const response = await fetch('/component_config');
        componentConfig = await response.json();
        populateFilterDropdowns();
    } catch (error) {
        console.error('Error loading component configuration:', error);
    }
}

async function loadStorageData() {
    try {
        const response = await fetch('/storage_data');
        storageData = await response.json();
        updateMapOccupancy();
    } catch (error) {
        console.error('Error loading storage data:', error);
    }
}

// Add new function to extract storage places from component config
function extractStoragePlaces(config) {
    const storagePlaces = new Set();

    Object.values(config).forEach(type => {
        Object.values(type['Component Branch']).forEach(branch => {
            if (branch['Storage Place']) {
                storagePlaces.add(branch['Storage Place']);
            }
        });
    });

    return Array.from(storagePlaces).sort();
}

async function initializeMap() {
    try {
        // No need to fetch componentConfig here for labeling
        // Only need it for extracting storage places for occupancy, not for labeling
        const mapGrid = document.querySelector('.map-grid');
        if (!mapGrid) {
            console.error("Map grid container not found.");
            return;
        }

        mapGrid.innerHTML = ''; // Clear previous grid content

        // Set CSS Custom Properties for the grid
        mapGrid.style.setProperty('--map-cols', MAP_CONFIG.cols);
        mapGrid.style.setProperty('--map-rows', MAP_CONFIG.rows);
        mapGrid.style.setProperty('--map-drawer-size', `${MAP_CONFIG.drawerSize}px`);
        mapGrid.style.setProperty('--map-gap', `${MAP_CONFIG.gap}px`);

        // --- Create Main Grid Drawers with fixed labels --- 
        const totalCells = MAP_CONFIG.rows * MAP_CONFIG.cols;
        let labelList = [];
        for (let row = 0; row < MAP_CONFIG.rows; row++) {
            const rowLetter = String.fromCharCode(65 + row); // 65 = 'A'
            for (let col = 1; col <= MAP_CONFIG.cols; col++) {
                labelList.push(`${rowLetter}${col}`);
            }
        }
        // Create drawers with fixed labels
        labelList.forEach(label => {
            const drawer = createDrawerElement(label);
            mapGrid.appendChild(drawer);
        });

        // --- Add Separator and Extra Drawers --- 
        const extraCount = MAP_CONFIG.extra;
        if (extraCount > 0) {
            // Add a separator element that spans the grid width
            const separator = document.createElement('div');
            separator.className = 'grid-separator';
            separator.style.gridColumn = `1 / -1`; // Span all columns
            mapGrid.appendChild(separator);

            // Add extra drawers
            for (let i = 1; i <= extraCount; i++) {
                const location = `U${i}`;
                const drawer = createDrawerElement(location);
                mapGrid.appendChild(drawer); // Append directly to mapGrid
            }
        }

        // Load and update storage data (will update all drawers in mapGrid)
        await loadStorageData();

    } catch (error) {
        console.error('Error initializing map:', error);
    }
}

// Helper function to create a drawer element and attach listeners
function createDrawerElement(location) {
    const drawer = document.createElement('div');
    drawer.className = 'drawer empty';
    drawer.setAttribute('data-location', location);

    const labelSpan = document.createElement('span');
    labelSpan.className = 'drawer-label';
    labelSpan.textContent = location || 'Empty'; // Display location or 'Empty'

    drawer.appendChild(labelSpan);

    // Add click listener for both showing contents and assignment
    drawer.addEventListener('click', () => {
        if (location) {
            handleDrawerClick(drawer, location);
        } // Do nothing if it's an 'Empty' drawer
    });

    return drawer;
}

// Function to handle drawer clicks (decides between info and assignment)
function handleDrawerClick(drawerElement, location) {
    // Example logic: If Shift key is held, open assignment modal, otherwise show info.
    // You can adjust this logic based on your desired UX.
    if (window.event && window.event.shiftKey) { // Check if Shift key is held
        openAssignModal(location);
    } else {
        showDrawerContents(drawerElement);
    }
}

// Function to open the assignment modal
function openAssignModal(location) {
    currentAssignLocation = location;
    document.getElementById('assignLocationLabel').textContent = location;

    const typeSelect = document.getElementById('assignComponentType');
    const branchSelect = document.getElementById('assignComponentBranch');

    // Populate type dropdown
    typeSelect.innerHTML = '<option value="">Select Type</option>';
    Object.keys(componentConfig).sort().forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        typeSelect.appendChild(option);
    });

    // Reset and disable branch dropdown
    branchSelect.innerHTML = '<option value="">Select Branch</option>';
    branchSelect.disabled = true;

    // Show the modal
    document.getElementById('assignBranchModal').style.display = 'flex';
}

// Function to close the assignment modal
function closeAssignModal() {
    document.getElementById('assignBranchModal').style.display = 'none';
    currentAssignLocation = null;
}

// Function to update assignment branch dropdown based on selected type
function updateAssignBranchDropdown() {
    const typeSelect = document.getElementById('assignComponentType');
    const branchSelect = document.getElementById('assignComponentBranch');
    const selectedType = typeSelect.value;

    branchSelect.innerHTML = '<option value="">Select Branch</option>';

    if (selectedType && componentConfig[selectedType] && componentConfig[selectedType]['Component Branch']) {
        const branches = componentConfig[selectedType]['Component Branch'];
        Object.keys(branches).sort().forEach(branch => {
            const option = document.createElement('option');
            option.value = branch;
            option.textContent = branch;
            branchSelect.appendChild(option);
        });
        branchSelect.disabled = false;
    } else {
        branchSelect.disabled = true;
    }
}

// Function to handle the assignment request
async function assignBranch() {
    const typeSelect = document.getElementById('assignComponentType');
    const branchSelect = document.getElementById('assignComponentBranch');

    const componentType = typeSelect.value;
    const componentBranch = branchSelect.value;

    if (!currentAssignLocation || !componentType || !componentBranch) {
        alert('Please select a location, component type, and branch.');
        return;
    }

    try {
        const response = await fetch('/assign_branch_to_location', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                location: currentAssignLocation,
                component_type: componentType,
                component_branch: componentBranch
            })
        });

        const result = await response.json();

        if (response.ok) {
            alert(result.message);
            closeAssignModal();
            // Optionally: Reload config or update UI immediately
            loadComponentConfig(); // Reload config to reflect changes
            initializeMap(); // Re-initialize map to potentially update drawer labels/styles if needed
        } else {
            alert(`Error: ${result.detail || 'Failed to assign branch.'}`);
        }
    } catch (error) {
        console.error('Error assigning branch:', error);
        alert('An unexpected error occurred while assigning the branch.');
    }
}

function populateFilterDropdowns() {
    const typeFilter = document.getElementById('componentTypeFilter');
    const branchFilter = document.getElementById('componentBranchFilter');

    // Clear existing options
    typeFilter.innerHTML = '<option value="">Select Component Type</option>';
    branchFilter.innerHTML = '<option value="">Select Component Branch</option>';

    // Populate component types
    Object.keys(componentConfig).forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        typeFilter.appendChild(option);
    });
}

function updateBranchFilter() {
    const typeFilter = document.getElementById('componentTypeFilter');
    const branchFilter = document.getElementById('componentBranchFilter');
    const selectedType = typeFilter.value;

    branchFilter.innerHTML = '<option value="">Select Component Branch</option>';

    if (selectedType && componentConfig[selectedType]) {
        const branches = componentConfig[selectedType]['Component Branch'];
        Object.keys(branches).forEach(branch => {
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

// Modify updateMapOccupancy to handle the new structure
function updateMapOccupancy() {
    const drawers = document.querySelectorAll('.drawer');
    drawers.forEach(drawer => {
        const location = drawer.getAttribute('data-location');
        if (location) {
            const isOccupied = storageData[location] && storageData[location].length > 0;
            drawer.classList.remove('empty', 'occupied');
            drawer.classList.add(isOccupied ? 'occupied' : 'empty');
        }
    });
}

// Function to show drawer contents (on dedicated map page)
function showDrawerContents(drawer) {
    const location = drawer.getAttribute('data-location');
    const contents = storageData[location] || [];

    const infoPanel = document.querySelector('.drawer-info-panel');
    const infoContent = infoPanel.querySelector('.drawer-info-content');

    infoContent.innerHTML = ''; // Clear previous content

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

    // Use flex display instead of block for better compatibility with new CSS
    infoPanel.style.display = 'flex';

    // Add temporary listener to close panel on outside click
    setTimeout(() => { // Use timeout to prevent immediate closing
        document.addEventListener('click', closeInfoPanelOnClickOutside, { once: true });
    }, 0);
}

// Function to close the info panel when clicking outside
function closeInfoPanelOnClickOutside(event) {
    const infoPanel = document.querySelector('.drawer-info-panel');
    // Check if the click is outside the infoPanel and not on a drawer
    if (infoPanel && !infoPanel.contains(event.target) && !event.target.closest('.drawer')) {
        infoPanel.style.display = 'none';
    } else if (infoPanel && infoPanel.style.display === 'flex') {
        // If clicked inside or on a drawer while panel is open, re-add the listener
        document.addEventListener('click', closeInfoPanelOnClickOutside, { once: true });
    }
}

function setupEventListeners() {
    // Component type filter change (map side panel)
    document.getElementById('componentTypeFilter').addEventListener('change', (e) => {
        updateBranchFilter();
        applyFilters();
    });

    // Component branch filter change (map side panel)
    document.getElementById('componentBranchFilter').addEventListener('change', () => {
        applyFilters();
    });

    // Search button click (map side panel)
    document.getElementById('searchButton').addEventListener('click', () => {
        const partNumber = document.getElementById('partNumberSearch').value.trim();
        if (partNumber) {
            searchByPartNumber(partNumber);
        }
    });

    // Search input enter key (map side panel)
    document.getElementById('partNumberSearch').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const partNumber = e.target.value.trim();
            if (partNumber) {
                searchByPartNumber(partNumber);
            }
        }
    });

    // Close drawer info panel (using the dedicated close button)
    const drawerInfoCloseBtn = document.querySelector('.drawer-info-panel .close-button');
    if (drawerInfoCloseBtn) {
        drawerInfoCloseBtn.addEventListener('click', () => {
            const infoPanel = document.querySelector('.drawer-info-panel');
            if (infoPanel) infoPanel.style.display = 'none';
            // Optional: Explicitly remove the outside click listener if the button is used
            document.removeEventListener('click', closeInfoPanelOnClickOutside);
        });
    }

    // Close assign modal if clicking outside the content
    const assignModal = document.getElementById('assignBranchModal');
    if (assignModal) { // Check if assignModal exists on this page
        assignModal.addEventListener('click', (event) => {
            if (event.target === assignModal) {
                closeAssignModal();
            }
        });
    }

    // Add Escape key listener to close modals
    document.addEventListener('keydown', (event) => {
        const assignModal = document.getElementById('assignBranchModal');
        const infoPanel = document.querySelector('.drawer-info-panel');

        if (event.key === 'Escape') {
            if (assignModal && assignModal.style.display === 'flex') {
                closeAssignModal();
            } else if (infoPanel && infoPanel.style.display === 'flex') {
                infoPanel.style.display = 'none';
                document.removeEventListener('click', closeInfoPanelOnClickOutside);
            }
        }
    });

    // --- New Event Listeners for Assign Modal ---
    document.getElementById('closeAssignModal').addEventListener('click', closeAssignModal);
    document.getElementById('assignComponentType').addEventListener('change', updateAssignBranchDropdown);
    document.getElementById('assignBranchButton').addEventListener('click', assignBranch);
}

async function searchByPartNumber(partNumber) {
    try {
        const response = await fetch(`/search_component?query=${encodeURIComponent(partNumber)}`);
        if (response.ok) {
            const results = await response.json();
            highlightStorageLocation(results);
        } else {
            alert('Component not found');
        }
    } catch (error) {
        console.error('Error searching for component:', error);
        alert('Error searching for component');
    }
}

function highlightStorageLocation(components) {
    // Clear previous highlights
    document.querySelectorAll('.drawer').forEach(drawer => {
        drawer.classList.remove('highlighted');
    });

    // Highlight drawers containing the components
    components.forEach(component => {
        const location = component.storage_place;
        if (location) {
            const drawer = document.querySelector(`.drawer[data-location="${location}"]`);
            if (drawer) {
                drawer.classList.add('highlighted');
            }
        }
    });
}

function applyFilters() {
    const typeFilter = document.getElementById('componentTypeFilter');
    const branchFilter = document.getElementById('componentBranchFilter');
    const selectedType = typeFilter.value;
    const selectedBranch = branchFilter.value;

    // Clear previous highlights
    document.querySelectorAll('.drawer').forEach(drawer => {
        drawer.classList.remove('highlighted');
    });

    if (!selectedType) return;

    // Highlight drawers based on filters
    Object.entries(storageData).forEach(([location, components]) => {
        const hasMatch = components.some(component => {
            if (selectedBranch) {
                return component.component_type === selectedType &&
                    component.component_branch === selectedBranch;
            }
            return component.component_type === selectedType;
        });

        if (hasMatch) {
            const drawer = document.querySelector(`.drawer[data-location="${location}"]`);
            if (drawer) {
                drawer.classList.add('highlighted');
            }
        }
    });
}

// Initial load of storage data
loadStorageData();