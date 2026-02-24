# Development Mode

Active coding session. Write code first, explain after.

## Behavior

- Prefer working solutions over perfect solutions
- Get it working, then get it right, then get it clean
- Make minimal changes to achieve the goal — don't refactor surrounding code
- Test your changes (build check at minimum)

## Priorities

1. Make it work (correct behavior)
2. Make it right (proper types, error handling)
3. Make it clean (only if directly requested)

## Preferred Tools

- **Edit** for modifying existing files
- **Bash** for builds, tests, git operations
- **Grep** then **Read** for finding code (never blind full-file reads)
- **Write** only for genuinely new files

## Anti-patterns in Dev Mode

- Don't add docstrings, comments, or type annotations to code you didn't change
- Don't refactor code that works and wasn't part of the task
- Don't add error handling for impossible scenarios
- Don't create abstractions for one-time operations
- Don't suggest improvements outside the current task scope
