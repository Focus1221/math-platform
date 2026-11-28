import { ImageResponse } from 'next/og';

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0284C7 0%, #6366F1 55%, #0D9488 100%)',
        }}
      >
        <svg width="290" height="290" viewBox="0 0 100 100" fill="none">
          <path
            d="M 76 18 H 24 L 54 50 L 24 82 H 76"
            stroke="#FFFFFF"
            strokeWidth="11"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { width: 512, height: 512 }
  );
}