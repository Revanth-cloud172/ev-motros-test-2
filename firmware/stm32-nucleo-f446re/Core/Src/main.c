/**
  ******************************************************************************
  * @file           : main.c
  * @brief          : EV Motor Digital Twin - STM32 NUCLEO-F446RE Firmware
  *                   Transmits real-time motor telemetry over ST-LINK VCP (USART2)
  *                   Baud: 115200, 8-N-1, Newline-delimited JSON
  ******************************************************************************
  * @attention
  *
  * Hardware Target: STM32 NUCLEO-F446RE (ARM Cortex-M4 @ 180 MHz)
  * Interface:       ST-LINK V2-1 Virtual COM Port (VCP)
  * Pinout:          USART2_TX -> PA2 (connected to ST-LINK VCP RX)
  *                  USART2_RX -> PA3 (connected to ST-LINK VCP TX)
  *
  * NOTICE:
  * By default, this firmware operates in "MCU-Generated Demonstration Mode"
  * to generate physically plausible motor telemetry from the STM32 microcontroller.
  * When physical transducers (current clamp, encoder, accelerometer) are connected,
  * set USE_REAL_SENSORS to 1 to read physical hardware ADC and timers.
  ******************************************************************************
  */

/* Includes ------------------------------------------------------------------*/
#include "main.h"
#include <stdio.h>
#include <string.h>
#include <math.h>

/* Private defines -----------------------------------------------------------*/
#define TELEMETRY_INTERVAL_MS 100  /* 10 Hz transmission rate (10 frames/sec) */
#define TX_BUFFER_SIZE        256

/* Toggle between MCU internal demonstration synthesis and physical ADC/Sensors */
#define USE_REAL_SENSORS      0

/* Private variables ---------------------------------------------------------*/
UART_HandleTypeDef huart2;
char txBuffer[TX_BUFFER_SIZE];

/* Simulated / Demonstration variables */
typedef struct {
  float rpm;
  float current_A;
  float voltage_V;
  float temperature_C;
  float vibration_mm_s;
  float load_pct;
  float torque_Nm;
  float power_kW;
  uint8_t fault_mode; // 0=Nominal, 1=Overheat, 2=HighVib
} MotorState_t;

static MotorState_t motor = {
  .rpm = 1500.0f,
  .current_A = 18.5f,
  .voltage_V = 398.2f,
  .temperature_C = 42.0f,
  .vibration_mm_s = 0.85f,
  .load_pct = 50.0f,
  .torque_Nm = 16.2f,
  .power_kW = 2.54f,
  .fault_mode = 0
};

/* Private function prototypes -----------------------------------------------*/
void SystemClock_Config(void);
static void MX_GPIO_Init(void);
static void MX_USART2_UART_Init(void);
void Update_Demonstration_Telemetry(uint32_t tickMs);
void Send_Telemetry_JSON(void);

#if USE_REAL_SENSORS
void Read_Physical_Sensors(void);
#endif

/**
  * @brief  The application entry point.
  * @retval int
  */
int main(void)
{
  /* MCU Configuration--------------------------------------------------------*/
  /* Reset of all peripherals, Initializes the Flash interface and the Systick. */
  HAL_Init();

  /* Configure the system clock to 180 MHz */
  SystemClock_Config();

  /* Initialize all configured peripherals */
  MX_GPIO_Init();
  MX_USART2_UART_Init();

  /* Turn on green user LED (LD2 - PA5) to indicate MCU active */
  HAL_GPIO_WritePin(GPIOA, GPIO_PIN_5, GPIO_PIN_SET);

  /* Send startup banner */
  const char *banner = "\r\n{\"info\":\"STM32 NUCLEO-F446RE EV Motor Twin Online\",\"baud\":115200}\r\n";
  HAL_UART_Transmit(&huart2, (uint8_t*)banner, strlen(banner), 500);

  uint32_t lastTxTime = 0;

  /* Infinite loop -----------------------------------------------------------*/
  while (1)
  {
    uint32_t currentTick = HAL_GetTick();

    /* Transmit telemetry at a periodic 10 Hz rate */
    if (currentTick - lastTxTime >= TELEMETRY_INTERVAL_MS)
    {
      lastTxTime = currentTick;

#if USE_REAL_SENSORS
      /* Read actual physical hardware sensors:
       * - Encoder via TIM2/TIM3
       * - Current shunt / LEM sensor via ADC1
       * - Voltage divider via ADC1
       * - PT100 / Thermistor via ADC1 or SPI MAX31865
       * - Accelerometer via I2C MPU6050
       */
      Read_Physical_Sensors();
#else
      /* Generate plausible MCU demonstration values */
      Update_Demonstration_Telemetry(currentTick);
#endif

      /* Format and transmit JSON telemetry packet over USART2 VCP */
      Send_Telemetry_JSON();

      /* Toggle User LED2 (PA5) briefly on each transmission */
      HAL_GPIO_TogglePin(GPIOA, GPIO_PIN_5);
    }
  }
}

/**
  * @brief Formats and transmits one newline-terminated JSON telemetry line.
  * Example: {"rpm":3200,"current_A":18.4,"voltage_V":360,"temperature_C":68.2,"vibration_mm_s":1.8,"load_pct":50}
  */
void Send_Telemetry_JSON(void)
{
  int len = snprintf(txBuffer, TX_BUFFER_SIZE,
    "{\"rpm\":%.1f,\"current_A\":%.2f,\"voltage_V\":%.1f,\"temperature_C\":%.1f,\"vibration_mm_s\":%.2f,\"load_pct\":%.0f,\"torque_Nm\":%.1f,\"power_kW\":%.2f}\r\n",
    motor.rpm,
    motor.current_A,
    motor.voltage_V,
    motor.temperature_C,
    motor.vibration_mm_s,
    motor.load_pct,
    motor.torque_Nm,
    motor.power_kW
  );

  if (len > 0 && len < TX_BUFFER_SIZE)
  {
    /* Non-blocking or bounded timeout UART transmission */
    HAL_UART_Transmit(&huart2, (uint8_t*)txBuffer, len, 50);
  }
}

/**
  * @brief Updates demonstration telemetry using plausible motor curves.
  * @note This runs entirely on the STM32 ARM Cortex-M4 core.
  */
void Update_Demonstration_Telemetry(uint32_t tickMs)
{
  float timeSec = tickMs / 1000.0f;

  /* Check User Blue Pushbutton (B1 - PC13): If pressed, simulate high load / stress */
  if (HAL_GPIO_ReadPin(GPIOC, GPIO_PIN_13) == GPIO_PIN_RESET)
  {
    motor.load_pct = 90.0f;
  }
  else
  {
    /* Dynamic sinusoidal load variation between 30% and 75% */
    motor.load_pct = 50.0f + 22.0f * sinf(timeSec * 0.15f);
  }

  /* Speed profile: Ramp up through urban and highway speeds (2,500 to 5,500 RPM) */
  motor.rpm = 4000.0f + 1400.0f * sinf(timeSec * 0.25f);
  if (motor.rpm < 0.0f) motor.rpm = 0.0f;

  /* Estimated Torque (Nm) = Load fraction * Base Peak (310 Nm) */
  motor.torque_Nm = (motor.load_pct / 100.0f) * 180.0f + 5.0f * sinf(timeSec * 1.5f);

  /* Phase Current RMS: Iq = Torque / Kt (0.88) + Idle (12A) */
  motor.current_A = (motor.torque_Nm / 0.88f) + 12.0f + (sinf(timeSec * 10.0f) * 0.8f);

  /* DC Bus Voltage: Nominal 400V with inverter draw sag */
  motor.voltage_V = 400.0f - (motor.current_A * 0.25f) + (sinf(timeSec * 4.0f) * 1.2f);

  /* Stator Temperature: Gradual rise and convective cooling equilibrium */
  float targetTemp = 30.0f + (motor.current_A * 0.45f);
  motor.temperature_C += (targetTemp - motor.temperature_C) * 0.005f;

  /* Mechanical Power: P = Torque * Omega / 1000 */
  float omega = (motor.rpm * 2.0f * 3.14159f) / 60.0f;
  motor.power_kW = (motor.torque_Nm * omega) / 1000.0f;

  /* Vibration RMS: ISO 10816 Zone A/B baseline with speed-dependent harmonic */
  motor.vibration_mm_s = 0.65f + 0.85f * powf(motor.rpm / 12000.0f, 2.0f) + (sinf(timeSec * 25.0f) * 0.08f);
}

#if USE_REAL_SENSORS
/**
  * @brief Placeholder for reading real physical hardware sensors.
  *        Connect real sensor inputs to the Nucleo headers and uncomment:
  */
void Read_Physical_Sensors(void)
{
  /* 1. Read Speed from Quadrature Encoder on Timer 2:
   * uint32_t encoderPulses = __HAL_TIM_GET_COUNTER(&htim2);
   * motor.rpm = (encoderPulses * 60.0f) / (PULSES_PER_REV * DT);
   */

  /* 2. Read Phase Current from LEM Current Transducer on ADC1 Channel 0 (PA0):
   * HAL_ADC_Start(&hadc1);
   * HAL_ADC_PollForConversion(&hadc1, 10);
   * uint32_t adcRaw = HAL_ADC_GetValue(&hadc1);
   * float voltage = (adcRaw * 3.3f) / 4095.0f;
   * motor.current_A = (voltage - 1.65f) / SENSITIVITY_V_PER_A;
   */

  /* 3. Read Stator Temperature from NTC Thermistor on ADC1 Channel 1 (PA1):
   * // Steinhart-Hart equation calculation
   */

  /* 4. Read Vibration Accelerometer over I2C1 (MPU6050 / ADXL345):
   * // Compute FFT or RMS velocity over 100ms sample window
   */
}
#endif

/**
  * @brief System Clock Configuration (180 MHz from 8 MHz HSE via ST-LINK or HSI)
  */
void SystemClock_Config(void)
{
  RCC_OscInitTypeDef RCC_OscInitStruct = {0};
  RCC_ClkInitTypeDef RCC_ClkInitStruct = {0};

  __HAL_RCC_PWR_CLK_ENABLE();
  __HAL_PWR_VOLTAGESCALING_CONFIG(PWR_REGULATOR_VOLTAGE_SCALE1);

  /* Initializes the RCC Oscillators */
  RCC_OscInitStruct.OscillatorType = RCC_OSCILLATORTYPE_HSI;
  RCC_OscInitStruct.HSIState = RCC_HSI_ON;
  RCC_OscInitStruct.HSICalibrationValue = RCC_HSICALIBRATION_DEFAULT;
  RCC_OscInitStruct.PLL.PLLState = RCC_PLL_ON;
  RCC_OscInitStruct.PLL.PLLSource = RCC_PLLSOURCE_HSI;
  RCC_OscInitStruct.PLL.PLLM = 16;
  RCC_OscInitStruct.PLL.PLLN = 360;
  RCC_OscInitStruct.PLL.PLLP = RCC_PLLP_DIV2;
  RCC_OscInitStruct.PLL.PLLQ = 2;
  RCC_OscInitStruct.PLL.PLLR = 2;
  HAL_RCC_OscConfig(&RCC_OscInitStruct);

  /* Activate the Over-Drive mode for 180 MHz */
  HAL_PWREx_EnableOverDrive();

  /* Initializes the CPU, AHB and APB buses clocks */
  RCC_ClkInitStruct.ClockType = RCC_CLOCKTYPE_HCLK|RCC_CLOCKTYPE_SYSCLK
                              |RCC_CLOCKTYPE_PCLK1|RCC_CLOCKTYPE_PCLK2;
  RCC_ClkInitStruct.SYSCLKSource = RCC_SYSCLKSOURCE_PLLCLK;
  RCC_ClkInitStruct.AHBCLKDivider = RCC_SYSCLK_DIV1;
  RCC_ClkInitStruct.APB1CLKDivider = RCC_HCLK_DIV4;
  RCC_ClkInitStruct.APB2CLKDivider = RCC_HCLK_DIV2;
  HAL_RCC_ClockConfig(&RCC_ClkInitStruct, FLASH_LATENCY_5);
}

/**
  * @brief USART2 Initialization (Virtual COM Port connected to ST-LINK)
  * Pinout: PA2 -> USART2_TX, PA3 -> USART2_RX
  */
static void MX_USART2_UART_Init(void)
{
  huart2.Instance = USART2;
  huart2.Init.BaudRate = 115200;
  huart2.Init.WordLength = UART_WORDLENGTH_8B;
  huart2.Init.StopBits = UART_STOPBITS_1;
  huart2.Init.Parity = UART_PARITY_NONE;
  huart2.Init.Mode = UART_MODE_TX_RX;
  huart2.Init.HwFlowCtl = UART_HWCONTROL_NONE;
  huart2.Init.OverSampling = UART_OVERSAMPLING_16;
  if (HAL_UART_Init(&huart2) != HAL_OK)
  {
    /* Initialization Error */
    while (1);
  }
}

/**
  * @brief GPIO Initialization Function
  */
static void MX_GPIO_Init(void)
{
  GPIO_InitTypeDef GPIO_InitStruct = {0};

  /* GPIO Ports Clock Enable */
  __HAL_RCC_GPIOC_CLK_ENABLE();
  __HAL_RCC_GPIOA_CLK_ENABLE();
  __HAL_RCC_GPIOB_CLK_ENABLE();

  /* Configure User LED (LD2) on PA5 */
  HAL_GPIO_WritePin(GPIOA, GPIO_PIN_5, GPIO_PIN_RESET);
  GPIO_InitStruct.Pin = GPIO_PIN_5;
  GPIO_InitStruct.Mode = GPIO_MODE_OUTPUT_PP;
  GPIO_InitStruct.Pull = GPIO_NOPULL;
  GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_LOW;
  HAL_GPIO_Init(GPIOA, &GPIO_InitStruct);

  /* Configure User Blue Button (B1) on PC13 */
  GPIO_InitStruct.Pin = GPIO_PIN_13;
  GPIO_InitStruct.Mode = GPIO_MODE_INPUT;
  GPIO_InitStruct.Pull = GPIO_NOPULL;
  HAL_GPIO_Init(GPIOC, &GPIO_InitStruct);

  /* Configure USART2 GPIO: PA2 -> TX, PA3 -> RX */
  GPIO_InitStruct.Pin = GPIO_PIN_2 | GPIO_PIN_3;
  GPIO_InitStruct.Mode = GPIO_MODE_AF_PP;
  GPIO_InitStruct.Pull = GPIO_NOPULL;
  GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_VERY_HIGH;
  GPIO_InitStruct.Alternate = GPIO_AF7_USART2;
  HAL_GPIO_Init(GPIOA, &GPIO_InitStruct);
}

/**
  * @brief  This function is executed in case of error occurrence.
  */
void Error_Handler(void)
{
  __disable_irq();
  while (1)
  {
  }
}
