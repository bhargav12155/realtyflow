import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
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
    // Dialog should close after a successful Save so the user is returned
    // to the board grid without needing an extra click.
    await waitFor(() => {
      expect(
        screen.queryByTestId(`dialog-rename-board-${baseBoard.id}`),
      ).toBeNull();
    });
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

  it("disables Save and shows an error when the title exceeds 200 characters", async () => {
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
    const saveBtn = screen.getByTestId(
      `button-confirm-rename-${baseBoard.id}`,
    ) as HTMLButtonElement;
    // 201 non-space chars exceeds the 200 cap. Use fireEvent.input so we
    // bypass the native maxLength clamp that would otherwise truncate the
    // value and prevent us from exercising the JS validation path.
    const tooLong = "a".repeat(201);
    Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set?.call(input, tooLong);
    fireEvent.input(input, { target: { value: tooLong } });
    expect(input.value.length).toBe(201);
    expect(saveBtn.disabled).toBe(true);
    expect(
      screen.queryByTestId(`text-rename-error-${baseBoard.id}`),
    ).not.toBeNull();
    fireEvent.click(saveBtn);
    expect(onRename).not.toHaveBeenCalled();
  });

  it("renders an inline pencil button next to the title for owners", () => {
    renderCard({ ...baseBoard, isOwner: true }, { onRename: () => {} });
    const pencil = screen.getByTestId(`button-rename-inline-${baseBoard.id}`);
    expect(pencil).toBeTruthy();
    expect(pencil.getAttribute("aria-label")).toBe("Rename board");
  });

  it("does not render the inline pencil for non-owner collaborators", () => {
    renderCard(
      {
        ...baseBoard,
        isOwner: false,
        owner: { id: "u-other", name: "Other", email: "other@example.com" },
      },
      { onRename: () => {}, onLeave: () => {} },
    );
    expect(
      screen.queryByTestId(`button-rename-inline-${baseBoard.id}`),
    ).toBeNull();
  });

  it("does not render the inline pencil when no onRename handler is provided", () => {
    renderCard({ ...baseBoard, isOwner: true });
    expect(
      screen.queryByTestId(`button-rename-inline-${baseBoard.id}`),
    ).toBeNull();
  });

  it("opens the rename dialog when the inline pencil is clicked without navigating", async () => {
    const onRename = vi.fn();
    renderCard({ ...baseBoard, isOwner: true }, { onRename });
    const pencil = screen.getByTestId(`button-rename-inline-${baseBoard.id}`);
    const clickEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      pencil.dispatchEvent(clickEvent);
    });
    // The pencil must stop the click from triggering the surrounding link
    // navigation (which would unmount the card before the dialog appears).
    expect(clickEvent.defaultPrevented).toBe(true);
    const input = (await screen.findByTestId(
      `input-rename-board-${baseBoard.id}`,
    )) as HTMLInputElement;
    expect(input.value).toBe(baseBoard.title);
    fireEvent.change(input, { target: { value: "Renamed via pencil" } });
    fireEvent.click(
      screen.getByTestId(`button-confirm-rename-${baseBoard.id}`),
    );
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onRename).toHaveBeenCalledWith(
      expect.objectContaining({ id: baseBoard.id }),
      "Renamed via pencil",
    );
  });

  it("opens the rename dialog when Enter is pressed on the inline pencil", async () => {
    renderCard({ ...baseBoard, isOwner: true }, { onRename: () => {} });
    const pencil = screen.getByTestId(`button-rename-inline-${baseBoard.id}`);
    act(() => {
      fireEvent.keyDown(pencil, { key: "Enter" });
    });
    expect(
      await screen.findByTestId(`input-rename-board-${baseBoard.id}`),
    ).toBeTruthy();
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
