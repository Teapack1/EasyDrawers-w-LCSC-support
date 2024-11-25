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

        if (!currentUser) {
            alert("Please select a user before performing this action.");
            return;
        }

        const formData = {
            component_type: document.getElementById("componentType").value,
            component_branch: document.getElementById("componentBranch").value,
            part_number: document.getElementById("partNumber").value,
            storage_place: document.getElementById("storagePlace").value,
            order_qty: parseInt(document.getElementById("orderQty").value),
            unit_price: parseFloat(document.getElementById("unitPrice").value) || null,
            description: document.getElementById("description").value || null,
            package: document.getElementById("package").value || null,
            manufacturer: document.getElementById("manufacturer").value || null,
        };

        // Get dynamic fields
        const optionalFields = document.querySelectorAll('#optionalFields input');
        optionalFields.forEach(input => {
            formData[input.id.toLowerCase()] = input.value || null;
        });

        try {
            const response = await fetch('/add_component', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                alert('Component added successfully.');
                document.getElementById("addComponentForm").reset();
                // Optionally reset optional fields
                document.getElementById("optionalFields").innerHTML = '';
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
    });

    // Event listener for component branch change
    document.getElementById("componentBranch").addEventListener("change", () => {
        displayOptionalFields();
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
        componentTypeSelect.innerHTML = '<option value="">Select Type</option>';
        for (let type in componentConfig) {
            componentTypeSelect.innerHTML += `<option value="${type}">${type}</option>`;
        }
    }

    function populateComponentBranches() {
        const componentBranchSelect = document.getElementById("componentBranch");
        componentBranchSelect.innerHTML = '<option value="">Select Branch</option>';
        const selectedType = document.getElementById("componentType").value;
        if (selectedType && componentConfig[selectedType]) {
            const branches = componentConfig[selectedType]["Component Branch"];
            for (let branch in branches) {
                componentBranchSelect.innerHTML += `<option value="${branch}">${branch}</option>`;
            }
        }
    }

    function displayOptionalFields() {
        const optionalFieldsDiv = document.getElementById("optionalFields");
        optionalFieldsDiv.innerHTML = '';
        const selectedType = document.getElementById("componentType").value;
        const selectedBranch = document.getElementById("componentBranch").value;
        if (selectedType && selectedBranch && componentConfig[selectedType]) {
            const params = componentConfig[selectedType]["Component Branch"][selectedBranch];
            if (params) {
                params.forEach(param => {
                    optionalFieldsDiv.innerHTML += `<label>${param}: <input type="text" id="${param.replace('/', '')}" required></label><br>`;
                });
            }
        }
    }

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
    const resultsTableBody = document.getElementById("resultsTableBody");
    resultsTableBody.innerHTML = "";

    if (results.length > 0) {
        results.forEach(component => {
            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${component.part_number}</td>
                <td>${component.manufacturer}</td>
                <td>${component.package}</td>
                <td>${component.description}</td>
                <td>${component.unit_price}</td>
                <td>${component.component_type}</td>
                <td>${component.component_branch}</td>
                <td>${component.capacitance}</td>
                <td>${component.resistance}</td>
                <td>${component.voltage}</td>
                <td>${component.tolerance}</td>
                <td>${component.inductance}</td>
                <td>${component.current_power}</td>
                <td class="order-qty">${component.order_qty}</td>
                <td class="storage-place">
                    <input type="text" class="storage-place-input" data-id="${component.id}" value="${component.storage_place || ''}">
                </td>
                <td class="quantity-controls">
                    <!-- Quantity controls -->
                    <button class="decrease" data-id="${component.id}">-</button>
                    <input type="number" class="quantity-input" value="1" min="1">
                    <button class="increase" data-id="${component.id}">+</button>
                    <!-- Delete button -->
                    <button class="delete-button" data-id="${component.id}">X</button>
                </td>
            `;

            // Handle row expansion (optional)
            row.addEventListener("click", (event) => {
                if (!event.target.matches('.increase, .decrease, .quantity-input, .storage-place-input')) {
                    row.classList.toggle("expanded");
                }
            });

            resultsTableBody.appendChild(row);
        });

        // Update event listeners for buttons and storage place inputs
        addQuantityControlEventListeners();
        addStoragePlaceEventListeners();
        addDeleteButtonEventListeners();

    } else {
        // Handle no results
        const row = document.createElement("tr");
        const noResultCell = document.createElement("td");
        noResultCell.colSpan = 16; // Adjust based on total number of columns
        noResultCell.textContent = "No results found";
        row.appendChild(noResultCell);
        resultsTableBody.appendChild(row);
    }
}

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
    componentTypeSelect.innerHTML = '<option value="">Select Type</option>';
    for (let type in componentConfig) {
        componentTypeSelect.innerHTML += `<option value="${type}">${type}</option>`;
    }
}

function populateComponentBranches() {
    const componentBranchSelect = document.getElementById("componentBranch");
    componentBranchSelect.innerHTML = '<option value="">Select Branch</option>';
    const selectedType = document.getElementById("componentType").value;
    if (selectedType && componentConfig[selectedType]) {
        const branches = componentConfig[selectedType]["Component Branch"];
        for (let branch in branches) {
            componentBranchSelect.innerHTML += `<option value="${branch}">${branch}</option>`;
        }
    }
}

function displayOptionalFields() {
    const optionalFieldsDiv = document.getElementById("optionalFields");
    optionalFieldsDiv.innerHTML = '';
    const selectedType = document.getElementById("componentType").value;
    const selectedBranch = document.getElementById("componentBranch").value;
    if (selectedType && selectedBranch && componentConfig[selectedType]) {
        const params = componentConfig[selectedType]["Component Branch"][selectedBranch];
        if (params) {
            params.forEach(param => {
                optionalFieldsDiv.innerHTML += `<label>${param}: <input type="text" id="${param.replace('/', '')}" required></label><br>`;
            });
        }
    }
}

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