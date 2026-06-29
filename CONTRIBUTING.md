# Contributing

Thanks for your interest in contributing to smart-stick-loadbalancer. This is a small, focused package — contributions that keep it simple and beginner-friendly are most welcome.

## What's welcome

- Bug fixes
- Documentation improvements
- New routing strategies (add a `case` in `router.js`)
- Health check improvements
- Better error messages

## What to discuss first

Open an issue before starting work on anything large — new features, breaking config changes, or architectural shifts. Keeps everyone from wasting time.

## Getting started

```bash
git clone https://github.com/SwayamGupta12345/smart-stick-loadbalancer.git
cd smart-stick-loadbalancer
npm install
```

Create two simple backend servers (see the Quick Start in the README) and run `node src/index.js` against a local config to verify your changes work end-to-end.

## Submitting a pull request

1. Fork the repo and create a branch: `git checkout -b fix/your-fix-name`
2. Make your changes
3. Test manually with at least two backends
4. Update the README if you're changing behaviour or adding config options
5. Open a pull request with a clear description of what changed and why

## Adding a routing strategy

All routing logic lives in `src/router.js`. Add a new `case` to `selectBackend`, handle the `nextIndex` return value correctly, and document it in the README under **Routing Strategies**.

## Style

- No external linting setup — just match the style of the surrounding code
- Clear variable names over clever one-liners
- Add a comment if the logic isn't immediately obvious

## Reporting bugs

Open a GitHub issue with:
- What you expected to happen
- What actually happened
- Your config (remove any credentials)
- Node.js version

---

Small project, low friction. If something's unclear, just open an issue and ask.