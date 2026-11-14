# Contributing to ORBIT

Thank you for taking an interest in ORBIT. Contributions should make the observatory more useful, accessible, reliable, or scientifically transparent.

## Before you start

- Search open and closed issues and pull requests to avoid duplicate work.
- For a substantial change, open an issue first to discuss scope and approach.
- For a bug report, include browser/device details, steps to reproduce, expected behaviour, and actual behaviour.
- For a scientific or data-related change, include authoritative references and explain the assumptions.

## Development setup

Requirements: Node.js 22 or later.

```bash
git clone https://github.com/whtankus/Orbit.git
cd Orbit
npx serve .
```

Run the automated checks before submitting:

```bash
npm run check
npm test
```

## Pull request workflow

1. Create a focused branch from `main`.
2. Make the smallest coherent change that addresses the issue.
3. Add or update regression tests when behaviour or calculations change.
4. Run both project checks locally.
5. Open a pull request against `main`, describe the motivation, implementation, and validation, and link the related issue.
6. Include screenshots or a short recording for visible UI changes when practical.

Do not bundle unrelated visual changes, refactors, and astronomy-model changes into one pull request.

## Project-specific expectations

### Scientific integrity
- Preserve source attribution and licence notices for external datasets, textures, and imagery.
- Cite authoritative sources for new astronomical facts or data.
- Distinguish measured/catalogued data, mathematical approximations, and artistic illustration.
- Document validity ranges, coordinate frames, time scales, and known error sources when changing calculations.
- Do not silently replace the JPL approximate element model or alter observer-coordinate conventions.

### Interface and accessibility
- Check desktop, tablet, and narrow mobile layouts.
- Keep controls readable and keyboard-operable.
- Preserve accessible names, focus visibility, and reduced-motion support.
- Avoid relying on colour alone to communicate state.
- Keep animations purposeful and provide a reduced-motion path.

### Performance and reliability
- Avoid unnecessary per-frame allocations in the Three.js render loop.
- Dispose of WebGL resources when removing scene objects.
- Pause or reduce work when the page is hidden.
- Keep automated tests deterministic and independent of live network services.

## Scope and licensing

The repository currently has no project-wide open-source licence. Please do not assume that contributing grants broad reuse rights or that existing code is available under an open-source licence. Discuss licensing questions with the repository owner before contributing code you intend others to reuse.
