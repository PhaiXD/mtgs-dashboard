document.addEventListener("DOMContentLoaded", () => {
    
    // --- 1. Init ---
    const widgetInstances = {}; 
    const grid = GridStack.init({
        float: true, cellHeight: 100, minRow: 1, margin: 8, column: 12, disableOneColumnMode: true,
        draggable: { handle: '.widget-header', scroll: true, appendTo: 'body' }
    });

    const socket = io(); 

    // --- 2. Widget HTML Generator ---
    const createWidgetHTML = (title, type, config = {}) => {
        const configStr = JSON.stringify(config);
        let label = "ID: -";
        if(config.indexes && config.indexes.length > 0) label = `ID: ${config.indexes.join(',')}`;

        return `
            <div class="widget-header">
                <span class="widget-title">${title}</span>
                <button class="widget-settings-btn"><i class="fa-solid fa-gear"></i></button>
            </div>
            <div class="widget-body" data-type="${type}" data-config='${configStr}'>
                <div class="content-area" style="width:100%; height:100%; display:flex; justify-content:center; align-items:center;">NaN</div>
                <div class="widget-index-label">${label}</div>
            </div>
        `;
    };

    // --- 3. MODAL LOGIC & DYNAMIC INPUTS ---
    const modalOverlay = document.getElementById('settingModalOverlay');
    const dynamicArea = document.getElementById('modal-dynamic-inputs');
    const inputName = document.getElementById('modalWidgetName');
    const selectType = document.getElementById('modalWidgetType');
    let currentEditingWidget = null;

    function renderModalInputs(type, currentConfig = {}) {
        dynamicArea.innerHTML = "";
        
        if (!currentConfig.indexes) currentConfig.indexes = ["0"];
        if (!currentConfig.format) currentConfig.format = "{0}";
        if (!currentConfig.maxPoints) currentConfig.maxPoints = 20; // Default 20

        // --- TYPE: TEXT ---
        if (type === 'Text') {
            dynamicArea.innerHTML += `
                <div class="form-group-stack">
                    <label style="color:#aaa; font-size:0.8rem;">Data Format</label>
                    <span class="helper-text">Format: {0} for first index. Use \\n for newline.</span>
                    <input type="text" id="inp-format" value="${currentConfig.format}" placeholder="Temp: {0} C">
                </div>
                <label style="color:#aaa; font-size:0.8rem; display:block; margin-top:10px;">Data Indexes</label>
                <div id="index-container"></div>
                <button class="btn-add-row" onclick="addIndexRow()">+ Add Index</button>
            `;
            const container = document.getElementById('index-container');
            currentConfig.indexes.forEach(val => addIndexRow(val, container));
        } 
        // --- TYPE: GRAPH ---
        else if (type === 'Graph') {
            const idxY = currentConfig.indexes[1] || currentConfig.indexes[0] || "0"; 
            dynamicArea.innerHTML += `
                <div class="form-group-stack">
                    <label style="color:#aaa; font-size:0.8rem;">Data Index (Y-Axis)</label>
                    <span style="font-size:0.75rem; color:#666; font-style:italic;">X-Axis is Time.</span>
                    <input type="number" id="inp-y" value="${idxY}" placeholder="0">
                </div>
                <!-- 4. เพิ่มช่องตั้งค่า Max Points -->
                <div class="form-group-stack">
                    <label style="color:#aaa; font-size:0.8rem;">Max Data Points</label>
                    <input type="number" id="inp-max-points" value="${currentConfig.maxPoints}" placeholder="20">
                </div>
            `;
        }
        // --- TYPE: MAP ---
        else if (type === 'Map') {
            const lat = currentConfig.indexes[0] || "0";
            const lng = currentConfig.indexes[1] || "1";
            dynamicArea.innerHTML += `
                <div class="dynamic-row"><label style="width:50px; font-size:0.8rem;">Lat:</label> <input type="number" id="inp-lat" value="${lat}"></div>
                <div class="dynamic-row"><label style="width:50px; font-size:0.8rem;">Lng:</label> <input type="number" id="inp-lng" value="${lng}"></div>
            `;
        }
        // --- TYPE: TABLE ---
        else if (type === 'Table') {
            dynamicArea.innerHTML += `
                <div id="table-rows-container"></div>
                <button class="btn-add-row" onclick="addTableRow()">+ Add Row</button>
            `;
            const container = document.getElementById('table-rows-container');
            if(!currentConfig.tableRows) currentConfig.tableRows = [{label: "Data", idx: "0"}];
            currentConfig.tableRows.forEach(row => addTableRow(row.label, row.idx, container));
        }
    }

    // Helper: Add Index Row
    window.addIndexRow = (value = "0", targetContainer = null) => {
        const container = targetContainer || document.getElementById('index-container');
        const div = document.createElement('div');
        div.className = 'dynamic-row';
        div.innerHTML = `
            <input type="number" class="inp-multi-index" value="${value}" placeholder="idx">
            <button class="btn-icon-sm" onclick="this.parentElement.remove()" title="Remove">
                <i class="fa-solid fa-minus"></i>
            </button>
        `;
        container.appendChild(div);
    }
    // Helper: Add Table Row
    window.addTableRow = (label = "Data", idx = "0", targetContainer = null) => {
        const container = targetContainer || document.getElementById('table-rows-container');
        const div = document.createElement('div');
        div.className = 'dynamic-row';
        div.innerHTML = `
            <input type="text" class="inp-table-label" value="${label}" placeholder="Label">
            <input type="number" class="inp-table-index" value="${idx}" placeholder="Idx" style="width:80px;">
            <button class="btn-icon-sm" onclick="this.parentElement.remove()" title="Remove">
                <i class="fa-solid fa-minus"></i>
            </button>
        `;
        container.appendChild(div);
    }

    // Open Modal
    window.openModal = function(widgetElement) {
        currentEditingWidget = widgetElement;
        const header = widgetElement.querySelector('.widget-title');
        const body = widgetElement.querySelector('.widget-body');
        
        inputName.value = header.innerText;
        const type = body.dataset.type;
        selectType.value = type;
        
        let config = {};
        try { config = JSON.parse(body.dataset.config || '{}'); } catch(e) {}
        
        renderModalInputs(type, config);
        modalOverlay.classList.add('active');
    }

    // Close & Save Modal
    function closeModal() {
        if (currentEditingWidget) {
            const header = currentEditingWidget.querySelector('.widget-title');
            const body = currentEditingWidget.querySelector('.widget-body');
            const type = selectType.value;

            const newConfig = { indexes: [] };

            if (type === 'Text') {
                const fmt = document.getElementById('inp-format');
                if(fmt) newConfig.format = fmt.value;
                document.querySelectorAll('.inp-multi-index').forEach(inp => newConfig.indexes.push(inp.value));
            } 
            else if (type === 'Graph') {
                const y = document.getElementById('inp-y');
                const max = document.getElementById('inp-max-points');
                newConfig.indexes.push('time'); 
                if(y) newConfig.indexes.push(y.value);
                // Save Max Points
                if(max) newConfig.maxPoints = parseInt(max.value) || 20;
            } 
            else if (type === 'Map') {
                const lat = document.getElementById('inp-lat');
                const lng = document.getElementById('inp-lng');
                if(lat) newConfig.indexes.push(lat.value);
                if(lng) newConfig.indexes.push(lng.value);
            } 
            else if (type === 'Table') {
                newConfig.tableRows = [];
                const labels = document.querySelectorAll('.inp-table-label');
                const idxs = document.querySelectorAll('.inp-table-index');
                labels.forEach((lbl, i) => {
                    newConfig.tableRows.push({ label: lbl.value, idx: idxs[i].value });
                    newConfig.indexes.push(idxs[i].value);
                });
            }

            // Save
            header.innerText = inputName.value;
            body.dataset.type = type;
            body.dataset.config = JSON.stringify(newConfig);

            // Re-render UI
            let label = "ID: -";
            if(newConfig.indexes.length > 0) label = `ID: ${newConfig.indexes.join(',')}`;
            body.innerHTML = `<div class="content-area" style="width:100%; height:100%; display:flex; justify-content:center; align-items:center;">Waiting...</div><div class="widget-index-label">${label}</div>`;

            // Clear Old Instances
            const wId = body.getAttribute('id') || Date.now().toString();
            body.setAttribute('id', wId);
            if(widgetInstances[wId]) {
                 if(widgetInstances[wId].destroy) widgetInstances[wId].destroy();
                 if(widgetInstances[wId].remove) widgetInstances[wId].remove(); // for map
                 delete widgetInstances[wId];
            }
        }
        modalOverlay.classList.remove('active');
        currentEditingWidget = null;
    }

    // Events
    document.getElementById('btnCloseModal').addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });
    selectType.addEventListener('change', () => renderModalInputs(selectType.value, {}));
    document.getElementById('btnDeleteWidget').addEventListener('click', () => {
        if(currentEditingWidget) { grid.removeWidget(currentEditingWidget); closeModal(); }
    });
    document.querySelector('.grid-stack').addEventListener('click', (e) => {
        const btn = e.target.closest('.widget-settings-btn');
        if (btn) openModal(btn.closest('.grid-stack-item'));
    });

    // Sidebar Actions
    document.getElementById('btnAddWidget').addEventListener('click', () => {
        const nameInp = document.getElementById('widget-name');
        const typeInp = document.getElementById('widget-type');
        let name = nameInp.value.trim() || "Untitled";
        const w = grid.addWidget({ w: 3, h: 2 });
        if (w) w.querySelector('.grid-stack-item-content').innerHTML = createWidgetHTML(name, typeInp.value, {indexes:["0"], format:"{0}"});
        nameInp.value = "";
    });

    // Console & Uplink
    const consoleOut = document.getElementById('consoleOutput');
    const consoleInp = document.getElementById('consoleInput');
    const consolePanel = document.getElementById('consolePanel');
    const consoleResizer = document.getElementById('consoleResizer');

    // 1. Log function with Timestamp [HH:mm:ss]
    function logToConsole(msg, type='normal') {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('th-TH', { hour12: false });
        
        const line = document.createElement('div');
        line.className = 'log-line';
        line.style.color = type === 'error' ? '#ef4444' : (type === 'success' ? '#86efac' : '#ccc');
        
        // Format: [time] msg
        line.innerHTML = `<span class="log-time">[${timeStr}]</span>${msg}`;
        
        consoleOut.appendChild(line);
        consoleOut.scrollTop = consoleOut.scrollHeight;
    }

    socket.on('log_message', (d) => logToConsole(d.msg, d.type));
    socket.on('serial_data', (d) => {
        // Log RX format
        logToConsole(`RX: ${d.data}`);
        updateDashboard(d.data);
    });

    consoleInp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const cmd = consoleInp.value.trim();
            if (cmd) {
                socket.emit('send_command', { cmd: cmd });
                consoleInp.value = "";
            }
        }
    });

    document.getElementById('btnClearConsole').addEventListener('click', () => {
        consoleOut.innerHTML = '';
    });

    // Console Resizer
    let isResizing = false;
    consoleResizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = 'row-resize';
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const containerH = document.body.clientHeight;
        let h = containerH - e.clientY;
        if (h < 50) {
            consolePanel.classList.add('collapsed');
            document.documentElement.style.removeProperty('--console-height');
        } else {
            consolePanel.classList.remove('collapsed');
            if (h > 600) h = 600;
            document.documentElement.style.setProperty('--console-height', h + 'px');
        }
    });

    document.addEventListener('mouseup', () => {
        isResizing = false;
        document.body.style.cursor = 'default';
    });
    consoleResizer.addEventListener('click', () => {
        if(consolePanel.classList.contains('collapsed')) {
            consolePanel.classList.remove('collapsed');
            document.documentElement.style.setProperty('--console-height', '180px');
        }
    });

    // Connection & Sim
    document.getElementById('btnConnect').addEventListener('click', () => {
        const com = document.getElementById('cfg-com');
        const baud = document.getElementById('cfg-baud');
        socket.emit('connect_serial', { port: com.value, baud: baud.value });
        com.value = ""; baud.value = "";
    });

    document.getElementById('btnSend').addEventListener('click', () => {
        const sim = document.getElementById('sim-input');
        if(sim.value.trim()) {
            // ไม่ต้อง logToConsole ตรงนี้ซ้ำ เพราะ socket.on('serial_data') จะ log ให้เอง
            // หรือถ้าจะ log เพื่อให้รู้ว่าเป็น sim ก็ทำได้ แต่ต้องระวังซ้ำซ้อน
            // แต่เนื่องจาก Sim แค่ trigger update ไม่ได้ยิงเข้า socket ฝั่ง server (ในโค้ดเดิม)
            // เราเลย log ตรงนี้แหละถูกแล้ว แต่ใส่ Format ให้เหมือนของจริง
            logToConsole(`RX (Sim): ${sim.value}`);
            updateDashboard(sim.value);
            sim.value = "";
        }
    });

    document.getElementById('btnToggleSidebar').addEventListener('click', () => {
        document.getElementById('appContainer').classList.toggle('sidebar-closed');
        setTimeout(() => grid.onResize(), 300);
    });

    window.toggleSection = function(header) {
        header.classList.toggle('active');
        header.nextElementSibling.classList.toggle('open');
    }

    // Edit Name Logic
    const btnEditName = document.getElementById('btnEditName');
    const inpName = document.getElementById('modalWidgetName');
    btnEditName.addEventListener('click', () => {
        inpName.removeAttribute('readonly');
        inpName.classList.add('editable');
        inpName.focus(); inpName.select();
    });
    inpName.addEventListener('blur', () => {
        inpName.setAttribute('readonly', true);
        inpName.classList.remove('editable');
    });
    inpName.addEventListener('keydown', (e) => { if(e.key === 'Enter') inpName.blur(); });

    // --- 4. Update Dashboard ---
    function updateDashboard(dataString) {
        const dataArray = dataString.split(',').map(s => s.trim());
        const widgets = document.querySelectorAll('.widget-body');

        widgets.forEach(widget => {
            const contentArea = widget.querySelector('.content-area');
            if(!contentArea) return;

            let config = {};
            try { config = JSON.parse(widget.dataset.config || '{}'); } catch(e) {}
            
            if (!widget.id) widget.id = 'w-' + Math.random().toString(36).substr(2, 9);
            const wId = widget.id;
            const type = widget.dataset.type;

            if (type === 'Text') {
                let text = config.format || "{0}";
                // 3. Fix Data Format: Replace {0}, {1} accurately
                config.indexes.forEach((idx, i) => {
                    let val = "NaN";
                    const dataIdx = parseInt(idx);
                    if(!isNaN(dataIdx) && dataArray[dataIdx] !== undefined) {
                        val = dataArray[dataIdx];
                    }
                    // Regex replace all occurrences of {i}
                    text = text.replace(new RegExp(`\\{${i}\\}`, 'g'), val);
                });
                // Replace \n with <br>
                contentArea.innerHTML = text.replace(/\\n/g, '<br>');
            }
            else if (type === 'Graph') {
                const idxY = parseInt(config.indexes[1] || "0");
                const valY = parseFloat(dataArray[idxY]);
                // Read Max Points config
                const maxPoints = parseInt(config.maxPoints) || 20;
                
                if (!widgetInstances[wId]) {
                    contentArea.innerHTML = '<canvas></canvas>';
                    const ctx = contentArea.querySelector('canvas').getContext('2d');
                    widgetInstances[wId] = new Chart(ctx, {
                        type: 'line',
                        data: { labels: [], datasets: [{ label: 'Data', data: [], borderColor: '#38bdf8', tension: 0.3, pointRadius: 0 }] },
                        options: {
                            responsive: true, maintainAspectRatio: false, animation: false,
                            scales: { x: { display: false }, y: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#fff' } } },
                            plugins: { legend: { display: false } }
                        }
                    });
                }
                const chart = widgetInstances[wId];
                if (!isNaN(valY)) {
                    chart.data.labels.push(new Date().toLocaleTimeString());
                    chart.data.datasets[0].data.push(valY);
                    
                    // 4. Use Max Points Config
                    while (chart.data.labels.length > maxPoints) { 
                        chart.data.labels.shift(); 
                        chart.data.datasets[0].data.shift(); 
                    }
                    chart.update();
                }
            }
            else if (type === 'Map') {
                const lat = parseFloat(dataArray[parseInt(config.indexes[0])]);
                const lng = parseFloat(dataArray[parseInt(config.indexes[1])]);
                if (!widgetInstances[wId]) {
                    contentArea.innerHTML = '<div class="map-container" style="height:100%; width:100%;"></div>';
                    const mapDiv = contentArea.querySelector('.map-container');
                    const map = L.map(mapDiv).setView([13.7563, 100.5018], 10);
                    
                    // 5. Change Map Color (OpenStreetMap Standard)
                    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    }).addTo(map);
                    
                    const marker = L.marker([13.7563, 100.5018]).addTo(map);
                    widgetInstances[wId] = { map, marker };
                    setTimeout(() => map.invalidateSize(), 500);
                }
                const mapObj = widgetInstances[wId];
                if (!isNaN(lat) && !isNaN(lng)) {
                    const newLatLng = new L.LatLng(lat, lng);
                    mapObj.marker.setLatLng(newLatLng);
                    mapObj.map.panTo(newLatLng);
                }
            }
            else if (type === 'Table') {
                 let tableHTML = `<table class="data-table" style="width:100%;"><thead><tr><th>Type</th><th>Data</th></tr></thead><tbody>`;
                 config.tableRows.forEach(row => {
                     let val = dataArray[parseInt(row.idx)];
                     if(val === undefined) val = "-";
                     tableHTML += `<tr><td>${row.label}</td><td style="color:#38bdf8;">${val}</td></tr>`;
                 });
                 tableHTML += `</tbody></table>`;
                 contentArea.innerHTML = `<div style="overflow-y:auto; max-height:100%; width:100%;">${tableHTML}</div>`;
            }
        });
    }
});