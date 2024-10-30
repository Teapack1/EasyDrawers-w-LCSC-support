import pandas as pd
import os
import sqlite3
import json
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import re
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from starlette.requests import Request
from fastapi.staticfiles import StaticFiles

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
    cursor.execute('''CREATE TABLE IF NOT EXISTS components (
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
                        current_power TEXT
                    )''')
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

# Endpoint to add a new component
@app.post("/add_component")
async def add_component(component: Component):
    conn = sqlite3.connect('components.db')
    cursor = conn.cursor()
    try:
        cursor.execute('''INSERT INTO components (part_number, manufacturer, package, description, order_qty, unit_price,
                          component_type, component_branch, capacitance, resistance, voltage, tolerance, inductance, current_power)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                       (component.part_number, component.manufacturer, component.package, component.description,
                        component.order_qty, component.unit_price, component.component_type, component.component_branch,
                        component.capacitance, component.resistance, component.voltage, component.tolerance,
                        component.inductance, component.current_power))
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
async def upload_csv(file: UploadFile = File(...)):
    try:
        # Load the CSV file using pandas
        df = pd.read_csv(file.file)

        # Check for missing columns
        required_columns = [
            'LCSC Part Number', 'Manufacturer', 'Package', 'Description',
            'Order Qty.', 'Unit Price($)', 'Component Type', 'Component Branch',
            'Capacitance', 'Resistance', 'Voltage', 'Tolerance', 'Inductance', 'Current/Power'
        ]
        if not all(col in df.columns for col in required_columns):
            return {"error": "Missing one or more required columns in CSV file"}

        # Insert rows into the database
        conn = sqlite3.connect('components.db')
        cursor = conn.cursor()
        for _, row in df.iterrows():
            try:
                cursor.execute('''INSERT INTO components (part_number, manufacturer, package, description, order_qty, unit_price,
                                  component_type, component_branch, capacitance, resistance, voltage, tolerance, inductance, current_power)
                                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                               (row['LCSC Part Number'], row['Manufacturer'], row['Package'], row['Description'],
                                row['Order Qty.'], row['Unit Price($)'], row['Component Type'], row['Component Branch'],
                                row['Capacitance'], row['Resistance'], row['Voltage'], row['Tolerance'],
                                row['Inductance'], row['Current/Power']))
            except sqlite3.IntegrityError:
                # Handle duplicate entries by skipping or updating, as needed
                continue
        conn.commit()
        conn.close()
        return {"message": "CSV uploaded and data saved successfully"}

    except Exception as e:
        return {"error": f"Failed to upload CSV file: {str(e)}"}

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
