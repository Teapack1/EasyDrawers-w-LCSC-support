import pandas as pd
import os
import sqlite3
import json
from fastapi import FastAPI, HTTPException, UploadFile, File, Request, Query  # Add this import
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import re
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from starlette.requests import Request
from fastapi.staticfiles import StaticFiles
from io import BytesIO
import datetime
from typing import Optional  # Add this line
from collections import defaultdict
from fastapi.responses import StreamingResponse
import csv

# Initialize FastAPI app
app = FastAPI()

# Allow CORS for all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for serving HTML, CSS, JS
app.mount("/static", StaticFiles(directory="static"), name="static")

# Set up Jinja2 templates for rendering HTML files
templates = Jinja2Templates(directory="templates")

# SQLite database setup
def create_database():
    conn = sqlite3.connect('components.db')
    cursor = conn.cursor()
    
    # Create components table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS components (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            part_number TEXT UNIQUE,
            manufacture_part_number TEXT,
            manufacturer TEXT,
            description TEXT,
            package TEXT,
            storage_place TEXT,
            order_qty INTEGER DEFAULT 0,
            unit_price REAL,
            component_type TEXT,
            component_branch TEXT,
            resistance TEXT,
            capacitance TEXT,
            voltage TEXT,
            tolerance TEXT,
            inductance TEXT,
            current_power TEXT
        )
    ''')

    # Create cart table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cart (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user TEXT,
            component_id INTEGER,
            quantity INTEGER,
            FOREIGN KEY (component_id) REFERENCES components (id)
        )
    ''')

    # Add change_log table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS change_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            user TEXT,
            action_type TEXT,
            component_id INTEGER,
            part_number TEXT,
            details TEXT
        )
    ''')

    conn.commit()
    conn.close()

create_database()

# Pydantic models for request bodies
class Component(BaseModel):
    part_number: str
    storage_place: str
    order_qty: int
    component_type: str
    component_branch: str
    unit_price: Optional[float] = None
    description: Optional[str] = None
    package: Optional[str] = None
    manufacturer: Optional[str] = None
    capacitance: Optional[str] = None
    resistance: Optional[str] = None
    voltage: Optional[str] = None
    tolerance: Optional[str] = None
    inductance: Optional[str] = None
    current_power: Optional[str] = None
    manufacture_part_number: Optional[str] = None

# Endpoint to add a new component
@app.post("/add_component")
async def add_component(component: Component):
    conn = sqlite3.connect('components.db')
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO components (
                part_number,
                storage_place,
                order_qty,
                component_type,
                component_branch,
                unit_price,
                description,
                package,
                manufacturer,
                capacitance,
                resistance,
                voltage,
                tolerance,
                inductance,
                current_power,
                manufacture_part_number
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            component.part_number,
            component.storage_place,
            component.order_qty,
            component.component_type,
            component.component_branch,
            component.unit_price,
            component.description,
            component.package,
            component.manufacturer,
            component.capacitance,
            component.resistance,
            component.voltage,
            component.tolerance,
            component.inductance,
            component.current_power,
            component.manufacture_part_number
        ))
        conn.commit()
    except sqlite3.IntegrityError as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()
    return {"message": "Component added successfully."}

# Endpoint to search for components
@app.get("/search_component")
async def search_component(
    query: str,
    component_type: Optional[str] = None,
    component_branch: Optional[str] = None,
    in_stock: Optional[bool] = False
):
    conn = sqlite3.connect('components.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Build the base query
    sql_query = "SELECT * FROM components WHERE 1=1"
    params = []

    # Prepare search pattern (case-insensitive, space-insensitive)
    search_terms = query.strip().split()
    search_patterns = [f"%{term.lower()}%" for term in search_terms]

    # Add search conditions
    if search_patterns:
        sql_query += " AND ("
        search_columns = [
            "LOWER(part_number)",
            "LOWER(manufacturer)",
            "LOWER(description)",
            "LOWER(component_type)",
            "LOWER(component_branch)",
            "LOWER(capacitance)",
            "LOWER(resistance)",
            "LOWER(voltage)",
            "LOWER(tolerance)",
            "LOWER(inductance)",
            "LOWER(current_power)",
            "LOWER(package)",
            "LOWER(manufacture_part_number)"  # Add this line
        ]
        conditions = []
        for pattern in search_patterns:
            cols_conditions = [f"{col} LIKE ?" for col in search_columns]
            conditions.append("(" + " OR ".join(cols_conditions) + ")")
            params.extend([pattern] * len(search_columns))
        sql_query += " AND ".join(conditions)
        sql_query += ")"

    # Apply filters
    if component_type:
        sql_query += " AND component_type = ?"
        params.append(component_type)
    if component_branch:
        sql_query += " AND component_branch = ?"
        params.append(component_branch)
    if in_stock:
        sql_query += " AND order_qty > 0"

    cursor.execute(sql_query, params)
    results = cursor.fetchall()
    conn.close()

    if not results:
        raise HTTPException(status_code=404, detail="No components found matching the query")

    return [dict(row) for row in results]

# Endpoint to serve the UI
@app.get("/", response_class=HTMLResponse)
async def serve_ui(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

# Endpoint to upload and update components from CSV
@app.post("/update_components_from_csv")
async def update_components_from_csv(file: UploadFile = File(...)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Please upload a CSV file.")

    # Read the uploaded file
    content = await file.read()
    df = pd.read_csv(BytesIO(content), encoding='utf-8')

    # Load component configurations
    with open('component_config.json', 'r') as f:
        component_config = json.load(f)

    # Define the required columns
    required_columns = [
        'LCSC Part Number', 'Manufacturer', 'Package', 'Description',
        'Order Qty.', 'Unit Price($)', 'Component Type', 'Component Branch',
        'Capacitance', 'Resistance', 'Voltage', 'Tolerance', 'Inductance', 'Current/Power', 'Storage Place',
        'Manufacture Part Number'
    ]

    # Initialize new columns with None
    for col in required_columns:
        if col not in df.columns:
            df[col] = None

    # Function to extract component details (same as before)
    def extract_component_details(description):
        component_type = None
        component_branch = None
        parameters = {}
        storage_place = None

        # Flatten component branches with their corresponding types
        branches_with_types = []
        for c_type, c_data in component_config.items():
            for branch, branch_data in c_data['Component Branch'].items():
                branches_with_types.append((branch, c_type, branch_data))

        # Iterate over component branches
        for branch, c_type, branch_data in branches_with_types:
            if re.search(re.escape(branch), description, re.IGNORECASE):
                component_branch = branch
                component_type = c_type
                # Extract parameters based on Parameters list
                for param in branch_data['Parameters']:
                    if param == 'Resistance':
                        res_match = re.search(
                            r'(?<!\w)(\d+\.?\d*\s*[kKmM]?\s*(?:[ΩΩ]|Ohm))(?!\w)',
                            description, re.IGNORECASE)
                        if res_match:
                            parameters['Resistance'] = res_match.group(1).strip()
                    elif param == 'Capacitance':
                        cap_match = re.search(
                            r'(\d+\.?\d*\s*[pPnNuUµμ]?F)', description, re.IGNORECASE)
                        if cap_match:
                            parameters['Capacitance'] = cap_match.group(1).strip()
                    elif param == 'Inductance':
                        ind_match = re.search(
                            r'(\d+\.?\d*\s*[pPnNuUµμmM]?H)', description, re.IGNORECASE)
                        if ind_match:
                            parameters['Inductance'] = ind_match.group(1).strip()
                    elif param == 'Voltage':
                        volt_match = re.search(
                            r'(\d+\.?\d*\s*[Vv])', description)
                        if volt_match:
                            parameters['Voltage'] = volt_match.group(1).strip()
                    elif param == 'Tolerance':
                        tol_match = re.search(
                            r'(±\d+%|\d+%)', description)
                        if tol_match:
                            parameters['Tolerance'] = tol_match.group(1).strip()
                    elif param == 'Current/Power':
                        curr_match = re.search(
                            r'(\d+\.?\d*\s*[mMuU]?A|\d+\.?\d*\s*[mMkKuU]?W)', description, re.IGNORECASE)
                        if curr_match:
                            parameters['Current/Power'] = curr_match.group(1).strip()
                storage_place = branch_data.get('Storage Place')
                break

        return component_type, component_branch, parameters, storage_place

    # Apply the function to each row in the DataFrame
    for index, row in df.iterrows():
        desc = row.get('Description', '')
        if isinstance(desc, str):
            component_type, component_branch, parameters, storage_place = extract_component_details(desc)
            df.at[index, 'Component Type'] = component_type
            df.at[index, 'Component Branch'] = component_branch
            df.at[index, 'Storage Place'] = storage_place
            for param, value in parameters.items():
                df.at[index, param] = value

    # Keep only the required columns
    df = df[required_columns]

    # Fill missing 'Order Qty.' with zeros if necessary
    df['Order Qty.'] = df['Order Qty.'].fillna(0).astype(int)

    # Now, proceed to insert/update the data in the database
    required_fields = ['LCSC Part Number']
    errors = []
    updated_components = []

    conn = sqlite3.connect('components.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        for index, row in df.iterrows():
            missing_fields = []
            for field in required_fields:
                if pd.isna(row.get(field)):
                    missing_fields.append(field)
            if missing_fields:
                errors.append(f"Row {index + 2}: Missing required fields: {', '.join(missing_fields)}")
                continue

            # Check if component already exists
            cursor.execute("SELECT * FROM components WHERE part_number=?", (row['LCSC Part Number'],))
            existing_component = cursor.fetchone()

            component_data = {
                'part_number': row['LCSC Part Number'],
                'storage_place': row.get('Storage Place'),
                'order_qty': int(row['Order Qty.']),
                'component_type': row.get('Component Type'),
                'component_branch': row.get('Component Branch'),
                'unit_price': row.get('Unit Price($)'),
                'description': row.get('Description'),
                'package': row.get('Package'),
                'manufacturer': row.get('Manufacturer'),
                'capacitance': row.get('Capacitance'),
                'resistance': row.get('Resistance'),
                'voltage': row.get('Voltage'),
                'tolerance': row.get('Tolerance'),
                'inductance': row.get('Inductance'),
                'current_power': row.get('Current/Power'),
                'manufacture_part_number': row.get('Manufacture Part Number')
            }

            if existing_component:
                # Update existing component
                new_qty = existing_component['order_qty'] + component_data['order_qty']
                cursor.execute("""
                    UPDATE components 
                    SET order_qty = ?, 
                        unit_price = COALESCE(?, unit_price),
                        storage_place = COALESCE(?, storage_place)
                    WHERE part_number = ?
                """, (new_qty, component_data['unit_price'], component_data['storage_place'], component_data['part_number']))
                
                # Get updated component
                cursor.execute("SELECT * FROM components WHERE part_number=?", (component_data['part_number'],))
                updated_component = cursor.fetchone()
                updated_components.append(dict(updated_component))
            else:
                # Insert new component
                cursor.execute('''
                    INSERT INTO components (
                        part_number, storage_place, order_qty, component_type, component_branch,
                        unit_price, description, package, manufacturer, capacitance,
                        resistance, voltage, tolerance, inductance, current_power, manufacture_part_number
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    component_data['part_number'], component_data['storage_place'],
                    component_data['order_qty'], component_data['component_type'],
                    component_data['component_branch'], component_data['unit_price'],
                    component_data['description'], component_data['package'],
                    component_data['manufacturer'], component_data['capacitance'],
                    component_data['resistance'], component_data['voltage'],
                    component_data['tolerance'], component_data['inductance'],
                    component_data['current_power'], component_data['manufacture_part_number']
                ))
                
                # Get the inserted component
                cursor.execute("SELECT * FROM components WHERE part_number=?", (component_data['part_number'],))
                new_component = cursor.fetchone()
                updated_components.append(dict(new_component))

        conn.commit()

        if errors:
            raise HTTPException(status_code=400, detail="; ".join(errors))

        return {
            "message": f"Successfully processed {len(updated_components)} components",
            "components": updated_components
        }

    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.post("/update_order_quantity")
async def update_order_quantity(data: dict):
    id = data.get('id')
    change = data.get('change')
    user = data.get('user')

    if not id or not isinstance(change, (int, float)) or not user:
        raise HTTPException(status_code=400, detail="ID, change, and user are required")

    conn = sqlite3.connect('components.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        # Start transaction
        cursor.execute("BEGIN TRANSACTION")
        
        # Get current component info
        cursor.execute("SELECT order_qty, part_number FROM components WHERE id = ?", (id,))
        result = cursor.fetchone()
        
        if not result:
            raise HTTPException(status_code=404, detail="Component not found")
        
        # Calculate new quantity
        new_qty = max(0, result['order_qty'] + change)
        
        # Update component quantity
        cursor.execute("""
            UPDATE components 
            SET order_qty = ? 
            WHERE id = ?
        """, (new_qty, id))
        
        # Log the change
        cursor.execute('''
            INSERT INTO change_log (user, action_type, component_id, part_number, details)
            VALUES (?, ?, ?, ?, ?)
        ''', (user, 'update_quantity', id, result['part_number'],
              f'Quantity changed by {change} to {new_qty}'))
        
        # Get updated component
        cursor.execute("SELECT * FROM components WHERE id = ?", (id,))
        updated_component = cursor.fetchone()
        
        # Commit transaction
        cursor.execute("COMMIT")
        
        return dict(updated_component)
        
    except Exception as e:
        cursor.execute("ROLLBACK")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.post("/update_storage_place")
async def update_storage_place(request: Request):
    data = await request.json()
    id = data.get('id')
    storage_place = data.get('storage_place')

    if not id:
        raise HTTPException(status_code=400, detail="ID is required")

    conn = sqlite3.connect('components.db')
    cursor = conn.cursor()
    cursor.execute("UPDATE components SET storage_place = ? WHERE id = ?", (storage_place, id))
    conn.commit()
    conn.close()

    return {"message": "Storage place updated successfully"}

@app.delete("/delete_component")
async def delete_component(request: Request):
    data = await request.json()
    component_id = data.get('component_id')
    user = data.get('user')

    conn = sqlite3.connect('components.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Fetch the component
    component = cursor.execute("SELECT * FROM components WHERE id=?", (component_id,)).fetchone()
    if not component:
        conn.close()
        raise HTTPException(status_code=404, detail="Component not found.")

    part_number = component['part_number']

    # Delete the component
    cursor.execute("DELETE FROM components WHERE id=?", (component_id,))
    conn.commit()

    # Log the deletion in the change_log
    cursor.execute("""
        INSERT INTO change_log (user, action_type, component_id, part_number, details)
        VALUES (?, ?, ?, ?, ?)
    """, (user, 'delete', component_id, part_number, f"Deleted component ID {component_id}, Part Number {part_number}"))

    conn.commit()
    conn.close()

    return {"message": "Component deleted successfully."}

@app.get("/changelog", response_class=HTMLResponse)
async def serve_changelog(request: Request):
    return templates.TemplateResponse("changelog.html", {"request": request})

@app.get("/get_changelog")
async def get_changelog():
    conn = sqlite3.connect('components.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get the most recent 100 changes
    cursor.execute("""
        SELECT * FROM change_log 
        ORDER BY timestamp DESC 
        LIMIT 100
    """)
    logs = cursor.fetchall()
    
    # Delete older entries
    cursor.execute("""
        DELETE FROM change_log 
        WHERE id NOT IN (
            SELECT id FROM change_log 
            ORDER BY timestamp DESC 
            LIMIT 100
        )
    """)
    conn.commit()
    conn.close()
    
    return [dict(log) for log in logs]

@app.get("/component_config")
async def get_component_config():
    with open('component_config.json', 'r') as f:
        config = json.load(f)
    return config

@app.post("/revert_change")
async def revert_change(data: dict):
    log_id = data.get('log_id')
    if not log_id:
        raise HTTPException(status_code=400, detail="Log ID is required.")

    conn = sqlite3.connect('components.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        # Retrieve the log entry
        cursor.execute("SELECT * FROM change_log WHERE id = ?", (log_id,))
        log_entry = cursor.fetchone()

        if not log_entry:
            raise HTTPException(status_code=404, detail="Log entry not found.")

        action_type = log_entry['action_type']
        component_id = log_entry['component_id']
        part_number = log_entry['part_number']
        details = log_entry['details']

        if action_type == 'add_component':
            cursor.execute("DELETE FROM components WHERE id = ?", (component_id,))
            revert_details = f"Reverted addition of component {part_number}"

        elif action_type == 'update_quantity':
            match = re.search(r'Quantity changed by (-?\d+) to (\d+)', details)
            if match:
                change = int(match.group(1))
                cursor.execute("""
                    UPDATE components 
                    SET order_qty = order_qty - ? 
                    WHERE id = ?
                """, (change, component_id))
                revert_details = f"Reverted quantity change of {change} for component {part_number}"
            else:
                raise HTTPException(status_code=400, detail="Cannot parse quantity change")

        elif action_type == 'delete':
            # Reinsert the component using backup data
            # Assume you have a backup mechanism or prevent deletion in the first place
            revert_details = f"Reverted deletion of component {part_number}"
            raise HTTPException(status_code=400, detail="Reverting deletion is not supported.")

        else:
            raise HTTPException(status_code=400, detail="Unsupported action type for revert.")

        # Log the revert action with part_number
        cursor.execute("""
            INSERT INTO change_log (user, action_type, component_id, part_number, details)
            VALUES (?, ?, ?, ?, ?)
        """, ("System", f"revert_{action_type}", component_id, part_number, revert_details))

        conn.commit()
        return {"message": "Change reverted successfully"}

    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# Cart endpoints
@app.post("/add_to_cart")
async def add_to_cart(data: dict):
    user = data.get('user')
    component_id = data.get('component_id')
    
    if not user or not component_id:
        raise HTTPException(status_code=400, detail="User and component ID are required")
    
    conn = sqlite3.connect('components.db')
    cursor = conn.cursor()
    
    try:
        # Check if item already exists in cart
        cursor.execute("""
            SELECT id FROM cart 
            WHERE user = ? AND component_id = ?
        """, (user, component_id))
        
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Item already in cart")
        
        cursor.execute("""
            INSERT INTO cart (user, component_id, quantity)
            VALUES (?, ?, 1)
        """, (user, component_id))
        
        conn.commit()
        return {"message": "Item added to cart"}
    finally:
        conn.close()

@app.get("/get_cart")
async def get_cart(user: str):
    conn = sqlite3.connect('components.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT c.*, ci.quantity as cart_quantity, ci.id as cart_item_id
        FROM components c
        JOIN cart ci ON c.id = ci.component_id
        WHERE ci.user = ?
    """, (user,))
    
    items = cursor.fetchall()
    conn.close()
    
    return [dict(item) for item in items]

@app.post("/update_cart_quantity")
async def update_cart_quantity(data: dict):
    user = data.get('user')
    cart_item_id = data.get('cart_item_id')
    quantity = data.get('quantity')
    
    conn = sqlite3.connect('components.db')
    cursor = conn.cursor()
    
    cursor.execute("""
        UPDATE cart
        SET quantity = ?
        WHERE id = ? AND user = ?
    """, (quantity, cart_item_id, user))
    
    conn.commit()
    conn.close()
    
    return {"message": "Cart updated"}

@app.delete("/remove_from_cart")
async def remove_from_cart(cart_item_id: int, user: str):
    conn = sqlite3.connect('components.db')
    cursor = conn.cursor()
    
    cursor.execute("""
        DELETE FROM cart
        WHERE id = ? AND user = ?
    """, (cart_item_id, user))
    
    conn.commit()
    conn.close()
    
    return {"message": "Item removed from cart"}

class CartAction(BaseModel):
    user: str

@app.post("/process_cart")
async def process_cart(data: CartAction):
    user = data.user
    
    conn = sqlite3.connect('components.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        # Get all cart items with component details
        cursor.execute("""
            SELECT c.*, ci.quantity as cart_quantity
            FROM components c
            JOIN cart ci ON c.id = ci.component_id
            WHERE ci.user = ?
        """, (user,))
        
        cart_items = cursor.fetchall()
        
        if not cart_items:
            raise HTTPException(status_code=400, detail="Cart is empty")
            
        # Update quantities and create log entries
        for item in cart_items:
            new_qty = item['order_qty'] - (item['cart_quantity'] or 1)
            if new_qty < 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient quantity for {item['part_number']}"
                )
            
            cursor.execute("""
                UPDATE components
                SET order_qty = ?
                WHERE id = ?
            """, (new_qty, item['id']))
            
            # Log the transaction
            cursor.execute("""
                INSERT INTO change_log (user, action_type, component_id, part_number, details)
                VALUES (?, 'cart_checkout', ?, ?, ?)
            """, (user, item['id'], item['part_number'],
                 f"Removed {item['cart_quantity'] or 1} units from stock"))
        
        # Clear the user's cart
        cursor.execute("DELETE FROM cart WHERE user = ?", (user,))
        
        conn.commit()
        return {"message": "Cart processed successfully", "items": [dict(item) for item in cart_items]}
    
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.post("/clear_cart")
async def clear_cart(data: CartAction):
    conn = sqlite3.connect('components.db')
    cursor = conn.cursor()
    
    try:
        cursor.execute("DELETE FROM cart WHERE user = ?", (data.user,))
        conn.commit()
        return {"message": "Cart cleared"}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

# Add cart page route (add this before the other routes)
@app.get("/cart", response_class=HTMLResponse)
async def serve_cart(request: Request):
    return templates.TemplateResponse("cart.html", {"request": request})

@app.get("/map", response_class=HTMLResponse)
async def serve_map(request: Request):
    return templates.TemplateResponse("map.html", {"request": request})

@app.get("/storage_data")
async def get_storage_data():
    conn = sqlite3.connect('components.db')
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get all components with their storage locations
    cursor.execute("""
        SELECT * FROM components 
        WHERE storage_place IS NOT NULL 
        AND storage_place != ''
    """)
    
    components = cursor.fetchall()
    conn.close()
    
    # Group components by storage location
    storage_data = defaultdict(list)
    for component in components:
        storage_data[component['storage_place']].append(dict(component))
    
    return dict(storage_data)

@app.get("/database", response_class=HTMLResponse)
async def serve_database(request: Request):
    return templates.TemplateResponse("database.html", {"request": request})

@app.get("/export_database")
async def export_database():
    try:
        conn = sqlite3.connect('components.db')
        # Get all components from database
        df = pd.read_sql_query("SELECT * FROM components", conn)
        
        # Rename columns to match finalCart.csv format
        column_mapping = {
            'part_number': 'LCSC Part Number',
            'manufacture_part_number': 'Manufacture Part Number',
            'manufacturer': 'Manufacturer',
            'package': 'Package',
            'description': 'Description',
            'order_qty': 'Order Qty.',
            'unit_price': 'Unit Price($)',
            'component_type': 'Component Type',
            'component_branch': 'Component Branch',
            'storage_place': 'Storage Place',
            'capacitance': 'Capacitance',
            'resistance': 'Resistance',
            'voltage': 'Voltage',
            'tolerance': 'Tolerance',
            'inductance': 'Inductance',
            'current_power': 'Current/Power'
        }
        
        # Rename columns and select only the ones we want
        df = df.rename(columns=column_mapping)[list(column_mapping.values())]
        
        # Convert DataFrame to CSV
        csv_buffer = BytesIO()
        df.to_csv(csv_buffer, index=False)
        csv_buffer.seek(0)
        
        # Return CSV file
        return StreamingResponse(
            csv_buffer,
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=component_database_{datetime.datetime.now().strftime('%Y%m%d')}.csv"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.post("/format_database")
async def format_database():
    try:
        # Close any existing connections
        conn = sqlite3.connect('components.db')
        conn.close()
        
        # Delete the existing database file
        if os.path.exists('components.db'):
            os.remove('components.db')
        
        # Create a new database
        create_database()
        
        return {"message": "Database formatted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Database connection function
def get_db_connection():
    conn = sqlite3.connect('components.db')
    conn.row_factory = sqlite3.Row
    return conn

# Add new endpoint for BOM upload
@app.post("/upload_bom")
async def upload_bom(file: UploadFile = File(...), user: str = Query(...)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Please upload a CSV file.")

    # Ensure database and tables exist
    create_database()

    # Read the uploaded file
    content = await file.read()
    
    # Try different encodings
    encodings = ['utf-8-sig', 'utf-16', 'utf-16le', 'cp1252', 'iso-8859-1', 'latin1']
    df = None
    last_error = None
    
    for encoding in encodings:
        try:
            # Try tab delimiter first
            df = pd.read_csv(BytesIO(content), delimiter='\t', encoding=encoding)
            if not df.empty and len(df.columns) > 1:
                break
                
            # If that didn't work well, try comma delimiter
            df = pd.read_csv(BytesIO(content), delimiter=',', encoding=encoding)
            if not df.empty and len(df.columns) > 1:
                break
                
        except Exception as e:
            last_error = str(e)
            continue
            
    if df is None or df.empty or len(df.columns) <= 1:
        raise HTTPException(
            status_code=400,
            detail=f"Could not read the CSV file. Please check the file format. Last error: {last_error}"
        )

    # Initialize response data
    found_components = []
    not_found_components = []

    # Get database connection
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Find the required columns
        supplier_part_col = None
        quantity_col = None
        designator_col = None
        
        # Find supplier part column
        for col in df.columns:
            if any(term in col.lower() for term in ['supplier part', 'part number', 'supplier_part', 'partnumber']):
                supplier_part_col = col
                break
                
        # If not found, try manufacturer part
        if not supplier_part_col:
            for col in df.columns:
                if any(term in col.lower() for term in ['manufacturer part', 'manufacturer_part', 'mfr part']):
                    supplier_part_col = col
                    break

        # Find quantity column
        for col in df.columns:
            if any(term in col.lower() for term in ['quantity', 'qty', 'amount']):
                quantity_col = col
                break

        # Find designator column
        for col in df.columns:
            if any(term in col.lower() for term in ['designator', 'reference', 'refdes']):
                designator_col = col
                break

        if not supplier_part_col or not quantity_col:
            raise HTTPException(
                status_code=400,
                detail=f"Required columns not found. Available columns: {', '.join(df.columns)}"
            )

        # Process each component in the BOM
        for index, row in df.iterrows():
            try:
                supplier_part = str(row[supplier_part_col]).strip()
                designator = str(row[designator_col]).strip() if designator_col else "N/A"
                
                # Skip empty rows
                if pd.isna(supplier_part) or supplier_part == '' or supplier_part.lower() == 'nan':
                    continue
                    
                try:
                    quantity = int(float(row[quantity_col]))
                    if quantity <= 0:
                        continue
                except (ValueError, TypeError):
                    continue

                # Search for the component in the database
                cursor.execute("""
                    SELECT id, part_number, order_qty 
                    FROM components 
                    WHERE part_number = ? OR manufacture_part_number = ?
                """, (supplier_part, supplier_part))
                
                result = cursor.fetchone()
                
                if result:
                    component_id = result[0]
                    part_number = result[1]
                    
                    # Check if component is already in cart
                    cursor.execute("""
                        SELECT quantity FROM cart 
                        WHERE user = ? AND component_id = ?
                    """, (user, component_id))
                    
                    cart_item = cursor.fetchone()
                    
                    if cart_item:
                        # Update existing cart item
                        new_quantity = cart_item[0] + quantity
                        cursor.execute("""
                            UPDATE cart 
                            SET quantity = ? 
                            WHERE user = ? AND component_id = ?
                        """, (new_quantity, user, component_id))
                    else:
                        # Add new cart item
                        cursor.execute("""
                            INSERT INTO cart (user, component_id, quantity) 
                            VALUES (?, ?, ?)
                        """, (user, component_id, quantity))
                    
                    found_components.append({
                        "part_number": part_number,
                        "quantity": quantity,
                        "designator": designator
                    })
                else:
                    not_found_components.append({
                        "supplier_part": supplier_part,
                        "quantity": quantity,
                        "designator": designator
                    })
            except Exception as row_error:
                print(f"Error processing row {index + 1}: {row_error}")
                continue

        conn.commit()
        
        return {
            "message": "BOM Upload Results",
            "found_components": found_components,
            "not_found_components": not_found_components
        }

    except Exception as e:
        conn.rollback()
        print(f"Error processing BOM: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
