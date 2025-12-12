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
        if(type === 'Text') label = "Format Based";
        else if(config.indexes && config.indexes.length > 0) label = `ID: ${config.indexes.join(',')}`;

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

    // --- 3. SAVE & LOAD LAYOUT SYSTEM (Client-Side) 💾 ---
    
    const btnSaveLayout = document.getElementById('btnSaveLayout');
    const btnLoadLayout = document.getElementById('btnLoadLayout');
    const fileInputLayout = document.getElementById('fileInputLayout');

    // Save Logic (Browser Download)
    btnSaveLayout.addEventListener('click', () => {
        const layoutData = [];
        grid.engine.nodes.forEach(node => {
            const el = node.el;
            const title = el.querySelector('.widget-title').innerText;
            const body = el.querySelector('.widget-body');
            const type = body.dataset.type;
            let config = {};
            try { config = JSON.parse(body.dataset.config || '{}'); } catch(e) {}
            layoutData.push({ x: node.x, y: node.y, w: node.w, h: node.h, title: title, type: type, config: config });
        });

        // สร้างไฟล์ JSON และสั่งดาวน์โหลด
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(layoutData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "dashboard_layout.json");
        document.body.appendChild(downloadAnchorNode); // จำเป็นสำหรับ Firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        
        logToConsole("Layout saved to your device.", "success");
    });

    // Load Logic (Trigger Input File)
    btnLoadLayout.addEventListener('click', () => {
        fileInputLayout.click(); // จำลองการกดปุ่ม input file ที่ซ่อนอยู่
    });

    // Handle File Selection
    fileInputLayout.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const layoutData = JSON.parse(event.target.result);
                
                // ล้าง Grid เก่า
                grid.removeAll();
                
                // สร้าง Widget ใหม่
                layoutData.forEach(item => {
                    const w = grid.addWidget({ x: item.x, y: item.y, w: item.w, h: item.h });
                    w.querySelector('.grid-stack-item-content').innerHTML = createWidgetHTML(item.title, item.type, item.config);
                });
                
                logToConsole(`Layout loaded from ${file.name}`, 'success');
            } catch (err) {
                logToConsole(`Error parsing layout file: ${err}`, 'error');
            }
        };
        reader.readAsText(file);
        // Reset value เพื่อให้เลือกไฟล์เดิมซ้ำได้ถ้าต้องการ
        fileInputLayout.value = ''; 
    });


    // --- 4. MODAL LOGIC & DYNAMIC INPUTS ---
    const modalOverlay = document.getElementById('settingModalOverlay');
    const dynamicArea = document.getElementById('modal-dynamic-inputs');
    const inputName = document.getElementById('modalWidgetName');
    const selectType = document.getElementById('modalWidgetType');
    let currentEditingWidget = null;

    window.toggleMaxInput = (checkbox) => {
        const input = document.getElementById('inp-max-points');
        if (input) {
            if (checkbox.checked) {
                input.classList.add('input-disabled');
                input.disabled = true;
            } else {
                input.classList.remove('input-disabled');
                input.disabled = false;
            }
        }
    };

    function renderModalInputs(type, currentConfig = {}) {
        dynamicArea.innerHTML = "";
        
        if (!currentConfig.indexes) currentConfig.indexes = ["0"];
        if (!currentConfig.format) currentConfig.format = "{0}";
        if (!currentConfig.maxPoints) currentConfig.maxPoints = 20;
        const isUnlimit = currentConfig.isUnlimited === true;

        if (type === 'Text') {
            dynamicArea.innerHTML += `
                <div class="form-group-stack">
                    <label style="color:#aaa; font-size:0.8rem;">Data Format</label>
                    <span class="helper-text">Example: <code>Velo: {0} m/s</code></span>
                    <textarea id="inp-format" rows="3" style="height:auto;">${currentConfig.format}</textarea>
                </div>
            `;
        } 
        else if (type === 'Graph') {
            const idxY = currentConfig.indexes[1] || currentConfig.indexes[0] || "0"; 
            const checkedAttr = isUnlimit ? 'checked' : '';
            const disabledClass = isUnlimit ? 'input-disabled' : '';
            const disabledAttr = isUnlimit ? 'disabled' : '';

            dynamicArea.innerHTML += `
                <div class="form-group-stack">
                    <label style="color:#aaa; font-size:0.8rem;">Data Index (Y-Axis)</label>
                    <span style="font-size:0.75rem; color:#666; font-style:italic;">X-Axis is Time.</span>
                    <input type="number" id="inp-y" value="${idxY}" placeholder="0">
                </div>
                <div class="form-group-stack">
                    <label style="color:#aaa; font-size:0.8rem;">Max Data Points</label>
                    <div class="input-group-row">
                        <input type="number" id="inp-max-points" value="${currentConfig.maxPoints}" placeholder="20" class="${disabledClass}" ${disabledAttr}>
                        <label class="checkbox-label">
                            <input type="checkbox" id="chk-unlimit" ${checkedAttr} onchange="toggleMaxInput(this)">
                            Unlimited
                        </label>
                    </div>
                </div>
            `;
        }
        else if (type === 'Map') {
            const lat = currentConfig.indexes[0] || "0";
            const lng = currentConfig.indexes[1] || "1";
            dynamicArea.innerHTML += `
                <div class="dynamic-row"><label style="width:50px; font-size:0.8rem;">Lat:</label> <input type="number" id="inp-lat" value="${lat}"></div>
                <div class="dynamic-row"><label style="width:50px; font-size:0.8rem;">Lng:</label> <input type="number" id="inp-lng" value="${lng}"></div>
            `;
        }
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

    function closeModal() {
        if (currentEditingWidget) {
            const header = currentEditingWidget.querySelector('.widget-title');
            const body = currentEditingWidget.querySelector('.widget-body');
            const type = selectType.value;
            const oldType = body.dataset.type;

            const newConfig = { indexes: [] };

            if (type === 'Text') {
                const fmt = document.getElementById('inp-format');
                if(fmt) newConfig.format = fmt.value;
            } 
            else if (type === 'Graph') {
                const y = document.getElementById('inp-y');
                const max = document.getElementById('inp-max-points');
                const chk = document.getElementById('chk-unlimit');
                
                newConfig.indexes.push('time'); 
                if(y) newConfig.indexes.push(y.value);
                if(max) newConfig.maxPoints = parseInt(max.value) || 20;
                if(chk) newConfig.isUnlimited = chk.checked;
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

            const wId = body.getAttribute('id');
            if (oldType === 'Graph' && type === 'Graph' && widgetInstances[wId]) {
                const chartInstance = widgetInstances[wId];
                if(chartInstance && chartInstance.data) {
                    body.preservedChartData = {
                        labels: chartInstance.data.labels,
                        datasets: chartInstance.data.datasets
                    };
                }
            }

            header.innerText = inputName.value;
            body.dataset.type = type;
            body.dataset.config = JSON.stringify(newConfig);

            let label = "ID: -";
            if (type === 'Text') label = "Format Based";
            else if(newConfig.indexes.length > 0) label = `ID: ${newConfig.indexes.join(',')}`;
            
            body.innerHTML = `<div class="content-area" style="width:100%; height:100%; display:flex; justify-content:center; align-items:center;">Waiting...</div><div class="widget-index-label">${label}</div>`;

            if(wId && widgetInstances[wId]) {
                 if(widgetInstances[wId].destroy) widgetInstances[wId].destroy();
                 if(widgetInstances[wId].remove) widgetInstances[wId].remove(); 
                 delete widgetInstances[wId];
            }
        }
        modalOverlay.classList.remove('active');
        currentEditingWidget = null;
    }

    document.getElementById('btnCloseModal').addEventListener('click', closeModal);
    
    let isMouseDownOnOverlay = false;
    modalOverlay.addEventListener('mousedown', (e) => {
        isMouseDownOnOverlay = (e.target === modalOverlay);
    });
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay && isMouseDownOnOverlay) closeModal();
        isMouseDownOnOverlay = false;
    });

    selectType.addEventListener('change', () => renderModalInputs(selectType.value, {}));
    document.getElementById('btnDeleteWidget').addEventListener('click', () => {
        if(currentEditingWidget) { grid.removeWidget(currentEditingWidget); closeModal(); }
    });
    document.querySelector('.grid-stack').addEventListener('click', (e) => {
        const btn = e.target.closest('.widget-settings-btn');
        if (btn) openModal(btn.closest('.grid-stack-item'));
    });

    document.getElementById('btnAddWidget').addEventListener('click', () => {
        const nameInp = document.getElementById('widget-name');
        const typeInp = document.getElementById('widget-type');
        let name = nameInp.value.trim() || "Untitled";
        const w = grid.addWidget({ w: 3, h: 2 });
        if (w) w.querySelector('.grid-stack-item-content').innerHTML = createWidgetHTML(name, typeInp.value, {indexes:["0"], format:"{0}"});
        nameInp.value = "";
    });

    // --- DATABASE LOGIC ---
    const dbPathBox = document.getElementById('dbPathBox');
    const dbPathText = document.getElementById('dbPathText');
    const dbStatusLed = document.getElementById('dbStatusLed');
    const dbClearBtn = document.getElementById('dbClearBtn');
    const btnConnectDb = document.getElementById('btnConnectDb');
    let currentDbPath = "";
    let isDbRecording = false;

    dbPathBox.addEventListener('click', async (e) => {
        if (e.target.closest('.path-clear-btn')) return;
        if (isDbRecording) return;

        try {
            dbPathText.innerText = "Opening Dialog...";
            const res = await fetch('/browse_db_path');
            const data = await res.json();
            
            if (data.success) {
                currentDbPath = data.path;
                dbPathText.innerText = currentDbPath;
                dbPathText.classList.add('has-file');
                dbClearBtn.classList.add('visible'); 
                btnConnectDb.disabled = false;
            } else {
                if(data.msg === 'Cancelled' && !currentDbPath) {
                    dbPathText.innerText = "No file selected";
                } else if (currentDbPath) {
                    dbPathText.innerText = currentDbPath;
                }
            }
        } catch(e) {
            logToConsole(`DB Browser Error: ${e}`, 'error');
            dbPathText.innerText = "Error opening dialog";
        }
    });

    dbClearBtn.addEventListener('click', (e) => {
        if(isDbRecording) return;
        currentDbPath = "";
        dbPathText.innerText = "No file selected";
        dbPathText.classList.remove('has-file');
        dbClearBtn.classList.remove('visible'); 
        btnConnectDb.disabled = true;
    });

    btnConnectDb.addEventListener('click', () => {
        if (!isDbRecording) {
            if(currentDbPath) socket.emit('connect_db', { path: currentDbPath });
        } else {
            socket.emit('stop_db');
        }
    });

    socket.on('db_status', (data) => {
        isDbRecording = data.recording;
        if (isDbRecording) {
            dbStatusLed.classList.add('active');
            btnConnectDb.innerText = "Stop Recording";
            btnConnectDb.classList.add('stop-mode');
            dbPathBox.style.cursor = "not-allowed";
            dbPathBox.style.opacity = "0.7";
        } else {
            dbStatusLed.classList.remove('active');
            btnConnectDb.innerText = "Connect & Record";
            btnConnectDb.classList.remove('stop-mode');
            dbPathBox.style.cursor = "pointer";
            dbPathBox.style.opacity = "1";
        }
    });

    // --- Console & Uplink ---
    const consoleOut = document.getElementById('consoleOutput');
    const consoleInp = document.getElementById('consoleInput');
    const consolePanel = document.getElementById('consolePanel');
    const consoleResizer = document.getElementById('consoleResizer');

    function logToConsole(msg, type='normal') {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('th-TH', { hour12: false });
        const line = document.createElement('div');
        line.className = 'log-line';
        line.style.color = type === 'error' ? '#ef4444' : (type === 'success' ? '#86efac' : '#ccc');
        line.innerHTML = `<span class="log-time">[${timeStr}]</span>${msg}`;
        consoleOut.appendChild(line);
        consoleOut.scrollTop = consoleOut.scrollHeight;
    }

    socket.on('log_message', (d) => logToConsole(d.msg, d.type));
    socket.on('serial_data', (d) => {
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

    let isResizing = false;
    let isDragging = false; 
    let startY = 0;

    consoleResizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        isDragging = false; 
        startY = e.clientY; 
        document.body.style.cursor = 'row-resize';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        
        if (Math.abs(e.clientY - startY) > 5) {
            isDragging = true;
        }

        if (isDragging) {
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
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (isResizing) {
            if (!isDragging) {
                if (consolePanel.classList.contains('collapsed')) {
                    consolePanel.classList.remove('collapsed');
                    document.documentElement.style.setProperty('--console-height', '180px');
                } else {
                    consolePanel.classList.add('collapsed');
                    document.documentElement.style.removeProperty('--console-height');
                }
            }
            isResizing = false;
            isDragging = false;
            document.body.style.cursor = 'default';
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
            logToConsole(`RX(Sim): ${sim.value}`);
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

    const inpName = document.getElementById('modalWidgetName');
    
    inpName.addEventListener('click', () => {
        if (inpName.hasAttribute('readonly')) {
            inpName.removeAttribute('readonly');
            inpName.classList.add('editable');
            inpName.focus(); 
            inpName.select(); 
        }
    });

    const finishEditingName = () => {
        inpName.setAttribute('readonly', true);
        inpName.classList.remove('editable');
        inpName.blur(); 
    };

    inpName.addEventListener('blur', finishEditingName);
    inpName.addEventListener('keydown', (e) => { 
        if(e.key === 'Enter') finishEditingName(); 
    });

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
                text = text.replace(/\{(\d+)\}/g, (match, index) => {
                    const i = parseInt(index);
                    if (!isNaN(i) && dataArray[i] !== undefined) {
                        return dataArray[i]; 
                    }
                    return "NaN"; 
                });
                contentArea.innerHTML = text.replace(/\\n/g, '<br>');
            }
            else if (type === 'Graph') {
                const idxY = parseInt(config.indexes[1] || "0");
                const valY = parseFloat(dataArray[idxY]);
                const maxPoints = parseInt(config.maxPoints) || 20;
                const isUnlimit = config.isUnlimited === true;
                
                if (!widgetInstances[wId]) {
                    contentArea.innerHTML = '<canvas></canvas>';
                    const ctx = contentArea.querySelector('canvas').getContext('2d');
                    let initialData = { labels: [], datasets: [{ label: 'Data', data: [], borderColor: '#38bdf8', tension: 0.3, pointRadius: 0 }] };
                    if (widget.preservedChartData) {
                        initialData.labels = widget.preservedChartData.labels;
                        initialData.datasets = widget.preservedChartData.datasets;
                        delete widget.preservedChartData;
                    }
                    widgetInstances[wId] = new Chart(ctx, {
                        type: 'line',
                        data: initialData,
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
                    if (!isUnlimit) {
                        while (chart.data.labels.length > maxPoints) { 
                            chart.data.labels.shift(); 
                            chart.data.datasets[0].data.shift(); 
                        }
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
                    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        attribution: '&copy; OpenStreetMap'
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