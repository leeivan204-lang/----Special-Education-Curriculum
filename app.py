import os
import json
import sys
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

def resource_path(relative_path):
    """ Get absolute path to resource, works for dev and for PyInstaller """
    try:
        # PyInstaller creates a temp folder and stores path in _MEIPASS
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")

    return os.path.join(base_path, relative_path)

# Determine the folder where the executable (or script) is located
# This is where we will store the 'data' folder
if getattr(sys, 'frozen', False):
    # If the application is run as a bundle (PyInstaller)
    BASE_DIR = os.path.dirname(sys.executable)
    # Static assets are inside the MEIPASS folder
    STATIC_FOLDER = resource_path('.')
else:
    # If run from Python script
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    STATIC_FOLDER = '.'

app = Flask(__name__, static_url_path='', static_folder=STATIC_FOLDER)
CORS(app)  # Enable Cross-Origin Resource Sharing

# Configuration
PORT = 3000
DATA_DIR = os.path.join(BASE_DIR, 'data')

# Ensure data directory exists
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

# API: Login
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    user_id = data.get('userId')

    if not user_id:
        return jsonify({'success': False, 'message': 'User ID is required'}), 400

    # In a real app, you'd check passwords here.
    # We allow "Spe for u" or any ID for this local version.
    return jsonify({'success': True, 'message': 'Login successful'})

# API: Get Data
@app.route('/api/data/<user_id>', methods=['GET'])
def get_data(user_id):
    file_path = os.path.join(DATA_DIR, f"{user_id}.json")
    
    try:
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return jsonify({'success': True, 'data': data})
        else:
            return jsonify({'success': True, 'data': None})
    except Exception as e:
        print(f"Error reading data: {e}")
        return jsonify({'success': False, 'message': 'Internal Server Error'}), 500

# API: Save Data
@app.route('/api/data/<user_id>', methods=['POST'])
def save_data(user_id):
    data = request.json
    file_path = os.path.join(DATA_DIR, f"{user_id}.json")
    
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return jsonify({'success': True, 'message': 'Data saved successfully'})
    except Exception as e:
        print(f"Error writing data: {e}")
        return jsonify({'success': False, 'message': 'Internal Server Error'}), 500

if __name__ == '__main__':
    print(f"Server is running at http://localhost:{PORT}")
    print(f"To share with other computers, use your IP address, e.g., http://192.168.x.x:{PORT}")
    app.run(host='0.0.0.0', port=PORT, debug=True)
