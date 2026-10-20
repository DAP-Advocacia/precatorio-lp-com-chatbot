import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const alt = 'Premium Office Precatórios';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Preview de link (WhatsApp, Facebook, LinkedIn). Mesmo H1 do Hero, sobre o navy da marca.
export default async function OpengraphImage() {
  const logo = await readFile(join(process.cwd(), 'public', 'logo-white.png'));
  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: '0 90px',
          background: 'linear-gradient(180deg, #0B1B33 0%, #10233F 60%, #0B1B33 100%)',
          borderLeft: '16px solid #DAA520',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} width={243} height={120} alt="" style={{ marginBottom: 48 }} />
        <div
          style={{
            display: 'flex',
            fontSize: 66,
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            color: '#FFFFFF',
            maxWidth: 1000,
          }}
        >
          Tem um precatório para receber? Descubra quanto ele pode valer hoje.
        </div>
        <div style={{ display: 'flex', marginTop: 36, fontSize: 30, fontWeight: 600, color: '#8FB4EA' }}>
          Análise gratuita, feita por especialistas e sem compromisso.
        </div>
      </div>
    ),
    { ...size }
  );
}
