# Contributing to oc-browserless

Thank you for your interest in contributing! We welcome contributions from the community.

## Development Setup

1. **Fork and clone the repository**

```bash
git clone https://github.com/rh-id/oc-browserless.git
cd oc-browserless
```

2. **Install dependencies**

```bash
bun install
```

3. **Make your changes**

Create a new branch for your feature or bugfix:

```bash
git checkout -b feature/your-feature-name
```

4. **Run tests**

```bash
bun test
```

5. **Lint and format**

```bash
bun run lint
bun run format
```

## Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Examples:

```
feat: add WebP format support for screenshots
fix: resolve memory leak in browser manager
docs: update API reference
```

## Code Style

- Use TypeScript for all new code
- Follow ESLint rules
- Use Prettier for formatting
- Add JSDoc comments for public APIs
- Keep functions small and focused

## Testing

- Write tests for new functionality
- Ensure all tests pass before submitting PR
- Add integration tests for browser operations

## Pull Request Process

1. Ensure all tests pass
2. Update documentation if needed
3. Add or update tests for your changes
4. Submit a pull request with a clear description

## Reporting Issues

When reporting bugs, please include:

- Clear description of the problem
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details (OS, Bun version, etc.)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
