# Backend Server Setup Guide (Python)

## Prerequisites
To run the database backend, you need **Python** installed on your computer.

1.  **Check if Python is installed**:
    - Open Command Prompt (cmd) or PowerShell.
    - Type `py --version` (or `python --version`) and press Enter.
    - If you see a version number (e.g., `Python 3.14.2`), you are ready.

## Installation
1.  Open your terminal to the project folder:
    `d:\特教課表Special Education Curriculum`
2.  Install the required `flask` library (if not already installed):
    ```bash
    py -m pip install flask flask-cors
    ```

## Running the Server
To start the application:

1.  In the terminal, run:
    ```bash
    py app.py
    ```
2.  You should see a message:
    ```
    Server is running at http://localhost:3000
    To share with other computers, use your IP address, e.g., http://192.168.x.x:3000
    ```
3.  Open `index.html` in your browser.
4.  Enter User ID **Spe for u** to login.

## How to Share with Other Devices (Local Network)
You can access this webpage from other computers or iPads on the **same Wi-Fi network**.

1.  **Find your IP Address**:
    - Open Command Prompt (cmd).
    - Type `ipconfig` and press Enter.
    - Look for **IPv4 Address** (usually starts with `192.168.x.x` or `10.x.x.x`).
2.  **Access on Other Device**:
    - On the other device, open Chrome/Safari.
    - Enter URL: `http://[Your IP Address]:3000`
    - Example: `http://192.168.1.105:3000`

## Data Migration
- Your data will be automatically migrated from the browser to the server (`data/Spe for u.json`) upon first login.
- From now on, keep the black terminal window open while using the website to ensure data saves correctly.
