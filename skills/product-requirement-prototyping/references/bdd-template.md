# BDD Template

Write BDD in Chinese. Prefer feature-level grouping and scenarios that map directly to confirmed business rules and flows.

## Format

```gherkin
功能: <功能名称>
  为了 <业务目标>
  作为 <角色>
  我希望 <能力>

  背景:
    假如 <公共前置条件>

  场景: <主流程场景>
    假如 <前置条件>
    当 <用户或系统动作>
    那么 <可观察结果>
    并且 <状态或数据变化>

  场景: <异常或边界场景>
    假如 <前置条件>
    当 <异常动作或异常条件发生>
    那么 <系统反馈>
    并且 <状态保持或变化>
```

## Scenario Coverage

Include scenarios for:

- Main happy path.
- Each confirmed status transition.
- Important permission differences between roles.
- Required fields or blocking validations.
- Empty, error, timeout, duplicate, expired, or rejected states when relevant.
- Recovery actions after failure.

## Writing Rules

- Use observable behavior, not implementation details.
- Do not introduce fields, APIs, or roles that are absent from the PRD unless clearly marked as assumptions.
- Keep one scenario focused on one business rule or flow branch.
- Use stable terms from the confirmed business object model.
