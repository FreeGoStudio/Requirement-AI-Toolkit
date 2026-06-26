# PrototypeSpec

Create a `PrototypeSpec` before every Figma call. Use it as the contract between product reasoning and `figma-console-mcp`.

## Required Shape

```json
{
  "mode": "low-fidelity | high-fidelity",
  "productSurface": "b-side | c-side | mobile | desktop | mixed | unknown",
  "objective": "",
  "audience": "",
  "sourceArtifacts": [],
  "businessObjects": [],
  "states": [],
  "pages": [],
  "flows": [],
  "components": [],
  "interactions": [],
  "emptyStates": [],
  "errorStates": [],
  "annotations": [],
  "openQuestions": []
}
```

## Field Guidance

- `mode`: Use `low-fidelity` for structure and flow; use `high-fidelity` only after PRD/BDD review approval.
- `productSurface`: Infer from the requirement and state the inference.
- `sourceArtifacts`: List the confirmed requirement summary, PRD, BDD, prototype review notes, or user-provided files used.
- `businessObjects`: Include object name, purpose, key attributes only when needed for screen clarity, and relevant statuses.
- `states`: Include state name, owner, entry condition, exit condition, and visible UI effect.
- `pages`: Include page name, purpose, actor, layout priority, key sections, primary action, secondary actions, and states shown.
- `flows`: Include entry, ordered steps, decision points, completion state, and exception branches.
- `components`: Include tables, forms, filters, detail panels, cards, dialogs, steppers, tabs, toasts, and navigation elements.
- `interactions`: Include trigger, system response, validation, feedback, and resulting state transition.
- `emptyStates` and `errorStates`: Include the user message, available recovery action, and owner.
- `annotations`: Include business-rule notes that should appear near relevant frames.
- `openQuestions`: Include unresolved questions that should block or annotate prototype decisions.

## Low-Fidelity Rules

- Prioritize information architecture, page flow, business status, and critical interactions.
- Use grayscale wireframe styling.
- Avoid visual brand decisions, decorative imagery, and pixel-level layout tuning.
- Represent repeated objects as realistic rows/cards with short labels.
- Annotate uncertain rules directly on frames.

## High-Fidelity Rules

- Base the spec on reviewed PRD/BDD and low-fidelity feedback.
- Include visual hierarchy, spacing intent, component states, microcopy, validation messages, and realistic sample data.
- Preserve the approved workflow and business rules.
- Do not add new scope unless it is explicitly marked as a review change.
