# Brand and RTL design foundation

## Logo asset

The storefront uses `apps/web/public/brand/shimo-logo.png` for the Shimo Gift wordmark. Keep its proportions and colors intact; logos and other non-directional images are never mirrored in RTL layouts.

## Palette

Tokens live in `apps/web/src/styles/tokens.css`; component styles consume those tokens rather than repeating hex values. Primary and supporting colors are tuned for the storefront identity and text/control contrast. Semantic status colors communicate success, warning, error, and information; each state also has a visible text label or message.

| Token | HEX | Intended use |
| --- | --- | --- |
| Primary | `#24627A` | Main actions, links, focus outline, directional UI accents |
| Secondary | `#92D0DF` | Secondary actions and restrained branded surfaces; use dark text |
| Accent | `#577992` | Decorative accent or text on white only; not small text on the canvas |
| Background | `#E6EEF0` | Page canvas sampled from the logo background |
| Surface | `#FFFFFF` | Cards, form controls, dialogs |
| Text | `#252928` | Main text, sampled from the dark wordmark |
| Muted text | `#58676E` | Secondary copy and hints |
| Border | `#718991` | Control and card boundaries; darkened for non-text contrast |
| Success | `#346B57` | Success messages and badges |
| Warning | `#74530C` | Warning messages and badges |
| Error | `#963B42` | Error messages and invalid controls |
| Info | `#24627A` | Informational messages and badges |

Relative-luminance contrast ratios were checked against the main surfaces: text on the canvas is 12.52:1; primary on the canvas is 5.75:1 and on white 6.77:1; dark text on secondary is 8.63:1; accent on white is 4.61:1 (accent is not used for small text on the canvas); muted text on the canvas is 4.99:1; and the border on the canvas is 3.14:1. White text on semantic success, warning, error, and info colors is respectively 6.20:1, 7.03:1, 7.00:1, and 6.77:1. The page also uses visible labels, focus outlines, and state text so color is not the only cue.

## Type, spacing, and responsive behavior

The Arabic-first system uses `Noto Sans Arabic`, then `Segoe UI`, `Tahoma`, and `Arial` as system fallbacks. No remote font download or unnecessary weights are added. Body copy uses a 1.8 line-height. Tailwind's spacing scale is shared; page gutters, section spacing, reading width, radii, shadow, motion durations, easing, and breakpoints are centralized in `tokens.css`. Layouts use mobile-first styles and logical CSS properties such as `padding-inline`, `margin-inline`, `inset-inline`, and `text-align: start`.

## RTL and accessibility

The locale layout sets Arabic `lang` and RTL `dir`. UI direction comes from document direction rather than a whole-page flip. Only semantic next/previous arrows change direction. Components use native buttons, labels, inputs, selects, textarea, `details`/`summary`, and `dialog`; keyboard focus is visible. Buttons and fields have touch-friendly minimum sizes. Skeletons and transitions respect reduced-motion preferences, and high-contrast mode gets a system focus outline.

## Development showcase

Run the web app and visit `/ar/design-system`. This unindexed page is intended for local development and returns not-found in production. It demonstrates tokens, type, reusable controls, RTL navigation patterns, dropdown and dialog primitives, and responsive table behavior. It contains no storefront or admin workflow.
