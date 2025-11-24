document.addEventListener("DOMContentLoaded", () => {
    
    /* ========================
       1. GridStack Initialization
       ======================== */
    const grid = GridStack.init({
        float: true,
        cellHeight: 100, // ปรับความสูงของแต่ละแถว
        minRow: 1,
        margin: 8, // ระยะห่างระหว่าง Widget
        column: 12, // จำนวนคอลัมน์มาตรฐาน
        disableOneColumnMode: true // ห้ามเปลี่ยนเป็นคอลัมน์เดียว (เพื่อให้คง Layout)
    });

    // Helper: สร้าง HTML สำหรับ Widget พร้อมปุ่มลบ
    const createWidgetHTML = (title, type) => {
        return `
            <div class="widget-header">
                <span class="widget-title">${title}</span>
                <button class="delete-widget-btn"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="widget-body">
                <span>[${type} Content]</span>
            </div>
        `;
    };

    // Event Delegation: ฟัง event การกดปุ่มลบ (X) จาก container grid-stack
    const gridStackContainer = document.querySelector('.grid-stack');
    gridStackContainer.addEventListener('click', (e) => {
        // เช็คว่ากดโดนปุ่มลบ หรือ icon ข้างในปุ่มลบหรือไม่
        const btn = e.target.closest('.delete-widget-btn');
        if (btn) {
            const widgetItem = btn.closest('.grid-stack-item');
            if (widgetItem) {
                grid.removeWidget(widgetItem);
            }
        }
    });

/* ========================
       2. Add Widget Logic (แก้ไขใหม่)
       ======================== */
    const btnAddWidget = document.getElementById('btnAddWidget');
    const inputWidgetName = document.getElementById('widget-name');
    const inputWidgetType = document.getElementById('widget-type');

    btnAddWidget.addEventListener('click', () => {
        // 1. ดึงค่าชื่อ
        let name = inputWidgetName.value.trim();
        if (name === "") name = "Untitled";

        const type = inputWidgetType.value;

        // 2. เพิ่ม Widget เปล่าๆ ลง Grid (ไม่ต้องใส่ content ในนี้)
        const widgetElement = grid.addWidget({
            w: 3, h: 2 // ขนาดเริ่มต้น
        });

        // 3. เข้าถึง div เนื้อหาข้างใน (.grid-stack-item-content) แล้วยัด HTML เข้าไปเอง
        if (widgetElement) {
            const contentDiv = widgetElement.querySelector('.grid-stack-item-content');
            if (contentDiv) {
                // ใช้ innerHTML เพื่อให้มันแปลงเป็นปุ่มและข้อความ
                contentDiv.innerHTML = createWidgetHTML(name, type);
            }
        }

        // 4. เคลียร์ค่า Input
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
        // รอ Animation จบแล้วให้ Grid คำนวณขนาดใหม่
        setTimeout(() => {
            grid.onResize(); 
        }, 350);
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
    const inputRawData = document.getElementById('sim-rawdata');
    const btnClearRaw = document.getElementById('btnClearRaw');

    // Function: Log ลง Console
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

    // A. Console Input -> Log AND Append to Raw Data
    consoleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const cmd = consoleInput.value.trim();
            if (cmd) {
                // 1. แสดงใน Console Log
                logToConsole(`Command sent: ${cmd}`);
                
                // 2. แสดงใน Raw Data (Sidebar) ตามที่ขอ
                // ถ้ามีข้อมูลอยู่แล้ว ให้ขึ้นบรรทัดใหม่
                if (inputRawData.value !== "") {
                    inputRawData.value += "\n";
                }
                inputRawData.value += `> ${cmd}`;
                
                // 3. เคลียร์ช่อง Console Input
                consoleInput.value = "";
            }
        }
    });

    // B. Clear Raw Data Button
    btnClearRaw.addEventListener('click', () => {
        inputRawData.value = ""; // ล้างข้อมูล
        logToConsole("Raw data cleared."); // แจ้งเตือนใน Console นิดหน่อย
    });

    // C. Connect Simulation
    document.getElementById('btnConnect').addEventListener('click', () => {
        const com = document.getElementById('cfg-com').value;
        const baud = document.getElementById('cfg-baud').value;
        logToConsole(`Connected to ${com} (${baud})`, 'success');
        
        // เพิ่มข้อความลง Raw Data ด้วยเพื่อให้เห็นสถานะ
        inputRawData.value += `[SYSTEM] Connected: ${com} @ ${baud}\n`;
    });
    
    // D. Send Data Simulation
    document.getElementById('btnSend').addEventListener('click', () => {
        const data = inputRawData.value;
        if(data) logToConsole(`Data sent: ${data.substring(0, 20)}...`);
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
            // GridStack อาจต้องปรับขนาดถ้าพื้นที่เปลี่ยน (ในกรณีนี้ไม่กระทบมากแต่ใส่กันเหนียวได้)
        }
    });

});