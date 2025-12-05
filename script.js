document.addEventListener("DOMContentLoaded", () => {

    const widgetInstances = {};
    
    /* ========================
       1. GridStack Init (Fix Drag Handle)
       ======================== */
    const grid = GridStack.init({
        float: true,
        cellHeight: 100,
        minRow: 1,
        margin: 8,
        column: 12,
        disableOneColumnMode: true,
        // 🔑 KEY: กำหนดให้ลากได้เฉพาะ class .widget-header เท่านั้น
        draggable: {
            handle: '.widget-header',
            scroll: true,
            appendTo: 'body'
        }
    });

    /* ========================
       2. Data & Helper
       ======================== */
    // ตัวแปรเก็บ Widget ที่กำลัง Edit อยู่ปัจจุบัน
    let currentEditingWidget = null;

    // Helper: สร้าง HTML สำหรับ Widget
    // เปลี่ยนปุ่ม Delete (X) เป็นปุ่ม Settings (Gear)
    const createWidgetHTML = (title, type, idVal = "", formatVal = "") => {
        return `
            <div class="widget-header">
                <span class="widget-title">${title}</span>
                <button class="widget-settings-btn"><i class="fa-solid fa-gear"></i></button>
            </div>
            <div class="widget-body" data-type="${type}" data-index="${idVal}" data-format="${formatVal}">
                <div class="content-area" style="width:100%; height:100%; display:flex; justify-content:center; align-items:center;">
                    NaN
                </div>
                <div class="widget-index-label">ID: ${idVal}</div>
            </div>
        `;
    };

    /* ========================
       3. Modal Logic
       ======================== */
    const modalOverlay = document.getElementById('settingModalOverlay');
    const modalContent = document.getElementById('settingModalContent');
    const inputName = document.getElementById('modalWidgetName');
    const inputId = document.getElementById('modalWidgetId');
    const selectType = document.getElementById('modalWidgetType');
    const inputFormat = document.getElementById('modalWidgetFormat');
    const btnEditName = document.getElementById('btnEditName');

    // --- Function: Open Modal ---
    function openModal(widgetElement) {
        currentEditingWidget = widgetElement;
        
        const header = widgetElement.querySelector('.widget-title');
        const body = widgetElement.querySelector('.widget-body');
        
        inputName.value = header.innerText;
        // inputId.value = body.dataset.id || ""; <-- ลบอันเก่า
        inputId.value = body.dataset.index || "0"; // <-- ดึงค่า index มาโชว์ (ถ้าไม่มีให้เป็น 0)
        selectType.value = body.dataset.type || "Text";
        inputFormat.value = body.dataset.format || ""; 

        modalOverlay.classList.add('active');
    }

    // --- Function: Close & Save Modal ---
    function closeModal() {
        if (currentEditingWidget) {
            const header = currentEditingWidget.querySelector('.widget-title');
            const body = currentEditingWidget.querySelector('.widget-body');

            // 1. อัปเดตชื่อหัวข้อ
            header.innerText = inputName.value;
            
            // 2. อัปเดตค่าที่ซ่อนไว้ (เปลี่ยนจาก id เป็น index ตามที่คุณต้องการ)
            // body.dataset.id = inputId.value;  <-- ลบบรรทัดเดิมนี้
            body.dataset.index = inputId.value; // <-- ใช้อันนี้แทน (เก็บ Index)
            body.dataset.type = selectType.value;
            body.dataset.format = inputFormat.value;

            // 3. แสดงผลชั่วคราว (Preview)
            // ถ้ายังไม่มีข้อมูลจริง ให้โชว์ Format หรือคำว่า Waiting...
            body.innerHTML = `
                <div class="content-area" style="width:100%; height:100%; display:flex; justify-content:center; align-items:center;">
                    Waiting...
                </div>
                <div class="widget-index-label">ID: ${inputId.value}</div>
            `;
        }

        modalOverlay.classList.remove('active');
        currentEditingWidget = null;
    }

    // Event: กดปุ่ม Setting บน Widget เพื่อเปิด Modal
    // ใช้ Delegation เพราะ Widget ถูกสร้างใหม่ได้ตลอด
    const gridStackContainer = document.querySelector('.grid-stack');
    gridStackContainer.addEventListener('click', (e) => {
        // เช็คว่ากดโดนปุ่ม Gear หรือ icon ข้างใน
        const btn = e.target.closest('.widget-settings-btn');
        if (btn) {
            const widgetItem = btn.closest('.grid-stack-item');
            if (widgetItem) {
                openModal(widgetItem);
            }
        }
    });

    // Event: ปุ่ม Close (X) ใน Modal
    document.getElementById('btnCloseModal').addEventListener('click', closeModal);

    // Event: กดพื้นหลัง Overlay เพื่อปิด
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });

    // Event: ปุ่ม Edit Name (ดินสอ)
    btnEditName.addEventListener('click', () => {
        // 1. ปลดล็อก Input
        inputName.removeAttribute('readonly');
        inputName.classList.add('editable');
        
        // 2. เอา Cursor ไปวางแล้วเลือกข้อความทั้งหมดให้เลย (สะดวกต่อการแก้)
        inputName.focus();
        inputName.select(); 
    });

    // Event: เมื่อกด Enter หรือ คลิกออกจากช่องชื่อ (Blur) -> ให้กลับเป็น Text ปกติ
    const finishEditingName = () => {
        inputName.setAttribute('readonly', true); // ล็อกกลับ
        inputName.classList.remove('editable'); // เอาเส้นขีดออก
        inputName.blur(); // เอา focus ออก
    };

    inputName.addEventListener('keydown', (e) => {
        if(e.key === 'Enter') {
            finishEditingName();
        }
    });
    
    // เพิ่ม: ถ้าคลิกเมาส์ที่อื่น ก็ให้เซฟเหมือนกัน
    inputName.addEventListener('blur', () => {
        finishEditingName();
    });

    // Event: กด Enter ในช่องชื่อ -> ให้เบลอออก (เหมือนเซฟ)
    inputName.addEventListener('keydown', (e) => {
        if(e.key === 'Enter') inputName.blur();
    });

    /* ========================
       4. Delete Logic (Move inside Modal)
       ======================== */
    const btnDeleteWidget = document.getElementById('btnDeleteWidget');
    btnDeleteWidget.addEventListener('click', () => {
        if (currentEditingWidget) {
            // ลบ Widget ออกจาก Grid
            grid.removeWidget(currentEditingWidget);
            // ปิด Modal
            closeModal(); 
            // Reset ตัวแปรเพื่อความชัวร์
            currentEditingWidget = null;
        }
    });

    /* ========================
       5. Add Widget (Updated)
       ======================== */
    const btnAddWidget = document.getElementById('btnAddWidget');
    const inputWidgetName = document.getElementById('widget-name');
    const inputWidgetType = document.getElementById('widget-type');

    btnAddWidget.addEventListener('click', () => {
        let name = inputWidgetName.value.trim();
        if (name === "") name = "Untitled";
        const type = inputWidgetType.value;

        // สร้าง Widget
        const widgetElement = grid.addWidget({ w: 3, h: 2 });

        if (widgetElement) {
            const contentDiv = widgetElement.querySelector('.grid-stack-item-content');
            if (contentDiv) {
                // ใส่ HTML โครงสร้างใหม่ (มีปุ่ม Setting แทนปุ่ม X)
                contentDiv.innerHTML = createWidgetHTML(name, type);
            }
        }
        inputWidgetName.value = "";
    });

    /* ========================
       3. Sidebar & Layout
       ======================== */
    const btnToggle = document.getElementById('btnToggleSidebar');
    const appContainer = document.getElementById('appContainer');

    // Toggle Sidebar
    btnToggle.addEventListener('click', () => {
        appContainer.classList.toggle('sidebar-closed');
        setTimeout(() => grid.onResize(), 350);
    });

    // Accordion Logic
    window.toggleSection = function(header) {
        const wrapper = header.nextElementSibling;
        header.classList.toggle('active');
        wrapper.classList.toggle('open');
    }

    /* ========================
       4. Console & Raw Data Logic
       ======================== */
    const consoleOutput = document.getElementById('consoleOutput');
    const consoleInput = document.getElementById('consoleInput');
    const simInput = document.getElementById('sim-input'); // ช่อง Data to Simulate
    const btnClearConsole = document.getElementById('btnClearConsole'); // ปุ่ม Clear ที่ย้ายมา Console

    function logToConsole(message, type = 'normal') {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('th-TH', { hour12: false });
        const line = document.createElement('div');
        line.className = 'log-line';
        
        let msgColorClass = 'log-msg';
        if(type === 'success') msgColorClass = 'log-info';
        
        line.innerHTML = `<span class="timestamp">[${timeStr}]</span><span class="${msgColorClass}">${message}</span>`;
        consoleOutput.appendChild(line);
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }

    // A. Console Command Input (Uplink)
    consoleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const cmd = consoleInput.value.trim();
            if (cmd) {
                // แสดงเฉพาะใน Console Log (Raw Data Display) ไม่ไปยุ่งกับช่อง Simulator
                logToConsole(`> ${cmd}`);
                consoleInput.value = ""; // Clear Command Input
            }
        }
    });

    // B. Clear Console Button (ที่ Console Header)
    btnClearConsole.addEventListener('click', () => {
        consoleOutput.innerHTML = ''; // ล้างหน้าจอ Log
    });

    /* ========================
       ส่วนเสริม: เชื่อมต่อกับ Backend (Python)
       วางไว้ก่อนส่วน C หรือบนสุดของไฟล์ก็ได้ครับ
       ======================== */
    const socket = io(); // เปิดท่อคุยกับ Python

    // 1. รอฟังข่าวดี/ข่าวร้าย จาก Python (Log Message)
    socket.on('log_message', (data) => {
        // data.msg คือข้อความ, data.type คือสี (success/error)
        logToConsole(data.msg, data.type);
    });

    function formatValue(value, formatStr) {
        if (!formatStr) return value;
        return formatStr.replace(/\{.*?\}/g, value); 
    }

    function updateDashboard(dataString) {
        // แปลง "10,20,30" -> ["10", "20", "30"]
        const dataArray = dataString.split(',').map(s => s.trim());
        const widgets = document.querySelectorAll('.widget-body');

        widgets.forEach(widget => {
            const index = parseInt(widget.dataset.index);
            const type = widget.dataset.type;
            const format = widget.dataset.format;
            const contentArea = widget.querySelector('.content-area');
            
            // สร้าง ID ให้ Widget (ถ้ายังไม่มี)
            if (!widget.id) widget.id = 'w-' + Math.random().toString(36).substr(2, 9);
            const wId = widget.id;

            // ดึงค่าตาม Index
            let value = "NaN";
            if (!isNaN(index) && dataArray[index] !== undefined) {
                value = dataArray[index];
            }

            // แยกการทำงานตามประเภท
            switch (type) {
                case 'Text':
                    contentArea.innerHTML = formatValue(value, format);
                    break;

                case 'Graph':
                    // สร้างกราฟครั้งแรก
                    if (!widgetInstances[wId]) {
                        contentArea.innerHTML = '<canvas></canvas>';
                        const ctx = contentArea.querySelector('canvas').getContext('2d');
                        widgetInstances[wId] = new Chart(ctx, {
                            type: 'line',
                            data: {
                                labels: [],
                                datasets: [{
                                    label: 'Data',
                                    data: [],
                                    borderColor: '#38bdf8', // สีฟ้า
                                    tension: 0.3,
                                    borderWidth: 2,
                                    pointRadius: 0
                                }]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                animation: false, // ปิด Animation เพื่อความลื่น
                                scales: {
                                    x: { display: false }, // ซ่อนแกน X
                                    y: { 
                                        grid: { color: 'rgba(255,255,255,0.1)' },
                                        ticks: { color: '#fff' }
                                    }
                                },
                                plugins: { legend: { display: false } }
                            }
                        });
                    }
                    
                    // อัปเดตข้อมูลกราฟ
                    const chart = widgetInstances[wId];
                    if (value !== "NaN") {
                        const now = new Date().toLocaleTimeString();
                        chart.data.labels.push(now);
                        chart.data.datasets[0].data.push(parseFloat(value));
                        
                        // จำกัดจำนวนจุด (ไม่ให้เกิน 20 จุด)
                        if (chart.data.labels.length > 20) {
                            chart.data.labels.shift();
                            chart.data.datasets[0].data.shift();
                        }
                        chart.update();
                    }
                    break;

                case 'Map':
                    // Map ใช้ข้อมูล 2 ตัว: Index (Lat) และ Index+1 (Long)
                    const lat = parseFloat(dataArray[index]);
                    const lng = parseFloat(dataArray[index + 1]);

                    // สร้างแผนที่ครั้งแรก
                    if (!widgetInstances[wId]) {
                        contentArea.innerHTML = '<div class="map-container" style="height:100%; width:100%;"></div>';
                        const mapDiv = contentArea.querySelector('.map-container');
                        
                        const map = L.map(mapDiv).setView([13.7563, 100.5018], 10);
                        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                            attribution: '©OpenStreetMap'
                        }).addTo(map);
                        
                        const marker = L.marker([13.7563, 100.5018]).addTo(map);
                        widgetInstances[wId] = { map, marker };
                        
                        // แก้บั๊กแผนที่แสดงผลไม่เต็ม
                        setTimeout(() => map.invalidateSize(), 500);
                    }

                    // อัปเดตตำแหน่ง Marker
                    const mapObj = widgetInstances[wId];
                    if (!isNaN(lat) && !isNaN(lng)) {
                        const newLatLng = new L.LatLng(lat, lng);
                        mapObj.marker.setLatLng(newLatLng);
                        mapObj.map.panTo(newLatLng); // เลื่อนตามแบบไม่เปลี่ยน Zoom
                    }
                    break;

                case 'Table':
                    // สร้างตารางแสดงข้อมูลทั้งหมด
                    let tableHTML = `<table class="data-table" style="width:100%;">
                                        <thead><tr><th>Idx</th><th>Value</th></tr></thead>
                                        <tbody>`;
                    
                    dataArray.forEach((val, idx) => {
                        // ไฮไลท์แถวที่ตรงกับ Index ที่เลือก
                        const highlight = (idx === index) ? 'background:rgba(56, 189, 248, 0.2);' : '';
                        tableHTML += `<tr style="${highlight}">
                                        <td>${idx}</td>
                                        <td style="color:#38bdf8;">${val}</td>
                                      </tr>`;
                    });
                    tableHTML += `</tbody></table>`;
                    
                    contentArea.innerHTML = `<div style="overflow-y:auto; max-height:100%; width:100%;">${tableHTML}</div>`;
                    break;
            }
        });
    }

    // เมื่อได้รับข้อมูลจาก Python (ทั้งจาก ESP32 จริง และ Simulator)
    socket.on('serial_data', (packet) => {
        logToConsole(`RX: ${packet.data}`); // โชว์ Log เหมือนเดิม
        updateDashboard(packet.data);       // **เรียกฟังก์ชันอัปเดตหน้าจอ!**
    });


    /* ========================
       C. Connect Logic (แบบใช้งานจริง)
       ======================== */
    const btnConnect = document.getElementById('btnConnect');
    const cfgCom = document.getElementById('cfg-com');
    const cfgBaud = document.getElementById('cfg-baud');
    const cfgFormat = document.getElementById('cfg-format');

    btnConnect.addEventListener('click', () => {
        const com = cfgCom.value;
        const baud = cfgBaud.value;
        // const format = cfgFormat.value; // เก็บไว้ใช้ตอน parse ข้อมูล

        // แทนที่จะ Log เอง เราส่งไปให้ Python ทำงานครับ
        socket.emit('connect_serial', { port: com, baud: baud });

        // เคลียร์ค่า Input ตามที่คุณต้องการ (เหมือน Add Widget)
        cfgCom.value = "";
        cfgBaud.value = "";
        // cfgFormat.selectedIndex = 0; 
    });
    
    /* ========================
       D. Simulator Send Data Logic (แบบใช้งานจริง)
       ======================== */
    document.getElementById('btnSend').addEventListener('click', () => {
        const data = simInput.value; // ดึงจากช่อง Sim Input
        
        if(data.trim() !== "") {
            // 1. จำลองว่ามีข้อมูลเข้ามา (เรียกใช้ Logic เดียวกับของจริง)
            // ทำแบบนี้ ข้อมูลจาก Sim จะไปโผล่ที่กราฟได้เหมือนของจริงเลยครับ
            logToConsole(`RX (Sim): ${data}`);

            updateDashboard(data);
            
            // 2. เคลียร์ค่า Sim Input 
            simInput.value = "";
            document.getElementById('sim-input').value = "";
        }
    });

    /* ========================
       5. Console Resizer
       ======================== */
    const consoleResizer = document.getElementById('consoleResizer');
    let isResizingConsole = false;

    consoleResizer.addEventListener('mousedown', (e) => {
        isResizingConsole = true;
        document.body.style.cursor = 'row-resize';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizingConsole) return;
        const containerHeight = document.body.clientHeight;
        let newHeight = containerHeight - e.clientY;
        if (newHeight < 100) newHeight = 100;
        if (newHeight > 600) newHeight = 600;
        document.documentElement.style.setProperty('--console-height', newHeight + 'px');
    });

    document.addEventListener('mouseup', () => {
        if (isResizingConsole) {
            isResizingConsole = false;
            document.body.style.cursor = 'default';
        }
    });
});