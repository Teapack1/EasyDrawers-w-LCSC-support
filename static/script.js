document.addEventListener("DOMContentLoaded", () => {
    // Existing event listeners...

    document.getElementById("uploadCsvForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        const fileInput = document.getElementById("csvFile");
        const file = fileInput.files[0];

        if (!file) {
            alert("Please select a CSV file to upload.");
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch("/update_components_from_csv", {
                method: "POST",
                body: formData,
            });

            if (response.ok) {
                alert("CSV file uploaded successfully!");
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

        const componentData = {
            part_number: document.getElementById("partNumber").value,
            manufacturer: document.getElementById("manufacturer").value,
            package: document.getElementById("package").value,
            description: document.getElementById("description").value,
            order_qty: parseInt(document.getElementById("orderQty").value) || 0,
            unit_price: parseFloat(document.getElementById("unitPrice").value) || 0.0,
            component_type: document.getElementById("componentType").value,
            component_branch: document.getElementById("componentBranch").value,
            capacitance: document.getElementById("capacitance").value,
            resistance: document.getElementById("resistance").value,
            voltage: document.getElementById("voltage").value,
            tolerance: document.getElementById("tolerance").value,
            inductance: document.getElementById("inductance").value,
            current_power: document.getElementById("currentPower").value,
            storage_place: document.getElementById("storagePlace").value  // Added storagePlace
        };

        try {
            const response = await fetch("/add_component", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(componentData),
            });

            if (response.ok) {
                alert("Component added successfully!");
                document.getElementById("addComponentForm").reset();
            } else {
                const error = await response.json();
                alert(`Error: ${error.message}`);
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
});

let searchResults = []; // Store current search results
let currentSortColumn = null;
let sortOrderAsc = true; // Sort order flag

async function searchComponent() {
    const query = document.getElementById("searchQuery").value;

    const response = await fetch(`/search_component?query=${encodeURIComponent(query)}`);
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
    const response = await fetch(`/update_order_quantity?id=${id}&change=${change}`, {
        method: "POST"
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
                try {
                    const response = await fetch(`/delete_component?id=${id}`, {
                        method: "DELETE",
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