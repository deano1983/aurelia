import { ShareButton } from '@aurelia/core/share'

/** Share the rendered pitch through intent links, native share or LinkedIn. */
export function SharePitchButton({ subject, body }: { subject: string; body: string }) {
  return (
    <ShareButton
      post={{ text: body, title: subject }}
      appId="07-distribution-affiliate-engine"
      label="Share / Post pitch"
      heading="Share this pitch"
      className="w-full py-3 rounded-lg border border-emerald-500 bg-white text-sm font-semibold text-emerald-700 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
    />
  )
}
