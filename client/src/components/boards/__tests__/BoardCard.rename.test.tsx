import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BoardCard, type BoardSummary } from "../BoardCard";

function renderCard(
  board: BoardSummary,
  props: Partial<{
    onRename: (board: BoardSummary, newTitle: string) => void;
    isRenaming: boolean;
    onLeave: (board: BoardSummary) => void;
    onDelete: (board: BoardSummary) => void;
  }> = {},
) {
  const { hook } = memoryLocation({ path: "/boards", record: true });
  return render(
    <TooltipProvider>
      <Router hook={hook}>
        <BoardCard board={board} {...props} />
      </Router>
    </TooltipProvider>,
  );
}

function openMenu(boardId: string) {
  const trigger = screen.getByTestId(`button-board-menu-${boardId}`);
  fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" });
  fireEvent.pointerUp(trigger, { button: 0, pointerType: "mouse" });
  fireEvent.click(trigger);
}

const baseBoard: BoardSummary = {
  id: "brd_rename_1",
  title: "Coastal listings",
  updatedAt: new Date().toISOString(),
};

// Radix DropdownMenu uses pointer capture APIs that JSDOM doesn't implement.
// Polyfill them so the menu actually opens in tests.
beforeEach(() => {
  if (!(Element.prototype as unknown as { hasPointerCapture?: unknown }).hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!(Element.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
});

afterEach(() => cleanup());

describe("BoardCard rename", () => {
  it("shows the Rename menu item for owners", async () => {
    renderCard(
      { ...baseBoard, isOwner: true },
      { onRename: () => {}, onDelete: () => {} },
    );
    openMenu(baseBoard.id);
    expect(
      await screen.findByTestId(`menu-item-rename-${baseBoard.id}`),
    ).toBeTruthy();
  });

  it("does not show the Rename menu item for non-owner collaborators", async () => {
    renderCard(
      {
        ...baseBoard,
        isOwner: false,
        owner: { id: "u-other", name: "Other", email: "other@example.com" },
      },
      { onRename: () => {}, onLeave: () => {} },
    );
    openMenu(baseBoard.id);
    // Leave is the only kebab option for shared collaborators — wait for it
    // so we know the menu actually opened, then assert Rename is absent.
    await screen.findByTestId(`menu-item-leave-${baseBoard.id}`);
    expect(screen.queryByTestId(`menu-item-rename-${baseBoard.id}`)).toBeNull();
  });

  it("opens the rename dialog prefilled with the current title and saves the trimmed value", async () => {
    const onRename = vi.fn();
    renderCard({ ...baseBoard, isOwner: true }, { onRename });
    openMenu(baseBoard.id);
    const item = await screen.findByTestId(`menu-item-rename-${baseBoard.id}`);
    act(() => {
      fireEvent.click(item);
    });
    const input = (await screen.findByTestId(
      `input-rename-board-${baseBoard.id}`,
    )) as HTMLInputElement;
    expect(input.value).toBe(baseBoard.title);
    fireEvent.change(input, { target: { value: "  Updated title  " } });
    fireEvent.click(
      screen.getByTestId(`button-confirm-rename-${baseBoard.id}`),
    );
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onRename).toHaveBeenCalledWith(
      expect.objectContaining({ id: baseBoard.id }),
      "Updated title",
    );
  });

  it("disables Save when the input is empty or unchanged", async () => {
    const onRename = vi.fn();
    renderCard({ ...baseBoard, isOwner: true }, { onRename });
    openMenu(baseBoard.id);
    const item = await screen.findByTestId(`menu-item-rename-${baseBoard.id}`);
    act(() => {
      fireEvent.click(item);
    });
    const saveBtn = (await screen.findByTestId(
      `button-confirm-rename-${baseBoard.id}`,
    )) as HTMLButtonElement;
    // Unchanged value -> disabled
    expect(saveBtn.disabled).toBe(true);
    const input = screen.getByTestId(
      `input-rename-board-${baseBoard.id}`,
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "   " } });
    expect(saveBtn.disabled).toBe(true);
    expect(
      screen.queryByTestId(`text-rename-error-${baseBoard.id}`),
    ).not.toBeNull();
    // Clicking the disabled button must not fire onRename
    fireEvent.click(saveBtn);
    expect(onRename).not.toHaveBeenCalled();
  });

  it("does not call onRename when Cancel is clicked", async () => {
    const onRename = vi.fn();
    renderCard({ ...baseBoard, isOwner: true }, { onRename });
    openMenu(baseBoard.id);
    const item = await screen.findByTestId(`menu-item-rename-${baseBoard.id}`);
    act(() => {
      fireEvent.click(item);
    });
    const input = (await screen.findByTestId(
      `input-rename-board-${baseBoard.id}`,
    )) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Should be ignored" } });
    fireEvent.click(screen.getByTestId(`button-cancel-rename-${baseBoard.id}`));
    expect(onRename).not.toHaveBeenCalled();
  });
});
