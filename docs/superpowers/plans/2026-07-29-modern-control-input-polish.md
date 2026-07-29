# Modern Control Input Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 去除现代控制输入框的原生白色步进箭头，并让自定义 K 的用途对初学者可理解。

**Architecture:** 仅修改现代控制组件文案和全局输入样式，不触碰数值内核。

**Tech Stack:** React、CSS、Node test runner

## Global Constraints

- 沿用现有无箭头数字输入设计。
- 不增加自制加减按钮。
- 不修改控制算法。

### Task 1: UI contract

- [ ] 新增失败测试，要求现代控制组件包含“自定义增益”和初学说明，并要求对应输入选择器设置 `appearance: textfield`。
- [ ] 运行测试确认失败。
- [ ] 修改 `ModernControlDesigner.tsx` 与 `app/globals.css`。
- [ ] 运行全量测试和构建。
