document.addEventListener('DOMContentLoaded', function() {
    const exportDatabaseBtn = document.getElementById('exportDatabaseBtn');
    const formatDatabaseBtn = document.getElementById('formatDatabaseBtn');
    const confirmationModal = document.getElementById('confirmationModal');
    const confirmAction = document.getElementById('confirmAction');
    const cancelAction = document.getElementById('cancelAction');
    const confirmationMessage = document.getElementById('confirmationMessage');
    
    let pendingAction = null;

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
        }
        confirmationModal.style.display = 'none';
    });

    // Cancel Action
    cancelAction.addEventListener('click', () => {
        confirmationModal.style.display = 'none';
        pendingAction = null;
    });

    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === confirmationModal) {
            confirmationModal.style.display = 'none';
            pendingAction = null;
        }
    });
}); 