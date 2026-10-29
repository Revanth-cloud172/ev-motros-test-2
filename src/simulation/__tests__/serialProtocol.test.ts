import { describe, it, expect, vi } from 'vitest';
import {
  createTelemetryFromHardware,
  Stm32SerialManager,
  validateHardwarePacket,
} from '../serialProtocol';
import { formatTelemetryCsv } from '../exportUtils';
import { RawHardwarePacket } from '../types';

describe('STM32 Serial Communication & Protocol Unit Tests', () => {
  // 1. Packet Validation Tests
  describe('Hardware Packet Validation', () => {
    it('accepts valid STM32 JSON telemetry packet', () => {
      const validPkt = {
        rpm: 3200,
        current_A: 18.4,
        voltage_V: 360,
        temperature_C: 68.2,
        vibration_mm_s: 1.8,
        load_pct: 50,
      };

      const result = validateHardwarePacket(validPkt);
      expect(result.isValid).toBe(true);
      expect(result.packet?.rpm).toBe(3200);
      expect(result.packet?.current_A).toBe(18.4);
    });

    it('rejects packets with missing required fields', () => {
      const missingRpm = {
        current_A: 18.4,
        voltage_V: 360,
        temperature_C: 68.2,
        vibration_mm_s: 1.8,
      };

      const result = validateHardwarePacket(missingRpm);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('rpm');
    });

    it('rejects packets with values exceeding plausible physical limits', () => {
      const outOfBoundsRpm = {
        rpm: 25000, // Exceeds 18000 RPM limit
        current_A: 18.4,
        voltage_V: 360,
        temperature_C: 68.2,
        vibration_mm_s: 1.8,
      };

      const result = validateHardwarePacket(outOfBoundsRpm);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('RPM value');

      const negativeVib = {
        rpm: 3000,
        current_A: 18.4,
        voltage_V: 360,
        temperature_C: 68.2,
        vibration_mm_s: -2.5, // Negative vibration
      };
      const resultVib = validateHardwarePacket(negativeVib);
      expect(resultVib.isValid).toBe(false);
    });

    it('handles non-object inputs gracefully without throwing', () => {
      expect(validateHardwarePacket(null).isValid).toBe(false);
      expect(validateHardwarePacket(undefined).isValid).toBe(false);
      expect(validateHardwarePacket('not a json').isValid).toBe(false);
      expect(validateHardwarePacket(123).isValid).toBe(false);
    });
  });

  // 2. Derived Value Calculations & Identification
  describe('Derived vs Measured Values', () => {
    it('computes missing torque and power when not provided by STM32 and flags them as derived', () => {
      const raw: RawHardwarePacket = {
        rpm: 3000,
        current_A: 50.0,
        voltage_V: 400.0,
        temperature_C: 55.0,
        vibration_mm_s: 1.2,
        load_pct: 40,
      };

      const telemetry = createTelemetryFromHardware(raw, Date.now(), 5.0);

      expect(telemetry.dataSource).toBe('HARDWARE');
      expect(telemetry.speedRpm).toBe(3000);
      expect(telemetry.phaseCurrentA).toBe(50.0);

      // Torque and power were missing, so they must be calculated and flagged
      expect(telemetry.derivedFields.torque).toBe(true);
      expect(telemetry.derivedFields.power).toBe(true);
      expect(telemetry.derivedFields.health).toBe(true);
      expect(telemetry.torqueNm).toBeGreaterThan(0);
      expect(telemetry.powerKw).toBeGreaterThan(0);
    });

    it('preserves measured torque and power when provided by STM32 without marking them derived', () => {
      const rawWithTorquePower: RawHardwarePacket = {
        rpm: 4500,
        current_A: 80.0,
        voltage_V: 390.0,
        temperature_C: 65.0,
        vibration_mm_s: 1.4,
        torque_Nm: 75.5,
        power_kW: 35.6,
        health_index: 92,
      };

      const telemetry = createTelemetryFromHardware(rawWithTorquePower, Date.now(), 10.0);

      expect(telemetry.torqueNm).toBe(75.5);
      expect(telemetry.powerKw).toBe(35.6);
      expect(telemetry.healthIndex).toBe(92);

      expect(telemetry.derivedFields.torque).toBe(false);
      expect(telemetry.derivedFields.power).toBe(false);
      expect(telemetry.derivedFields.health).toBe(false);
    });
  });

  // 3. Serial Manager Line Stream Parsing
  describe('Serial Line Parser & Chunk Buffer', () => {
    it('parses valid newline-delimited JSON line and dispatches telemetry', () => {
      const onTelemetry = vi.fn();
      const onRawLine = vi.fn();
      const onStatusChange = vi.fn();
      const onStatsUpdate = vi.fn();

      const manager = new Stm32SerialManager({
        onTelemetry,
        onRawLine,
        onStatusChange,
        onStatsUpdate,
      });

      const line = '{"rpm":1500,"current_A":5.2,"voltage_V":24.0,"temperature_C":32.5,"vibration_mm_s":1.2,"load_pct":25}';
      const success = manager.parseAndDispatchLine(line);

      expect(success).toBe(true);
      expect(onTelemetry).toHaveBeenCalledTimes(1);
      expect(manager.stats.validCount).toBe(1);
      expect(manager.stats.invalidCount).toBe(0);

      const dispatched = onTelemetry.mock.calls[0][0];
      expect(dispatched.speedRpm).toBe(1500);
      expect(dispatched.phaseCurrentA).toBe(5.2);
      expect(dispatched.dataSource).toBe('HARDWARE');
    });

    it('rejects malformed syntax without crashing and increments error count', () => {
      const onTelemetry = vi.fn();
      const onRawLine = vi.fn();
      const onStatusChange = vi.fn();
      const onStatsUpdate = vi.fn();

      const manager = new Stm32SerialManager({
        onTelemetry,
        onRawLine,
        onStatusChange,
        onStatsUpdate,
      });

      const malformedLine = '{"rpm":1500, corrupt_data_without_closing_brace';
      const success = manager.parseAndDispatchLine(malformedLine);

      expect(success).toBe(false);
      expect(onTelemetry).not.toHaveBeenCalled();
      expect(manager.stats.validCount).toBe(0);
      expect(manager.stats.invalidCount).toBe(1);
    });
  });

  // 4. CSV Export with Data Source Distinction
  describe('CSV Export Data Source Tagging', () => {
    it('labels samples as HARDWARE or SIMULATION in exported CSV rows', () => {
      const raw: RawHardwarePacket = {
        rpm: 3200,
        current_A: 18.4,
        voltage_V: 360,
        temperature_C: 68.2,
        vibration_mm_s: 1.8,
        load_pct: 50,
      };
      const hwSample = createTelemetryFromHardware(raw, 1730160000000, 1.0);

      const csv = formatTelemetryCsv([hwSample]);
      const lines = csv.split('\n');

      expect(lines[0]).toContain('Data_Source');
      expect(lines[0]).toContain('Torque_Derived');
      expect(lines[1]).toContain('HARDWARE');
      expect(lines[1]).toContain('YES (Calc)');
    });
  });

  // 5. Browser Permissions & Security Handling Tests
  describe('Browser Serial Permissions & Security Handling', () => {
    it('flags SecurityError as BLOCKED without crashing or re-looping', async () => {
      const onStatusChange = vi.fn();
      const onRawLine = vi.fn();

      const manager = new Stm32SerialManager({
        onTelemetry: vi.fn(),
        onRawLine,
        onStatusChange,
        onStatsUpdate: vi.fn(),
      });

      // Mock navigator.serial with a requestPort that throws SecurityError
      const securityErr = new Error('requestPort() is not allowed in this context');
      securityErr.name = 'SecurityError';

      const mockRequestPort = vi.fn().mockRejectedValue(securityErr);
      Object.defineProperty(globalThis, 'window', {
        value: { isSecureContext: true, self: {}, top: {} },
        configurable: true,
        writable: true,
      });
      Object.defineProperty(globalThis.navigator, 'serial', {
        value: { requestPort: mockRequestPort },
        configurable: true,
        writable: true,
      });

      await manager.connect(115200);

      expect(onStatusChange).toHaveBeenCalledWith(
        'BLOCKED',
        expect.stringContaining('blocked by browser/iframe security')
      );
      expect(onRawLine).toHaveBeenCalledWith(
        expect.stringContaining('[SECURITY ERROR]'),
        true
      );
      // Ensure requestPort was called only once and not spammed
      expect(mockRequestPort).toHaveBeenCalledTimes(1);
    });

    it('handles NotFoundError user cancellation gracefully without error alarm', async () => {
      const onStatusChange = vi.fn();
      const onRawLine = vi.fn();

      const manager = new Stm32SerialManager({
        onTelemetry: vi.fn(),
        onRawLine,
        onStatusChange,
        onStatsUpdate: vi.fn(),
      });

      const cancelErr = new Error('No port selected by user');
      cancelErr.name = 'NotFoundError';

      const mockRequestPort = vi.fn().mockRejectedValue(cancelErr);
      Object.defineProperty(globalThis, 'window', {
        value: { isSecureContext: true },
        configurable: true,
        writable: true,
      });
      Object.defineProperty(globalThis.navigator, 'serial', {
        value: { requestPort: mockRequestPort },
        configurable: true,
        writable: true,
      });

      await manager.connect(115200);

      expect(onStatusChange).toHaveBeenCalledWith(
        'DISCONNECTED',
        expect.stringContaining('cancelled by the user')
      );
    });
  });
});
