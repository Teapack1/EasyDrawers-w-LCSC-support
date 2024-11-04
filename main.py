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
    conn.commit()
    conn.close()

create_database()

# Pydantic models for request bodies
class Component(BaseModel):
    part_number: str = None
    manufacturer: str = None
    package: str = None
    description: str = None
    order_qty: int = None
    unit_price: float = None
    component_type: str = None
    component_branch: str = None
    capacitance: str = None
    resistance: str = None
    voltage: str = None
    tolerance: str = None
    inductance: str = None
    current_power: str = None
    storage_place: str = None  # Added new field

# Endpoint to add a new component
@app.post("/add_component")
async def add_component(component: Component):
    conn = sqlite3.connect('components.db')
    cursor = conn.cursor()
    try:
        cursor.execute(
            '''
            INSERT INTO components (
                part_number, manufacturer, package, description, order_qty, unit_price,
                component_type, component_branch, capacitance, resistance, voltage, tolerance,
                inductance, current_power, storage_place  -- Added storage_place
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (
                component.part_number, component.manufacturer, component.package, component.description,
                component.order_qty, component.unit_price, component.component_type, component.component_branch,
                component.capacitance, component.resistance, component.voltage, component.tolerance,
                component.inductance, component.current_power, component.storage_place  # Added storage_place
            )
        )
        conn.commit()
        response = {"message": "Component added successfully"}
    except sqlite3.IntegrityError:
        response = {"message": "Component with this part number already exists"}
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
    try:
        content = await file.read()
        df = pd.read_csv(BytesIO(content))

        # Ensure column names match between the CSV and database fields
        df.rename(columns={
            'LCSC Part Number': 'part_number',
            'Manufacturer': 'manufacturer',
            'Package': 'package',
            'Description': 'description',
            'Order Qty.': 'order_qty',
            'Unit Price($)': 'unit_price',
            'Component Type': 'component_type',
            'Component Branch': 'component_branch',
            'Capacitance': 'capacitance',
            'Resistance': 'resistance',
            'Voltage': 'voltage',
            'Tolerance': 'tolerance',
            'Inductance': 'inductance',
            'Current/Power': 'current_power',
            'Storage Place': 'storage_place'  # Added storage_place
        }, inplace=True)

        # Convert data types if necessary
        df['order_qty'] = df['order_qty'].fillna(0).astype(int)
        df['unit_price'] = df['unit_price'].fillna(0).astype(float)

        conn = sqlite3.connect('components.db')
        cursor = conn.cursor()

        # Insert or update each component
        for _, row in df.iterrows():
            cursor.execute(
                '''
                INSERT INTO components (
                    part_number, manufacturer, package, description,
                    order_qty, unit_price, component_type, component_branch,
                    capacitance, resistance, voltage, tolerance,
                    inductance, current_power, storage_place  -- Added storage_place
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(part_number) DO UPDATE SET
                    manufacturer=excluded.manufacturer,
                    package=excluded.package,
                    description=excluded.description,
                    order_qty=components.order_qty + excluded.order_qty,
                    unit_price=excluded.unit_price,
                    component_type=excluded.component_type,
                    component_branch=excluded.component_branch,
                    capacitance=excluded.capacitance,
                    resistance=excluded.resistance,
                    voltage=excluded.voltage,
                    tolerance=excluded.tolerance,
                    inductance=excluded.inductance,
                    current_power=excluded.current_power,
                    storage_place=excluded.storage_place  -- Added storage_place
                ''',
                (
                    row.get('part_number'),
                    row.get('manufacturer'),
                    row.get('package'),
                    row.get('description'),
                    row.get('order_qty', 0),
                    row.get('unit_price', 0.0),
                    row.get('component_type'),
                    row.get('component_branch'),
                    row.get('capacitance'),
                    row.get('resistance'),
                    row.get('voltage'),
                    row.get('tolerance'),
                    row.get('inductance'),
                    row.get('current_power'),
                    row.get('storage_place')  # Added storage_place
                )
            )

        conn.commit()
        conn.close()

        return {"message": "CSV uploaded and data updated successfully"}

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to upload CSV file: {str(e)}")

@app.post("/update_order_quantity")
async def update_order_quantity(id: int, change: int):
    conn = sqlite3.connect('components.db')
    conn.row_factory = sqlite3.Row  # Enable dictionary-like access to rows
    cursor = conn.cursor()
    cursor.execute("SELECT order_qty FROM components WHERE id = ?", (id,))
    result = cursor.fetchone()
    if result:
        new_qty = result["order_qty"] + change  # Accessing by column name
        if new_qty < 0:
            new_qty = 0
        cursor.execute("UPDATE components SET order_qty = ? WHERE id = ?", (new_qty, id))
        conn.commit()
        cursor.execute("SELECT * FROM components WHERE id = ?", (id,))
        updated_component = cursor.fetchone()
        conn.close()
        return dict(updated_component)  # Now this works
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
async def delete_component(id: int):
    conn = sqlite3.connect('components.db')
    cursor = conn.cursor()
    cursor.execute("DELETE FROM components WHERE id = ?", (id,))
    conn.commit()
    conn.close()
    return {"message": "Component deleted successfully"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
