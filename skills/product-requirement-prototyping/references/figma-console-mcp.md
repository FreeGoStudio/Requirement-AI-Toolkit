# figma-console-mcp Integration

Use `figma-console-mcp` through the user's local Figma bridge plugin. Never claim a Figma file, frame, or component was created unless the MCP tool call succeeds.

## Preflight

Before any Figma generation:

1. Check available tools for a Figma or `figma-console-mcp` MCP server.
2. Confirm the local Figma bridge plugin is connected when the tool requires an active Figma session.
3. Prepare a complete `PrototypeSpec`.
4. State whether the call is for low fidelity or high fidelity.

If the tool is unavailable, stop and tell the user:

```text
未检测到 figma-console-mcp 或 Figma 桥接插件连接。请先启动 Figma 本地客户端、打开桥接插件，并在 Codex 中连接 figma-console-mcp。下面是本次准备发送的 PrototypeSpec。
```

Then output the `PrototypeSpec` and do not simulate tool results.

## Call Contract

Send enough structured information for the bridge plugin to create or update frames:

- Target file or current Figma document, if supplied by the user.
- Prototype mode: low fidelity or high fidelity.
- Product surface inference.
- Page/frame list.
- Flow order and navigation links.
- Component inventory.
- Interaction annotations.
- Business object/status annotations.
- Review notes or open questions.

## Expected Result Handling

After a successful MCP call:

- Record the returned Figma file/page/frame identifiers or URL if provided.
- Summarize what was created or updated.
- Ask the user to review the prototype before moving past the gate.

If the MCP call fails:

- Report the exact failure in plain language.
- Preserve the `PrototypeSpec`.
- Suggest only connection, permission, active document, or plugin-state checks that are supported by the error.
