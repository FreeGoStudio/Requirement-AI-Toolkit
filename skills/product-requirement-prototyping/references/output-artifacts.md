# Output Artifacts

Persist every stage artifact to disk. Do not rely only on chat output.

## Output Directory

If the user provides an output directory, use it.

If the user does not provide one, create a directory under the current workspace:

```text
outputs/product-requirements/<yyyyMMdd-HHmm>-<short-requirement-slug>/
```

Rules:

- Use local time for `<yyyyMMdd-HHmm>`.
- Derive `<short-requirement-slug>` from the product or feature name.
- Use lowercase ASCII letters, digits, and hyphens for the slug.
- If the product name is unclear, use `new-requirement`.
- Reuse the same output directory for all later stages in the same requirement thread.
- Include the absolute output directory path in the stage response.

## Required Files

Create files as stages become available:

```text
00-raw-requirement.md
01-clarification-questions.md
02-business-model.md
03-low-fidelity-prototype-spec.json
04-low-fidelity-review.md
05-prd.md
06-flowchart.mmd
07-bdd.feature
08-high-fidelity-prototype-spec.json
09-high-fidelity-review.md
index.md
```

Do not create placeholder files for future stages. Create or update each file only when that stage is reached.

## Index File

Maintain `index.md` as the stage manifest. Update it whenever a stage file is created or updated.

Use this structure:

```markdown
# <需求名称>

- 输出目录: `<absolute path>`
- 当前阶段: <stage name>
- Figma: <not-started | unavailable | low-fidelity-created | high-fidelity-created>

## Artifacts

| Stage | File | Status |
| --- | --- | --- |
| Raw requirement | `00-raw-requirement.md` | done |
```

## Response Requirement

At the end of every stage response, include:

- Current stage.
- Whether the next gate is blocked by confirmation.
- Absolute path of the output directory.
- Files created or updated in this stage.

## Figma Failure

If `figma-console-mcp` is unavailable, still save:

- The relevant `PrototypeSpec` JSON file.
- A short note in `index.md` marking Figma as `unavailable`.

Then stop and ask the user to connect the Figma bridge plugin.
