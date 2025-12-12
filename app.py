import threading
import serial
import time
from flask import Flask, render_template, jsonify
from flask_socketio import SocketIO, emit

app = Flask(__name__, template_folder='.', static_folder='.', static_url_path='')
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*")

# System Variables
ser = None
is_connected = False

# --- Serial Thread ---
def read_from_serial():
    global ser, is_connected
    while is_connected and ser and ser.is_open:
        try:
            if ser.in_waiting > 0:
                # อ่านข้อมูล
                raw_data = ser.readline().decode('utf-8', errors='ignore').strip()
                if raw_data:
                    # ส่งไปให้ Client (Browser) จัดการต่อเอง
                    socketio.emit('serial_data', {'data': raw_data})
            time.sleep(0.01)
        except Exception as e:
            is_connected = False
            socketio.emit('log_message', {'msg': f"Connection Lost: {str(e)}", 'type': 'error'})
            break

@app.route('/')
def index():
    return render_template('index.html')

# --- Socket Events ---
@socketio.on('connect_serial')
def handle_connect_serial(data):
    global ser, is_connected
    port = data.get('port')
    baud = data.get('baud')
    
    emit('log_message', {'msg': f"Connecting to {port}...", 'type': 'normal'})

    try:
        if ser and ser.is_open:
            ser.close()

        ser = serial.Serial(port, int(baud), timeout=1)
        is_connected = True
        
        emit('log_message', {'msg': f"Successfully connected to {port}!", 'type': 'success'})
        
        thread = threading.Thread(target=read_from_serial)
        thread.daemon = True
        thread.start()

    except Exception as e:
        is_connected = False
        emit('log_message', {'msg': f"Connection Failed: {str(e)}", 'type': 'error'})

@socketio.on('send_command')
def handle_send_command(data):
    global ser, is_connected
    cmd = data.get('cmd')
    
    if is_connected and ser and ser.is_open:
        try:
            ser.write((cmd + '\n').encode('utf-8'))
            emit('log_message', {'msg': f"TX: {cmd}", 'type': 'success'}) 
        except Exception as e:
            emit('log_message', {'msg': f"TX Error: {str(e)}", 'type': 'error'})
    else:
        emit('log_message', {'msg': "Error: Not connected to any device.", 'type': 'error'})

if __name__ == '__main__':
    print("Starting Server...")
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)