document.getElementById("addComponentForm").addEventListener("submit", async function(event) {
    event.preventDefault();

    const partNumber = document.getElementById("partNumber").value;
    const category = document.getElementById("category").value;
    const value1 = document.getElementById("value1").value;
    const value2 = document.getElementById("value2").value;
    const value3 = document.getElementById("value3").value;
    const footprint = document.getElementById("footprint").value;
    const price = document.getElementById("price").value || 0;
    const manufacturer = document.getElementById("manufacturer").value;
    const manufacturerPart = document.getElementById("manufacturerPart").value;
    const quantity = document.getElementById("quantity").value || 0;
    const location = document.getElementById("location").value;

    const response = await fetch("/add_component", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            part_number: partNumber,
            category: category,
            value1: value1,
            value2: value2,
            value3: value3,
            footprint: footprint,
            price: parseFloat(price),
            manufacturer: manufacturer,
            manufacturer_part: manufacturerPart,
            location: location,
            quantity: parseInt(quantity)
        }),
    });

    const result = await response.json();
    alert(result.message);
});

document.getElementById("uploadCsvForm").addEventListener("submit", async function(event) {
    event.preventDefault();

    const formData = new FormData();
    const csvFile = document.getElementById("csvFile").files[0];
    formData.append("file", csvFile);

    try {
        const response = await fetch("/update_components_from_csv", {
            method: "POST",
            body: formData
        });

        if (response.ok) {
            const result = await response.json();
            alert(result.message);
        } else {
            const error = await response.json();
            alert(`Error: ${error.detail}`);
        }
    } catch (error) {
        alert(`Upload failed: ${error.message}`);
    }
});

async function searchComponent() {
    const query = document.getElementById("searchQuery").value;

    const response = await fetch(`/search_component?query=${encodeURIComponent(query)}`);
    if (response.ok) {
        const results = await response.json();
        displaySearchResults(results);
    } else {
        const error = await response.json();
        alert(`Error: ${error.detail}`);
    }
}

function displaySearchResults(results) {
    const resultsDiv = document.getElementById("searchResults");
    resultsDiv.innerHTML = "<h3>Search Results:</h3>";

    if (results.length > 0) {
        results.forEach(component => {
            const componentDiv = document.createElement("div");
            componentDiv.textContent = `Part Number: ${component.part_number}, Category: ${component.category}, Value1: ${component.value1}, Value2: ${component.value2}, Footprint: ${component.footprint}, Manufacturer: ${component.manufacturer}`;
            resultsDiv.appendChild(componentDiv);
        });
    } else {
        resultsDiv.innerHTML += "<p>No results found</p>";
    }
}
