---
name: product-requirement-prototyping
description: Turn raw product requirements into clarified business rules, converged business objects, state models, workflow checks, Chinese PRDs, Mermaid flowcharts, BDD acceptance scenarios, and Figma low/high fidelity prototypes. Use when Codex needs to support product managers creating requirements, generating clarification questions, calling figma-console-mcp through a Figma bridge plugin, reverse-checking prototypes, or producing review-ready product artifacts.
---

# Product Requirement Prototyping

## Core Rule

Operate as a gated product requirement workflow. Do not skip gates, do not fabricate Figma results, and do not move to the next major stage until the product manager explicitly confirms the current stage.

Default outputs are Chinese Markdown. Use Mermaid for flowcharts. Use BDD scenarios in Chinese unless the user asks otherwise.

Persist every stage artifact to disk. Read `references/output-artifacts.md` at the start of every task, create or reuse the project output directory it defines, and include saved file paths in each user-facing stage summary.

When no existing project prototype is available, accept user-provided screenshots as visual references for prototype generation. Treat screenshots as references for layout, information density, component patterns, and visual tone; do not let screenshots override confirmed business rules or workflow gates.

## Workflow

1. **Raw requirement intake**
   - Read `references/output-artifacts.md` and create the requirement output directory.
   - Restate the user goal, audience, actors, suspected product surface, and unresolved assumptions.
   - Generate clarification questions focused on business rules, roles, business objects, states, workflow boundaries, exceptions, permissions, data sources, and success criteria.
   - Save the intake summary and clarification questions before stopping.
   - Stop and wait for answers before producing a prototype or PRD.

2. **Business convergence**
   - Convert answers into business objects, object relationships, statuses, state transitions, main flows, exception flows, and open risks.
   - Save the converged model before asking for confirmation.
   - Ask for explicit confirmation of the converged model.
   - Do not call Figma before this confirmation.

3. **Low-fidelity prototype**
   - Read `references/prototype-spec.md`.
   - Produce a structured `PrototypeSpec` for low fidelity.
   - If the user supplied screenshots, include them as visual references in the `PrototypeSpec`.
   - Save the low-fidelity `PrototypeSpec` before any Figma call.
   - Read `references/figma-console-mcp.md`.
   - Unless the user explicitly asks to modify an existing Figma page, require a new Figma page for this requirement's low-fidelity prototype.
   - Check whether `figma-console-mcp` tools are available. If unavailable, stop and ask the user to connect the Figma bridge plugin.
   - If available, call the tool to create/update the low-fidelity Figma prototype.

4. **Prototype reverse check**
   - Inspect the low-fidelity prototype output or returned frame/component summary.
   - Identify missing steps, unclear interactions, state conflicts, rule gaps, empty/error states, and role-permission mismatches.
   - Save the reverse-check report.
   - Ask for confirmation or corrections before generating final requirement artifacts.

5. **Requirement artifacts**
   - Read `references/prd-template.md` and `references/bdd-template.md`.
   - Generate a review-ready Chinese PRD, Mermaid flowchart, and Chinese BDD scenarios.
   - Save the PRD, Mermaid flowchart, and BDD files separately.
   - Ask for review approval before high-fidelity work.

6. **High-fidelity prototype**
   - Base high fidelity only on the reviewed PRD/BDD and low-fidelity feedback.
   - Produce a high-fidelity `PrototypeSpec`.
   - If the user supplied screenshots, include them as visual references in the `PrototypeSpec` and explain which visual aspects are being reused.
   - Save the high-fidelity `PrototypeSpec` before any Figma call.
   - Unless the user explicitly asks to modify an existing Figma page, require a new Figma page for this requirement's high-fidelity prototype.
   - Check `figma-console-mcp` again before calling Figma.
   - Create/update the high-fidelity Figma prototype only after explicit approval.

## Gates

Require explicit user confirmation at these points:

- After clarification answers are gathered, before business convergence is treated as final.
- After business objects, statuses, and main flows are summarized, before low-fidelity Figma generation.
- After low-fidelity prototype reverse check, before PRD/flowchart/BDD generation.
- After PRD/BDD review, before high-fidelity Figma generation.

If the user asks to continue without confirmation, summarize the risk and request the missing confirmation. If the user explicitly overrides the gate, record that override in the output.

## Reference Loading

- Read `references/output-artifacts.md` before producing any stage artifact.
- Read `references/prototype-spec.md` before any Figma prototype stage.
- Read `references/figma-console-mcp.md` before checking or calling Figma tools.
- Read `references/prd-template.md` before drafting a PRD.
- Read `references/bdd-template.md` before drafting BDD scenarios.

## Output Standards

- Keep product artifacts concrete enough for review, but avoid inventing backend APIs, analytics, release plans, or database fields unless the user asks for implementation depth.
- Infer B-side, C-side, mobile, desktop, or mixed product surface from the requirement. State the inference and ask if it materially affects the prototype.
- Preserve open questions as an explicit section instead of silently resolving risky assumptions.
- When Figma tools are unavailable, provide the exact `PrototypeSpec` that would have been sent and stop there.
- Every response that completes a stage must list the files written or updated.
