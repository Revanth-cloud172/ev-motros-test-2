# STM32 NUCLEO-F446RE Firmware for EV Motor Digital Twin

This folder contains the complete STM32CubeIDE C firmware for the **STM32 NUCLEO-F446RE** evaluation board to stream real-time motor telemetry into the browser digital twin application via ST-LINK Virtual COM Port (VCP).

---

## 1. Hardware Pinout & Architecture

The NUCLEO-F446RE features an onboard ST-LINK V2-1 debugger with integrated Virtual COM Port (VCP). **No external USB-to-UART converter cable is needed.**

| STM32 Pin | Function | Routing | Description |
|---|---|---|---|
| **PA2** | USART2_TX | ST-LINK VCP RX | Microcontroller telemetry output @ 115200 baud |
| **PA3** | USART2_RX | ST-LINK VCP TX | Microcontroller command input |
| **PA5** | GPIO_Output | User LED (LD2) | Blinks on each transmitted telemetry packet |
| **PC13** | GPIO_Input | User Blue Button (B1) | Push to inject simulated 90% load surge |

---

## 2. Telemetry Packet Protocol

The firmware transmits newline-terminated ASCII JSON strings at **10 Hz** (every 100 ms):

```json
{"rpm":3200.0,"current_A":18.42,"voltage_V":395.4,"temperature_C":52.1,"vibration_mm_s":1.12,"load_pct":50,"torque_Nm":16.2,"power_kW":5.43}
```

The Web Serial dashboard validates:
- `rpm`: 0 to 18,000 RPM
- `current_A`: -500 to 600 A
- `voltage_V`: 0 to 1,200 V
- `temperature_C`: -40 to 250 °C
- `vibration_mm_s`: 0 to 60 mm/s
- `load_pct`: 0 to 100 %

---

## 3. How to Build & Flash with STM32CubeIDE

1. Open **STM32CubeIDE** (v1.12 or newer).
2. Go to **File > New > STM32 Project**.
3. Select Board Selector: **NUCLEO-F446RE**.
4. Initialize all peripherals in default mode: **Yes**.
5. Replace `Core/Src/main.c` and `Core/Inc/main.h` with the files provided in this directory.
6. Connect the NUCLEO board to your PC using a standard Micro-USB cable connected to the upper USB port (CN1 - ST-LINK).
7. Click **Project > Build All** (`Ctrl + B`).
8. Click **Run > Run** (`Ctrl + F11`) to flash the `.elf` binary via ST-LINK GDB server.
9. Green LED (LD2) will start blinking steadily at 10 Hz, indicating active telemetry transmission.

---

## 4. Connecting Real Physical Transducers

To transition from MCU demonstration mode to physical sensors:
1. Open `main.c`.
2. Change `#define USE_REAL_SENSORS 0` to `#define USE_REAL_SENSORS 1`.
3. Connect your physical transducers:
   - **Shaft Speed**: Optical quadrature encoder to TIM2 Channel 1 (PA0) and Channel 2 (PA1) configured in Encoder Mode.
   - **Phase Current**: LEM HASS Hall-effect current sensor (0–5V output) via resistive divider (to 0–3.3V) to ADC1 Channel 4 (PA4).
   - **DC Bus Voltage**: Precision 100:1 resistive divider to ADC1 Channel 8 (PB0).
   - **Winding Temperature**: PT100 RTD sensor via SPI1 (PA5/PA6/PA7) and MAX31865 amplifier board.
   - **Vibration**: ADXL345 or MPU-6050 3-axis accelerometer on I2C1 (PB8/PB9).

---

## 5. Identifying the COM Port

### On Windows
1. Open **Device Manager** (`Win + X > Device Manager`).
2. Expand **Ports (COM & LPT)**.
3. Look for **STMicroelectronics STLink Virtual COM Port (COMx)**. Note the COM port number (e.g., `COM3`, `COM7`).

### On Ubuntu / Linux
1. Run in terminal:
   ```bash
   ls -l /dev/ttyACM*
   # Typically enumerates as /dev/ttyACM0
   ```
2. Verify dmesg log:
   ```bash
   dmesg | tail -30
   # You should see: cdc_acm: ttyACM0: USB ACM device
   ```
3. Grant serial access permission to your user account:
   ```bash
   sudo usermod -a -G dialout $USER
   # Log out and log back in, or run:
   sudo chmod 666 /dev/ttyACM0
   ```

---

## 6. Testing with the Browser Digital Twin

1. Open the EV Motor Digital Twin dashboard in **Google Chrome** or **Microsoft Edge** (at `http://localhost:3000` or an HTTPS URL).
2. Click **Connect STM32 Board** in the Hardware Connection panel.
3. In the browser permission pop-up, select **STMicroelectronics STLink Virtual COM Port**.
4. Click **Connect**.
5. Observe the live JSON stream in the terminal window, and watch the dashboard update live with the STM32's measurements!
