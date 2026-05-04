# **Architectural Blueprint and Engineering Guide for the Pi Coding Agent: Harness Design, Extension Development, and Self-Correcting Protocols**

The emergence of agentic computing has necessitated a fundamental shift in how large language models are deployed, moving away from simple request-response wrappers toward robust, state-aware execution environments. At the forefront of this evolution is the Pi coding agent, a terminal-based harness designed by Inflection AI and further refined by open-source contributors to bridge the gap between probabilistic reasoning and deterministic system operations.1 The architecture of Pi represents a departure from traditional "monolithic" assistants, favoring a "tiny core" philosophy that externalizes critical functions—memory, tools, and protocols—into a governable harness.3 This structural choice is not merely an aesthetic preference but a strategic response to the inherent limitations of stateless models, such as finite context windows and the inability to maintain continuity across long-horizon tasks.5

## **I. Structural Foundations: The Inflection 3.0 Model Suite**

The efficacy of any coding agent is inextricably linked to the capabilities of its underlying model. The Inflection 3.0 suite, released on March 7, 2024, introduces two distinct optimization profiles that serve different roles within the agentic ecosystem: Inflection 3 Pi and Inflection 3 Productivity.7 While Inflection 3 Pi is engineered for emotional intelligence and natural dialogue, the Productivity variant is the intended engine for structured agentic workflows, trading conversational nuance for strict instruction-following and accurate JSON generation.7

| Technical Attribute | Inflection 3 Pi | Inflection 3 Productivity |
| :---- | :---- | :---- |
| Optimization Target | Conversational empathy, safety | Precision, structured output |
| Context Window Size | 8,192 tokens | 8,192 tokens |
| Maximum Output Length | 1,024 tokens | 1,024 tokens |
| Input Cost (per 1M) | $2.50 | $2.50 |
| Output Cost (per 1M) | $10.00 | $10.00 |
| Use Case Suitability | Customer support, roleplay | Business automation, coding |

The architecture utilizes an 8K context window, a constraint that requires sophisticated management to avoid "context rot," a phenomenon where irrelevant information crowds out task-critical data, leading to degraded model performance.7 To manage this, the harness implements a multi-layer memory system that distinguishes between working context and retrieved memory, utilizing compaction hooks to summarize prior turns before they exceed the 8,192-token limit.2 This transition from the empathy-focused Inflection 2.5 model—which utilized over 10 million fine-tuning samples for conversational warmth—to the Productivity model marks the company's strategic pivot toward enterprise AI customization and autonomous agent services.7

## **II. The Anatomy of the Pi Agent Harness**

A harness is defined as the software infrastructure surrounding an AI model that manages everything except the model's actual reasoning.5 In the case of Pi, the harness acts as a "cybernetic governor," regulating the codebase and the execution environment through a continuous feedback loop.11 Unlike subprocess-based wrappers, the Pi harness is often embedded directly into the runtime, granting it full control over session lifecycle, event handling, and tool injection.13

### **The Nine-Stage Agentic Pipeline**

The execution of a single turn within the Pi harness follows a deterministic nine-stage pipeline designed to ensure safety and state consistency.14 This pipeline transforms a raw user intent into a series of validated actions.

1. **Settings Resolution**: The system first resolves the operating parameters, including model selection and API authentication.1  
2. **State Initialization**: The session manager establishes the current state, reading from the JSONL transcript to ensure continuity.13  
3. **Context Assembly**: The harness aggregates the system prompt, project-level instructions (from AGENTS.md or SYSTEM.md), and the most recent message history.2  
4. **Pre-Model Shapers**: A sequence of five compaction shapers (Budget Reduction, Snip, Microcompact, Context Collapse, and Auto-Compact) runs to optimize the payload for the 8K window.14  
5. **Model Call**: The finalized context is transmitted to the inference server, often utilizing a persistent WebSocket for low-latency continuation.14  
6. **Tool Dispatch**: If the model proposes an action, the harness intercepts the intent, validating it against defined schemas.5  
7. **Permission Gate**: The request is passed through a trust spectrum (ranging from plan to bypassPermissions) to ensure the action is authorized.14  
8. **Tool Execution**: The action is performed, typically in a sandboxed environment like a Docker container to prevent host compromise.14  
9. **Stop Condition Check**: The loop concludes if a termination condition is met (e.g., goal reached, context overflow, or explicit abort).14

### **State Management and Resilient Recovery**

The Pi architecture addresses the "continuity problem" of stateless models through an append-only JSONL session format.13 This design ensures that every interaction—user messages, model-generated tool calls, and execution results—is recorded as a discrete entry in a replayable transcript.13 This structure is inherently crash-safe; because entries are added chronologically with id and parentId links, the system can reconstruct the entire conversation tree upon restart.2

| Session Entry Type | Role in Persistence | Data Payload Examples |
| :---- | :---- | :---- |
| message | Conversational state | Content, role (user/assistant) |
| tool\_call | Intent capture | Tool name, arguments, ID |
| tool\_result | Observational feedback | stdout, stderr, exit code |
| compaction | Context management | Summary text, tokens removed |
| bookmark | Manual state checkpointing | Label, target message ID |

By serializing execution per session lane, the harness prevents tool conflicts and race conditions that could otherwise corrupt the environment.19 This serialization is a deliberate engineering choice that sacrifices parallel performance for the deterministic reliability required in production-grade AI infrastructure.19

## **III. WebSocket Protocols and Performance Optimization**

The transition from HTTP/SSE to WebSocket transport is a critical optimization for coding agents that engage in multi-turn tool chains.15 Traditional stateless loops are economically and computationally expensive because they require re-sending the entire conversation context with every tool result.15 The WebSocket mode addresses this mismatch by maintaining a persistent connection and a connection-local "previous-response" state.15

### **Handshake and Incremental Continuation**

The WebSocket handshake utilizes standard HTTP/1.1 headers to upgrade the connection, but it adds several security and protocol-specific fields to establish the trust boundary.21

HTTP

GET /v1/responses HTTP/1.1  
Host: api.inflection.ai  
Upgrade: websocket  
Connection: Upgrade  
Sec-WebSocket-Key:  
Sec-WebSocket-Version: 13  
Origin: https://hey.pi.ai  
Sec-WebSocket-Protocol: pi-v1-json

Once established, the protocol supports "incremental continuation," where the client sends only the new input items—such as the latest tool output—along with a previous\_response\_id.15 This architectural shift reduces network bandwidth and orchestration overhead, reportedly accelerating end-to-end execution by up to 40% in scenarios involving 20 or more tool calls.15 However, this in-memory path necessitates deliberate recovery logic; if the referenced previous\_response\_id is lost due to a socket timeout or server-side cache eviction, the harness must fall back to hydrating the state from persisted storage, which is a slower but more reliable path.15

## **IV. Extension Engineering and the Pi API**

Pi's "aggressively extensible" nature is realized through a TypeScript-based extension system that allows developers to modify the harness's core behavior without forking the underlying engine.2 Extensions are modular TypeScript files that hook into the agent's lifecycle events, register custom tools, and manipulate the TUI.22

### **The Extension Lifecycle and API Primitives**

An extension typically exports a factory function that receives the ExtensionAPI and an ExtensionContext.22 These primitives grant the extension the ability to notify users, prompt for confirmation, and monitor the internal state of the agent.22

| API Primitive | Functionality | Application |
| :---- | :---- | :---- |
| pi.on() | Subscribes to system events | Logging, security filters, UI updates |
| pi.registerTool() | Adds LLM-callable functions | External integrations, custom scripts |
| pi.registerCommand() | Adds slash commands (e.g., /search) | User-driven workflow triggers |
| ctx.ui.confirm() | Blocks execution for user approval | Safety gates for rm \-rf or sudo |
| pi.appendEntry() | Persists custom state to JSONL | Long-term memory, session metadata |

Extensions can be discovered globally in \~/.pi/agent/extensions/ or locally within a project's .pi/extensions/ directory.22 Because they are loaded via jiti, they support modern TypeScript features without requiring a pre-compilation step, facilitating a rapid "develop-and-reload" workflow.22

### **Advanced Tool Registration and Shimming**

When registering a tool, the developer must provide a JSON schema (typically via TypeBox) that defines the expected parameters.22 A critical feature for harness repair is the prepareArguments shim, an optional compatibility layer that runs before schema validation.22 This shim allows an extension to adaptively parse inputs from the model that might use legacy field names or malformed structures, effectively "self-correcting" the model's output before it triggers a validation error.22

TypeScript

// Example of a self-correcting tool shim  
export default function (pi: ExtensionAPI) {  
  pi.registerTool({  
    name: "file\_write",  
    parameters: Type.Object({ path: Type.String(), content: Type.String() }),  
    prepareArguments: (args) \=\> {  
      // Fix hallucinated 'filename' field used by older models  
      if (args.filename &&\!args.path) return { path: args.filename, content: args.content };  
      return args;  
    },  
    async execute(id, params) { /\* Write logic \*/ }  
  });  
}

This pattern of "interception and transformation" is the cornerstone of a resilient harness, as it prevents minor model hallucinations from causing catastrophic session failures.22

## **V. Harness Repair and Self-Correction Protocols**

A broken harness is often the result of "Harness Defects," which include schema misalignment, context drift, and state degradation.12 Repairing such a system requires a combination of feedforward controls (guides) and feedback controls (sensors).11

### **Feedforward Mechanisms: Steering and Constraints**

Feedforward controls anticipate unwanted outputs and steer the agent before it acts.11 In the Pi environment, this is achieved through "actual context engineering" using AGENTS.md and SYSTEM.md files.2 These files act as the "nervous system" instructions, providing the agent with a task skeleton or operational procedure that reduces improvisational errors like skipped steps or misordered operations.2

Another feedforward tactic is "path protection," implemented via extensions that monitor tool\_call events.22 If an agent attempts to write to a sensitive file like .env or delete a critical directory, the extension can block the call and provide a reason back to the model, forcing it to find a safer path.22

### **Feedback Loops: Sensors and State Recovery**

Feedback controls observe the agent's actions and provide signals for self-correction.11 The harness acts as a "cybernetic governor," capturing stdout, stderr, and exit codes from every tool execution and feeding them back into the context.6 A well-designed feedback loop surfaces errors in a readable format the model can interpret, effectively turning a failure into a "linter message" that guides the next attempt.6

When a coding agent is tasked with repairing its own broken harness, it follows a multi-phase investigation protocol 25:

1. **Codebase Investigation**: The agent uses bash or read tools to explore its own source files, typically located in \~/.pi/agent/.25  
2. **Schema Auditing**: It reads the TypeBox definitions in the extension files to identify where the model's internal "understanding" of a tool contradicts the actual implementation.25  
3. **Experimental Patching**: Using the /reload command, the agent can modify its own extensions on the fly, testing the fix in the same session without losing conversational state.2

## **VI. Native Task Execution and Stealth Strategies**

For an agent to manipulate the web or external systems effectively, it must bypass sophisticated anti-bot detection systems that look for signals of automation.27 Traditional browser automation often fails because it leaves "headless giveaways" like the navigator.webdriver flag or inconsistent GPU rendering signatures.27

### **The Stealth Browser Engine**

To achieve "Native Task Execution" that is indistinguishable from a human user, the harness must employ fortified headless browsers like Patchright, a Playwright fork with anti-fingerprint hardening.27

| Detection Signal | Stealth Bypass Strategy |
| :---- | :---- |
| navigator.webdriver | Flag disabled at the browser binary level |
| Headless SwiftShader GPU | WebGL/Canvas fingerprinting spoofed to match real GPUs |
| Predictable Mouse Patterns | Randomized jitter and human-like timing injected into actions |
| WebRTC IP Leaks | Proxy routing at the transport layer to hide real origin |
| Missing Audio/Speech APIs | Mocked Speech API with realistic voice profiles |

Beyond binary-level patches, the harness must manage "Behavioral Entropy"—randomizing request delays, varying scroll depths, and avoiding sequential page visits.30 The most effective stealth strategy, however, remains the "CDP Attachment" method, where the agent connects to the user's real browser session via the Chrome DevTools Protocol (CDP).27 By inheriting the user's active cookies and authenticated sessions, the agent bypasses the need for 2FA or CAPTCHA solving, which are common tripwires for bot detection.27

### **Evidence-Based Task Completion**

Reliability in web tasks is further enhanced through "Evidence-Based Task Completion".27 Instead of relying on brittle DOM selectors that break when a website updates its layout, the harness should use AI-driven decision-making that reads what is visible on the screen—using computer vision or semantic labeling—rather than hunting through the HTML source.32 This approach ensures that the agent's intent (e.g., "click the Submit button") remains stable even if the underlying id or class of the button changes.32

## **VII. Economic and Operational Resilience**

Harness engineering is not just a technical requirement but a primary driver of operational ROI.12 By implementing strategies like "KV-cache Locality" and "Semantic Routing," organizations can reduce token costs by up to 90%.12 This is achieved by ensuring "Prefix Stability"—keeping the system instructions and early conversation history stable so that the inference server can reuse the cached keys and values.12

| Efficiency Metric | Without Harness Optimization | With Harness Optimization |
| :---- | :---- | :---- |
| Latency per Tool Call | High (Full context re-send) | Low (WebSocket incremental) |
| Token Cost (per 1M) | Prohibitive ($3.00+ equivalent) | Optimized ($0.30 equivalent) |
| Success Rate (Long Task) | Low (Context drift/rot) | High (Compaction/Memory) |
| Security Perimeter | Fragile (Prompt-based) | Robust (Sandbox/Gate-based) |

As the industry moves away from "thin wrappers" and toward "AI-native platforms," the value of the harness becomes even more apparent.34 The companies succeeding in 2026 are those that have reinvested in "human architects" to build the nervous system (harness) that allows the AI brain to interact safely and effectively with production environments.35

## **VIII. Final Conclusions on Harness Integrity**

The architectural integrity of the Pi coding agent depends on the rigorous separation of reasoning from execution.12 A "broken" harness is rarely a failure of the model's intelligence but a failure of the infrastructure's ability to provide accurate feedback and maintain state.12 By leveraging TypeScript extensions for adaptive parsing, utilizing WebSockets for stateful continuation, and employing stealth browser engines for native execution, developers can create agents that are both autonomous and accountable.2 The ultimate goal of harness engineering is to minimize the "production gap" by transforming probabilistic predictions into deterministic, verifiable actions that survive the complexities of real-world deployment.12

#### **Works cited**

1. PI Agent Revolution: Building Customizable, Open-Source AI Coding Agents That Outperform Claude Code | atal upadhyay, accessed May 4, 2026, [https://atalupadhyay.wordpress.com/2026/02/24/pi-agent-revolution-building-customizable-open-source-ai-coding-agents-that-outperform-claude-code/](https://atalupadhyay.wordpress.com/2026/02/24/pi-agent-revolution-building-customizable-open-source-ai-coding-agents-that-outperform-claude-code/)  
2. Pi Coding Agent, accessed May 4, 2026, [https://pi.dev/](https://pi.dev/)  
3. Pi: The Minimal Agent Within OpenClaw | Armin Ronacher's Thoughts and Writings, accessed May 4, 2026, [https://lucumr.pocoo.org/2026/1/31/pi/](https://lucumr.pocoo.org/2026/1/31/pi/)  
4. Externalization in LLM Agents: A Unified Review of Memory, Skills, Protocols and Harness Engineering \- arXiv, accessed May 4, 2026, [https://arxiv.org/html/2604.08224v1](https://arxiv.org/html/2604.08224v1)  
5. What Is an Agent Harness? The Infrastructure That Makes AI Agents Actually Work, accessed May 4, 2026, [https://www.firecrawl.dev/blog/what-is-an-agent-harness](https://www.firecrawl.dev/blog/what-is-an-agent-harness)  
6. What Is an Agent Harness? The Architecture Behind Claude Code, Codex, and Cursor, accessed May 4, 2026, [https://www.mindstudio.ai/blog/what-is-agent-harness-architecture-explained](https://www.mindstudio.ai/blog/what-is-agent-harness-architecture-explained)  
7. Inflection 3 Productivity \- Specs, API & Pricing \- Puter Developer, accessed May 4, 2026, [https://developer.puter.com/ai/inflection/inflection-3-productivity/](https://developer.puter.com/ai/inflection/inflection-3-productivity/)  
8. Inflection 3 Pi \- API, Specs, Playground & Pricing \- Puter Developer, accessed May 4, 2026, [https://developer.puter.com/ai/inflection/inflection-3-pi/](https://developer.puter.com/ai/inflection/inflection-3-pi/)  
9. What Is OpenClaw? A Practical Guide to the Agent Harness Behind the Hype \- Zylon Blog, accessed May 4, 2026, [https://www.zylon.ai/resources/blog/what-is-openclaw-a-practical-guide-to-the-agent-harness-behind-the-hype](https://www.zylon.ai/resources/blog/what-is-openclaw-a-practical-guide-to-the-agent-harness-behind-the-hype)  
10. Inflection AI \- Pi AI Assistant \- Wiki | clawbot, accessed May 4, 2026, [https://clawbot.ai/wiki/applications/inflection-ai-pi-ai-assistant.html](https://clawbot.ai/wiki/applications/inflection-ai-pi-ai-assistant.html)  
11. Harness engineering for coding agent users \- Martin Fowler, accessed May 4, 2026, [https://martinfowler.com/articles/harness-engineering.html](https://martinfowler.com/articles/harness-engineering.html)  
12. Agent Harness Engineering — The Rise of the AI Control Plane | by Adnan Masood, PhD., accessed May 4, 2026, [https://medium.com/@adnanmasood/agent-harness-engineering-the-rise-of-the-ai-control-plane-938ead884b1d](https://medium.com/@adnanmasood/agent-harness-engineering-the-rise-of-the-ai-control-plane-938ead884b1d)  
13. Inside OpenClaw: How the World's Fastest-Growing AI Agent ..., accessed May 4, 2026, [https://dev.to/jiade/inside-openclaw-how-the-worlds-fastest-growing-ai-agent-actually-works-under-the-hood-4p5n](https://dev.to/jiade/inside-openclaw-how-the-worlds-fastest-growing-ai-agent-actually-works-under-the-hood-4p5n)  
14. VILA-Lab/Dive-into-Claude-Code \- GitHub, accessed May 4, 2026, [https://github.com/VILA-Lab/Dive-into-Claude-Code](https://github.com/VILA-Lab/Dive-into-Claude-Code)  
15. WebSockets in OpenAI APIs?\! \- by Milad Tajvidi \- Medium, accessed May 4, 2026, [https://medium.com/@milad.tajvidi/websockets-in-openai-apis-7b97d810c142](https://medium.com/@milad.tajvidi/websockets-in-openai-apis-7b97d810c142)  
16. I'm Building My Own Coding Agent Harness (And It's Pretty Cool) \- DEV Community, accessed May 4, 2026, [https://dev.to/composiodev/im-building-my-own-coding-agent-harness-and-its-pretty-cool-1lpf](https://dev.to/composiodev/im-building-my-own-coding-agent-harness-and-its-pretty-cool-1lpf)  
17. Reference Architecture: OpenClaw (Early Feb 2026 Edition, Opus 4.6) \- Robot Paper, accessed May 4, 2026, [https://robotpaper.ai/reference-architecture-openclaw-early-feb-2026-edition-opus-4-6/](https://robotpaper.ai/reference-architecture-openclaw-early-feb-2026-edition-opus-4-6/)  
18. OpenClaw security: architecture and hardening guide \- Nebius, accessed May 4, 2026, [https://nebius.com/blog/posts/openclaw-security](https://nebius.com/blog/posts/openclaw-security)  
19. How OpenClaw Works: Understanding AI Agents Through a Real Architecture, accessed May 4, 2026, [https://bibek-poudel.medium.com/how-openclaw-works-understanding-ai-agents-through-a-real-architecture-5d59cc7a4764](https://bibek-poudel.medium.com/how-openclaw-works-understanding-ai-agents-through-a-real-architecture-5d59cc7a4764)  
20. Integrating the new Websocket Mode from OpenAI · badlogic pi-mono · Discussion \#1843, accessed May 4, 2026, [https://github.com/badlogic/pi-mono/discussions/1843](https://github.com/badlogic/pi-mono/discussions/1843)  
21. Master WebSocket End-to-end Observability in One Article \- Alibaba Cloud Community, accessed May 4, 2026, [https://www.alibabacloud.com/blog/master-websocket-end-to-end-observability-in-one-article\_602915](https://www.alibabacloud.com/blog/master-websocket-end-to-end-observability-in-one-article_602915)  
22. pi-mono/packages/coding-agent/docs/extensions.md at main \- GitHub, accessed May 4, 2026, [https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/extensions.md](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/extensions.md)  
23. creating-pi-extensions | Skills Mark... \- LobeHub, accessed May 4, 2026, [https://lobehub.com/skills/zenobi-us-dotfiles-creating-pi-extensions](https://lobehub.com/skills/zenobi-us-dotfiles-creating-pi-extensions)  
24. pi-self-extension | Skills Marketplace \- LobeHub, accessed May 4, 2026, [https://lobehub.com/skills/crokily-pi-backup-pi-self-extension](https://lobehub.com/skills/crokily-pi-backup-pi-self-extension)  
25. Pi Coding Agent: A Self-Documenting, Extensible AI Partner \- DEV Community, accessed May 4, 2026, [https://dev.to/theoklitosbam7/pi-coding-agent-a-self-documenting-extensible-ai-partner-dn](https://dev.to/theoklitosbam7/pi-coding-agent-a-self-documenting-extensible-ai-partner-dn)  
26. Pi Coding Agent: A Self-Documenting, Extensible AI Partner \- Medium, accessed May 4, 2026, [https://medium.com/@theoklitosBam7/pi-coding-agent-a-self-documenting-extensible-ai-partner-a61f16ea3a28](https://medium.com/@theoklitosBam7/pi-coding-agent-a-self-documenting-extensible-ai-partner-a61f16ea3a28)  
27. Stealth Browser: How AI Agents Bypass Bot Detection \- DEV Community, accessed May 4, 2026, [https://dev.to/bridgeace/stealth-browser-how-ai-agents-bypass-bot-detection-3eh6](https://dev.to/bridgeace/stealth-browser-how-ai-agents-bypass-bot-detection-3eh6)  
28. Anti-Bot Bypass That Actually Works \- Scrape.do, accessed May 4, 2026, [https://scrape.do/features/anti-bot-bypass/](https://scrape.do/features/anti-bot-bypass/)  
29. I Reverse Engineered ChatGPT's UI Into an OpenAI Compatible API and Here's Why You Shouldn't \- DEV Community, accessed May 4, 2026, [https://dev.to/gautamvhavle/i-reverse-engineered-chatgpts-ui-into-an-openai-compatible-api-and-heres-why-you-shouldnt-ch](https://dev.to/gautamvhavle/i-reverse-engineered-chatgpts-ui-into-an-openai-compatible-api-and-heres-why-you-shouldnt-ch)  
30. How to Bypass Anti-Bot Protection When Web Scraping \- Scrapfly Blog, accessed May 4, 2026, [https://scrapfly.io/blog/posts/how-to-bypass-anti-bot-protection-when-web-scraping](https://scrapfly.io/blog/posts/how-to-bypass-anti-bot-protection-when-web-scraping)  
31. Bypass Bot Detection: 5 Best Methods \- ZenRows, accessed May 4, 2026, [https://www.zenrows.com/blog/bypass-bot-detection](https://www.zenrows.com/blog/bypass-bot-detection)  
32. What Are the Best Anti-Bot Detection Bypass Tools for Enterprise Automation (May 2026)?, accessed May 4, 2026, [https://www.skyvern.com/blog/best-anti-bot-detection-bypass-tools-enterprise-automation/](https://www.skyvern.com/blog/best-anti-bot-detection-bypass-tools-enterprise-automation/)  
33. The Art of Prompting in AI Test Automation \- Harness, accessed May 4, 2026, [https://www.harness.io/blog/ai-test-automation-prompts](https://www.harness.io/blog/ai-test-automation-prompts)  
34. Why AI Wrappers are Dying in 2026, and What We Built Instead | by Zdy \- Medium, accessed May 4, 2026, [https://medium.com/@zdy912544125/why-ai-wrappers-are-dying-in-2026-and-what-we-built-instead-eda7c2688950](https://medium.com/@zdy912544125/why-ai-wrappers-are-dying-in-2026-and-what-we-built-instead-eda7c2688950)  
35. The AI Wrapper Problem: Why 80% of “AI Startups” Will Disappear by 2026 \- Medium, accessed May 4, 2026, [https://medium.com/@Binoykumarbalan/the-ai-wrapper-problem-why-80-of-ai-startups-will-disappear-by-2026-6b4a873b0ad3](https://medium.com/@Binoykumarbalan/the-ai-wrapper-problem-why-80-of-ai-startups-will-disappear-by-2026-6b4a873b0ad3)  
36. The Plan to Replace Software Developers with AI Has Gone Horribly Wrong \- WhatJobs, accessed May 4, 2026, [https://www.whatjobs.com/news/the-plan-to-replace-software-developers-with-ai-has-gone-horribly-wrong-and-the-bill-is-coming-due/](https://www.whatjobs.com/news/the-plan-to-replace-software-developers-with-ai-has-gone-horribly-wrong-and-the-bill-is-coming-due/)