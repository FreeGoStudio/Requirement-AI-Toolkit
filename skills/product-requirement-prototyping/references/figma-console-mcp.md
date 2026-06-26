# figma-console-mcp Integration

Use `figma-console-mcp` through the user's local Figma bridge plugin. Never claim a Figma file, frame, or component was created unless the MCP tool call succeeds.

## Preflight

Before any Figma generation:

1. Check available tools for a Figma or `figma-console-mcp` MCP server.
2. Confirm the local Figma bridge plugin is connected when the tool requires an active Figma session.
3. Check whether the current Figma file/project contains an existing prototype page relevant to this requirement.
4. If no existing prototype or saved visual reference is found, ask the user to provide screenshots/reference images or confirm continuing without visual references.
5. Prepare a complete `PrototypeSpec`.
6. State whether the call is for low fidelity or high fidelity.
7. Decide page behavior: create a new page by default; update an existing page only when the user explicitly asks to modify one.

If the tool is unavailable, stop and tell the user:

```text
未检测到 figma-console-mcp 或 Figma 桥接插件连接。请先启动 Figma 本地客户端、打开桥接插件，并在 Codex 中连接 figma-console-mcp。下面是本次准备发送的 PrototypeSpec。
```

Then output the `PrototypeSpec` and do not simulate tool results.

## Call Contract

Send enough structured information for the bridge plugin to create or update frames:

- Target file or current Figma document, if supplied by the user.
- Page strategy: `create-new-page` by default, or `update-existing-page` only with an explicit user modification request.
- Page name and target page id when applicable.
- Prototype mode: low fidelity or high fidelity.
- Product surface inference.
- Prototype reference gate decision: existing prototype found, screenshots provided, or user confirmed no visual reference.
- Screenshot or image references, when supplied by the user, including which aspects to borrow.
- Page/frame list.
- Flow order and navigation links.
- Component inventory.
- Interaction annotations.
- Business object/status annotations.
- Review notes or open questions.

## Visual Reference Policy

When no existing project prototype is available, user-provided screenshots may be used as visual references.

Rules:

- Always check for existing relevant Figma pages/prototypes before asking for screenshots.
- If no existing prototype is found, explicitly ask the user to provide screenshots/reference images or confirm continuing without visual references.
- Do not call Figma while the visual reference decision is still pending.
- Pass screenshot paths, URLs, or uploaded image identifiers through the `visualReferences` field in `PrototypeSpec`.
- State which aspects are being reused: layout, navigation, density, component style, spacing, or interaction affordance.
- Do not copy logos, private data, or third-party brand-specific visuals unless the user confirms they own or may reuse them.
- For low fidelity, translate screenshot references into neutral wireframe structure.
- For high fidelity, use screenshot references as directional design guidance, not as a pixel-for-pixel clone unless the user explicitly asks and has rights.

## Page Creation Policy

Default behavior is to create a new Figma page for every prototype generation stage.

Use these names unless the user provides a naming convention:

```text
<需求名称> / Low Fidelity / <yyyyMMdd-HHmm>
<需求名称> / High Fidelity / <yyyyMMdd-HHmm>
```

Rules:

- Low fidelity and high fidelity must be on separate Figma pages.
- Do not place a new requirement's prototype on the currently open page by default.
- Do not overwrite or append to a previous prototype page unless the user clearly says this is a modification.
- If the user asks to modify an existing prototype, require or infer the target Figma page, record `figmaPageStrategy.action` as `update-existing-page`, and include the target page id/name in the `PrototypeSpec`.
- If the MCP tool returns only frames and no page id, record the page name requested in the stage summary and `index.md`.

## Expected Result Handling

After a successful MCP call:

- Record the returned Figma file/page/frame identifiers or URL if provided.
- Summarize what was created or updated.
- Ask the user to review the prototype before moving past the gate.

If the MCP call fails:

- Report the exact failure in plain language.
- Preserve the `PrototypeSpec`.
- Suggest only connection, permission, active document, or plugin-state checks that are supported by the error.
