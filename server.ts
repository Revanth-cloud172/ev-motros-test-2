import express, { Request, Response } from 'express';
import http from 'http';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const httpServer = http.createServer(app);
const PORT = 3000;

app.use(express.json());

// Initialize Gemini client if API key is provided
let aiClient: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  aiClient = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// AI Diagnostic Specialist Endpoint
app.post('/api/gemini/diagnose', async (req: Request, res: Response) => {
  try {
    const { telemetry, activeFault, faultHistory, config } = req.body;

    if (!aiClient) {
      // Fallback rule-based diagnostic assessment if API key is not yet set
      return res.json({
        available: false,
        summary: 'Server running in local-telemetry mode (Gemini API key not configured in environment).',
        analysis: generateFallbackAnalysis(telemetry, activeFault),
      });
    }

    const prompt = `You are a Senior Electric Vehicle Powertrain Diagnostic & Reliability Engineer.
Analyze the following live telemetry and condition data from a simulated 150 kW Permanent Magnet Synchronous Motor (PMSM) EV traction drive:

Current Telemetry:
- Motor Speed: ${telemetry?.speedRpm?.toFixed(1) ?? 'N/A'} RPM
- Phase Current RMS: ${telemetry?.phaseCurrentA?.toFixed(2) ?? 'N/A'} A
- DC Bus Voltage: ${telemetry?.dcBusVoltageV?.toFixed(1) ?? 'N/A'} V
- Winding Temperature: ${telemetry?.windingTempC?.toFixed(1) ?? 'N/A'} °C (Ambient: ${config?.ambientTempC ?? 25} °C)
- Mechanical Torque: ${telemetry?.torqueNm?.toFixed(1) ?? 'N/A'} Nm
- Mechanical Power: ${telemetry?.powerKw?.toFixed(2) ?? 'N/A'} kW
- Vibration RMS: ${telemetry?.vibrationRms?.toFixed(2) ?? 'N/A'} mm/s (ISO 10816 threshold ~4.5 mm/s)
- Estimated Health Index: ${telemetry?.healthIndex?.toFixed(0) ?? 'N/A'} / 100
- Active Injected Fault: ${activeFault?.name ?? 'None (Normal Baseline)'}
- Fault Description: ${activeFault?.description ?? 'No active fault condition'}

Recent Diagnostic Warnings:
${faultHistory?.map((e: any) => `[${e.timestamp}] ${e.severity}: ${e.message}`).slice(-5).join('\n') || 'None'}

Provide a structured engineering diagnostic evaluation in valid JSON with these keys:
{
  "severityLevel": "NOMINAL" | "ADVISORY" | "WARNING" | "CRITICAL",
  "rootCauseAnalysis": "2-3 sentences explaining physics behind the symptom",
  "thermalElectromagneticAssessment": "Analysis of current density, stator copper losses (I^2*R), flux saturation or thermal runaway risk",
  "mechanicalIntegrityAssessment": "Vibration harmonics, bearing fatigue (L10 life), rotor dynamic imbalance, or eccentricity risks",
  "isoComplianceNote": "Brief reference to ISO 26262 functional safety, ISO 10816 vibration severity, or UN ECE R100 high-voltage safety",
  "recommendedActions": ["step 1", "step 2", "step 3"]
}
Return ONLY valid raw JSON without markdown code fences or backticks.`;

    const response = await aiClient.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '{}';
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      // In case text had formatting
      const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(clean);
    }

    return res.json({
      available: true,
      analysis: parsed,
    });
  } catch (error: any) {
    console.error('Gemini diagnostic error:', error);
    return res.status(500).json({
      error: 'Failed to generate diagnostic report',
      details: error.message,
    });
  }
});

function generateFallbackAnalysis(telemetry: any, activeFault: any) {
  const isNormal = !activeFault || activeFault.id === 'none';
  return {
    severityLevel: isNormal ? 'NOMINAL' : 'WARNING',
    rootCauseAnalysis: isNormal
      ? 'The traction motor is operating within calibrated electromechanical envelopes. Phase currents, thermal gradients, and harmonic vibrations match expected baseline curves.'
      : `Active state '${activeFault?.name || 'Abnormal'}' induces stress on PMSM subsystems. Observed parameters deviate from calibrated nominal baselines.`,
    thermalElectromagneticAssessment:
      telemetry?.windingTempC > 115
        ? 'High stator core thermal gradient detected. Sustained high winding temperature risks insulation class degradation (IEC 60034-1).'
        : 'Stator joule heating is safely dissipated through the cooling jacket.',
    mechanicalIntegrityAssessment:
      telemetry?.vibrationRms > 4.5
        ? 'Vibration levels exceed ISO 10816-3 Zone C boundary. Indicates probable rotor eccentricity, bearing raceway spalling, or structural resonance.'
        : 'Mechanical vibration is within ISO 10816 Zone A/B (rigid mount acceptable band).',
    isoComplianceNote:
      'Monitor continuously under ISO 26262 functional safety ASIL-B powertrain supervisory requirements.',
    recommendedActions: [
      isNormal ? 'Maintain routine scheduled inspection intervals.' : 'Reduce torque demand and throttle duty cycle.',
      'Log high-frequency telemetry samples for post-run FFT harmonic analysis.',
      'Check liquid cooling loop flow rate and inverter gate driver DC link stability.',
    ],
  };
}

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use('/ev-motors', express.static(path.resolve(__dirname, 'dist')));
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('/ev-motors/*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    // In AI Studio dev environment, HMR is disabled via DISABLE_HMR env var.
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server: httpServer },
        watch: isHmrDisabled ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`EV Motor Digital Twin server running at http://localhost:${PORT}`);
  });
}

startServer();
