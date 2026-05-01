pi-mono is not a single application, but a comprehensive, open-source AI agent toolkit and a TypeScript monorepo created by Mario Zechner (known as `badlogic`). Think of it as a "Swiss Army Knife" for building, deploying, and managing your own custom AI assistants, particularly coding agents.

The graphic below demonstrates how the different components of pi-mono work together:

```mermaid
flowchart LR
    A[pi-mono (Main GitHub Repo)]
    A --> B[Packages<br>Core Libraries]
    A --> D[Extension Ecosystem<br>Built by Community]

    B --> C[pi-ai<br>Unified LLM API]
    B --> E[pi-agent-core<br>Agent Runtime]
    B --> F[pi-coding-agent<br>Interactive CLI]
    B --> G[pi-tui<br>Terminal UI]
    B --> H[pi-web-ui<br>Web Components]
    B --> I[pi-mom<br>Slack Bot]
    B --> J[pi-pods<br>vLLM Manager]

    F --> K[User Customization]
    K --> L[Skills<br>Simple Markdown Guides]
    K --> M[Extensions<br>TypeScript/JS Add-ons]
    K --> N[Prompt Templates<br>Text Shortcuts]
    K --> O[Themes<br>Visual Customization]
```

### 🧠 What is pi-mono? (The Architecture)

*   **Design Philosophy**: The project was born from a philosophy of **minimalism and extreme extensibility**. The maintainer intentionally keeps the core light and avoids bloat. Instead of baking every feature into the codebase, pi-mono empowers you to add exactly what you need. A core tenet of this philosophy is a deliberate choice to not include built-in sub-agents, plan modes, or permission popups, pushing these customizations to the extension layer.
*   **Monorepo Structure**: The toolkit is organized into several key, interlocking packages found within the main GitHub repository:
    *   **`@mariozechner/pi-ai`**: A unified, multi-provider LLM API that functions as a single interface for models from OpenAI, Anthropic, Google, and many others.
    *   **`@mariozechner/pi-agent-core`**: The central agent runtime that manages tool calling and state. It's the engine that processes prompts and determines actions.
    *   **`@mariozechner/pi-coding-agent`**: This is the main interactive coding agent CLI that you directly interact with in your terminal. It's what most users refer to simply as "pi".
    *   **`@mariozechner/pi-tui`**: A dedicated Terminal UI library with differential rendering for building interactive components.
    *   **`@mariozechner/pi-web-ui`**: Web components for constructing AI chat interfaces.
    *   **`@mariozechner/pi-mom`**: A Slack bot that delegates messages to the pi coding agent, bringing AI assistance directly into your team's communication channel.
    *   **`@mariozechner/pi-pods`**: A CLI utility for managing vLLM deployments on GPU pods, useful for those running their own models.

### ✨ The Magic: How Skills, Extensions, and More Work

The true power of pi-mono lies in its layered customization system. You can teach your agent new tricks using these four main building blocks:

*   **Skills (SKILL.md)**: The simplest way to add knowledge. A Skill is reusable, on-demand instructions written in natural language within a `SKILL.md` file. The agent knows which skills are available and can load the relevant instructions when it needs to perform a specific task, preventing context overload.
    *   **How they work**: Each skill lives in its own directory with a `SKILL.md` file that has a YAML frontmatter (for a short description) and a Markdown body (for the full instructions). Pi checks for skills in `~/.pi/agent/commands/*.md` and `.pi/commands/*.md` directories.
*   **Extensions (TypeScript/JS)**: The heavy-lifters for deep customization. Extensions are TypeScript/JavaScript modules that directly hook into pi-agent's runtime to handle events, register new tools, or add custom UI components. They grant low-level access to modify core behavior.
    *   **How they work**: Extensions are loaded from `extensions/` directories and can do things like replace built-in tools entirely, add custom TUI components, or integrate with external services.
*   **Prompt Templates**: Streamline your daily workflows. These are Markdown text snippets saved in a `.pi/prompts/` directory. In the editor, you can type `/` followed by the template's name, and it will automatically expand into a full prompt.
    *   **How they work**: A template's filename becomes the command name (`review.md` becomes `/review`), and supports positional arguments like `$1`, `$2`, and `$@` for all arguments.
*   **Themes**: Control the agent's appearance. Themes allow you to visually customize the Terminal UI (TUI) to suit your preferences, making the interface more personal and comfortable to use.

### 🔧 Customizing Pi for Your Use Case

To build your own custom workflows, you can rely on this straightforward directory-driven architecture. Pi automatically discovers your customizations from these conventional locations:

| Customization Type | Global Location (User-wide) | Project Location (Per-Project) |
| :--- | :--- | :--- |
| **Extensions** | `~/.pi/agent/extensions/` | `.pi/extensions/` |
| **Skills** | `~/.pi/agent/skills/` | `.pi/skills/` |
| **Prompt Templates** | `~/.pi/agent/prompts/` | `.pi/prompts/` |
| **Themes** | `~/.pi/agent/themes/` | `.pi/themes/` |

You can also share your completed packages via npm or git.

#### Creating a Custom Tool (Extension)

Here’s a complete, step-by-step example of creating an extension that queries the GitHub API:

1.  **Set up the extension directory**: Create a new folder for your extension, for example `~/.pi/agent/extensions/github-tool/`. Inside, create an `index.ts` file.
2.  **Write the extension code**: Copy the following TypeScript code into `index.ts`. This defines a new tool, `github_repo_info`, that the agent can use.

```typescript
import { Tool, ToolContext } from "@mariozechner/pi-coding-agent";
import fetch from "node-fetch";

// This function creates and returns the tool definition
export default function createGitHubTool(): Tool {
  return {
    name: "github_repo_info",
    description: "Get information and statistics for a GitHub repository.",
    parameters: {
      type: "object",
      properties: {
        owner: { type: "string", description: "The username of the repository owner" },
        repo: { type: "string", description: "The name of the repository" }
      },
      required: ["owner", "repo"]
    },
    // The execute function is called when the agent uses this tool
    async execute(ctx: ToolContext, params) {
      // 1. Securely get the API key you've configured
      const apiKey = await ctx.modelRegistry.getApiKey("github");
      if (!apiKey) {
        throw new Error("GitHub API key not configured. Please set it in your settings.");
      }

      try {
        // 2. Call the GitHub API
        const response = await fetch(
          `https://api.github.com/repos/${params.owner}/${params.repo}`,
          { headers: { Authorization: `token ${apiKey}` } }
        );
        
        if (!response.ok) {
          throw new Error(`API request failed: ${response.statusText}`);
        }
        const data = await response.json();

        // 3. Format and return the result to the agent
        return `Repository: ${data.full_name}
Description: ${data.description || "No description"}
Stars: ${data.stargazers_count}
Forks: ${data.forks_count}
Last Updated: ${new Date(data.updated_at).toLocaleString()}`;
      } catch (error) {
        // 4. Handle errors gracefully and show a message in the UI
        ctx.ui.showError(`GitHub API call failed: ${error.message}`);
        throw error;
      }
    }
  };
}
```

3.  **Configure the API Key**: Before the tool can work, you need to securely store your GitHub token. Add it to your pi settings file (`~/.pi/agent/settings.json`) under the `apiKeys` section:
    ```json
    {
      "apiKeys": {
        "github": "ghp_YOUR_GITHUB_PERSONAL_ACCESS_TOKEN"
      }
    }
    ```
4.  **Restart pi**: Restart your pi agent. It will automatically detect the new extension in the directory. You can now ask it things like "What's the star count for the `badlogic/pi-mono` repo?"

#### A Note on Contributing Back

The project welcomes contributions, but be aware of its "contribution gate." New issues and pull requests from first-time contributors are auto-closed by default to manage the review load. Maintainers review these and reopen the ones that meet the project's high-quality bar.

The ecosystem is already thriving with community-built extensions. To jumpstart your ideas, you can explore a curated list of add-ons at the [`awesome-pi-agent` repository](https://github.com/qualisero/awesome-pi-agent), which includes everything from security auditors to interactive TUI canvases.