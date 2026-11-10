import { createRemoteJWKSet, jwtVerify } from 'jose';

const GOOGLE_JWKS = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

// ตรวจ Firebase ID token → คืน uid (หรือโยน error). jwks ฉีดได้เพื่อทดสอบโดยไม่ต้องเรียก Google
export function makeVerifier(projectId, jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS))) {
  return async (token) => {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ['RS256'],
    });
    if (!payload.sub) throw new Error('no sub');
    return payload.sub;
  };
}
