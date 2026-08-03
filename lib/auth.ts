import { jwtVerify, SignJWT } from "jose";

export type SessionBombero = {
  bombero_id: string;
  numero_ingreso: number;
  nombre_completo: string;
  cargo: string;
};

export const SESSION_COOKIE = "guardia_bomberos_session";

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const JWT_ISSUER = "guardia-bomberos";
const JWT_AUDIENCE = "guardia-bomberos-web";

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET no está configurado o es muy corto. Agregá un valor de al menos 32 caracteres en .env.local."
    );
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(
  bombero: SessionBombero
): Promise<string> {
  return new SignJWT({ ...bombero })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string
): Promise<SessionBombero | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    if (
      typeof payload.bombero_id !== "string" ||
      typeof payload.numero_ingreso !== "number" ||
      typeof payload.nombre_completo !== "string" ||
      typeof payload.cargo !== "string"
    ) {
      return null;
    }
    return {
      bombero_id: payload.bombero_id,
      numero_ingreso: payload.numero_ingreso,
      nombre_completo: payload.nombre_completo,
      cargo: payload.cargo,
    };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
};
