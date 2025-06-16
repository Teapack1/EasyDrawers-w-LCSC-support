document.addEventListener('DOMContentLoaded', function () {
    const exportDatabaseBtn = document.getElementById('exportDatabaseBtn');
    const formatDatabaseBtn = document.getElementById('formatDatabaseBtn');
    const importDatabaseBtn = document.getElementById('importDatabaseBtn');
    const importFileInput = document.getElementById('importFile');
    const confirmationModal = document.getElementById('confirmationModal');
    const confirmAction = document.getElementById('confirmAction');
    const cancelAction = document.getElementById('cancelAction');
    const confirmationMessage = document.getElementById('confirmationMessage');

    let pendingAction = null;
    let fileToImport = null;

    // Enable import button only when a file is selected
    importFileInput.addEventListener('change', () => {
        if (importFileInput.files.length > 0) {
            importDatabaseBtn.disabled = false;
        } else {
            importDatabaseBtn.disabled = true;
        }
    });

    // Export Database
    exportDatabaseBtn.addEventListener('click', async () => {
        try {
            window.location.href = '/export_database';
        } catch (error) {
            alert('Failed to export database: ' + error.message);
        }
    });

    // Format Database
    formatDatabaseBtn.addEventListener('click', () => {
        pendingAction = 'format';
        confirmationMessage.textContent = 'Are you sure you want to format the database? This action cannot be undone.';
        confirmationModal.style.display = 'block';
    });

    // Import Database
    importDatabaseBtn.addEventListener('click', () => {
        fileToImport = importFileInput.files[0];
        if (!fileToImport) {
            alert('Please select a CSV file to import.');
            return;
        }
        pendingAction = 'import';
        confirmationMessage.textContent = 'Are you sure you want to import this database? This will replace all current data and cannot be undone.';
        confirmationModal.style.display = 'block';
    });

    // Confirm Action
    confirmAction.addEventListener('click', async () => {
        if (pendingAction === 'format') {
            try {
                const response = await fetch('/format_database', {
                    method: 'POST'
                });

                if (response.ok) {
                    alert('Database formatted successfully');
                    window.location.reload();
                } else {
                    const error = await response.json();
                    alert('Failed to format database: ' + error.detail);
                }
            } catch (error) {
                alert('Failed to format database: ' + error.message);
            }
        } else if (pendingAction === 'import' && fileToImport) {
            const formData = new FormData();
            formData.append('file', fileToImport);
            try {
                const response = await fetch('/import_database', {
                    method: 'POST',
                    body: formData
                });
                if (response.ok) {
                    alert('Database imported successfully');
                    window.location.reload();
                } else {
                    const error = await response.json();
                    alert('Failed to import database: ' + error.detail);
                }
            } catch (error) {
                alert('Failed to import database: ' + error.message);
            }
        }
        confirmationModal.style.display = 'none';
        pendingAction = null;
        fileToImport = null;
        importFileInput.value = ''; // Clear file input
        importDatabaseBtn.disabled = true; // Disable button again
    });

    // Cancel Action
    cancelAction.addEventListener('click', () => {
        confirmationModal.style.display = 'none';
        pendingAction = null;
        fileToImport = null;
        // Don't clear file input on cancel, user might still want to use it
    });

    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === confirmationModal) {
            confirmationModal.style.display = 'none';
            pendingAction = null;
            fileToImport = null;
            // Don't clear file input on cancel
        }
    });
}); 