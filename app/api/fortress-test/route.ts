import { NextRequest, NextResponse } from 'next/server';
import { createWithFortress } from '@mindfiredigital/nextjs-fortress';
import { fortressConfig } from '@/fortress.config';

const withFortress = createWithFortress(fortressConfig);

// This endpoint is protected by Fortress
export const POST = withFortress(
  async (request: NextRequest) => {
    try {
      const body = await request.json();
      
      // Your business logic here
      // Input is automatically validated by Fortress
      
      return NextResponse.json({ 
        success: true, 
        message: '✅ Request validated by Fortress',
        data: body,
        protections: [
          'Deserialization (CVE-2025-55182)',
          'SQL Injection',
          'XSS Attacks',
          'Command Injection',
          'Encoding Bypass',
        ]
      });
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid request' }, 
        { status: 400 }
      );
    }
  },
  {
    // Route-specific options
    rateLimit: { requests: 10, window: 60000 },
    maxPayloadSize: 512 * 1024, // 512KB
    requireCSRF: false,
  }
);

export async function GET() {
  return NextResponse.json({ 
    status: '🛡️ Fortress Active',
    version: '0.1.0',
    protections: [
      'Deserialization (CVE-2025-55182)',
      'SQL Injection',
      'XSS Attacks',
      'Command Injection',
      'Encoding Bypass (Ghost Mode)',
      'Rate Limiting',
      'CSRF Protection',
      'Security Headers',
    ]
  });
}
