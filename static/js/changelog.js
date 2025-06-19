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

    if (logs.length === 0) {
        const row = document.createElement('tr');
        const noData = document.createElement('td');
        noData.colSpan = 7;
        noData.textContent = 'No changes logged.';
        row.appendChild(noData);
        tableBody.appendChild(row);
        return;
    }

    logs.forEach(log => {
        const timestamp = new Date(log.timestamp).toLocaleString();

        const mainRow = document.createElement('tr');
        mainRow.className = 'log-row';
        mainRow.innerHTML = `
            <td>${timestamp}</td>
            <td>${log.user}</td>
            <td>${log.action_type}</td>
            <td>${log.component_id || ''}</td>
            <td>${log.part_number || ''}</td>
            <td class="details-cell">${log.details}</td>
            <td>
                ${log.action_type.startsWith('revert_') ?
                    '<span class="reverted">Reverted</span>' :
                    `<button class="revert-button" data-log-id="${log.id}">Revert</button>`
                }
            </td>`;

        tableBody.appendChild(mainRow);

        // --- Expand/Collapse functionality ---
        mainRow.addEventListener('click', (e) => {
            if (e.target.closest('.revert-button')) return; // ignore clicks on revert
            mainRow.classList.toggle('expanded');
            if (mainRow.classList.contains('expanded')) {
                // Close other expanded rows
                tableBody.querySelectorAll('tr.detail-row').forEach(r => r.remove());
                tableBody.querySelectorAll('tr.expanded').forEach(r => { if (r !== mainRow) r.classList.remove('expanded'); });

                const detailRow = document.createElement('tr');
                detailRow.className = 'detail-row';
                detailRow.innerHTML = `<td colspan="7"><div class="detail-content">${log.details}</div></td>`;
                mainRow.after(detailRow);
            } else {
                if (mainRow.nextSibling && mainRow.nextSibling.classList.contains('detail-row')) {
                    mainRow.nextSibling.remove();
                }
            }
        });
    });

    // Attach revert button listeners separately to stop propagation
    tableBody.querySelectorAll('.revert-button').forEach(btn => {
        btn.addEventListener('click', async (event) => {
            event.stopPropagation();
            const logId = btn.getAttribute('data-log-id');
            if (!confirm('Revert this change?')) return;
            try {
                btn.disabled = true; btn.textContent = 'Reverting...';
                const response = await fetch('/revert_change', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ log_id: logId })
                });
                if (response.ok) {
                    const result = await response.json();
                    alert(result.message);
                    window.location.reload();
                } else {
                    const err = await response.json();
                    alert(`Error: ${err.detail}`);
                    btn.disabled = false; btn.textContent = 'Revert';
                }
            } catch (err) {
                alert(`Unexpected error: ${err.message}`);
                btn.disabled = false; btn.textContent = 'Revert';
            }
        });
    });
}