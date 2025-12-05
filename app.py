import threading
import serial
import time
from flask import Flask, render_template
from flask_socketio import SocketIO, emit

# ตั้งค่า Server
app = Flask(__name__, template_folder='.', static_folder='.', static_url_path='')
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*")

# ตัวแปรเก็บการเชื่อมต่อ Serial
ser = None
is_connected = False

# ฟังก์ชันอ่านข้อมูลจาก Serial (ทำงานอยู่เบื้องหลังตลอดเวลา)
def read_from_serial():
    global ser, is_connected
    while is_connected and ser and ser.is_open:
        try:
            if ser.in_waiting > 0:
                # อ่านข้อมูลแล้วแปลงเป็นตัวหนังสือ
                raw_data = ser.readline().decode('utf-8', errors='ignore').strip()
                
                # ส่งข้อมูลไปที่หน้าจอ (Event ชื่อ 'serial_data')
                socketio.emit('serial_data', {'data': raw_data})
                
            time.sleep(0.01) # พักนิดนึงไม่ให้กิน CPU เกินไป
        except Exception as e:
            print(f"Error reading: {e}")
            is_connected = False
            socketio.emit('log_message', {'msg': f"Error: {str(e)}", 'type': 'error'})

# 1. หน้าแรก (โหลด index.html)
@app.route('/')
def index():
    return render_template('index.html')

# 2. รับคำสั่ง Connect จากหน้าจอ (Frontend)
@socketio.on('connect_serial')
def handle_connect_serial(data):
    global ser, is_connected
    port = data.get('port')
    baud = data.get('baud')
    
    # แจ้งหน้าจอก่อนว่ากำลังพยายามเชื่อมต่อ
    emit('log_message', {'msg': f"Connecting to {port} at {baud}...", 'type': 'normal'})

    try:
        # ปิดอันเก่าถ้าเปิดค้างไว้
        if ser and ser.is_open:
            ser.close()

        # เชื่อมต่อ Serial จริงๆ ตรงนี้
        ser = serial.Serial(port, int(baud), timeout=1)
        is_connected = True
        
        # ส่งข้อความความสำเร็จกลับไปหน้าจอ
        emit('log_message', {'msg': f"Successfully connected to {port}!", 'type': 'success'})
        
        # เริ่มทำงานเบื้องหลังเพื่ออ่านข้อมูลทันที
        thread = threading.Thread(target=read_from_serial)
        thread.daemon = True
        thread.start()

    except Exception as e:
        is_connected = False
        emit('log_message', {'msg': f"Connection Failed: {str(e)}", 'type': 'error'})

# รัน Server
if __name__ == '__main__':
    print("Starting Server...")
    socketio.run(app, debug=True, port=5000)