---
version: 2
slug: "src-views-imagesview-vue"
primary_target: "src/views/ImagesView.vue"
related_targets: ["src/components/file-list/ImageAlbumView.vue","src/utils/albumVirtual.ts","src/styles/theme.css"]
---

# Surface: App shell + album

## Scope
Visitor mode: Operate (album) / Experience (diary scroll). Visual world: Sky Pocket + Timeline Spine. Signature surface: /images.

## Audience / job
Personal private album: browse by shoot day on phone and desktop; spine shows date and place; upload and files support the job.

## Constraints
Source-file upload; pure frontend; keep routes and Element Plus controls; beacon blue on actions, spine sky-blue on date rail only.

## Direction contract

THESIS: Album reads as a vertical diary — left date spine, right photo wells; refuse full-width day banners and card-in-card stage shells.
OWN-WORLD: Fog #e8f4ff, white wells, spine sky-blue #2a6fad / soft #d6ebff, beacon #2f7dff; 80px spine desktop / 60px mobile; diary year+day hierarchy; soft continuous rail + hollow nodes; 2-column well; section gaps like page breaks.
STORY: Scroll day by day; date and place on the spine; tap photo to preview; filters stay in a thin sticky bar.
FIRST VIEWPORT: Masthead one line + stats; below, first day’s spine label and two large tiles in the well; scroll continues the spine.
FORM: timeline-spine (major redesign; user lock; code-led).
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
