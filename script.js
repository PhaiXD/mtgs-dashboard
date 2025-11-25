document.addEventListener("DOMContentLoaded", () => {
    
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
                <span class="widget-title" data-name="${title}">${title}</span>
                <button class="widget-settings-btn"><i class="fa-solid fa-gear"></i></button>
            </div>
            <div class="widget-body" data-type="${type}" data-id="${idVal}" data-format="${formatVal}">
                <span>[${type}]<br>${formatVal || "No Format"}</span> 
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
        
        // 1. ดึงค่าจาก Widget ปัจจุบันมาใส่ใน Modal
        const header = widgetElement.querySelector('.widget-title');
        const body = widgetElement.querySelector('.widget-body');
        
        // ดึงค่าจาก HTML หรือ Attribute (ในที่นี้ดึงจาก Attribute ที่เราแอบแปะไว้ หรือ textContent)
        inputName.value = header.innerText; // ชื่อ
        inputId.value = body.dataset.id || ""; // ID (ถ้าเคยเซฟไว้)
        selectType.value = body.dataset.type || "Text"; // Type
        inputFormat.value = body.dataset.format || ""; // Format

        // 2. แสดง Modal (Animation)
        modalOverlay.classList.add('active');
    }

    // --- Function: Close & Save Modal ---
    function closeModal() {
        if (currentEditingWidget) {
            // Save Changes กลับไปที่ Widget ทันทีที่ปิด (หรือจะทำปุ่ม Save แยกก็ได้)
            const header = currentEditingWidget.querySelector('.widget-title');
            const body = currentEditingWidget.querySelector('.widget-body');

            // อัปเดต UI หน้า Dashboard
            header.innerText = inputName.value;
            
            // อัปเดต Data Attribute เพื่อจำค่าไว้เปิดครั้งหน้า
            body.dataset.id = inputId.value;
            body.dataset.type = selectType.value;
            body.dataset.format = inputFormat.value;

            // อัปเดตการแสดงผลใน Body ของการ์ด (ตัวอย่าง)
            body.innerHTML = `<span>[${selectType.value}]<br>${inputFormat.value || inputId.value || "No Data"}</span>`;
        }

        // ซ่อน Modal
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

    // C. Connect Logic (Config)
    const btnConnect = document.getElementById('btnConnect');
    const cfgCom = document.getElementById('cfg-com');
    const cfgBaud = document.getElementById('cfg-baud');
    const cfgFormat = document.getElementById('cfg-format');

    btnConnect.addEventListener('click', () => {
        const com = cfgCom.value;
        const baud = cfgBaud.value;
        const format = cfgFormat.value;

        // 1. Log ครบทุกค่า (COM, Baud, Format)
        logToConsole(`Connected to <b>${com}</b> @ <b>${baud}</b> baud (Format: <b>${format}</b>)`, 'success');
        
        // 2. เคลียร์ค่า Input ใน Config (ตามที่ขอ "เหมือน add widget")
        cfgCom.value = "";
        cfgBaud.value = "";
        // format อาจจะไม่ต้องเคลียร์เพราะเป็น select แต่ถ้าอยากให้ reset ก็ทำได้:
        // cfgFormat.selectedIndex = 0; 
    });
    
    // D. Simulator Send Data Logic
    document.getElementById('btnSend').addEventListener('click', () => {
        const data = simInput.value; // ดึงจากช่อง Sim Input
        if(data.trim() !== "") {
            // 1. ส่งข้อมูลไปแสดงที่ Console Log (เสมือนรับ Data เข้ามา)
            logToConsole(`RX: ${data}`); 
            
            // 2. เคลียร์ค่า Sim Input (เพื่อให้พร้อมกรอกค่าใหม่)
            simInput.value = ""; 
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