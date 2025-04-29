let currentUser = localStorage.getItem('currentUser');

document.addEventListener('DOMContentLoaded', () => {
    // Update user display
    document.getElementById('currentUserDisplay').textContent = `Current User: ${currentUser || 'None'}`;

    // Load cart contents
    loadCart();

    // Add event listeners
    document.getElementById('clearCartBtn').addEventListener('click', clearCart);
    document.getElementById('getPartsBtn').addEventListener('click', processCart);
    document.getElementById('printBtn').addEventListener('click', () => {
        // First ensure the table is visible and populated
        loadCart().then(() => {
            window.print();
        });
    });
});

async function loadCart() {
    if (!currentUser) {
        alert('Please log in first');
        return;
    }

    try {
        const response = await fetch(`/get_cart?user=${encodeURIComponent(currentUser)}`);
        const items = await response.json();
        displayCartItems(items);
    } catch (error) {
        console.error('Error loading cart:', error);
        alert('Failed to load cart items');
    }
}

function displayCartItems(items) {
    const tbody = document.getElementById('cartTableBody');
    tbody.innerHTML = '';

    items.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.part_number}</td>
            <td>${item.manufacture_part_number || ''}</td>
            <td>${item.component_type || ''}</td>
            <td>${item.package || ''}</td>
            <td>${item.description || ''}</td>
            <td>${item.storage_place || ''}</td>
            <td>${item.order_qty}</td>
            <td>
                <input type="number" class="cart-quantity" value="${item.cart_quantity || 1}" 
                    min="1" max="${item.order_qty}" data-cart-id="${item.cart_item_id}">
                <button class="delete-button" data-cart-id="${item.cart_item_id}">×</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    // Add event listeners for quantity inputs
    document.querySelectorAll('.cart-quantity').forEach(input => {
        input.addEventListener('change', async (e) => {
            const cartItemId = e.target.dataset.cartId;
            const quantity = parseInt(e.target.value);
            await updateCartQuantity(cartItemId, quantity);
        });
    });

    // Add event listeners for delete buttons
    document.querySelectorAll('.delete-button').forEach(button => {
        button.addEventListener('click', async (e) => {
            const cartItemId = e.target.dataset.cartId;
            await removeFromCart(cartItemId);
        });
    });
}

async function updateCartQuantity(cartItemId, quantity) {
    try {
        const response = await fetch('/update_cart_quantity', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                cart_item_id: cartItemId,
                quantity: quantity,
                user: currentUser
            })
        });
        if (!response.ok) throw new Error('Failed to update quantity');
    } catch (error) {
        console.error('Error updating cart:', error);
        alert('Failed to update cart quantity');
    }
}

async function removeFromCart(cartItemId) {
    try {
        const response = await fetch(`/remove_from_cart?cart_item_id=${cartItemId}&user=${currentUser}`, {
            method: 'DELETE'
        });
        if (response.ok) {
            loadCart(); // Refresh the cart display
        } else {
            throw new Error('Failed to remove item');
        }
    } catch (error) {
        console.error('Error removing item:', error);
        alert('Failed to remove item from cart');
    }
}

async function clearCart() {
    if (!confirm('Are you sure you want to clear your cart?')) return;

    try {
        const response = await fetch('/clear_cart', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ user: currentUser })
        });
        if (response.ok) {
            await loadCart(); // Refresh the cart display
        } else {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to clear cart');
        }
    } catch (error) {
        console.error('Error clearing cart:', error);
        alert(error.message);
    }
}

async function processCart() {
    if (!confirm('Are you sure you want to process these items? This will subtract them from stock.')) return;

    try {
        const response = await fetch('/process_cart', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ user: currentUser })
        });

        if (response.ok) {
            const result = await response.json();
            if (result.items && result.items.length > 0) {
                sessionStorage.setItem('processedCartItems', JSON.stringify(result.items));
            }
            window.location.href = '/';
        } else {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to process cart');
        }
    } catch (error) {
        console.error('Error processing cart:', error);
        alert(error.message);
    }
}
