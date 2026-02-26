# resonanceflow

Production-quality MVP web app for desktop Chrome/Edge that connects to BLE chest straps (for example Wahoo TICKR), streams RR intervals, and runs full HRV analysis in a Web Worker.

## Tech stack

- React + TypeScript + Vite
- Web Bluetooth (Heart Rate service)
- uPlot (realtime and report charts)
- Dexie (IndexedDB local session storage)
- Worker-based client-side analytics (artifact filtering + time/frequency metrics + coherence score)

## Supported platform

- Desktop Chrome / Edge with Web Bluetooth enabled
- Secure context required: run on `http://localhost` in development, and `https://` in production
- iOS browsers do not support Web Bluetooth for this use case, so BLE chest-strap connection will not work on iPhone/iPad browsers

## Quick start

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start dev server:
   ```bash
   npm run dev
   ```
3. Open the shown localhost URL (typically `http://localhost:5173`)
4. Click **Connect** and select your chest strap in the browser Bluetooth chooser

## Scripts

- `npm run dev` - start dev server
- `npm run build` - type-check project references and build production bundle
- `npm run preview` - preview production build
- `npm run lint` - ESLint checks
- `npm run format` - Prettier formatting
- `npm run typecheck` - strict TypeScript check
- `npm run test` - Vitest run (optional)

## BLE details

The app connects to:

- Heart Rate Service: `0x180D`
- Heart Rate Measurement Characteristic: `0x2A37`

Packet parsing handles flags:

- `0x01`: HR value is `uint16` (otherwise `uint8`)
- `0x08`: energy expended field present (2 bytes skipped)
- `0x10`: RR intervals present (`uint16` values in 1/1024 seconds)

RR values are converted to seconds before analysis.

## Modes

- **Measurement**
  - guided 30/45/60 second recording
  - live HR and RR charts
  - automatic analysis on completion
- **HRVB Session**
  - breathing pacer (default 5.4 breaths/min, adjustable)
  - live HR/RR charts
  - start/stop/save/export JSON/CSV
- **Calibration**
  - guided frequency scan (Hz)
  - per-frequency coherence score
  - recommended best breathing frequency output

## Theme behavior

Theme selector supports:

- `Auto` (follows system `prefers-color-scheme`)
- `Light`
- `Dark`

Theme preference is persisted in local storage.

## Data and analysis

- Sessions are stored locally in IndexedDB (Dexie)
- No backend required; all computation is client-side
- Worker pipeline:
  - artifact cleanup: RR outside `[0.3, 2.0]` removed + Hampel/MAD outlier filtering
  - time-domain metrics: mean HR, mean RR, RMSSD, SDNN, pNN50
  - frequency-domain: resample to uniform grid (4 Hz) + Welch PSD
  - coherence score: target-band power (target ±0.015 Hz) / total 0.04–0.4 Hz power, with peak frequency and power

## Wahoo TICKR note

Wahoo TICKR devices commonly expose RR intervals through the standard heart rate characteristic. If RR values are missing during streaming, the selected firmware/device packet may not include RR fields in each measurement.

## Troubleshooting

### “Web Bluetooth not available”

- Use desktop Chrome or Edge
- Confirm the page is loaded from `http://localhost` (dev) or `https://` (prod)
- Check browser flags/policies if Bluetooth is disabled

### Permission or connection errors

- Re-run **Connect** and accept the browser chooser/permission prompts
- Ensure chest strap is awake, worn correctly, and not locked by another app/device
- Turn host Bluetooth off/on and retry

### Disconnect/reconnect workflow

1. Click **Disconnect**
2. Wait a few seconds
3. Re-enable chest strap pairing mode if needed
4. Click **Connect** and reselect device

### No RR intervals even when HR appears

- Device can send HR without RR on some packets
- Ensure firmware and recording mode support RR export
- Try reconnecting and waiting for steady measurement packets
