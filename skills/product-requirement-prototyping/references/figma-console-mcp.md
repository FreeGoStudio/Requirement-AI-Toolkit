# figma-console-mcp Integration

Use `figma-console-mcp` through the user's local Figma bridge plugin. Never claim a Figma file, frame, or component was created unless the MCP tool call succeeds.

Never call Figma while the prototype reference gate or high-fidelity visual reference gate is pending.

## Preflight

Before any Figma generation:

1. Run the Figma Tool Discovery Preflight below.
2. Confirm the local Figma bridge plugin is connected with the read-only smoke test.
3. Check whether the current Figma file/project contains an existing prototype page relevant to this requirement.
4. If no existing prototype or saved visual reference is found, ask the user to provide screenshots/reference images or confirm continuing without visual references.
5. Prepare a complete `PrototypeSpec`.
6. State whether the call is for low fidelity or high fidelity.
7. Decide page behavior: create a new page by default; update an existing page only when the user explicitly asks to modify one.

## Tool Discovery Preflight

Figma tools may be lazy-loaded. Do not treat a missing first search result as proof that Figma is disconnected.

Required capability:

- Execute capability: `figma_execute`.
- Screenshot capability: either `figma_capture_screenshot` or `figma_take_screenshot`.

Discovery steps:

1. Use `tool_search` with exact queries for `figma_execute`, `figma_capture_screenshot`, `figma_take_screenshot`, and `figma-console-mcp`.
2. If any required capability is not found, run a second broader search with `figma`, `screenshot`, and `execute`.
3. Accept either screenshot alias. `figma_capture_screenshot` and `figma_take_screenshot` both satisfy the screenshot capability.
4. Only after both exact and broad searches fail to expose `figma_execute` should the stage be considered tool-unavailable.
5. If `figma_execute` is available but no screenshot tool is available, continue only when the current stage can create a draft without visual verification. State clearly that screenshot verification is unavailable. If the stage requires visual validation, hard stop before calling Figma.

If the execute tool is unavailable after both discovery passes, stop and tell the user:

```text
未检测到 Figma 执行工具。可能是 Codex 工具发现/懒加载尚未完成，而不是 Figma Desktop 断开。请重新搜索或等待工具面板加载 figma_execute，并确认 figma-console-mcp 已连接。下面是本次准备发送的 PrototypeSpec。
```

Then output the `PrototypeSpec` and do not simulate tool results.

## Bridge Smoke Test

After `figma_execute` is found and before any prototype generation, run a read-only smoke test that reads the active Figma document context, such as current file name, current page name, and page count.

Rules:

- A successful smoke test means the bridge is connected. An `Untitled` file name is valid and must not be reported as disconnected.
- The smoke test must not create, edit, delete, rename, or move any Figma nodes or pages.
- If the smoke test fails, report the failure as a bridge/session problem, not as a missing tool.

Use these categories when explaining a smoke test failure:

- Figma Desktop is not open or has no active document.
- The local bridge plugin is not running or not connected to Codex.
- The session lacks permission or the active document cannot be accessed.
- The execute tool exists but returned an unexpected runtime error.

If the bridge smoke test fails, stop and tell the user:

```text
Figma 执行工具已经可见，但桥接 smoke test 失败。请启动 Figma Desktop、打开本地桥接插件、保持目标文件处于激活状态，并确认 Codex 与 figma-console-mcp 的会话仍连接。下面是本次准备发送的 PrototypeSpec。
```

Then output the `PrototypeSpec` and do not simulate tool results.

If the prototype reference gate is pending, stop before preparing the `PrototypeSpec` and ask:

```text
未找到当前需求可复用的已有原型或参考图。请提供截图/参考图，或明确回复“无参考图，继续生成”。
```

If the high-fidelity visual reference gate is pending, stop before preparing the high-fidelity `PrototypeSpec` and ask:

```text
低保真只能作为流程和结构参考，不能单独支撑高保真视觉生成。请提供参考图、设计系统、已有高保真页面，或明确回复“无视觉参考，继续生成并接受风险”。
```

## Call Contract

Send enough structured information for the bridge plugin to create or update frames:

- Target file or current Figma document, if supplied by the user.
- Page strategy: `create-new-page` by default, or `update-existing-page` only with an explicit user modification request.
- Page name and target page id when applicable.
- Prototype mode: low fidelity or high fidelity.
- Product surface inference.
- Prototype reference gate decision: existing prototype found, screenshots provided, or user confirmed no visual reference.
- For high fidelity, visual reference gate decision: visual source used or user accepted no-visual-reference risk.
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
- For high fidelity, do not rely only on low fidelity. Use screenshots, design systems, existing high-fidelity pages, or brand UI guidelines as visual guidance. If absent, require explicit risk acceptance before calling Figma.

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
