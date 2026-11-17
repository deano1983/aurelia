# 05 — GlowGrid Studio: Creator Consistency Radar & Sponsor Rate Card

Functionality from velvetcadence page:
- Streak + Media Kit tracking
- Brand Partnership & UGC Rate-Card Calculator (AUD)
- Creator / Handle, Positioning / Niche
- Combined Followers, Avg 30-Day Views / Video
- Creator Consistency Radar

## Recommended tech stack
| Layer | Recommendation | Rationale |
|-------|---------------|-----------|
| UI | React + Vite | Calculator inputs, live rate-card preview, streak calendar |
| Charts | Recharts or Chart.js | Consistency radar visualization, follower/view trends |
| Math | Decimal.js | AUD currency calculations avoid float rounding |
| Export | jsPDF or html-to-image | Media kit PDF / rate card download |
| Storage | localStorage | Creator profile persisted client-side |

## Interlink dependencies
- Rate card output feeds **07 Affiliate Engine** (sponsor pitches)
- Creator profile shared with **03 Voice Studio** (audience/writing style)
- Streak deadlines to **01 Timeline**

## Suggested folders
```
05-glowgrid-creator-radar/
  src/
    components/  CreatorProfile, StreakCalendar, RateCardCalculator, RadarChart
    utils/       audMoney, engagementRate, sponsorshipTier
  index.html
  package.json
```
