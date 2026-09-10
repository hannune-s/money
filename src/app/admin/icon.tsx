import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 300,
          background: '#FBBF24', // Yellow background for Admin
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#1F2937', // Dark gray text
          borderRadius: '128px',
          fontWeight: 'bold',
        }}
      >
        M
      </div>
    ),
    { ...size }
  )
}
