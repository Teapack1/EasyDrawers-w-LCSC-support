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
                        category TEXT,
                        value1 TEXT,
                        value2 TEXT,
                        value3 TEXT,
                        footprint TEXT,
                        price REAL,
                        manufacturer TEXT,
                        manufacturer_part TEXT,
                        location TEXT,
                        quantity INTEGER
                    )''')
    conn.commit()
    conn.close()

create_database()

# Pydantic models for request bodies
class Component(BaseModel):
    part_number: str = None
    category: str = None
    value1: str = None
    value2: str = None
    value3: str = None
    footprint: str = None
    price: float = None
    manufacturer: str = None
    manufacturer_part: str = None
    location: str = None
    quantity: int = None

# Endpoint to add a new component
@app.post("/add_component")
async def add_component(component: Component):
    conn = sqlite3.connect('components.db')
    cursor = conn.cursor()
    try:
        cursor.execute('''INSERT INTO components (part_number, category, value1, value2, value3, footprint, price, manufacturer, manufacturer_part, location, quantity)
                          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                       (component.part_number, component.category, component.value1, component.value2, component.value3,
                        component.footprint, component.price, component.manufacturer, component.manufacturer_part,
                        component.location, component.quantity))
        conn.commit()
        response = {"message": "Component added successfully"}
    except sqlite3.IntegrityError:
        response = {"message": "Component with this part number already exists"}
    conn.close()
    return response

# Endpoint to update components from a CSV file
@app.post("/update_components_from_csv")
async def update_components_from_csv(file: UploadFile = File(...)):
    try:
        df = pd.read_csv(file.file)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading CSV file: {str(e)}")
    
    conn = sqlite3.connect('components.db')
    cursor = conn.cursor()
    
    for _, row in df.iterrows():
        part_number = row.get('LCSC Part Number', '').strip()
        description = row.get('Description', '').strip()
        footprint = row.get('Footprint', '').strip()
        price = row.get('Price', 0.0)
        manufacturer = row.get('Manufacturer', '').strip()
        manufacturer_part = row.get('Manufacturer Part', '').strip()
        quantity = row.get('Stock Quantity', 0)
        location = row.get('Location', '').strip()
        
        # Extract category, value1, value2, value3 from description using regex
        category = ""
        value1 = ""
        value2 = ""
        value3 = ""

        # Regex patterns to extract values
        resistor_pattern = re.compile(r'(\d+(\.\d+)?[kM]?)\s*ohm', re.IGNORECASE)
        capacitor_pattern = re.compile(r'(\d+(\.\d+)?[pnuµ]?F)', re.IGNORECASE)
        inductor_pattern = re.compile(r'(\d+(\.\d+)?[uµm]?H)', re.IGNORECASE)
        voltage_pattern = re.compile(r'(\d+(\.\d+)?V)', re.IGNORECASE)
        current_pattern = re.compile(r'(\d+(\.\d+)?[mµ]?A)', re.IGNORECASE)
        power_pattern = re.compile(r'(\d+(\.\d+)?W)', re.IGNORECASE)
        frequency_pattern = re.compile(r'(\d+(\.\d+)?[kM]?Hz)', re.IGNORECASE)

        # Identify category and extract values
        if "resistor" in description.lower():
            category = "Resistor"
            match = resistor_pattern.search(description)
            if match:
                value1 = match.group(1)
        elif "capacitor" in description.lower():
            category = "Capacitor"
            match = capacitor_pattern.search(description)
            if match:
                value1 = match.group(1)
        elif "inductor" in description.lower():
            category = "Inductor"
            match = inductor_pattern.search(description)
            if match:
                value1 = match.group(1)
        elif "buck" in description.lower() or "converter" in description.lower():
            category = "Buck Converter"
            match = power_pattern.search(description)
            if match:
                value1 = match.group(1)
            voltage_match = voltage_pattern.search(description)
            if voltage_match:
                value2 = voltage_match.group(1)
        elif "led driver" in description.lower():
            category = "LED Driver"
            current_match = current_pattern.search(description)
            if current_match:
                value1 = current_match.group(1)
            voltage_match = voltage_pattern.search(description)
            if voltage_match:
                value2 = voltage_match.group(1)
        elif "mcu" in description.lower() or "microcontroller" in description.lower():
            category = "Microcontroller"
            frequency_match = frequency_pattern.search(description)
            if frequency_match:
                value1 = frequency_match.group(1)
        elif "diode" in description.lower():
            category = "Diode"
            voltage_match = voltage_pattern.search(description)
            if voltage_match:
                value1 = voltage_match.group(1)
            current_match = current_pattern.search(description)
            if current_match:
                value2 = current_match.group(1)
        elif "transistor" in description.lower():
            category = "Transistor"
            power_match = power_pattern.search(description)
            if power_match:
                value1 = power_match.group(1)
            current_match = current_pattern.search(description)
            if current_match:
                value2 = current_match.group(1)
        elif "fuse" in description.lower():
            category = "Fuse"
            current_match = current_pattern.search(description)
            if current_match:
                value1 = current_match.group(1)
            voltage_match = voltage_pattern.search(description)
            if voltage_match:
                value2 = voltage_match.group(1)
        elif "crystal" in description.lower() or "oscillator" in description.lower():
            category = "Crystal/Oscillator"
            frequency_match = frequency_pattern.search(description)
            if frequency_match:
                value1 = frequency_match.group(1)
        elif "connector" in description.lower():
            category = "Connector"
        elif "regulator" in description.lower() or "ldo" in description.lower():
            category = "Voltage Regulator"
            voltage_match = voltage_pattern.search(description)
            if voltage_match:
                value1 = voltage_match.group(1)
        elif "sensor" in description.lower():
            category = "Sensor"
        elif "switch" in description.lower() or "button" in description.lower():
            category = "Switch/Button"

        cursor.execute('''SELECT * FROM components WHERE part_number = ?''', (part_number,))
        result = cursor.fetchone()
        
        if result:
            # Update existing component
            cursor.execute('''UPDATE components SET category = ?, value1 = ?, value2 = ?, value3 = ?, footprint = ?, price = ?,
                              manufacturer = ?, manufacturer_part = ?, location = ?, quantity = ? WHERE part_number = ?''',
                           (category, value1, value2, value3, footprint, price, manufacturer, manufacturer_part, location, quantity, part_number))
        else:
            # Insert new component
            cursor.execute('''INSERT INTO components (part_number, category, value1, value2, value3, footprint, price, manufacturer, manufacturer_part, location, quantity)
                              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                           (part_number, category, value1, value2, value3, footprint, price, manufacturer, manufacturer_part, location, quantity))
    
    conn.commit()
    conn.close()
    return {"message": "Components updated successfully from CSV"}

# Endpoint to search for components
@app.get("/search_component")
async def search_component(query: str):
    conn = sqlite3.connect('components.db')
    conn.row_factory = sqlite3.Row  # Enable dictionary-like access to rows
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM components WHERE part_number LIKE ? OR category LIKE ? OR value1 LIKE ? OR manufacturer LIKE ? OR manufacturer_part LIKE ? OR location LIKE ?", 
                   (f'%{query}%', f'%{query}%', f'%{query}%', f'%{query}%', f'%{query}%', f'%{query}%'))
    results = cursor.fetchall()
    conn.close()
    if not results:
        raise HTTPException(status_code=404, detail="No components found matching the query")
    return [dict(row) for row in results]

# Endpoint to serve the UI
@app.get("/", response_class=HTMLResponse)
async def serve_ui(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

# Run the app
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
