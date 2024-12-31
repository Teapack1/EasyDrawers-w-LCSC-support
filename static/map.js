// Map configuration
const MAP_CONFIG = {
    rows: 6,       // Adjust based on your needs
    cols: 8,       // Adjust based on your needs
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
});

let componentConfig = {};
let storageData = {};

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
        
        // Set grid template based on configuration
        mapGrid.style.gridTemplateColumns = `repeat(${MAP_CONFIG.cols}, ${MAP_CONFIG.drawerSize}px)`;
        mapGrid.style.gap = `${MAP_CONFIG.gap}px`;
        
        // Calculate total cells needed
        const totalCells = MAP_CONFIG.rows * MAP_CONFIG.cols;
        
        // Create drawers for each storage place
        storagePlaces.forEach((place, index) => {
            if (index < totalCells) {
                const drawer = document.createElement('div');
                drawer.className = 'drawer empty';
                drawer.setAttribute('data-location', place);
                
                const labelSpan = document.createElement('span');
                labelSpan.className = 'drawer-label';
                labelSpan.textContent = place;
                
                drawer.appendChild(labelSpan);
                mapGrid.appendChild(drawer);
            }
        });
        
        // Fill remaining cells with empty drawers if needed
        for (let i = storagePlaces.length; i < totalCells; i++) {
            const drawer = document.createElement('div');
            drawer.className = 'drawer empty';
            drawer.setAttribute('data-location', '');
            
            const labelSpan = document.createElement('span');
            labelSpan.className = 'drawer-label';
            labelSpan.textContent = 'Empty';
            
            drawer.appendChild(labelSpan);
            mapGrid.appendChild(drawer);
        }
        
        // Load and update storage data
        await loadStorageData();
        
    } catch (error) {
        console.error('Error initializing map:', error);
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
    // Component type filter change
    document.getElementById('componentTypeFilter').addEventListener('change', (e) => {
        updateBranchFilter();
        applyFilters();
    });
    
    // Component branch filter change
    document.getElementById('componentBranchFilter').addEventListener('change', () => {
        applyFilters();
    });
    
    // Search button click
    document.getElementById('searchButton').addEventListener('click', () => {
        const partNumber = document.getElementById('partNumberSearch').value.trim();
        if (partNumber) {
            searchByPartNumber(partNumber);
        }
    });
    
    // Search input enter key
    document.getElementById('partNumberSearch').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const partNumber = e.target.value.trim();
            if (partNumber) {
                searchByPartNumber(partNumber);
            }
        }
    });
    
    // Drawer click
    document.querySelectorAll('.drawer').forEach(drawer => {
        drawer.addEventListener('click', () => {
            showDrawerContents(drawer);
        });
    });
    
    // Close drawer info panel
    document.querySelector('.close-button').addEventListener('click', () => {
        document.querySelector('.drawer-info-panel').style.display = 'none';
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