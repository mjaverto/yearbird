# Agent Configuration

**FIRST ACTION (before responding to user):**
1. Run `echo $HOME` to get home path
2. Read `$HOME/agents.md`

**SECOND ACTION:**
4. Read `./docs/agents.md` for repo-specific context

Do this EVERY session. No exceptions. Then respond to user.

Repo note: no project board; skip project status updates.

## When finishing tasks

Make sure you verify the change. Use curl to see if the content is on production. Review if GitHub Actions actually finished deploying to main successfully. Just because you finished writing code doesn't mean you're finished with the job. 

Please give the user a summary of the task and the results in a table format using emojis to make it more engaging and easy to understand.

| Emoji | Description |
|-------|-------------|
| 🎉 | Task completed successfully |
| ❌ | Task failed |
| ⚠️ | Task warning |
| ℹ️ | Task information |
| 🔄 | Task in progress |
| 🔍 | Task debugging |
| 🔧 | Task fixing |
| 🔨 | Task building |
| 🔩 | Task assembling |
| 🔩 | Task assembling |