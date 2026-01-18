import os
import json
import sys
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room

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
socketio = SocketIO(app, cors_allowed_origins="*")

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

# WebSocket Events
@socketio.on('join')
def on_join(data):
    user_id = data.get('userId')
    if user_id:
        join_room(user_id)
        print(f"Client joined room: {user_id}")
        emit('status', {'msg': f'Joined room {user_id}'}, room=user_id)

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
    req_data = request.json
    
    # Check if this is a legacy request (direct data) or enveloped request ({data: ..., lastSyncedTimestamp: ...})
    if 'data' in req_data and 'lastSyncedTimestamp' in req_data:
        new_data = req_data['data']
        client_timestamp = req_data['lastSyncedTimestamp']
        force_save = req_data.get('force', False)
    else:
        # Backward compatibility or simple save
        new_data = req_data
        client_timestamp = None
        force_save = True # Assume force for legacy calls to avoid breaking changes immediately

    file_path = os.path.join(DATA_DIR, f"{user_id}.json")
    
    try:
        # Check for conflicts if not forcing
        if not force_save and os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as f:
                existing_file_content = json.load(f)
            
            # Extract timestamp from existing data
            existing_timestamp = existing_file_content.get('timestamp')
            
            if str(existing_timestamp) != str(client_timestamp):
                print(f"Conflict detected for {user_id}. Server: {existing_timestamp}, Client saw: {client_timestamp}")
                return jsonify({
                    'success': False, 
                    'message': 'Data conflict detected. Please reload.',
                    'serverData': existing_file_content
                }), 409

        # Write new data
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(new_data, f, ensure_ascii=False, indent=2)
        
        # Broadcast update to room
        try:
            # We broadcast the new timestamp so clients know there is a new version
            # We don't broadcast full data (efficiency), just notification
            socketio.emit('data_updated', {
                'timestamp': new_data.get('timestamp'),
                'updater': request.remote_addr  # Optional: who updated?
            }, room=user_id)
            print(f"Broadcasted update for room {user_id}")
        except Exception as e:
            print(f"Socket emit failed: {e}")

        return jsonify({'success': True, 'message': 'Data saved successfully'})
    except Exception as e:
        print(f"Error writing data: {e}")
        return jsonify({'success': False, 'message': 'Internal Server Error'}), 500

if __name__ == '__main__':
    print(f"Server is running at http://localhost:{PORT}")
    print(f"To share with other computers, use your IP address, e.g., http://192.168.x.x:{PORT}")
    # app.run(host='0.0.0.0', port=PORT, debug=True)
    socketio.run(app, host='0.0.0.0', port=PORT, debug=True, allow_unsafe_werkzeug=True)
