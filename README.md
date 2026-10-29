# EV Motor Digital Twin — Interactive Powertrain Simulation & Diagnostics

An interactive browser-based digital twin of an electric vehicle (EV) traction motor. This software application simulates a 150 kW Interior Permanent Magnet Synchronous Motor (IPM-PMSM), displays real-time telemetry, renders a 3D cutaway motor assembly, injects electromechanical faults, evaluates rule-based condition monitoring diagnostics, and exports validation reports.

---

## 1. Project Abstract

Electrification of vehicle powertrains demands high reliability and predictive maintenance for traction motors. Physical bench testing of motor faults (such as stator insulation breakdown, bearing spalling, and inverter shoot-through) carries severe risks of destructive equipment damage and high testbench costs. 

This project delivers a browser-based **EV Motor Digital Twin** that models motor electromagnetics, rotor dynamics, lumped-parameter heat transfer, and mechanical vibration. The software platform provides live telemetry visualization, interactive 3D PMSM inspection, fault injection, deterministic health index scoring, and academic validation reporting without requiring physical microcontrollers or paid cloud services.

> **Notice:** This application is an engineering software simulation. It does not claim physical motor testing, live microcontroller communication, certified functional safety, or real physical sensor measurements.

---

## 2. Problem Statement

Modern EV traction motors operate under hostile thermal, electrical, and vibrational environments:
- Stator winding temperatures regularly fluctuate across wide operating envelopes (ambient to 140°C).
- High-voltage inverter switching generates common-mode voltages that induce bearing fluting and degradation.
- Sensor drift and cooling loop faults can trigger cascading failures if not diagnosed promptly.

Engineering students and powertrain developers lack safe, accessible software testbenches to study traction motor fault dynamics, observe degradation propagation, and test diagnostic rules before physical prototyping.

---

## 3. Project Objectives

1. **Physical Simulation Engine**: Develop deterministic, coupled mathematical equations modeling speed, torque, phase current, DC bus potential, thermal heat rise/dissipation, and rotational vibration.
2. **Interactive 3D Digital Twin**: Render an interactive Three.js 3D PMSM motor with animated rotor rotation, cutaway stator inspection, thermal glow states, and component metadata.
3. **Fault Injection & Safety Diagnostics**: Implement 8 real-world fault scenarios with transparent, rule-based diagnostic alerts mapped to ISO 10816 and IEC 60034 standards.
4. **Telemetry Analysis & Persistence**: Provide multi-channel rolling time-series charts, threshold indicators, and downloadable CSV datasets of simulated test runs.
5. **Academic & Industrial Review Readiness**: Provide a print-friendly project review report containing peak stress metrics, validation summaries, and future Hardware-In-The-Loop (HIL) interfaces.

---

## 4. System Architecture

The application is structured into decoupled modules:

```
├── server.ts                  # Express server mounting Vite in dev & Gemini 3.8 Flash diagnostics
├── src/
│   ├── main.tsx              # Application entry point
│   ├── App.tsx               # Primary dashboard workbench coordinator
│   ├── index.css             # Tailwind v4 styles, fonts & print stylesheets
│   ├── simulation/           # Core physical modeling engine (isolated from UI)
│   │   ├── types.ts          # Telemetry, fault, config, and diagnostic interfaces
│   │   ├── motorPhysics.ts   # PMSM equations, thermal ODE, vibration, and health
│   │   ├── faultModels.ts    # 8 electromechanical fault definitions & procedures
│   │   ├── diagnosticEngine.ts # Rule-based condition monitoring & ISO thresholds
│   │   ├── exportUtils.ts    # Telemetry CSV, event CSV, & validation generator
│   │   ├── useSimulation.ts  # React hook running discrete fixed-step timer loop
│   │   └── __tests__/        # Unit tests (Vitest)
│   └── components/           # Modular UI & visualization components
│       ├── DashboardHeader.tsx    # Controls (Start, Pause, Reset, E-Stop) & Clock
│       ├── TelemetryCards.tsx     # 8 primary live metric cards with status bounds
│       ├── MotorVisualization.tsx # 3D Three.js PMSM cutaway twin & component inspector
│       ├── TelemetryCharts.tsx    # Rolling SVG time-series charts with crosshair tooltips
│       ├── SimulationControls.tsx # Load (25-95%), Speed, Ambient Temp, Cooling loop
│       ├── FaultInjectionPanel.tsx# 8 fault scenario cards with clear mechanics
│       ├── HealthAssessment.tsx   # Health score, margins, AI Specialist FMEA consultation
│       ├── EventLog.tsx           # Searchable, filterable system event timeline
│       └── ExportReports.tsx      # CSV downloads & Academic review modal
```

---

## 5. Simulation Methodology & Mathematical Formulations

### 5.1 Motor Specification (150 kW IPM-PMSM)
- **Rated Power**: 150 kW peak
- **Peak Torque**: 310 Nm
- **Base Speed**: 4,800 RPM | **Max Speed**: 12,000 RPM
- **Nominal DC Link Voltage**: 400 V DC
- **Pole Pairs**: $p = 4$ (8 poles, 48 stator slots)
- **Insulation**: Class H (IEC 60034-1, $180^\circ\text{C}$ max rating)

### 5.2 Rotational Speed Dynamics
Shaft acceleration follows a first-order inertial response with mechanical load droop:
$$\frac{dN}{dt} = \frac{N_{\text{target}} - N}{\tau_{\text{accel}}} - k_{\text{droop}} \cdot \left(\frac{\text{Load}\%}{100}\right)$$
where $\tau_{\text{accel}} = 0.85\text{ s}$ during standard drive and $0.35\text{ s}$ during emergency deceleration.

### 5.3 Torque & Power Conversion
Above rated base speed ($4,800\text{ RPM}$), torque capacity decreases inversely with speed due to back-EMF voltage limits (field-weakening region):
$$T_{\text{avail}} = T_{\text{peak}} \cdot \min\left(1, \frac{N_{\text{base}}}{N}\right)$$
Shaft angular velocity $\omega = \frac{2\pi N}{60}\text{ rad/s}$. Mechanical power:
$$P_{\text{mech}} = \frac{T \cdot \omega}{1000}\quad [\text{kW}]$$

### 5.4 Lumped-Parameter Stator Thermal Model
Temperature evolves according to stator heat generation and cooling convection:
$$\frac{dT_{\text{stator}}}{dt} = \frac{P_{\text{copper}} + P_{\text{iron}} + P_{\text{fault}} - P_{\text{diss}}}{C_{\text{thermal}}}$$
- Copper Joule loss: $P_{\text{copper}} = 3 \cdot I_{\text{phase}}^2 \cdot R_s(T)$, where $R_s(T) = R_{25}(1 + \alpha_{\text{cu}}(T - 25))$
- Iron losses: $P_{\text{iron}} \propto k_h f + k_e f^2$ (electrical frequency $f = \frac{p \cdot N}{60}$)
- Cooling heat dissipation: $P_{\text{diss}} = \frac{T_{\text{stator}} - T_{\text{ambient}}}{R_{\text{thermal}}}$, where $R_{\text{thermal}} \propto \frac{1}{\text{CoolingEffectiveness}}$

### 5.5 ISO 10816 Vibration Severity
Mechanical vibration RMS velocity grows with unbalance:
$$v_{\text{vib}} = v_{\text{baseline}} + 0.95 \cdot \left(\frac{N}{N_{\text{max}}}\right)^2 + v_{\text{fault}}\quad [\text{mm/s}]$$
- **Zone A**: $< 1.8\text{ mm/s}$ (Newly commissioned / Good)
- **Zone B**: $1.8 - 4.5\text{ mm/s}$ (Unrestricted continuous operation)
- **Zone C**: $4.5 - 7.1\text{ mm/s}$ (Warning / Restricted operation)
- **Zone D**: $> 7.1\text{ mm/s}$ (Critical / Imminent damage hazard)

### 5.6 Deterministic Health Index Scoring (0–100)
Calculated via multi-stress penalty deduction:
$$\text{Health} = 100 - \Delta_{\text{thermal}} - \Delta_{\text{current}} - \Delta_{\text{vibration}} - \Delta_{\text{voltage}} - \Delta_{\text{fault}}$$

---

## 6. Fault Scenarios Catalog

| Scenario | Subsystem | Injected Physical Alteration | Diagnostic Threshold Trip | Recommended Corrective Action |
|---|---|---|---|---|
| **1. Normal Operation** | Baseline | Nominal parameters | All parameters in Zone A/B | Routine scheduled maintenance (10,000 km) |
| **2. Stator Overheating** | Thermal | $+4200\text{ W}$ continuous internal heat | Temp $> 105^\circ\text{C}$ (Warn), $> 130^\circ\text{C}$ (Crit) | Derate torque $<30\%$; check radiator fan |
| **3. Phase Overcurrent** | Electrical | $+115\text{ A}$ current surge | Current $> 280\text{ A}$ (Warn), $> 340\text{ A}$ (Crit) | Isolate HV contactor; inspect inverter IGBTs |
| **4. Bearing Wear** | Mechanical | $+4.2\text{ mm/s}$ high-frequency vibration, $+9.5\text{ Nm}$ friction | Vibration $> 4.5\text{ mm/s}$ (Zone C) | Replace bearings; inspect shaft grounding ring |
| **5. DC Bus Undervoltage**| Electrical | Bus drops to $308\text{ V}$ | Voltage $< 350\text{ V}$ (Warn), $< 310\text{ V}$ (Crit) | Inspect battery pack cell SoC & DC contactor |
| **6. Sensor Drift** | Sensor | $+32.5^\circ\text{C}$ artificial bias with noise | Confidence $< 50\%$ ($\Delta T > 5^\circ\text{C}$ from model) | Switch to synthetic observer; inspect PT1000 |
| **7. Excessive Vibration**| Mechanical | $+7.1\text{ mm/s}$ dynamic eccentricity unbalance | Vibration $> 7.1\text{ mm/s}$ (Zone D) | Cease high-speed operation; balance rotor shaft |
| **8. Cooling Degraded** | Thermal | Convective heat transfer reduced by $72\%$ | Gradual thermal accumulation | Inspect coolant reservoir level and purge airlocks |

---

## 7. STM32 NUCLEO-F446RE Hardware Connection & Setup Guide

The application connects directly to an **STM32 NUCLEO-F446RE** microcontroller over USB serial communication via the browser's **Web Serial API**.

### 7.1 Connection Topology
- **Board**: STM32 NUCLEO-F446RE (ARM Cortex-M4 @ 180 MHz).
- **USB Interface**: Upper ST-LINK Micro-USB connector (CN1).
- **Virtual COM Port**: The onboard ST-LINK V2-1 enumerates automatically as a Virtual COM Port (VCP), bridged internally to **USART2**:
  - `PA2` (USART2_TX) $\rightarrow$ ST-LINK VCP RX
  - `PA3` (USART2_RX) $\rightarrow$ ST-LINK VCP TX
- **No external USB-to-UART FTDI converter is required.**

### 7.2 Data Format Specification
- **Baud Rate**: `115200`
- **Data Bits**: `8`
- **Parity**: `None`
- **Stop Bits**: `1`
- **Flow Control**: `None`
- **Framing**: Newline-delimited ASCII JSON (`\r\n` or `\n`), transmitted at ~10 Hz (every 100 ms):
```json
{"rpm":3200.0,"current_A":18.4,"voltage_V":360.0,"temperature_C":68.2,"vibration_mm_s":1.8,"load_pct":50,"torque_Nm":16.2,"power_kW":5.4}
```

### 7.3 Step-by-Step Setup Instructions

#### 1. Physical Hardware Connection
Plug a standard Micro-USB cable into the **upper ST-LINK USB connector (CN1)** of the NUCLEO-F446RE and connect it to your computer. The red/green power LED (PWR) and ST-LINK communication LED (COM) will illuminate.

#### 2. Identifying the Virtual COM Port

**On Windows:**
1. Open **Device Manager** (`Win + X` > `Device Manager`).
2. Expand the **Ports (COM & LPT)** branch.
3. Look for: `STMicroelectronics STLink Virtual COM Port (COMx)`.
4. Note the port number (e.g. `COM3` or `COM5`).

**On Ubuntu / Linux:**
1. Open a terminal and inspect connected USB serial devices:
```bash
ls -l /dev/ttyACM*
ls -l /dev/ttyUSB*
```
2. Typically, the NUCLEO enumerates as `/dev/ttyACM0`. Verify with kernel messages:
```bash
dmesg | tail -30
```
3. Grant dialout group permissions to your user account:
```bash
sudo usermod -a -G dialout $USER
```
*(Log out and log back in, or run `sudo chmod 666 /dev/ttyACM0` for temporary access).*

#### 3. Building & Flashing Firmware via STM32CubeIDE
1. The complete firmware source is located in `/firmware/stm32-nucleo-f446re/`.
2. Open **STM32CubeIDE** and import the project or create an STM32 Project targeting `NUCLEO-F446RE`.
3. In CubeMX Pinout view, verify **USART2** mode is set to **Asynchronous**, Baud: `115200`, `PA2` (TX) and `PA3` (RX).
4. Replace `Core/Src/main.c` and `Core/Inc/main.h` with the files provided in `/firmware/stm32-nucleo-f446re/`.
5. Build the project (`Ctrl + B`).
6. Flash to the board (`Run > Run` or `Ctrl + F11`).
7. The green onboard user LED (`LD2 - PA5`) will begin blinking steadily at 10 Hz, indicating active periodic transmission.

#### 4. Connecting in the Browser Dashboard
1. Open the application in **Google Chrome** or **Microsoft Edge** (on desktop) at `http://localhost:3000` or an HTTPS URL. *(Web Serial API requires a secure context or localhost).*
2. In the **STM32 NUCLEO-F446RE Hardware Connection** panel, select `115200` baud.
3. Click **Connect STM32 Board**.
4. A browser permission prompt will appear. Select **STMicroelectronics STLink Virtual COM Port** (or `/dev/ttyACM0`) and click **Connect**.
5. The status badge will change to **STM32 CONNECTED (VCP)**, the terminal monitor will display live JSON frames, and dashboard metrics will switch to **HARDWARE CONNECTED**.

#### 5. Troubleshooting Guide

| Issue | Root Cause | Solution |
|---|---|---|
| **Port selector does not appear** | Browser does not support Web Serial API | Open in desktop Chrome, Edge, or Opera. Firefox and Safari do not support Web Serial. |
| **"Failed to open serial port"** | Another terminal (Putty, Minicom, STM32CubeProgrammer) holds the port open | Close any external serial terminals before clicking Connect in the web dashboard. |
| **Linux "Access Denied"** | User missing dialout permissions | Run `sudo usermod -a -G dialout $USER` and log back in, or `sudo chmod 666 /dev/ttyACM*`. |
| **Malformed packets / CRC errors** | Mismatched baud rate | Verify that both firmware and dashboard baud rates are set to `115200`. |
| **"STALE HARDWARE DATA" Warning** | Microcontroller halted or cable loose | Press the black RESET button (B2) on the NUCLEO board; verify green LED2 is blinking at 10 Hz. |
| **Data shows [CALC] badge** | Torque/Power omitted from firmware packet | The dashboard automatically calculates derived values from measured phase current and RPM while clearly identifying them with `[CALC]`. |

---

## 8. Testing Methodology

Unit tests are implemented using **Vitest** in `/src/simulation/__tests__/simulation.test.ts`:
- First-order speed response and load-dependent droop verification.
- Power consistency equation ($P = \tau \cdot \omega$) unit check.
- Fault injection parameter deviation bounds.
- Deterministic health index penalty score assertions.
- Convective cooling ODE gradual decay verification.
- CSV serialization and summary metric accuracy.
- Emergency stop deceleration and state transition checks.

To execute tests:
```bash
npm test
```

---

## 9. Limitations & Boundary Disclaimers

1. **Simulation Model**: Equations represent simplified lumped-parameter differential models. They do not substitute for 3D finite element electromagnetic (FEA) or computational fluid dynamics (CFD) packages.
2. **Hardware Separation**: Telemetry is generated algorithmically inside the browser runtime. No physical microcontroller or motor is connected in this version.
3. **Safety Notice**: Diagnostic thresholds and alarms are intended for educational and engineering demonstration only, not certified ISO 26262 automotive safety release.

---

## 10. Installation & Execution Instructions

### Prerequisites
- Node.js 18.x or higher
- npm (or pnpm / yarn / bun)

### 1. Clone the repository
```bash
git clone https://github.com/your-username/ev-motor-digital-twin.git
cd ev-motor-digital-twin
```

### 2. Install dependencies
```bash
npm install
```

### 3. Run development server
```bash
npm run dev
```
Open your browser at `http://localhost:3000`.

### 4. Run unit tests
```bash
npm test
```

### 5. Production build
```bash
npm run build
```
Build output is generated in `/dist`.

### 6. Deployment to Static Hosting (GitHub Pages / Vercel / Netlify)
To deploy as a static client-side bundle on GitHub Pages:
```bash
npm run build
# Publish the 'dist' directory via gh-pages:
npx gh-pages -d dist
```

---

## License

This project is licensed under the [MIT License](LICENSE).
