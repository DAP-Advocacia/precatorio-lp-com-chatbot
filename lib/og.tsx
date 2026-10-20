import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const OG_SIZE = { width: 1200, height: 630 };

// Preview de link (WhatsApp, Facebook, LinkedIn) no navy da marca: logo, título e subtítulo.
export async function renderOg(headline: string, sub: string, kicker?: string) {
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
        <img src={logoSrc} width={243} height={120} alt="" style={{ marginBottom: kicker ? 32 : 48 }} />
        {kicker && (
          <div style={{ display: 'flex', marginBottom: 18, fontSize: 28, fontWeight: 700, color: '#DAA520' }}>
            {kicker}
          </div>
        )}
        <div
          style={{
            display: 'flex',
            fontSize: 62,
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            color: '#FFFFFF',
            maxWidth: 1000,
          }}
        >
          {headline}
        </div>
        <div style={{ display: 'flex', marginTop: 32, fontSize: 30, fontWeight: 600, color: '#8FB4EA' }}>{sub}</div>
      </div>
    ),
    { ...OG_SIZE }
  );
}
