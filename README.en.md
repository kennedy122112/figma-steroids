# figma-steroids

<p align="center">
  <a href="README.md">🇪🇸 Español</a> | <a href="README.en.md">🇺🇸 English</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.15.0-blue?style=for-the-badge" alt="Version 0.15.0">
  <img src="https://img.shields.io/badge/works_with-Claude_Code_·_Codex_·_OpenCode-D97757?style=for-the-badge" alt="Works with Claude Code, Codex and OpenCode">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/kennedy122112/figma-steroids?style=for-the-badge&color=green" alt="MIT license"></a>
</p>

<p align="center">
  <img src="assets/banner.svg" alt="figma-steroids: from idea to Figma, and from Figma to your code" width="800">
</p>

<p align="center">
  <b>Your AI designs in Figma and turns it into your code. And the other way around.</b><br>
  Local, no MCP, no API key, no usage limits.
</p>

---

## What is it?

A set of **skills** and **agents** for your AI assistant (Claude Code, Codex, OpenCode…) that
teach it to work in **Figma Desktop**: design with your design system, turn a design into code in
your stack, and bring a screen that already exists in your app into Figma.

Built on [figma-cli](https://github.com/silships/figma-cli) by Sil Bormüller.

## How it works

```
 You, in the chat ──► your AI + figma-steroids skills ──► figma-cli ──► plugin in Figma Desktop
 "design a login"                                        (on your machine)  (applies the changes)
```

1. You ask your AI for something in plain language.
2. The right skill kicks in on its own and tells the AI how to do it well (use your variables,
   your components, check the measurements…).
3. The AI runs **figma-cli** commands on your computer, and the **plugin** you have open in
   Figma applies them to your file.

**No MCP:** nothing goes through the cloud, you don't need a Figma token and your design never
leaves your machine. The plugin shows you live what the AI is doing and has a button to **pause** it.

### What you can ask

| You ask | What happens |
|---|---|
| *"Create a login screen with my design system"* | It builds it in Figma with your colors, text styles and components, fully editable |
| *"Implement the selected frame in my project"* | It writes the component in your stack (Angular, React, Lit, HTML…) reusing what you already have |
| *"Bring this screen of my app into Figma"* | It reads your app in the browser and rebuilds it in Figma with auto-layout and your variables |
| *"Check my file's consistency"* | Goes through every page, tells you which colors, text, spacing and buttons fall outside the system, and binds what already matches |
| *"Review the accessibility"* | It checks contrast, button and text sizes, and suggests fixes |
| *"Add dark mode"* | It creates the dark theme in Figma and carries it to your code |

## Installation

**You need:** [Figma Desktop](https://www.figma.com/downloads/) open,
[Node.js](https://nodejs.org/) 18.17 or later, and an AI assistant that works on your computer.
Works the same on **Windows, macOS and Linux**.

### 1. Run one command

```bash
npx -y github:kennedy122112/figma-steroids setup
```

It installs figma-cli, adds the skills to every AI you have (Claude Code, Codex, OpenCode,
Cursor), copies the Figma plugin, **puts its path on your clipboard** and opens its folder.

### 2. Import the plugin in Figma (first time only)

In Figma Desktop: **Plugins → Development → Import plugin from manifest…**, paste the path into
the file name and open it with **Plugins → Development → figma-steroids**.

> **On macOS you can't see the folder:** it's `~/.figma-steroids/figma-plugin/`, hidden because
> it starts with a dot. In Figma's dialog press **Cmd + Shift + G**, paste the path
> (<kbd>Cmd</kbd>+<kbd>V</kbd>) and press **Enter**. **Cmd + Shift + .** (period) also shows hidden
> folders, or drag the `manifest.json` from Finder onto Figma's dialog.

The command notices and shows **✓ Connected to Figma**. Done: start asking your AI for designs.

Next time you only open the plugin. If it stays on **"Buscando el daemon…"** (it happens after
restarting your computer), start figma-cli with `figma-cli daemon start` or ask your AI to
*"connect to Figma"*.

> Figma doesn't allow installing development plugins from outside: importing the plugin is the
> only step you do by hand.

<details>
<summary>Manual install, or through your AI's plugin system</summary>

1. `npm install -g figma-ds-cli`
2. The skills:
   - **Claude Code:** `/plugin marketplace add kennedy122112/figma-steroids` and
     `/plugin install figma-steroids@figma-steroids`. The Code tab of Claude Desktop has no
     `/plugin`: run `claude plugin marketplace add kennedy122112/figma-steroids` and
     `claude plugin install figma-steroids@figma-steroids` in a terminal, then start a new session.
   - **Codex:** `codex plugin marketplace add kennedy122112/figma-steroids` and
     `codex plugin add figma-steroids@figma-steroids`
   - **Others:** `npx -y github:kennedy122112/figma-steroids init --ai opencode --global`
     (or `codex`, `cursor`, `claude`, `universal`, `all`)
3. The plugin: `npx -y github:kennedy122112/figma-steroids plugin`, then step 2 above.
4. Start figma-cli (`figma-cli daemon start`), open the plugin and tell your AI *"connect to Figma"*.

</details>

### Updating

Run `setup` again, or in Claude Code with the plugin: `/plugin marketplace update figma-steroids`.

## Where does it work?

In any assistant that **works in a folder on your computer and can run commands**: Claude Code
(terminal, VS Code or the Code tab of Claude Desktop), Codex, OpenCode or Cursor.

It doesn't work in regular chats (claude.ai, ChatGPT) or in cloud versions, because they can't
see your Figma Desktop.

## Included skills

| Skill | What for |
|---|---|
| `figma-setup` | Checks and installs what's needed the first time |
| `figma-connect` | Connects to Figma Desktop |
| `figma-build-ui` | Designs screens and components with your design system |
| `figma-design-system` | Tokens, spacing, text styles, a button with variants, dark mode, icons |
| `figma-to-code` | Turns a design into code in your stack |
| `figma-from-code` | Brings a screen that already exists in your app into Figma |
| `figma-consistency-audit` | Reviews the whole file: what falls outside your design system, and binds it only when it's safe |
| `figma-a11y-review` | Reviews accessibility |
| `figma-handoff` | Exports images, tokens and specs for developers |

Plus three agents your AI can delegate to: one builds UI, one reviews designs and one keeps Figma
and the code in sync.

## Common problems

| Problem | Fix |
|---|---|
| "Plugin not detected" | Open the plugin in Figma and keep it open while you work |
| The plugin stays on "Buscando el daemon…" | figma-cli is off: `figma-cli daemon start` and reopen the plugin |
| Can't find `.figma-steroids` when importing (macOS) | In Figma's dialog press **Cmd + Shift + G** and paste `~/.figma-steroids/figma-plugin/manifest.json` |
| `/plugin` doesn't exist in Claude Desktop | Use `setup`, or `claude plugin marketplace add …` and `claude plugin install …` in a terminal |
| The daemon doesn't respond | `figma-cli daemon restart`, or ask your AI to reconnect |
| Changes land in another file | Keep only the file you want to work on open |
| `npm install -g` fails with permissions | Skip it: the skills fall back to `npx -p figma-ds-cli figma-cli` |
| The skills don't show up | Restart your AI. In Claude Code check `/plugin`; elsewhere, `npx -y github:kennedy122112/figma-steroids list` |

## Contributing

Skills and agents are Markdown files with instructions: anyone can improve them or add a new
stack. How, in [CONTRIBUTING.md](CONTRIBUTING.md). What changes in each version, in
[CHANGELOG.md](CHANGELOG.md).

## Credits

Thanks to [Sil Bormüller](https://github.com/silships) ([Into Design Systems](https://intodesignsystems.com))
for [figma-cli](https://github.com/silships/figma-cli), the foundation of all this (MIT license).
The Figma plugin in `figma-plugin/` starts from its FigCli plugin and adds the interface.

## License

[MIT](LICENSE)
