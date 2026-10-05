<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Continuing this project

- Follow the user's original Lovable requirements in `docs/lovable-original-prompt.txt`.
- Preserve the existing Lovable theme, layout, typography, assets, and component patterns. Extend `src/components/app/ui-kit.tsx` and `src/components/ui/` when adding features; reuse the design tokens in `src/styles.css`.
- Use the existing React, TypeScript, TanStack Start, and Tailwind stack and file-based routing. Let the router generate `src/routeTree.gen.ts`.
- Keep Thai as the primary UI language and preserve the specified English menu names.
- External integrations and personal data remain simulated, with clear Demo labels as specified in the original prompt.
- Read `docs/development-baseline.md` for the imported project's current coverage and validation results.
