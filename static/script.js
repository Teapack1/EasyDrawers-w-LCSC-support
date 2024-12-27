let currentUser = null;
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

    // Always show the modal on page load
    userSelectionModal.style.display = "block";

    // Display current user
    document.getElementById("currentUserDisplay").textContent = `Current User: ${currentUser || 'None'}`;

    // Check if user is already selected
    currentUser = localStorage.getItem("currentUser");
    if (currentUser) {
        userSelectionModal.style.display = "none";
    }

    document.getElementById("uploadCsvForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        const fileInput = document.getElementById("csvFile");
        const file = fileInput.files[0];

        if (!file) {
            alert("Please select a CSV file to upload.");
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        try {
            const response = await fetch('/update_components_from_csv', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const result = await response.json();
                alert(result.message);

                // Display the new components in the search results
                searchResults = result.components;
                displaySearchResults(searchResults);

                // Clear the file input
                fileInput.value = '';
            } else {
                const error = await response.json();
                alert(`Error: ${error.detail}`);
            }
        } catch (error) {
            alert(`Unexpected error: ${error.message}`);
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
            if (field.required && !field.value.trim()) {
                field.classList.add("invalid");
                allValid = false;
            } else {
                field.classList.remove("invalid");
            }
        });

        if (!allValid) {
            alert("Please fill in all required fields.");
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

    // Changelog button event listener
    document.getElementById("changelogButton").addEventListener("click", () => {
        window.location.href = "/changelog";
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
                        body: JSON.stringify({ id: id, user: currentUser }),
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