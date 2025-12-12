import threading
import serial
import time
import sqlite3
import datetime
import os
import json
from flask import Flask, render_template, jsonify, request
from flask_socketio import SocketIO, emit

# Tkinter Setup (Still needed for DB browsing on server)
try:
    import tkinter as tk
    from tkinter import filedialog
    HAS_TK = True
except ImportError:
    HAS_TK = False

app = Flask(__name__, template_folder='.', static_folder='.', static_url_path='')
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*")

# System Variables
ser = None
is_connected = False
db_path = None
db_conn = None
is_recording = False

# --- Database ---
def init_db(path):
    global db_conn
    try:
        if db_conn:
            db_conn.close()
        db_conn = sqlite3.connect(path, check_same_thread=False)
        cursor = db_conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS telemetry_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                raw_data TEXT
            )
        ''')
        db_conn.commit()
        return True
    except Exception as e:
        print(f"DB Init Error: {e}")
        return False

def save_to_db(data):
    global db_conn, is_recording
    if is_recording and db_conn:
        try:
            cursor = db_conn.cursor()
            cursor.execute('INSERT INTO telemetry_logs (raw_data) VALUES (?)', (data,))
            db_conn.commit()
        except Exception as e:
            print(f"DB Save Error: {e}")

# --- Serial Thread ---
def read_from_serial():
    global ser, is_connected
    while is_connected and ser and ser.is_open:
        try:
            if ser.in_waiting > 0:
                raw_data = ser.readline().decode('utf-8', errors='ignore').strip()
                if raw_data:
                    socketio.emit('serial_data', {'data': raw_data})
                    save_to_db(raw_data)
            time.sleep(0.01)
        except Exception as e:
            is_connected = False
            socketio.emit('log_message', {'msg': f"Connection Lost: {str(e)}", 'type': 'error'})
            break

@app.route('/')
def index():
    return render_template('index.html')

# --- DB Browse (Server-Side) ---
@app.route('/browse_db_path')
def browse_db_path():
    if not HAS_TK: return jsonify({'success': False, 'msg': 'Server UI not supported'})
    try:
        root = tk.Tk()
        root.withdraw()
        root.wm_attributes('-topmost', 1)
        
        file_path = filedialog.asksaveasfilename(
            title="Select or Create SQLite Database",
            defaultextension=".sqlite",
            confirmoverwrite=False, 
            filetypes=[("SQLite Database", "*.sqlite"), ("All Files", "*.*")]
        )
        root.destroy()
        return jsonify({'success': True, 'path': file_path}) if file_path else jsonify({'success': False, 'msg': 'Cancelled'})
    except Exception as e:
        return jsonify({'success': False, 'msg': str(e)})

# --- Socket Events ---
@socketio.on('connect_serial')
def handle_connect_serial(data):
    global ser, is_connected
    port = data.get('port')
    baud = data.get('baud')
    emit('log_message', {'msg': f"Connecting to {port}...", 'type': 'normal'})
    try:
        if ser and ser.is_open: ser.close()
        ser = serial.Serial(port, int(baud), timeout=1)
        is_connected = True
        emit('log_message', {'msg': f"Connected to {port}", 'type': 'success'})
        threading.Thread(target=read_from_serial, daemon=True).start()
    except Exception as e:
        is_connected = False
        emit('log_message', {'msg': f"Connection Failed: {str(e)}", 'type': 'error'})

@socketio.on('send_command')
def handle_send_command(data):
    global ser
    if is_connected and ser:
        try:
            ser.write((data.get('cmd') + '\n').encode('utf-8'))
            emit('log_message', {'msg': f"TX: {data.get('cmd')}", 'type': 'success'})
        except Exception as e:
            emit('log_message', {'msg': f"TX Error: {e}", 'type': 'error'})

@socketio.on('connect_db')
def handle_connect_db(data):
    global db_path, is_recording
    path = data.get('path')
    if path and init_db(path):
        db_path = path
        is_recording = True
        emit('log_message', {'msg': f"Recording to: {os.path.basename(path)}", 'type': 'success'})
        emit('db_status', {'recording': True, 'path': path})
    else:
        emit('log_message', {'msg': "Database connection failed", 'type': 'error'})

@socketio.on('stop_db')
def handle_stop_db():
    global is_recording, db_conn
    is_recording = False
    if db_conn:
        db_conn.close()
        db_conn = None
    emit('log_message', {'msg': "Recording Stopped. Database closed.", 'type': 'normal'})
    emit('db_status', {'recording': False})

if __name__ == '__main__':
    print("Starting Server...")
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)