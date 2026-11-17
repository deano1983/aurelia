// @aurelia/core/share: intent links, native share, the ShareSheet UI and
// direct LinkedIn posting through Supabase edge functions.
export {
  buildShareTargets,
  composeBody,
  fitForNetwork,
  graphemeLength,
  lengthForNetwork,
  NETWORK_LABELS,
  NETWORK_LIMITS,
} from './targets'
export type { FitResult, NetworkId, SharePost, ShareTarget } from './targets'
export { canNativeShare, copyForInstagram, copyForTikTok, copyText, nativeShare } from './native'
export type { CopyForAppResult, NativeShareResult } from './native'
export {
  connectLinkedIn,
  consumeLinkedInReturn,
  defaultFunctionsUrl,
  describeLinkedInError,
  getAccessToken,
  getLinkedInStatus,
  getShareSupabase,
  logShare,
  postToLinkedIn,
} from './linkedin'
export type { LinkedInOptions, LinkedInPostResult, LinkedInStatus, LinkedInVisibility } from './linkedin'
export { ShareButton, ShareSheet } from './ShareSheet'
export type { ShareButtonProps, ShareSheetProps } from './ShareSheet'
