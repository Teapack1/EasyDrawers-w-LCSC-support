// Map configuration
const DEFAULT_ROWS = 6;
const DEFAULT_COLS = 8;
const MAP_CONFIG = {
    get rows() {
        return parseInt(localStorage.getItem('mapRows')) || DEFAULT_ROWS;
    },
    get cols() {
        return parseInt(localStorage.getItem('mapCols')) || DEFAULT_COLS;
    },
    drawerSize: 100, // size in pixels
    gap: 10, // gap between drawers in pixels
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
    mapRowsInput.value = MAP_CONFIG.rows;
    mapColsInput.value = MAP_CONFIG.cols;

    // Apply Layout button event
    document.getElementById('applyLayoutBtn').addEventListener('click', () => {
        const rows = Math.max(1, Math.min(20, parseInt(mapRowsInput.value) || DEFAULT_ROWS));
        const cols = Math.max(1, Math.min(20, parseInt(mapColsInput.value) || DEFAULT_COLS));
        localStorage.setItem('mapRows', rows);
        localStorage.setItem('mapCols', cols);
        // Update input values in case user entered out-of-bounds
        mapRowsInput.value = rows;
        mapColsInput.value = cols;
        // Re-initialize the map grid
        initializeMap();
    });
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
        // Load component config
        const configResponse = await fetch('/component_config');
        const componentConfig = await configResponse.json();

        // Extract unique storage places
        const storagePlaces = extractStoragePlaces(componentConfig);

        const mapGrid = document.querySelector('.map-grid');

        // Clear previous grid
        mapGrid.innerHTML = '';

        // Set grid template based on configuration
        mapGrid.style.gridTemplateColumns = `repeat(${MAP_CONFIG.cols}, ${MAP_CONFIG.drawerSize}px)`;
        mapGrid.style.gap = `${MAP_CONFIG.gap}px`;

        // Calculate total cells needed
        const totalCells = MAP_CONFIG.rows * MAP_CONFIG.cols;

        // Create drawers for each storage place (up to totalCells)
        storagePlaces.forEach((place, index) => {
            if (index < totalCells) {
                const drawer = createDrawerElement(place);
                mapGrid.appendChild(drawer);
            }
        });

        // Fill remaining cells with empty drawers if needed
        for (let i = storagePlaces.length; i < totalCells; i++) {
            const drawer = createDrawerElement(''); // Empty location
            mapGrid.appendChild(drawer);
        }

        // Load and update storage data
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

function showDrawerContents(drawer) {
    const location = drawer.getAttribute('data-location');
    const contents = storageData[location] || [];

    const infoPanel = document.querySelector('.drawer-info-panel');
    const infoContent = infoPanel.querySelector('.drawer-info-content');

    // Clear previous content
    infoContent.innerHTML = '';

    if (contents.length === 0) {
        infoContent.innerHTML = '<p>No components stored in this location.</p>';
    } else {
        // Group components by type and branch
        const groupedContents = contents.reduce((acc, component) => {
            const key = `${component.component_type} - ${component.component_branch}`;
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(component);
            return acc;
        }, {});

        // Create content HTML
        Object.entries(groupedContents).forEach(([group, components]) => {
            const section = document.createElement('div');
            section.className = 'content-section';
            section.innerHTML = `
                <h4>${group}</h4>
                <ul>
                    ${components.map(comp => `
                        <li>
                            ${comp.part_number} - ${comp.description || 'No description'}
                            (Qty: ${comp.order_qty})
                        </li>
                    `).join('')}
                </ul>
            `;
            infoContent.appendChild(section);
        });
    }

    infoPanel.style.display = 'block';
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

    // Close drawer info panel
    document.querySelector('.drawer-info-panel .close-button').addEventListener('click', () => {
        document.querySelector('.drawer-info-panel').style.display = 'none';
    });

    // --- New Event Listeners for Assign Modal ---
    document.getElementById('closeAssignModal').addEventListener('click', closeAssignModal);
    document.getElementById('assignComponentType').addEventListener('change', updateAssignBranchDropdown);
    document.getElementById('assignBranchButton').addEventListener('click', assignBranch);

    // Close modal if clicking outside the content
    const assignModal = document.getElementById('assignBranchModal');
    assignModal.addEventListener('click', (event) => {
        if (event.target === assignModal) {
            closeAssignModal();
        }
    });

    // Add Escape key listener to close modal
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && assignModal.style.display === 'flex') {
            closeAssignModal();
        }
    });
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