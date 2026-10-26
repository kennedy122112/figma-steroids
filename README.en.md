# figma-steroids

<p align="center">
  <a href="README.md">🇪🇸 Español</a> | <a href="README.en.md">🇺🇸 English</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.13.0-blue?style=for-the-badge" alt="Version 0.13.0">
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
| *"Review the accessibility"* | It checks contrast, button and text sizes, and suggests fixes |
| *"Add dark mode"* | It creates the dark theme in Figma and carries it to your code |

## Installation

**You need:** [Figma Desktop](https://www.figma.com/downloads/) open,
[Node.js](https://nodejs.org/) 18.17 or later, and an AI assistant that works on your computer.

> **Shortcut:** once figma-steroids is installed, tell your AI *"set up figma-steroids"* and
> the `figma-setup` skill checks everything and installs what's missing, asking you first.

### 1. Install figma-cli

```bash
npm install -g figma-ds-cli
```

### 2. Add the skills to your AI

**Claude Code** (inside Claude Code):

```
/plugin marketplace add kennedy122112/figma-steroids
/plugin install figma-steroids@figma-steroids
```

> **Using the Code tab in Claude Desktop?** `/plugin` isn't available there. Run the same thing
> from a terminal (on macOS: the **Terminal** app) and start a new session afterwards:
>
> ```bash
> claude plugin marketplace add kennedy122112/figma-steroids
> claude plugin install figma-steroids@figma-steroids
> ```

**Codex:**

```bash
codex plugin marketplace add kennedy122112/figma-steroids
codex plugin add figma-steroids@figma-steroids
```

**OpenCode, Cursor and others** (from your project folder):

```bash
npx -y github:kennedy122112/figma-steroids init --ai opencode
```

Swap `opencode` for `codex`, `cursor`, `claude`, `universal` or `all`. Add `--global` to make it
available in every project.

### 3. Add the plugin to Figma (once)

```bash
npx -y github:kennedy122112/figma-steroids plugin
```

It prints the path to a `manifest.json`. In Figma Desktop: **Plugins → Development → Import
plugin from manifest…** and pick that file.

> **Can't see the folder on macOS?** The file lives in `~/.figma-steroids/figma-plugin/`, which
> macOS hides because its name starts with a dot. In Figma's file picker:
>
> - press **Cmd + Shift + G**, paste `~/.figma-steroids/figma-plugin/manifest.json` and press **Enter**, or
> - press **Cmd + Shift + .** (period) to show hidden folders.
>
> You can also open the folder in Finder with `open ~/.figma-steroids/figma-plugin`, drag
> `manifest.json` onto Figma's picker and click **Open**.

### 4. Connect

First start the figma-cli daemon (the local program the plugin talks to):

```bash
figma-cli daemon start
```

It stops when you restart your computer; run it again whenever you need it.

Open the plugin in Figma (**Plugins → Development → figma-steroids**) and tell your AI:

> *"Connect to Figma"*

Done: you can start asking for designs. Keep the plugin open while you work.

### Updating

- **Claude Code:** `/plugin marketplace update figma-steroids`
- **With the installer:** `npx -y github:kennedy122112/figma-steroids update`

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
| `figma-a11y-review` | Reviews accessibility |
| `figma-handoff` | Exports images, tokens and specs for developers |

Plus three agents your AI can delegate to: one builds UI, one reviews designs and one keeps Figma
and the code in sync.

## Common problems

| Problem | Fix |
|---|---|
| "Plugin not detected" | Open the plugin in Figma and keep it open while you work |
| The plugin is stuck on "Buscando el daemon…" (looking for the daemon) | The daemon is off: `figma-cli daemon start`, then reopen the plugin |
| Can't find `.figma-steroids` when importing the plugin (macOS) | In Figma's picker press **Cmd + Shift + G** and paste `~/.figma-steroids/figma-plugin/manifest.json` |
| `/plugin` doesn't exist in Claude Desktop | Run `claude plugin marketplace add …` and `claude plugin install …` in a terminal |
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
