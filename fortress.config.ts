import { FortressConfig } from '@mindfiredigital/nextjs-fortress';

export const fortressConfig: FortressConfig = {
  enabled: true,
  mode: 'development',
  
  logging: {
    enabled: true,
    level: 'debug',
    destination: 'console',
  },

  modules: {
    // 1. Deserialization Protection (CVE-2025-55182)
    deserialization: {
      enabled: true,
      native: false,
      maxDepth: 10,
      detectCircular: true,
    },

    // 2. Injection Detection (SQL, XSS, Command, Code)
    injection: {
      enabled: true,
      checks: ['sql', 'command', 'xss', 'codeInjection'],
    },

    // 3. Encoding Validation (Ghost Mode Protection)
    encoding: {
      enabled: true,
      blockNonUTF8: true,
      detectBOM: true,
    },

    // 4. CSRF Protection
    csrf: {
      enabled: false,
      cookieName: '_csrf',
      tokenSecret: process.env.CSRF_SECRET,
    },

    // 5. Rate Limiting
    rateLimit: {
      enabled: true,
      byIP: { 
        requests: 100, 
        window: 60000
      },
    },

    // 6. Content Validation
    content: {
      enabled: true,
      maxPayloadSize: 1048576,
    },

    // 7. Security Headers
    securityHeaders: {
      enabled: true,
    },
  },

  whitelist: {
    paths: ['/_next', '/favicon.ico', '/api/health'],
    ips: process.env.WHITELIST_IPS?.split(',') || [],
  },

  onSecurityEvent: async (event) => {
    // Log security events
    console.warn(`🚨 Security Event [${event.type}]:`, {
      severity: event.severity,
      message: event.message,
      path: event.request.path,
      ip: event.request.ip,
    });

    // Send to external monitoring (optional)
    // if (event.severity === 'critical') {
    //   await sendToSentry(event);
    // }
  },
};
