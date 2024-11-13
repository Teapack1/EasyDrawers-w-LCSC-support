import pandas as pd
import re
import json

# Load the new CSV file
file_path = 'cart.csv'
df = pd.read_csv(file_path, encoding='utf-8')

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

# Function to extract component details
def extract_component_details(description):
    component_type = None
    component_branch = None
    parameters = {}

    # Iterate over component types
    for c_type, branches in component_config.items():
        if re.search(re.escape(c_type), description, re.IGNORECASE):
            component_type = c_type
            # Iterate over component branches
            for branch, params in branches['Component Branch'].items():
                if re.search(re.escape(branch), description, re.IGNORECASE):
                    component_branch = branch
                    # Extract parameters based on params list
                    for param in params:
                        if param == 'Resistance':
                            res_match = re.search(r'(\d+(?:\.\d+)?\s*(?:[kKmM]?Ω|Ohm|R))', description, re.IGNORECASE)
                            if res_match:
                                parameters['Resistance'] = res_match.group(1)
                        elif param == 'Capacitance':
                            cap_match = re.search(r'(\d+(?:\.\d+)?\s*[pµunμ]?F)', description, re.IGNORECASE)
                            if cap_match:
                                parameters['Capacitance'] = cap_match.group(1)
                        # Add extraction logic for other parameters as needed
                    break
            break

    return component_type, component_branch, parameters

# Apply the function to each row in the DataFrame
for index, row in df.iterrows():
    desc = row['Description']

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

# Save the updated DataFrame to a new CSV file
output_file_path = 'formatted_cart.csv'
df.to_csv(output_file_path, index=False)
