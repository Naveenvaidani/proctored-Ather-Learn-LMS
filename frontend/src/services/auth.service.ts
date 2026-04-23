import { apiRequest } from "./http";

export interface LoginRequest {
  email: string;
  password: string;
  recaptchaToken: string;
}

export interface SignupRequest {
  firstName: string;
  lastName?: string;
  email: string;
  password: string;
  recaptchaToken: string;
}

interface BackendLoginResponse {
  localId: string;
  email: string;
  displayName?: string;
  idToken: string;
  refreshToken?: string;
}

interface BackendSignupResponse {
  userId: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

function mapLoginResponse(payload: BackendLoginResponse): AuthResponse {
  return {
    token: payload.idToken,
    user: {
      id: payload.localId,
      name: payload.displayName || payload.email.split("@")[0],
      email: payload.email
    }
  };
}

export async function login(payload: LoginRequest): Promise<AuthResponse> {
  const response = await apiRequest<BackendLoginResponse>("/auth/login", {
    method: "POST",
    auth: false,
    body: JSON.stringify(payload)
  });

  return mapLoginResponse(response);
}

export async function signup(payload: SignupRequest): Promise<AuthResponse> {
  await apiRequest<BackendSignupResponse>("/auth/signup", {
    method: "POST",
    auth: false,
    body: JSON.stringify(payload)
  });

  return login({
    email: payload.email,
    password: payload.password,
    recaptchaToken: payload.recaptchaToken
  });
}
