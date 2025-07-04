# EasyDrawers \w LCSC support

**Take Control of Your Electronic Components!**

*(Placeholder: Consider adding a simple, clean logo here)*

EasyDrawers is a lightweight, web-based application designed to help electronics enthusiasts, small teams, and workshops manage their inventory of electronic components, especially those sourced from LCSC. Say goodbye to cluttered spreadsheets, lost parts, and ordering duplicates!

It's built to be fast, user-friendly, and accessible from both desktop and mobile devices, whether you prefer using a mouse, keyboard, or touchscreen.

**Key Highlights:**

*   **Visual Storage Map:** See exactly where components are located with an interactive map of your drawers and shelves.
*   **LCSC Integration:** Quickly add new stock from LCSC orders and import Bill of Materials (BOMs) directly into a virtual cart for picking.
*   **Team Ready:** Supports multiple users, each with their own component cart, preventing workflow collisions.
*   **Safety Net:** A detailed changelog tracks all modifications, allowing easy reverts in case of mistakes.

---

## What Can EasyDrawers Do For You?

EasyDrawers streamlines the often tedious process of managing electronic parts. Here's a look at its core features:

**1. Find Parts Instantly (Advanced Search & Filter)**

*   Forget digging through boxes. Use the powerful search bar to find components by LCSC Part Number, Manufacturer Part Number (MPN), description, or even specific parameters like resistance or capacitance.
*   Refine your search with filters for component type, branch, stock status, and value ranges (e.g., find all 1kΩ resistors in stock).

    *(Placeholder: Screenshot of the search interface with filters applied)*

**2. Effortless Stock Updates (LCSC Order Import)**

*   Ordered new parts from LCSC? Simply export your order/cart history as a CSV file from their website.
*   Upload the CSV to EasyDrawers, and it automatically adds new components to your database and updates quantities for existing ones. It intelligently parses descriptions to categorize components based on your configuration.

    ```bash
    # How it works:
    # 1. Export CSV from LCSC website (Cart or Order History)
    # 2. Go to the 'Import' tab in EasyDrawers
    # 3. Select the CSV file
    # 4. Click 'Import LCSC Components'
    ```

**3. Quick BOM Handling (BOM-to-Cart Import)**

*   Have an LCSC BOM file for a project? Upload it directly.
*   EasyDrawers finds the required parts in *your* stock and adds them to your virtual cart, ready for picking. It even tells you which parts from the BOM you don't have in stock.

**4. Your Component Library (Local Database)**

*   EasyDrawers maintains a local database (`components.db`) of all your parts.
*   View details like quantity, price, manufacturer, package type, specifications, and assigned storage location.

**5. Flexible Organization (Customizable Categories)**

*   Components are organized by `Type` (e.g., Resistor, Capacitor) and `Branch` (e.g., Chip Resistor - Surface Mount, Aluminum Electrolytic Capacitors - SMD).
*   **Adding/Editing Categories:** This system is fully defined by the `component_config.json` file. You can easily add new types, branches, or modify existing ones by editing this file directly.

    > **Example:** To add a new "Motors" type with a "Stepper Motors" branch:
    >
    > 1.  Open `component_config.json`.
    > 2.  Add a new section like this (ensure correct JSON formatting, especially commas):
    >     ```json
    >     {
    >         "Resistor": { ... existing resistor config ... },
    >         "Capacitor": { ... existing capacitor config ... },
    >         "Motors": {
    >             "Component Branch": {
    >                 "Stepper Motors": {
    >                     "Parameters": ["Voltage", "Current/Power", "Step Angle"],
    >                     "Storage Place": "" // Assign a default storage place later via the map
    >                 },
    >                 "DC Motors": {
    >                     "Parameters": ["Voltage", "Current/Power"],
    >                     "Storage Place": ""
    >                 }
    >             }
    >         }
    >         // ... other existing types ...
    >     }
    >     ```
    > 3.  Specify the relevant `Parameters` you want to track for components in that branch.
    > 4.  Save the file. The new categories will appear in dropdowns after restarting the app or reloading the page (depending on server configuration).

    *   **Removing Categories:** Simply delete the corresponding section from `component_config.json`.

**6. Manual Component Entry**

*   Add components one by one using a simple form. Fill in the LCSC Part Number, quantity, storage location, and select the appropriate type/branch. Optional fields and specifications can also be added.
*   Fill out specific parameters like resistance, capacitance, and voltage values to make future searches more effective.

**7. Visual Stock Map (Interactive Storage Layout)**

*   Get a visual overview of your physical storage (drawers, shelves, boxes).
*   See which locations are occupied or empty at a glance.
*   **Customize Layout:** Easily set the number of rows, columns, and extra single drawers (like 'U1', 'U2') in the map settings to match your physical setup.
*   **Assign Branches:** `Shift + Click` on a drawer in the map to assign a specific component branch (like "Through Hole Resistors") to that physical location. EasyDrawers helps keep similar parts together!
*   **Find Parts on Map:** Search results can highlight the physical location(s) of the components on the map.
*   Click on any drawer to see a detailed list of its contents.

    *(Placeholder: GIF/Screenshot showing the interactive map, highlighting a searched component, and opening a drawer's content panel)*

**8. Team Collaboration (Multi-User Support)**

*   Multiple users (e.g., Ondra, Lukas, Guest) can use the app simultaneously.
*   Each user maintains their own separate "Cart" for collecting components needed for a project or task. This prevents users from interfering with each other's work-in-progress.

**9. Safety Net & History (Changelog)**

*   Every significant action (adding/updating quantity, deleting components, importing CSVs, processing carts) is logged with user details and timestamps.
*   Made a mistake? Most actions (like quantity updates or deletions) can be easily reverted directly from the changelog page.

**10. Database Management (Export, Import, Format)**

*   Need a backup or want to edit data externally? Export the entire component database to a CSV file.
*   Import a previously exported (or compatible) CSV file to replace the entire database.
*   Option to completely format (erase) the database and start fresh.

**11. Use Anywhere (Responsive Design)**

*   The interface adapts for comfortable use on desktops, tablets, and mobile phones.
*   Choose between a detailed table view or a touch-friendly card view for search results.

---

## Getting Started & Usage

EasyDrawers is designed to be intuitive. Here's a typical workflow:

1.  **Setup:** Install and run the application (see Installation/Deployment below). Choose your user profile.
2.  **Configure Categories:** (Optional) Edit `component_config.json` to match the types of components you stock.
3.  **Populate Database:**
    *   Use the **LCSC Order Import** for bulk additions from past orders.
    *   Add components manually via the **Add Component** tab.
4.  **Organize Storage:**
    *   Go to the **Storage Map**.
    *   Adjust the layout (**Rows/Columns/Extra**) to match your physical storage.
    *   `Shift + Click` on drawers to assign component branches (e.g., assign "B3" to "Multilayer Ceramic Capacitors MLCC - SMD/SMT").
5.  **Find Components:** Use the **Search** tab with filters and keywords.
6.  **Pick Parts for a Project:**
    *   Use the **BOM-to-Cart Import** if you have an LCSC BOM.
    *   Alternatively, search for parts and click the "Add to Cart" button (🛒) for each required component. Adjust quantities in the cart as needed.
7.  **Withdraw Stock:** Go to your **Cart**, review the items, and click "Get Parts". This deducts the quantities from the main database and logs the transaction. A printable summary is shown.

---

## Beyond Electronics?

While designed with LCSC electronic components in mind, the core inventory management, categorization, and storage mapping features could be adapted for other types of stock:

*   Craft supplies (beads, yarn types)
*   Mechanical parts (screws, bolts, nuts)
*   Lab consumables
*   Any collection of items needing organization and quantity tracking.

**Adaptation:** The key is modifying `component_config.json`. Define relevant `Types`, `Branches`, and `Parameters` for your specific items. For example, for screws, you might have `Type: Fastener`, `Branch: Machine Screw`, `Parameters: ["Thread Size", "Length", "Head Type", "Material"]`.

---

## Installation

EasyDrawers is a Python application using the FastAPI framework.

**Prerequisites:**

*   Python 3.10 (recommended)
*   `pip` (Python package installer)

**Steps:**

1.  **Clone or Download:** Get the project files onto your computer.
    ```bash
    git clone https://github.com/Teapack1/EasyDrawers-w-LCSC-support.git
    cd my_lcsc_stock
    ```
    Or download the ZIP and extract it.

2.  **Install Dependencies:** Open a terminal or command prompt in the project directory and run:
    ```bash
    pip install -r requirements.txt
    ```
    This installs FastAPI, Uvicorn, Pandas, and other necessary libraries.

3.  **Run the App:** Start the development server:
    ```bash
    uvicorn main:app --reload --host 0.0.0.0 --port 8000
    ```
    *   `--reload`: Automatically restarts the server when code changes (good for development).
    *   `--host 0.0.0.0`: Makes the app accessible from other devices on your network.
    *   `--port 8000`: Specifies the port number.

4.  **Access:** Open your web browser and go to `http://localhost:8000` or `http://<your-computer-ip>:8000`.

---

## Deployment

### Setting up EasyDrawers on Lubuntu (18.04/22.04)

This guide will walk you through deploying EasyDrawers as a permanent service that automatically starts on boot. Perfect for always-on access by small teams (up to 5 users).

#### 1. Install System Dependencies

```bash
# Update system packages
sudo apt update
sudo apt upgrade -y

# Install required packages
sudo apt install -y python3 python3-pip python3-venv git
```

#### 2. Download & Set Up the Application

```bash
# Create directory for the application
mkdir -p ~/apps
cd ~/apps

# Clone the repository
git clone https://github.com/Teapack1/EasyDrawers-w-LCSC-support.git
cd EasyDrawers-w-LCSC-support

# Create a virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

#### 3. Test the Application

```bash
# Start the server temporarily to test
uvicorn main:app --host 0.0.0.0 --port 8000
```

Visit `http://localhost:8000` in your browser. If everything works correctly, proceed to set up the service. Press `Ctrl+C` to stop the server.

#### 4. Create a Systemd Service

Create a service file that will manage the application and ensure it runs at startup:

```bash
# Create the service file
sudo nano /etc/systemd/system/easydrawers.service
```

Paste the following content (adjust paths as needed):

```ini
[Unit]
Description=EasyDrawers Component Manager
After=network.target

[Service]
User=$USER
WorkingDirectory=/home/$USER/apps/EasyDrawers-w-LCSC-support
ExecStart=/home/$USER/apps/EasyDrawers-w-LCSC-support/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=easydrawers

[Install]
WantedBy=multi-user.target
```

Save and exit (Ctrl+O, Enter, Ctrl+X).

#### 5. Enable & Start the Service

```bash
# Reload systemd configurations
sudo systemctl daemon-reload

# Enable the service to start on boot
sudo systemctl enable easydrawers

# Start the service now
sudo systemctl start easydrawers

# Check status
sudo systemctl status easydrawers
```

The service is now running and will automatically start each time your system boots!

#### 6. Network Configuration

To make the app accessible from other devices on your network:

1. **Find your server's IP address**:
   ```bash
   ip addr show | grep inet
   ```
   This will display your current IP address (look for something like 192.168.1.x or 10.0.0.x)

2. **Set a static IP** (recommended for server stability):
   ```bash
   sudo nano /etc/netplan/01-network-manager-all.yaml
   ```
   
   Add/edit configuration, replacing 192.168.1.100 with your desired static IP:
   ```yaml
   network:
     version: 2
     renderer: NetworkManager
     ethernets:
       eth0:
         dhcp4: no
         addresses: [192.168.1.100/24]  # Choose an IP in your network range
         gateway4: 192.168.1.1  # Your router's IP address
         nameservers:
           addresses: [8.8.8.8, 8.8.4.4]
   ```
   Save, exit, and apply with: `sudo netplan apply`

#### 7. Accessing EasyDrawers

- From any device on your network, open a web browser and navigate to:
  ```
  http://SERVER_IP:8000
  ```
  Where SERVER_IP is the static IP you configured above (e.g., 192.168.1.100)

- For easier access:
  - **On mobile**: Create a home screen shortcut to the URL
  - **On desktop**: Create a bookmark in your browser

#### 8. Managing the Service

- **Check status**: `sudo systemctl status easydrawers` - Shows if the service is running and recent log entries
- **Restart service**: `sudo systemctl restart easydrawers` - Restarts the application after changes or if issues occur
- **View logs**: `sudo journalctl -u easydrawers` - Shows detailed application logs for troubleshooting
- **Stop service**: `sudo systemctl stop easydrawers` - Stops the application completely

#### 9. Updating the Application

```bash
cd ~/apps/EasyDrawers-w-LCSC-support
git pull
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart easydrawers
```

Enjoy your always-on, team-accessible component management system!

---

## Technologies Used

*   **Backend:** Python, FastAPI
*   **Frontend:** HTML, CSS, JavaScript (Vanilla)
*   **Database:** SQLite
*   **CSV/Data Handling:** Pandas
*   **Web Server (Development):** Uvicorn

---

## Final Words

EasyDrawers aims to be a practical tool born from a real need for organizing electronic components. I hope it helps you stay organized, avoid ordering duplicate components and focus more on your projects and less on managing inventory! The app provides a robust solution specifically designed for LCSC parts while remaining flexible enough to adapt to your unique workflow.

Feel free to contribute, report issues, or suggest features as you use the application.
