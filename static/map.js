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

function initializeMap() {
    const mapGrid = document.querySelector('.map-grid');
    const rows = 4;
    const cols = 8;
    
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            const drawer = document.createElement('div');
            drawer.className = 'drawer';
            const label = `${String.fromCharCode(65 + i)}${j + 1}`;
            drawer.setAttribute('data-location', label);
            
            const labelSpan = document.createElement('span');
            labelSpan.className = 'drawer-label';
            labelSpan.textContent = label;
            
            drawer.appendChild(labelSpan);
            mapGrid.appendChild(drawer);
        }
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

function updateMapOccupancy() {
    const drawers = document.querySelectorAll('.drawer');
    drawers.forEach(drawer => {
        const location = drawer.getAttribute('data-location');
        const isOccupied = storageData[location] && storageData[location].length > 0;
        drawer.classList.toggle('occupied', isOccupied);
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