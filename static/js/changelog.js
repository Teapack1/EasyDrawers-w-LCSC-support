// static/changelog.js

document.addEventListener("DOMContentLoaded", async () => {
    try {
        const response = await fetch('/get_changelog');
        if (response.ok) {
            const changelog = await response.json();
            displayChangelog(changelog);
        } else {
            const error = await response.json();
            alert(`Error: ${error.detail}`);
        }
    } catch (error) {
        alert(`Unexpected error: ${error.message}`);
    }
});

function displayChangelog(logs) {
    const tableBody = document.getElementById("changelogTableBody");
    tableBody.innerHTML = "";

    if (logs.length > 0) {
        logs.forEach(log => {
            const row = document.createElement("tr");
            
            // Format the timestamp
            const timestamp = new Date(log.timestamp).toLocaleString();
            
            row.innerHTML = `
                <td>${timestamp}</td>
                <td>${log.user}</td>
                <td>${log.action_type}</td>
                <td>${log.component_id || ''}</td>
                <td>${log.part_number || ''}</td>
                <td>${log.details}</td>
                <td>
                    ${log.action_type.startsWith('revert_') ? 
                        '<span class="reverted">Reverted</span>' : 
                        `<button class="revert-button" data-log-id="${log.id}">Revert</button>`
                    }
                </td>
            `;
            tableBody.appendChild(row);
        });

        // Add event listeners for revert buttons
        document.querySelectorAll('.revert-button').forEach(button => {
            button.addEventListener('click', async () => {
                const logId = button.getAttribute('data-log-id');
                if (confirm('Are you sure you want to revert this change? This action cannot be undone.')) {
                    try {
                        button.disabled = true;
                        button.textContent = 'Reverting...';
                        
                        const response = await fetch('/revert_change', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ log_id: logId })
                        });

                        if (response.ok) {
                            const result = await response.json();
                            alert(result.message);
                            window.location.reload();
                        } else {
                            const error = await response.json();
                            alert(`Error: ${error.detail}`);
                            button.disabled = false;
                            button.textContent = 'Revert';
                        }
                    } catch (error) {
                        alert(`Unexpected error: ${error.message}`);
                        button.disabled = false;
                        button.textContent = 'Revert';
                    }
                }
            });
        });
    } else {
        const row = document.createElement("tr");
        const noDataCell = document.createElement("td");
        noDataCell.colSpan = 6;
        noDataCell.textContent = "No changes logged.";
        row.appendChild(noDataCell);
        tableBody.appendChild(row);
    }
}