import pandas as pd
import re

# Load the new CSV file
file_path = 'cart.csv'
df = pd.read_csv(file_path, encoding='utf-8')

# Initialize the columns to be extracted and added
required_columns = [
    'LCSC Part Number', 'Manufacturer', 'Package', 'Description',
    'Order Qty.', 'Unit Price($)', 'Component Type', 'Component Branch',
    'Capacitance', 'Resistance', 'Voltage', 'Tolerance', 'Inductance', 'Current/Power'
]
df['Component Type'] = None
df['Component Branch'] = None
df['Capacitance'] = None
df['Resistance'] = None
df['Voltage'] = None
df['Tolerance'] = None
df['Inductance'] = None
df['Current/Power'] = None

@app.post("/update_order_quantity")
async def update_order_quantity(id: int, change: int):
    conn = sqlite3.connect('components.db')
    cursor = conn.cursor()
    cursor.execute("SELECT order_qty FROM components WHERE id = ?", (id,))
    result = cursor.fetchone()
    if result:
        new_qty = result[0] + change
        if new_qty < 0:
            new_qty = 0
        cursor.execute("UPDATE components SET order_qty = ? WHERE id = ?", (new_qty, id))
        conn.commit()
        cursor.execute("SELECT * FROM components WHERE id = ?", (id,))
        updated_component = cursor.fetchone()
        conn.close()
        return dict(updated_component)
    else:
        conn.close()
        raise HTTPException(status_code=404, detail="Component not found")
    
    
# Function to extract resistor details
def extract_resistor_details(description):
    component_type = resistor_type = resistance = voltage = tolerance = None

    # Check if the component is a resistor
    if re.search(r'resistor', description, re.IGNORECASE):
        component_type = 'Resistor'
        # Determine resistor type based on categories from the image
        if re.search(r'chip', description, re.IGNORECASE):
            resistor_type = 'Chip Resistor - Surface Mount'
        elif re.search(r'network|array', description, re.IGNORECASE):
            resistor_type = 'Resistor Network/Array'
        elif re.search(r'current sense|shunt', description, re.IGNORECASE):
            resistor_type = 'Current Sense Resistor / Shunt'
        elif re.search(r'potentiometer|variable', description, re.IGNORECASE):
            resistor_type = 'Potentiometer / Variable Resistor'
        elif re.search(r'through hole', description, re.IGNORECASE):
            resistor_type = 'Through Hole Resistor'
        elif re.search(r'aluminum case|porcelain tube', description, re.IGNORECASE):
            resistor_type = 'Aluminum Case / Porcelain Tube Resistor'
        else:
            resistor_type = 'General Resistor'
        # Extract resistance, voltage, and tolerance
        res_match = re.search(r'(\d+(?:\.\d+)?[kM]?[ΩR])', description, re.IGNORECASE)
        if res_match:
            resistance = res_match.group(1).replace('Ω', 'Ohm')  # Replace the symbol Ω with 'Ohm' for better encoding compatibility
        volt_match = re.search(r'(\d+V)', description, re.IGNORECASE)
        if volt_match:
            voltage = volt_match.group(1)
        tol_match = re.search(r'(±\d+%)', description, re.IGNORECASE)
        if tol_match:
            tolerance = tol_match.group(1)

    return component_type, resistor_type, resistance, voltage, tolerance

# Function to extract capacitor details
def extract_capacitor_details(description):
    component_type = capacitor_type = capacitance = voltage = tolerance = None

    # Check if the component is a capacitor
    if re.search(r'capacitor', description, re.IGNORECASE):
        component_type = 'Capacitor'
        # Determine capacitor type based on categories from the image
        if re.search(r'aluminum electrolytic.*screw', description, re.IGNORECASE):
            capacitor_type = 'Aluminum Electrolytic Capacitor (Can - Screw Terminals)'
        elif re.search(r'aluminum electrolytic.*lead', description, re.IGNORECASE):
            capacitor_type = 'Aluminum Electrolytic Capacitor - Leaded'
        elif re.search(r'aluminum electrolytic.*smd', description, re.IGNORECASE):
            capacitor_type = 'Aluminum Electrolytic Capacitor - SMD'
        elif re.search(r'film', description, re.IGNORECASE):
            capacitor_type = 'Film Capacitor'
        elif re.search(r'tantalum', description, re.IGNORECASE):
            capacitor_type = 'Tantalum Capacitor'
        elif re.search(r'ceramic.*mlcc.*smd', description, re.IGNORECASE):
            capacitor_type = 'Multilayer Ceramic Capacitor MLCC - SMD/SMT'
        elif re.search(r'ceramic.*mlcc.*lead', description, re.IGNORECASE):
            capacitor_type = 'Multilayer Ceramic Capacitor MLCC - Leaded'
        elif re.search(r'polypropylene', description, re.IGNORECASE):
            capacitor_type = 'Polypropylene Film Capacitor'
        elif re.search(r'safety', description, re.IGNORECASE):
            capacitor_type = 'Safety Capacitor'
        elif re.search(r'trimmer|variable', description, re.IGNORECASE):
            capacitor_type = 'Trimmer / Variable Capacitor'
        else:
            capacitor_type = 'General Capacitor'
        # Extract capacitance, voltage, and tolerance
        cap_match = re.search(r'(\d+(?:\.\d+)?[munpF])', description, re.IGNORECASE)
        if cap_match:
            capacitance = cap_match.group(1)
        volt_match = re.search(r'(\d+V)', description, re.IGNORECASE)
        if volt_match:
            voltage = volt_match.group(1)
        tol_match = re.search(r'(±\d+%)', description, re.IGNORECASE)
        if tol_match:
            tolerance = tol_match.group(1)

    return component_type, capacitor_type, capacitance, voltage, tolerance

# Function to extract inductor details
def extract_inductor_details(description):
    component_type = inductor_type = inductance = current = tolerance = None

    # Check if the component is an inductor
    if re.search(r'inductor', description, re.IGNORECASE):
        component_type = 'Inductor'
        # Determine inductor type based on categories from the image
        if re.search(r'power', description, re.IGNORECASE):
            inductor_type = 'Power Inductor'
        elif re.search(r'color ring|through hole', description, re.IGNORECASE):
            inductor_type = 'Color Ring Inductor / Through Hole'
        elif re.search(r'smd', description, re.IGNORECASE):
            inductor_type = 'Inductor (SMD)'
        elif re.search(r'current sense', description, re.IGNORECASE):
            inductor_type = 'Current Sense Transformer'
        elif re.search(r'audio', description, re.IGNORECASE):
            inductor_type = 'Audio Transformer'
        elif re.search(r'wireless charging coil', description, re.IGNORECASE):
            inductor_type = 'Wireless Charging Coil'
        else:
            inductor_type = 'General Inductor'
        # Extract inductance, current, and tolerance
        ind_match = re.search(r'(\d+(?:\.\d+)?[munH])', description, re.IGNORECASE)
        if ind_match:
            inductance = ind_match.group(1)
        cur_match = re.search(r'(\d+(?:\.\d+)?[mA|A])', description, re.IGNORECASE)
        if cur_match:
            current = cur_match.group(1)
        tol_match = re.search(r'(±\d+%)', description, re.IGNORECASE)
        if tol_match:
            tolerance = tol_match.group(1)

    return component_type, inductor_type, inductance, current, tolerance

# Function to extract diode details
def extract_diode_details(description):
    component_type = diode_type = voltage = current_power = None

    # Check if the component is a diode
    if re.search(r'diode', description, re.IGNORECASE):
        component_type = 'Diode'
        # Determine diode type based on categories from the image
        if re.search(r'bridge rectifier', description, re.IGNORECASE):
            diode_type = 'Bridge Rectifier'
        elif re.search(r'fast recovery|high efficiency', description, re.IGNORECASE):
            diode_type = 'Fast Recovery / High Efficiency Diode'
        elif re.search(r'zener', description, re.IGNORECASE):
            diode_type = 'Zener Diode'
        elif re.search(r'general purpose', description, re.IGNORECASE):
            diode_type = 'General Purpose Diode'
        elif re.search(r'variable capacitance', description, re.IGNORECASE):
            diode_type = 'Variable Capacitance Diode'
        elif re.search(r'switching', description, re.IGNORECASE):
            diode_type = 'Switching Diode'
        elif re.search(r'avalanche', description, re.IGNORECASE):
            diode_type = 'Avalanche Diode'
        elif re.search(r'schottky', description, re.IGNORECASE):
            diode_type = 'Schottky Diode'
        elif re.search(r'trigger', description, re.IGNORECASE):
            diode_type = 'Trigger Diode'
        else:
            diode_type = 'General Diode'
        # Extract voltage and current/power
        volt_match = re.search(r'(\d+(?:\.\d+)?V)', description, re.IGNORECASE)
        if volt_match:
            voltage = volt_match.group(1)
        cur_pow_match = re.search(r'(\d+(?:\.\d+)?(?:mA|A|mW|W))', description, re.IGNORECASE)
        if cur_pow_match:
            current_power = cur_pow_match.group(1)

    return component_type, diode_type, voltage, current_power

# Apply the functions to each row in the DataFrame
for index, row in df.iterrows():
    desc = row['Description']

    # Ensure the description is a string
    if isinstance(desc, str):
        component_type, resistor_type, resistance, voltage, tolerance = extract_resistor_details(desc)
        cap_component_type, capacitor_type, capacitance, cap_voltage, cap_tolerance = extract_capacitor_details(desc)
        ind_component_type, inductor_type, inductance, current, ind_tolerance = extract_inductor_details(desc)
        diode_component_type, diode_type, diode_voltage, diode_current_power = extract_diode_details(desc)

        # Update DataFrame with extracted resistor values
        if component_type == 'Resistor':
            df.at[index, 'Component Type'] = component_type
            df.at[index, 'Component Branch'] = resistor_type
            df.at[index, 'Resistance'] = resistance
            df.at[index, 'Voltage'] = voltage
            df.at[index, 'Tolerance'] = tolerance

        # Update DataFrame with extracted capacitor values
        if cap_component_type == 'Capacitor':
            df.at[index, 'Component Type'] = cap_component_type
            df.at[index, 'Component Branch'] = capacitor_type
            df.at[index, 'Capacitance'] = capacitance
            df.at[index, 'Voltage'] = cap_voltage
            df.at[index, 'Tolerance'] = cap_tolerance

        # Update DataFrame with extracted inductor values
        if ind_component_type == 'Inductor':
            df.at[index, 'Component Type'] = ind_component_type
            df.at[index, 'Component Branch'] = inductor_type
            df.at[index, 'Inductance'] = inductance
            df.at[index, 'Current/Power'] = current
            df.at[index, 'Tolerance'] = ind_tolerance

        # Update DataFrame with extracted diode values
        if diode_component_type == 'Diode':
            df.at[index, 'Component Type'] = diode_component_type
            df.at[index, 'Component Branch'] = diode_type
            df.at[index, 'Voltage'] = diode_voltage
            df.at[index, 'Current/Power'] = diode_current_power
        
        
# Keep only the required columns
df = df[required_columns]

# Save the updated DataFrame to a new CSV file
output_file_path = 'Formatted_Resistor_Details.csv'
df.to_csv(output_file_path, index=False)
