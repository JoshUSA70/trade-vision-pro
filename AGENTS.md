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

- Keep demo market fixtures in one shared client-safe module and expose them through TanStack API routes; this makes the eventual live-provider switch isolated to server handlers.
- Keep the root `api/` directory for integration contracts and the executable HTTP routes under `src/routes/api/`; TanStack discovers routes only under `src/routes/`.
- Keep trading tables owner-scoped with RLS and no demo rows; sample market information stays explicitly labeled and separate from persisted account data.
