# Modular Telemetry Ground Station Dashboard
A web-based dashboard designed for visualizing real-time telemetry data from ground stations, high-altitude balloons, or embedded systems. The application allows users to create a custom layout with modular widgets for text, graphs, maps, and tables.

## Description
This project provides a flexible interface for monitoring serial data. It uses a Python [(Flask)](https://flask.palletsprojects.com/en/stable/) backend to handle serial communication and a JavaScript frontend for visualization. The dashboard supports drag-and-drop widgets, real-time plotting, GPS mapping, and client-side database logging [(SQLite)](https://sqlite.org/). It is responsive and can be accessed via mobile devices on the same network.

## Key Features
- **Real-time Visualization:** Displays data from Serial Port (USB) or simulation mode.
- **Modular Widgets:**
  - **Text:** Display raw values with custom formatting.
  - **Graph:** Line charts with adjustable history length and unlimited mode.
  - **Map:** GPS tracking using OpenStreetMap [(Leaflet)](https://leafletjs.com/).
  - **Table:** Tabular data display.
- **Layout Manager:** Save and load dashboard configurations as JSON files.
- **Client-side Database:** Record telemetry logs directly to a local SQLite file via the browser.
- **Console:** Integrated terminal for monitoring raw logs and sending uplink commands.
