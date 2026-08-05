Ah, yes — that is actually the better approach.

Do **not** ask Claude to immediately rewrite the CSS. Give it:

1. **Minehut's original CSS** → so it understands the real DOM/classes/components.
2. **Your current UserStyle CSS** → so it understands what you already fixed.
3. **A premium design guide/spec** → so it has a target instead of blindly changing colours.

The mistake would be saying “make it premium”. Claude will often produce a generic glassmorphism redesign. You want a **design brief like a real product team would write**.

Use this as the guide:

---

# Minehut Premium Dashboard Redesign Guide

## Vision

Transform the Minehut dashboard into a world-class premium server management interface.

The final experience should feel like a product designed by a senior UI/UX team, comparable to:

* Linear
* Vercel Dashboard
* Stripe Dashboard
* Apple system applications
* Raycast
* Arc Browser

The goal is not "dark mode".

The goal is:

> A beautiful, premium, calm, powerful control center for managing Minecraft servers.

The interface should feel expensive, intentional, and polished.

---

# Core Principles

## 1. Avoid "AI UI"

The design must NOT look generated.

Avoid:

* random gradients
* excessive glow
* neon colours
* cyberpunk aesthetics
* excessive glass blur
* giant rounded cards everywhere
* rainbow accents
* fake futuristic styling

Premium software is usually restrained.

Every visual element must have a purpose.

---

# 2. Surface System

The dashboard should use a carefully designed elevation system.

Do not make everything the same dark grey.

Create a material hierarchy:

## Level 0 — Environment

The application background.

Feeling:

* OLED black
* calm
* infinite space

Example:

```
#08090B
```

---

## Level 1 — Navigation

Sidebar and persistent UI.

Feeling:

* slightly separated
* stable
* elegant

Use:

* subtle transparency
* subtle border
* very light depth

---

## Level 2 — Cards

Server cards and primary containers.

Feeling:

* physical object
* lifted from background

Should have:

* subtle gradient
* soft internal highlight
* controlled shadow
* clean border

---

## Level 3 — Interactive surfaces

Buttons, dropdowns, inputs.

Should feel:

* tactile
* responsive
* closer to user

---

# 3. Colour Philosophy

The colour system should feel premium.

Avoid oversaturation.

Accent:

Current:
Blue

Improve into:

A refined brand colour.

Properties:

Default:
calm

Hover:
brighter

Active:
strong

Glow:
subtle

Never:
neon

---

## Status Colours

Statuses should communicate information.

### Running

Should feel:

* alive
* successful
* active

Use:
emerald atmosphere

Not:
bright green box

---

### Stopped

Should feel:

* neutral
* inactive

---

### Error

Should feel:

* important
* controlled

Not:
large red warning blocks

---

# 4. Typography

Typography is one of the biggest differences between average and premium.

Goals:

* stronger hierarchy
* cleaner spacing
* better readability

Use:

Inter
Geist
SF Pro style

Rules:

Headings:
confident

Labels:
small and elegant

Metadata:
quiet

Numbers:
clear and technical

---

# 5. Server Cards

The server cards are the hero component.

They should feel like premium product cards.

Improve:

## Header

Server name:

* stronger
* cleaner
* more important

Status:

* elegant indicator

---

## Information

CPU/RAM/player information:

Should feel like a professional monitoring dashboard.

Avoid:
random boxes everywhere.

Use:

* spacing
* alignment
* typography

---

## Hover

Hover should feel like touching a physical object.

Effects:

* tiny elevation
* subtle border lighting
* slight background shift

Avoid:

* huge glow
* movement
* flashy animations

---

# 6. Motion Design

Motion should feel expensive.

Duration:

Fast:
100-150ms

Normal:
150-250ms

Slow:
250-400ms

Use:

* opacity
* colour
* shadow
* transform

Avoid:

* bouncing
* spinning
* exaggerated movement

---

# 7. Buttons

Buttons should feel tactile.

Primary:

Should have:

* controlled accent background
* subtle highlight
* premium hover

Secondary:

Should have:

* material surface
* clear border
* good contrast

Danger:

Should feel serious.

Not:
bright red gamer button.

---

# 8. Navigation

Sidebar should feel like a premium application shell.

Requirements:

* clear active state
* elegant indicator
* smooth transitions
* good spacing

Active item:

Should feel selected, not highlighted like a game menu.

---

# 9. Console Design

Console should feel like a professional developer tool.

Inspired by:

* VS Code terminal
* Linear logs
* GitHub actions

Requirements:

* readable colours
* good contrast
* elegant prompt
* clear errors/warnings

---

# 10. Accessibility

Must maintain:

* WCAG contrast
* keyboard focus
* reduced motion support
* readable text sizes

Premium design is accessible design.

---

# 11. Final Feeling

When someone opens the dashboard they should think:

"This feels like a $500/month enterprise product."

Not:

"This is a Minecraft server panel."

---

# Implementation Rules

When rewriting the UserStyle:

* Preserve Minehut functionality.
* Do not break Tailwind classes.
* Keep selectors maintainable.
* Use CSS variables.
* Remove redundant overrides.
* Improve the existing system rather than replacing randomly.
* Test every component.

Before coding:

Analyze:

1. Minehut original CSS
2. Existing UserStyle
3. DOM structure
4. Component patterns

Then create:

**Minehut Premium Dashboard v2**

---

Then send Claude:

```
Here is:
1. Minehut original CSS
2. My current UserStyle CSS

Your task:

Using the redesign guide below, redesign the existing theme into the highest quality premium dashboard theme possible.

Do not just recolor it.
Do not make a generic dark theme.
Do not add random effects.

Think like a senior product designer and frontend engineer.

[PASTE GUIDE]
```

---

That workflow will produce something much better than just "make this prettier". It gives Claude the **design north star** and lets it modify the existing architecture instead of creating AI-looking CSS.
