export interface Env {
  DATABASE_URL: string;
  JWT_SECRET: string;
  R2_PUBLIC_URL: string;
  ALLOWED_ORIGINS: string;
  AVATARS: R2Bucket;
}

export interface AuthUser {
  id: string;
  email: string;
}

export type AppBindings = {
  Bindings: Env;
  Variables: {
    user: AuthUser;
  };
};
