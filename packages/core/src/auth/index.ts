export {
  AureliaAuthProvider,
  useSession,
  DEFAULT_ROLE,
  IDLE_LOCK_MS,
  type AureliaAuthProviderProps,
  type AureliaUser,
  type ProfileUpdate,
  type SessionContextValue,
  type SessionStatus,
} from './AuthProvider'
export { RequireSession, NotConfiguredPanel, AuthPanel, type RequireSessionProps } from './RequireSession'
export {
  getSupabase,
  clearLegacySession,
  completeSignInFromUrl,
  authRedirectUrl,
  isNativePlatform,
  AUTH_STORAGE_KEY,
  LEGACY_SESSION_KEY,
  NATIVE_AUTH_CALLBACK,
} from './client'
export { readSupabaseConfig, getSupabaseConfig, type SupabaseConfig } from './config'
export {
  deriveRoomKey,
  newRoomSalt,
  saltToBase64,
  saltFromBase64,
  ROOM_KEY_ITERATIONS,
  ROOM_SALT_BYTES,
  MIN_PASSPHRASE_LENGTH,
} from './roomKey'
