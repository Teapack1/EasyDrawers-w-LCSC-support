// Default map configuration
let MAP_CONFIG = {
    rows: 6,           // Default number of rows
    cols: 8,           // Default number of columns
    drawerSize: 100,   // Default size in pixels
    gap: 10,           // Default gap between drawers in pixels
};

// Storage keys for localStorage
const STORAGE_KEYS = {
    mapConfig: 'storageMapConfig',
    componentAssignments: 'storageComponentAssignments'
};

// Component colors for different categories
const COMPONENT_COLORS = {
    'Resistors': { color: '#ff5252', class: 'resistor-color' },
    'Capacitors': { color: '#4caf50', class: 'capacitor-color' },
    'Inductors': { color: '#ba68c8', class: 'inductor-color' },
    'Diodes': { color: '#ff9800', class: 'diode-color' },
    'Transistors': { color: '#2196f3', class: 'transistor-color' },
    'ICs': { color: '#9c27b0', class: 'ic-color' },
    'Connectors': { color: '#795548', class: 'connector-color' },
    'Miscellaneous': { color: '#607d8b', class: 'misc-color' }
};

// Global variables
let componentConfig = {};
let storageData = {};
let componentAssignments = {};
let isAssignmentMode = false;
let currentAssignment = { type: '', branch: '' };

document.addEventListener('DOMContentLoaded', () => {
    // Load saved map configuration if available
    loadSavedMapConfig();

    // Load saved component assignments if available
    loadSavedComponentAssignments();

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

function loadSavedMapConfig() {
    const savedConfig = localStorage.getItem(STORAGE_KEYS.mapConfig);
    if (savedConfig) {
        try {
            const parsedConfig = JSON.parse(savedConfig);
            MAP_CONFIG = { ...MAP_CONFIG, ...parsedConfig };

            // Update input fields in the layout editor panel
            if (document.getElementById('rowsInput')) {
                document.getElementById('rowsInput').value = MAP_CONFIG.rows;
                document.getElementById('columnsInput').value = MAP_CONFIG.cols;
                document.getElementById('boxSizeInput').value = MAP_CONFIG.drawerSize;
                document.getElementById('gapSizeInput').value = MAP_CONFIG.gap;
            }
        } catch (e) {
            console.error('Error loading saved map configuration:', e);
        }
    }
}

function loadSavedComponentAssignments() {
    const savedAssignments = localStorage.getItem(STORAGE_KEYS.componentAssignments);
    if (savedAssignments) {
        try {
            componentAssignments = JSON.parse(savedAssignments);
        } catch (e) {
            console.error('Error loading saved component assignments:', e);
            componentAssignments = {};
        }
    }
}

async function loadComponentConfig() {
    try {
        const response = await fetch('/component_config');
        componentConfig = await response.json();
        populateFilterDropdowns();
        populateAssignmentSelects();
        updateDynamicLegend();
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

// Extract storage places from component config
function extractStoragePlaces(config) {
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

async function initializeMap() {
    try {
        // Load component config
        const configResponse = await fetch('/component_config');
        const componentConfig = await configResponse.json();

        // Extract unique storage places
        const storagePlaces = extractStoragePlaces(componentConfig);

        const mapGrid = document.querySelector('.map-grid');
        if (!mapGrid) return;

        // Set grid template based on configuration
        mapGrid.style.gridTemplateColumns = `repeat(${MAP_CONFIG.cols}, ${MAP_CONFIG.drawerSize}px)`;
        mapGrid.style.gridTemplateRows = `repeat(${MAP_CONFIG.rows}, ${MAP_CONFIG.drawerSize}px)`;
        mapGrid.style.gap = `${MAP_CONFIG.gap}px`;

        // Calculate total cells needed
        const totalCells = MAP_CONFIG.rows * MAP_CONFIG.cols;

        // Clear existing grid
        mapGrid.innerHTML = '';

        // Create drawers for each location
        for (let i = 0; i < totalCells; i++) {
            const drawer = document.createElement('div');
            drawer.className = 'drawer empty';

            const locationId = `box-${i}`;
            drawer.setAttribute('data-location', locationId);
            drawer.setAttribute('data-index', i);

            // If this location has a saved component type, apply it
            if (componentAssignments[locationId]) {
                const assignment = componentAssignments[locationId];
                drawer.setAttribute('data-component-type', assignment.type);
                drawer.setAttribute('data-component-branch', assignment.branch);

                // Add appropriate class for coloring
                const colorClass = getComponentColorClass(assignment.type);
                if (colorClass) {
                    drawer.classList.add(colorClass);
                }
            }

            const labelSpan = document.createElement('span');
            labelSpan.className = 'drawer-label';
            labelSpan.textContent = locationId;

            drawer.appendChild(labelSpan);
            mapGrid.appendChild(drawer);

            // Add click event to show drawer contents or assign component type
            drawer.addEventListener('click', (e) => {
                handleDrawerClick(drawer, e);
            });
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

    if (!typeFilter || !branchFilter) return;

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

function populateAssignmentSelects() {
    const typeSelect = document.getElementById('assignTypeSelect');
    const branchSelect = document.getElementById('assignBranchSelect');

    if (!typeSelect || !branchSelect) return;

    // Clear existing options
    typeSelect.innerHTML = '<option value="">Select Component Type</option>';

    // Populate component types
    Object.keys(componentConfig).forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        typeSelect.appendChild(option);
    });

    // Add change event to type select
    typeSelect.addEventListener('change', () => {
        updateAssignmentBranchSelect();
        updateColorPreview();
    });

    // Add change event to branch select
    branchSelect.addEventListener('change', () => {
        updateColorPreview();
        updateStartAssigningButton();
    });
}

function updateAssignmentBranchSelect() {
    const typeSelect = document.getElementById('assignTypeSelect');
    const branchSelect = document.getElementById('assignBranchSelect');

    if (!typeSelect || !branchSelect) return;

    const selectedType = typeSelect.value;

    // Clear and disable by default
    branchSelect.innerHTML = '<option value="">Select Component Branch</option>';
    branchSelect.disabled = true;

    if (selectedType && componentConfig[selectedType]) {
        const branches = componentConfig[selectedType]['Component Branch'];
        if (branches) {
            Object.keys(branches).forEach(branch => {
                const option = document.createElement('option');
                option.value = branch;
                option.textContent = branch;
                branchSelect.appendChild(option);
            });
            branchSelect.disabled = false;
        }
    }

    updateStartAssigningButton();
}

function updateStartAssigningButton() {
    const typeSelect = document.getElementById('assignTypeSelect');
    const branchSelect = document.getElementById('assignBranchSelect');
    const startBtn = document.getElementById('startAssigningBtn');

    if (!typeSelect || !branchSelect || !startBtn) return;

    // Enable button only when both type and branch are selected
    startBtn.disabled = !(typeSelect.value && branchSelect.value);
}

function updateColorPreview() {
    const typeSelect = document.getElementById('assignTypeSelect');
    const colorPreview = document.getElementById('assignmentColorPreview');

    if (!typeSelect || !colorPreview) return;

    const selectedType = typeSelect.value;

    // Set default color
    colorPreview.style.backgroundColor = '#f0f0f0';

    // Update with component type color if available
    if (selectedType && COMPONENT_COLORS[selectedType]) {
        colorPreview.style.backgroundColor = COMPONENT_COLORS[selectedType].color;
    }
}

function updateBranchFilter() {
    const typeFilter = document.getElementById('componentTypeFilter');
    const branchFilter = document.getElementById('componentBranchFilter');

    if (!typeFilter || !branchFilter) return;

    const selectedType = typeFilter.value;

    branchFilter.innerHTML = '<option value="">Select Component Branch</option>';

    if (selectedType && componentConfig[selectedType]) {
        const branches = componentConfig[selectedType]['Component Branch'];
        if (branches) {
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
    } else {
        branchFilter.disabled = true;
    }
}

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

    if (!infoPanel || !infoContent) return;

    // Clear previous content
    infoContent.innerHTML = '';

    // Add the drawer location to the header
    const drawerHeader = infoPanel.querySelector('.drawer-info-header h3');
    if (drawerHeader) {
        drawerHeader.textContent = `Drawer Contents: ${location}`;
    }

    // Show component type/branch if assigned
    const componentType = drawer.getAttribute('data-component-type');
    const componentBranch = drawer.getAttribute('data-component-branch');

    if (componentType) {
        const assignmentInfo = document.createElement('div');
        assignmentInfo.className = 'assignment-info';
        assignmentInfo.innerHTML = `
            <strong>Assigned Category:</strong> ${componentType} - ${componentBranch || 'All'}
        `;
        infoContent.appendChild(assignmentInfo);
    }

    // Show stored components
    if (contents.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.textContent = 'No components stored in this location.';
        infoContent.appendChild(emptyMessage);
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
                            <strong>${comp.part_number}</strong> - ${comp.description || 'No description'}
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

function handleDrawerClick(drawer, event) {
    // If we're in assignment mode, assign component
    if (isAssignmentMode && currentAssignment.type) {
        assignComponentToDrawer(drawer);
    } else {
        // Otherwise show drawer contents
        showDrawerContents(drawer);
    }
}

function assignComponentToDrawer(drawer) {
    const location = drawer.getAttribute('data-location');

    // Remove any existing component assignments and classes
    Object.values(COMPONENT_COLORS).forEach(colorData => {
        drawer.classList.remove(colorData.class);
    });

    // Assign new component type and branch
    drawer.setAttribute('data-component-type', currentAssignment.type);
    drawer.setAttribute('data-component-branch', currentAssignment.branch || '');

    // Add appropriate styling
    const colorClass = getComponentColorClass(currentAssignment.type);
    if (colorClass) {
        drawer.classList.add(colorClass);
    }

    // Save the assignment
    componentAssignments[location] = {
        type: currentAssignment.type,
        branch: currentAssignment.branch || ''
    };

    // Persist to localStorage
    saveComponentAssignments();

    // Update status
    const statusEl = document.getElementById('assignmentStatus');
    if (statusEl) {
        statusEl.textContent = `Assigned ${currentAssignment.type} ${currentAssignment.branch ? `- ${currentAssignment.branch}` : ''} to drawer ${location}`;
    }

    // Add selected class to show feedback
    drawer.classList.add('selected');
    setTimeout(() => {
        drawer.classList.remove('selected');
    }, 500);
}

function getComponentColorClass(componentType) {
    if (COMPONENT_COLORS[componentType]) {
        return COMPONENT_COLORS[componentType].class;
    }
    return null;
}

function saveComponentAssignments() {
    try {
        localStorage.setItem(STORAGE_KEYS.componentAssignments, JSON.stringify(componentAssignments));
    } catch (e) {
        console.error('Error saving component assignments:', e);
    }
}

function saveMapConfig() {
    try {
        localStorage.setItem(STORAGE_KEYS.mapConfig, JSON.stringify(MAP_CONFIG));
    } catch (e) {
        console.error('Error saving map configuration:', e);
    }
}

function updateDynamicLegend() {
    const legendContainer = document.getElementById('dynamicLegendItems');
    if (!legendContainer) return;

    // Clear existing legend items
    legendContainer.innerHTML = '';

    // Add title
    const title = document.createElement('div');
    title.className = 'legend-title';
    title.textContent = 'Component Categories:';
    legendContainer.appendChild(title);

    // Add component type colors to legend
    Object.entries(COMPONENT_COLORS).forEach(([type, data]) => {
        const item = document.createElement('div');
        item.className = 'legend-item';

        const colorBox = document.createElement('div');
        colorBox.className = 'legend-color';
        colorBox.style.backgroundColor = data.color;

        const label = document.createElement('span');
        label.textContent = type;

        item.appendChild(colorBox);
        item.appendChild(label);
        legendContainer.appendChild(item);
    });
}

function startAssignmentMode() {
    const typeSelect = document.getElementById('assignTypeSelect');
    const branchSelect = document.getElementById('assignBranchSelect');
    const startBtn = document.getElementById('startAssigningBtn');
    const stopBtn = document.getElementById('stopAssigningBtn');
    const mapContainer = document.querySelector('.map-container');

    if (!typeSelect || !branchSelect || !startBtn || !stopBtn || !mapContainer) return;

    // Get selected values
    currentAssignment = {
        type: typeSelect.value,
        branch: branchSelect.value
    };

    // Enable assignment mode
    isAssignmentMode = true;
    mapContainer.classList.add('assignment-mode');

    // Update buttons
    startBtn.disabled = true;
    stopBtn.disabled = false;

    // Update status
    const statusEl = document.getElementById('assignmentStatus');
    if (statusEl) {
        statusEl.textContent = `Click on drawers to assign ${currentAssignment.type} ${currentAssignment.branch ? `- ${currentAssignment.branch}` : ''}`;
    }
}

function stopAssignmentMode() {
    const startBtn = document.getElementById('startAssigningBtn');
    const stopBtn = document.getElementById('stopAssigningBtn');
    const mapContainer = document.querySelector('.map-container');

    if (!startBtn || !stopBtn || !mapContainer) return;

    // Disable assignment mode
    isAssignmentMode = false;
    mapContainer.classList.remove('assignment-mode');

    // Update buttons
    startBtn.disabled = false;
    stopBtn.disabled = true;

    // Update status
    const statusEl = document.getElementById('assignmentStatus');
    if (statusEl) {
        statusEl.textContent = `Stopped assigning. Select a component type and branch to continue.`;
    }

    // Clear current assignment
    currentAssignment = { type: '', branch: '' };
}

function clearAllAssignments() {
    if (confirm('Are you sure you want to clear all component assignments? This cannot be undone.')) {
        // Clear assignments object
        componentAssignments = {};

        // Remove data attributes and classes from all drawers
        const drawers = document.querySelectorAll('.drawer');
        drawers.forEach(drawer => {
            drawer.removeAttribute('data-component-type');
            drawer.removeAttribute('data-component-branch');

            // Remove all component color classes
            Object.values(COMPONENT_COLORS).forEach(colorData => {
                drawer.classList.remove(colorData.class);
            });
        });

        // Save cleared state
        saveComponentAssignments();

        // Update status
        const statusEl = document.getElementById('assignmentStatus');
        if (statusEl) {
            statusEl.textContent = `All component assignments have been cleared.`;
        }
    }
}

function applyLayoutChanges() {
    // Get values from inputs
    const rowsInput = document.getElementById('rowsInput');
    const columnsInput = document.getElementById('columnsInput');
    const boxSizeInput = document.getElementById('boxSizeInput');
    const gapSizeInput = document.getElementById('gapSizeInput');

    if (!rowsInput || !columnsInput || !boxSizeInput || !gapSizeInput) return;

    // Update config
    MAP_CONFIG.rows = parseInt(rowsInput.value) || 6;
    MAP_CONFIG.cols = parseInt(columnsInput.value) || 8;
    MAP_CONFIG.drawerSize = parseInt(boxSizeInput.value) || 100;
    MAP_CONFIG.gap = parseInt(gapSizeInput.value) || 10;

    // Save to localStorage
    saveMapConfig();

    // Reinitialize the map
    initializeMap();

    // Hide the editor panel
    document.getElementById('layoutEditorPanel').classList.remove('active');
}

function resetLayoutToDefault() {
    if (confirm('Are you sure you want to reset to the default layout? This will not affect component assignments.')) {
        // Reset to default values
        MAP_CONFIG = {
            rows: 6,
            cols: 8,
            drawerSize: 100,
            gap: 10
        };

        // Update input fields
        document.getElementById('rowsInput').value = MAP_CONFIG.rows;
        document.getElementById('columnsInput').value = MAP_CONFIG.cols;
        document.getElementById('boxSizeInput').value = MAP_CONFIG.drawerSize;
        document.getElementById('gapSizeInput').value = MAP_CONFIG.gap;

        // Save to localStorage
        saveMapConfig();

        // Reinitialize the map
        initializeMap();
    }
}

async function smartSearch(query) {
    const searchInput = document.getElementById('partNumberSearch');
    const searchToggle = document.getElementById('smartSearchToggle');

    if (!searchInput || !searchToggle) return;

    // Determine search type
    const isSmartSearch = searchToggle.checked;

    try {
        let url;
        if (isSmartSearch) {
            // Use a more semantic search for smart search
            url = `/search_component?query=${encodeURIComponent(query)}`;
        } else {
            // Use exact part number search for LCSC search
            url = `/search_component?query=${encodeURIComponent(query)}`;
        }

        const response = await fetch(url);
        if (response.ok) {
            const results = await response.json();

            // Process and highlight the results
            highlightSearchResults(results, isSmartSearch);

            // Show how many results were found
            const foundMessage = `Found ${results.length} components${isSmartSearch ? ' (smart search)' : ''}`;

            // Show notification
            const statusText = foundMessage;
            alert(statusText);

            return results;
        } else {
            alert('No components found matching your search');
            return [];
        }
    } catch (error) {
        console.error('Error during search:', error);
        alert('Error searching for components');
        return [];
    }
}

function highlightSearchResults(components, isSmartSearch) {
    // Clear previous highlights
    document.querySelectorAll('.drawer').forEach(drawer => {
        drawer.classList.remove('highlighted');
    });

    // Get all unique storage locations from search results
    const storageLocations = new Set();
    components.forEach(component => {
        if (component.storage_place) {
            storageLocations.add(component.storage_place);
        }
    });

    // Get uniquely assigned boxes for these component types
    const componentTypes = new Set(components.map(c => c.component_type));
    const assignedLocations = Object.entries(componentAssignments)
        .filter(([location, assignment]) => componentTypes.has(assignment.type))
        .map(([location]) => location);

    // Highlight all relevant drawers
    document.querySelectorAll('.drawer').forEach(drawer => {
        const location = drawer.getAttribute('data-location');
        // Highlight if component is stored there or if assigned to that component type
        if (storageLocations.has(location) || assignedLocations.includes(location)) {
            drawer.classList.add('highlighted');
        }
    });
}

function setupEventListeners() {
    // Component type filter change
    const typeFilter = document.getElementById('componentTypeFilter');
    if (typeFilter) {
        typeFilter.addEventListener('change', () => {
            updateBranchFilter();
            applyFilters();
        });
    }

    // Component branch filter change
    const branchFilter = document.getElementById('componentBranchFilter');
    if (branchFilter) {
        branchFilter.addEventListener('change', () => {
            applyFilters();
        });
    }

    // Search toggle
    const searchToggle = document.getElementById('smartSearchToggle');
    const partNumberSearch = document.getElementById('partNumberSearch');
    if (searchToggle && partNumberSearch) {
        searchToggle.addEventListener('change', () => {
            // Update placeholder text based on search mode
            if (searchToggle.checked) {
                partNumberSearch.placeholder = 'Search by description, function, etc.';
            } else {
                partNumberSearch.placeholder = 'Search by LCSC Part Number';
            }
        });
    }

    // Search button click
    const searchButton = document.getElementById('searchButton');
    if (searchButton && partNumberSearch) {
        searchButton.addEventListener('click', () => {
            const searchQuery = partNumberSearch.value.trim();
            if (searchQuery) {
                smartSearch(searchQuery);
            }
        });
    }

    // Search input enter key
    if (partNumberSearch) {
        partNumberSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const searchQuery = e.target.value.trim();
                if (searchQuery) {
                    smartSearch(searchQuery);
                }
            }
        });
    }

    // Close drawer info panel
    const closeButton = document.querySelector('.drawer-info-panel .close-button');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            document.querySelector('.drawer-info-panel').style.display = 'none';
        });
    }

    // Edit Layout Button
    const editLayoutBtn = document.getElementById('editLayoutBtn');
    const layoutEditorPanel = document.getElementById('layoutEditorPanel');
    if (editLayoutBtn && layoutEditorPanel) {
        editLayoutBtn.addEventListener('click', () => {
            layoutEditorPanel.classList.add('active');
        });
    }

    // Close Layout Editor
    const closeLayoutEditor = document.getElementById('closeLayoutEditor');
    if (closeLayoutEditor && layoutEditorPanel) {
        closeLayoutEditor.addEventListener('click', () => {
            layoutEditorPanel.classList.remove('active');
        });
    }

    // Apply Layout Changes
    const applyLayoutBtn = document.getElementById('applyLayoutBtn');
    if (applyLayoutBtn) {
        applyLayoutBtn.addEventListener('click', applyLayoutChanges);
    }

    // Reset Layout
    const resetLayoutBtn = document.getElementById('resetLayoutBtn');
    if (resetLayoutBtn) {
        resetLayoutBtn.addEventListener('click', resetLayoutToDefault);
    }

    // Assign Components Button
    const assignComponentsBtn = document.getElementById('assignComponentsBtn');
    const componentAssignmentPanel = document.getElementById('componentAssignmentPanel');
    if (assignComponentsBtn && componentAssignmentPanel) {
        assignComponentsBtn.addEventListener('click', () => {
            componentAssignmentPanel.classList.add('active');
        });
    }

    // Close Component Assignment Panel
    const closeComponentAssignment = document.getElementById('closeComponentAssignment');
    if (closeComponentAssignment && componentAssignmentPanel) {
        closeComponentAssignment.addEventListener('click', () => {
            componentAssignmentPanel.classList.remove('active');
            stopAssignmentMode();
        });
    }

    // Start Assigning Button
    const startAssigningBtn = document.getElementById('startAssigningBtn');
    if (startAssigningBtn) {
        startAssigningBtn.addEventListener('click', startAssignmentMode);
    }

    // Stop Assigning Button
    const stopAssigningBtn = document.getElementById('stopAssigningBtn');
    if (stopAssigningBtn) {
        stopAssigningBtn.addEventListener('click', stopAssignmentMode);
    }

    // Clear Assignments Button
    const clearAssignmentsBtn = document.getElementById('clearAssignmentsBtn');
    if (clearAssignmentsBtn) {
        clearAssignmentsBtn.addEventListener('click', clearAllAssignments);
    }
}

async function applyFilters() {
    const typeFilter = document.getElementById('componentTypeFilter');
    const branchFilter = document.getElementById('componentBranchFilter');

    if (!typeFilter) return;

    const selectedType = typeFilter.value;
    const selectedBranch = branchFilter ? branchFilter.value : '';

    // Clear previous highlights
    document.querySelectorAll('.drawer').forEach(drawer => {
        drawer.classList.remove('highlighted');
    });

    if (!selectedType) return;

    // Highlight drawers based on filters
    // First check actual storage data
    let matchFound = false;
    Object.entries(storageData).forEach(([location, components]) => {
        const hasMatch = components.some(component => {
            if (selectedBranch) {
                return component.component_type === selectedType &&
                    component.component_branch === selectedBranch;
            }
            return component.component_type === selectedType;
        });

        if (hasMatch) {
            matchFound = true;
            const drawer = document.querySelector(`.drawer[data-location="${location}"]`);
            if (drawer) {
                drawer.classList.add('highlighted');
            }
        }
    });

    // Then check component assignments
    Object.entries(componentAssignments).forEach(([location, assignment]) => {
        let assignmentMatch = false;

        if (selectedBranch) {
            assignmentMatch = assignment.type === selectedType &&
                (assignment.branch === selectedBranch || assignment.branch === '');
        } else {
            assignmentMatch = assignment.type === selectedType;
        }

        if (assignmentMatch) {
            matchFound = true;
            const drawer = document.querySelector(`.drawer[data-location="${location}"]`);
            if (drawer) {
                drawer.classList.add('highlighted');
            }
        }
    });

    // Show a message if no matches are found
    if (!matchFound) {
        alert(`No storage locations found for ${selectedType}${selectedBranch ? ` - ${selectedBranch}` : ''}`);
    }
}

// Initial load of storage data
loadStorageData();