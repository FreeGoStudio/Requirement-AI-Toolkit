# PrototypeSpec

Create a `PrototypeSpec` before every Figma call. Use it as the contract between product reasoning and `figma-console-mcp`.

## Required Shape

```json
{
  "mode": "low-fidelity | high-fidelity",
  "figmaPageStrategy": {
    "action": "create-new-page | update-existing-page",
    "pageName": "",
    "targetPageId": "",
    "reason": ""
  },
  "productSurface": "b-side | c-side | mobile | desktop | mixed | unknown",
  "objective": "",
  "audience": "",
  "sourceArtifacts": [],
  "prototypeReferenceGate": {
    "existingPrototypeChecked": false,
    "existingPrototypeFound": false,
    "visualReferenceRequested": false,
    "userDecision": "provided-reference | use-existing-prototype | continue-without-reference | pending",
    "notes": ""
  },
  "visualReferences": [],
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
- `figmaPageStrategy`: Use `create-new-page` by default. Use `update-existing-page` only when the user explicitly asks to modify an existing page or provides a target page.
- `productSurface`: Infer from the requirement and state the inference.
- `sourceArtifacts`: List the confirmed requirement summary, PRD, BDD, prototype review notes, or user-provided files used.
- `prototypeReferenceGate`: Record whether existing project prototypes were checked, whether one was found, whether visual references were requested, and the user's decision.
- `visualReferences`: List screenshots or image references supplied by the user. Include file path or URL, source, what to borrow, what not to borrow, and confidence.
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
- Create a new Figma page by default for the low-fidelity prototype.
- If screenshots are supplied, use them only to guide layout structure, information density, navigation patterns, and component placement.
- Use grayscale wireframe styling.
- Avoid visual brand decisions, decorative imagery, and pixel-level layout tuning.
- Represent repeated objects as realistic rows/cards with short labels.
- Annotate uncertain rules directly on frames.

## High-Fidelity Rules

- Base the spec on reviewed PRD/BDD and low-fidelity feedback.
- Create a new Figma page by default for the high-fidelity prototype, separate from the low-fidelity page.
- If screenshots are supplied, use them to guide visual hierarchy, spacing rhythm, component style, and interaction affordances while preserving the approved requirement.
- Include visual hierarchy, spacing intent, component states, microcopy, validation messages, and realistic sample data.
- Preserve the approved workflow and business rules.
- Do not add new scope unless it is explicitly marked as a review change.

## Screenshot Reference Rules

- Accept screenshots when the project has no existing Figma prototype or the user wants an external reference.
- Before producing a prototype spec, first check for existing project prototypes or saved visual references. If none exist, ask the user whether to provide screenshots/reference images or continue without visual references.
- Do not proceed while `prototypeReferenceGate.userDecision` is `pending`.
- Ask what aspects to reuse if unclear: layout, flow pattern, table density, form structure, navigation, visual style, or microcopy tone.
- Do not copy third-party branding, logos, proprietary content, or user data from screenshots unless the user owns the material and explicitly asks for it.
- Record screenshot paths or URLs in `visualReferences`.
- If the screenshot conflicts with confirmed business rules, follow the confirmed rules and note the conflict in `annotations`.
