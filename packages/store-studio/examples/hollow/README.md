# Hollow — example Store Studio project

A two-board Play listing (phone + feature graphic) using the `aurora-panorama` family. `boards[].source` holds the template and copy; `nodes` is empty so Studio materialises the boards on open.

```bash
# from packages/store-studio
node examples/hollow/generate-assets.mjs
npx @tigawanna/store-studio examples/hollow --open
```

The screenshots are generated locally instead of committed. After opening, edit freely — the board is marked `detached` once you change a node, and regeneration asks before replacing your edits.
