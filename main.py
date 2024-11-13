import pandas as pd
import os
import sqlite3
import json
from fastapi import FastAPI, HTTPException, UploadFile, File, Request
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
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS components (
            id INTEGER PRIMARY KEY,
            part_number TEXT UNIQUE,
            manufacturer TEXT,
            package TEXT,
            description TEXT,
            order_qty INTEGER,
            unit_price REAL,
            component_type TEXT,
            component_branch TEXT,
            capacitance TEXT,
            resistance TEXT,
            voltage TEXT,
            tolerance TEXT,
            inductance TEXT,
            current_power TEXT,
            storage_place TEXT  -- Added new column
        )
    ''')

    # Check if 'storage_place' column exists
    cursor.execute("PRAGMA table_info(components)")
    columns = [column[1] for column in cursor.fetchall()]
    if 'storage_place' not in columns:
        cursor.execute("ALTER TABLE components ADD COLUMN storage_place TEXT")

    # Create change_log table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS change_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            user TEXT,
            action_type TEXT,
            component_id INTEGER,
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

# Endpoint to add a new component
@app.post("/add_component")
async def add_component(component: Component):
    conn = sqlite3.connect('components.db')
    cursor = conn.cursor()
    try:
        cursor.execute('''
            INSERT INTO components (
                part_number, manufacturer, package, description, order_qty, unit_price,
                component_type, component_branch, capacitance, resistance, voltage,
                tolerance, inductance, current_power, storage_place
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            component.part_number, component.manufacturer, component.package, component.description,
            component.order_qty, component.unit_price, component.component_type, component.component_branch,
            component.capacitance, component.resistance, component.voltage, component.tolerance,
            component.inductance, component.current_power, component.storage_place
        ))
        conn.commit()
        response = {"message": "Component added successfully."}
    except sqlite3.IntegrityError:
        response = {"message": "Component with this part number already exists."}
    conn.close()
    return response

# Endpoint to search for components
@app.get("/search_component")
async def search_component(query: str):
    conn = sqlite3.connect('components.db')
    conn.row_factory = sqlite3.Row  # Enable dictionary-like access to rows
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM components WHERE part_number LIKE ? OR manufacturer LIKE ? OR description LIKE ? OR component_type LIKE ?",
                   (f'%{query}%', f'%{query}%', f'%{query}%', f'%{query}%'))
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
        'Capacitance', 'Resistance', 'Voltage', 'Tolerance', 'Inductance', 'Current/Power', 'Storage Place'
    ]

    # Initialize new columns with None
    for col in required_columns:
        if col not in df.columns:
            df[col] = None

    # Function to extract component details (same as in format.py)
    def extract_component_details(description):
        component_type = None
        component_branch = None
        parameters = {}

        # Iterate over component types
        for c_type, branches in component_config.items():
            if re.search(c_type, description, re.IGNORECASE):
                component_type = c_type
                # Iterate over component branches
                for branch, params in branches['Component Branch'].items():
                    if re.search(branch, description, re.IGNORECASE):
                        component_branch = branch
                        # Extract parameters based on params list
                        for param in params:
                            # Implement extraction logic for each param
                            if param == 'Resistance':
                                res_match = re.search(r'(\d+(?:\.\d+)?\s*(?:[kKmM]?Ω|Ohm|R))', description, re.IGNORECASE)
                                if res_match:
                                    parameters['Resistance'] = res_match.group(1)
                            elif param == 'Capacitance':
                                cap_match = re.search(r'(\d+(?:\.\d+)?[pµunF]{1,2}F)', description, re.IGNORECASE)
                                if cap_match:
                                    parameters['Capacitance'] = cap_match.group(1)
                            elif param == 'Inductance':
                                ind_match = re.search(r'(\d+(?:\.\d+)?[µunHm]{1,2}H)', description, re.IGNORECASE)
                                if ind_match:
                                    parameters['Inductance'] = ind_match.group(1)
                            elif param == 'Voltage':
                                volt_match = re.search(r'(\d+(?:\.\d+)?V)', description, re.IGNORECASE)
                                if volt_match:
                                    parameters['Voltage'] = volt_match.group(1)
                            elif param == 'Current/Power':
                                curr_match = re.search(r'(\d+(?:\.\d+)?[mµu]?A|[mµu]?W)', description, re.IGNORECASE)
                                if curr_match:
                                    parameters['Current/Power'] = curr_match.group(1)
                            elif param == 'Tolerance':
                                tol_match = re.search(r'([±\+-]?\d+(?:\.\d+)?%)', description, re.IGNORECASE)
                                if tol_match:
                                    parameters['Tolerance'] = tol_match.group(1)
                        break
                break

        return component_type, component_branch, parameters

    # Apply the function to each row in the DataFrame
    for index, row in df.iterrows():
        desc = row.get('Description', '')

        # Ensure the description is a string
        if isinstance(desc, str):
            component_type, component_branch, parameters = extract_component_details(desc)

            # Update DataFrame with extracted values
            df.at[index, 'Component Type'] = component_type
            df.at[index, 'Component Branch'] = component_branch
            for param, value in parameters.items():
                df.at[index, param] = value

    # Keep only the required columns
    df = df[required_columns]

    # Fill missing 'Order Qty.' with zeros if necessary
    df['Order Qty.'] = df['Order Qty.'].fillna(0).astype(int)

    # Now, proceed to insert the data into the database
    required_fields = ['LCSC Part Number', 'Order Qty.']
    errors = []
    new_components = []

    for index, row in df.iterrows():
        missing_fields = []
        for field in required_fields:
            if pd.isna(row.get(field)):
                missing_fields.append(field)
        if missing_fields:
            errors.append(f"Row {index + 2}: Missing required fields: {', '.join(missing_fields)}")
            continue

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
        }
        new_components.append(component_data)

    if errors:
        # Return error messages if any
        raise HTTPException(status_code=400, detail="; ".join(errors))

    # Insert new components into the database
    conn = sqlite3.connect('components.db')
    cursor = conn.cursor()
    inserted_components = []
    for component in new_components:
        try:
            cursor.execute('''
                INSERT INTO components (
                    part_number, manufacturer, package, description, order_qty, unit_price,
                    component_type, component_branch, capacitance, resistance, voltage,
                    tolerance, inductance, current_power, storage_place
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                component['part_number'], component['manufacturer'], component['package'],
                component['description'], component['order_qty'], component['unit_price'],
                component['component_type'], component['component_branch'], component['capacitance'],
                component['resistance'], component['voltage'], component['tolerance'],
                component['inductance'], component['current_power'], component['storage_place']
            ))
            # Log the addition in the change_log
            cursor.execute('''
                INSERT INTO change_log (user, action_type, component_id, details)
                VALUES (?, ?, ?, ?)
            ''', (
                "CSV Upload", "add_component", cursor.lastrowid,
                f"Added component {component['part_number']} with quantity {component['order_qty']}"
             ))
            inserted_components.append(component)
        except sqlite3.IntegrityError:
            # Handle duplicates or other integrity errors
            pass

    conn.commit()
    conn.close()

    # Return the inserted components
    return {"message": "Components uploaded successfully.", "components": inserted_components}

@app.post("/update_order_quantity")
async def update_order_quantity(data: dict):
    id = data.get('id')
    change = data.get('change')
    user = data.get('user')

    if not id or not change or not user:
        raise HTTPException(status_code=400, detail="ID, change, and user are required")

    conn = sqlite3.connect('components.db')
    conn.row_factory = sqlite3.Row  # Add this line to get results as dictionaries
    cursor = conn.cursor()
    cursor.execute("SELECT order_qty FROM components WHERE id = ?", (id,))
    result = cursor.fetchone()
    if result:
        new_qty = result['order_qty'] + change
        if new_qty < 0:
            new_qty = 0
        cursor.execute("UPDATE components SET order_qty = ? WHERE id = ?", (new_qty, id))
        conn.commit()

        # Log the change
        cursor.execute('''
            INSERT INTO change_log (user, action_type, component_id, details)
            VALUES (?, ?, ?, ?)
        ''', (user, 'update_quantity', id, f'Quantity changed by {change} to {new_qty}'))
        conn.commit()

        cursor.execute("SELECT * FROM components WHERE id = ?", (id,))
        updated_component = cursor.fetchone()
        conn.close()
        return dict(updated_component)
    else:
        conn.close()
        raise HTTPException(status_code=404, detail="Component not found")

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
    id = data.get('id')
    user = data.get('user')

    if not id or not user:
        raise HTTPException(status_code=400, detail="ID and user are required")

    conn = sqlite3.connect('components.db')
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM components WHERE id = ?", (id,))
    component = cursor.fetchone()
    if component:
        cursor.execute("DELETE FROM components WHERE id = ?", (id,))
        conn.commit()

        # Log the deletion
        cursor.execute('''
            INSERT INTO change_log (user, action_type, component_id, details)
            VALUES (?, ?, ?, ?)
        ''', (user, 'delete', id, 'Component deleted'))
        conn.commit()
        conn.close()
        return {"message": "Component deleted successfully"}
    else:
        conn.close()
        raise HTTPException(status_code=404, detail="Component not found")

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
        details = log_entry['details']

        if action_type == 'add_component':
            # For CSV uploads, handle multiple components
            if details.startswith("Added components from CSV"):
                # Get all components added in this batch
                cursor.execute("""
                    SELECT id, part_number FROM components 
                    WHERE id >= ? AND id <= (
                        SELECT MIN(id) FROM change_log 
                        WHERE id > ? AND action_type != 'add_component'
                    )
                """, (component_id, log_id))
                components = cursor.fetchall()
                
                for comp in components:
                    cursor.execute("DELETE FROM components WHERE id = ?", (comp['id'],))
                    
                revert_details = f"Reverted CSV upload of {len(components)} components"
            else:
                # Single component addition
                cursor.execute("DELETE FROM components WHERE id = ?", (component_id,))
                revert_details = f"Reverted addition of component ID {component_id}"

        elif action_type == 'update_quantity':
            match = re.search(r'Quantity changed by (-?\d+) to (\d+)', details)
            if match:
                change = int(match.group(1))
                # Reverse the change
                cursor.execute("""
                    UPDATE components 
                    SET order_qty = order_qty - ? 
                    WHERE id = ?
                """, (change, component_id))
                revert_details = f"Reverted quantity change of {change} for component ID {component_id}"
            else:
                raise HTTPException(status_code=400, detail="Cannot parse quantity change")

        elif action_type == 'delete':
            # Get the component data from the previous log entry
            cursor.execute("""
                SELECT c.* FROM change_log l
                JOIN components c ON l.component_id = c.id
                WHERE l.component_id = ? AND l.id < ?
                ORDER BY l.id DESC LIMIT 1
            """, (component_id, log_id))
            prev_state = cursor.fetchone()
            
            if prev_state:
                # Reinsert the component with its previous state
                cursor.execute("""
                    INSERT INTO components (
                        id, part_number, manufacturer, package, description,
                        order_qty, unit_price, component_type, component_branch,
                        capacitance, resistance, voltage, tolerance,
                        inductance, current_power, storage_place
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, tuple(prev_state))
                revert_details = f"Restored deleted component ID {component_id}"
            else:
                raise HTTPException(status_code=400, detail="Previous state not found")

        # Log the revert action
        cursor.execute("""
            INSERT INTO change_log (user, action_type, component_id, details)
            VALUES (?, ?, ?, ?)
        """, ("System", f"revert_{action_type}", component_id, revert_details))

        conn.commit()
        return {"message": "Change reverted successfully"}

    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
