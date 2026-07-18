import { describe, expect, it, beforeEach, vi } from 'vitest';
import { DrawerStack } from './drawerStack';

/**
 * Mirrors Drawer.tsx stable registration: one stack entry per open period, with the latest
 * callback held in a mutable ref so identity changes do not re-register or reorder the stack.
 */
function createStableRegistration(
  stack: DrawerStack,
  getLatestOnClose: () => () => void,
): () => void {
  return stack.register(() => {
    getLatestOnClose()();
  });
}

describe('DrawerStack', () => {
  let stack: DrawerStack;

  beforeEach(() => {
    stack = new DrawerStack();
  });

  it('tracks nested open depth via register/unregister', () => {
    const closeParent = vi.fn();
    const closeChild = vi.fn();

    const unregisterParent = stack.register(closeParent);
    expect(stack.depth).toBe(1);

    const unregisterChild = stack.register(closeChild);
    expect(stack.depth).toBe(2);

    unregisterChild();
    expect(stack.depth).toBe(1);

    unregisterParent();
    expect(stack.depth).toBe(0);
  });

  it('dispatches Escape only to the topmost drawer', () => {
    const closeParent = vi.fn();
    const closeChild = vi.fn();

    stack.register(closeParent);
    stack.register(closeChild);

    expect(stack.dispatchEscapeForTests()).toBe(true);
    expect(closeChild).toHaveBeenCalledOnce();
    expect(closeParent).not.toHaveBeenCalled();
  });

  it('dispatches Escape to the parent after the child unregisters', () => {
    const closeParent = vi.fn();
    const closeChild = vi.fn();

    stack.register(closeParent);
    const unregisterChild = stack.register(closeChild);
    unregisterChild();

    expect(stack.dispatchEscapeForTests()).toBe(true);
    expect(closeParent).toHaveBeenCalledOnce();
    expect(closeChild).not.toHaveBeenCalled();
  });

  it('returns false when Escape is dispatched with an empty stack', () => {
    expect(stack.dispatchEscapeForTests()).toBe(false);
    expect(stack.depth).toBe(0);
  });

  it('keeps the child topmost when the parent callback identity changes via a stable registration', () => {
    let parentClose = vi.fn();
    const childClose = vi.fn();

    createStableRegistration(stack, () => parentClose);
    stack.register(childClose);

    // Simulate a parent re-render that produces a new onClose function identity.
    parentClose = vi.fn();

    expect(stack.depth).toBe(2);
    expect(stack.dispatchEscapeForTests()).toBe(true);
    expect(childClose).toHaveBeenCalledOnce();
    expect(parentClose).not.toHaveBeenCalled();
  });

  it('keeps the child registered when the parent unregisters out of order', () => {
    const closeParent = vi.fn();
    const closeChild = vi.fn();

    const unregisterParent = stack.register(closeParent);
    stack.register(closeChild);

    unregisterParent();

    expect(stack.depth).toBe(1);
    expect(stack.dispatchEscapeForTests()).toBe(true);
    expect(closeChild).toHaveBeenCalledOnce();
    expect(closeParent).not.toHaveBeenCalled();
  });

  it('treats two registrations of the same callback as independent entries', () => {
    const sharedClose = vi.fn();

    const unregisterFirst = stack.register(sharedClose);
    const unregisterSecond = stack.register(sharedClose);

    expect(stack.depth).toBe(2);

    unregisterFirst();
    expect(stack.depth).toBe(1);

    expect(stack.dispatchEscapeForTests()).toBe(true);
    expect(sharedClose).toHaveBeenCalledOnce();

    unregisterSecond();
    expect(stack.depth).toBe(0);
    expect(stack.dispatchEscapeForTests()).toBe(false);
  });

  it('supports register → unregister → register without leftover depth or stale Escape targets', () => {
    const firstClose = vi.fn();
    const secondClose = vi.fn();

    const unregisterFirst = stack.register(firstClose);
    expect(stack.depth).toBe(1);
    unregisterFirst();
    expect(stack.depth).toBe(0);

    stack.register(secondClose);
    expect(stack.depth).toBe(1);

    expect(stack.dispatchEscapeForTests()).toBe(true);
    expect(secondClose).toHaveBeenCalledOnce();
    expect(firstClose).not.toHaveBeenCalled();
  });

  it('invokes the latest parent callback after identity change without reordering above the child', () => {
    let parentClose = vi.fn();
    const childClose = vi.fn();

    const unregisterParent = createStableRegistration(stack, () => parentClose);
    const unregisterChild = stack.register(childClose);

    parentClose = vi.fn();
    unregisterChild();

    expect(stack.dispatchEscapeForTests()).toBe(true);
    expect(parentClose).toHaveBeenCalledOnce();

    unregisterParent();
    expect(stack.depth).toBe(0);
  });
});
