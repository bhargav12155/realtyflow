import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BoardCard, type BoardSummary } from "../BoardCard";

function renderCard(board: BoardSummary) {
  const { hook } = memoryLocation({ path: "/boards", record: true });
  return render(
    <TooltipProvider>
      <Router hook={hook}>
        <BoardCard board={board} />
      </Router>
    </TooltipProvider>,
  );
}

const baseBoard = {
  id: "brd_muted_1",
  title: "Coastal listings",
  updatedAt: new Date().toISOString(),
};

afterEach(() => cleanup());

describe("BoardCard muted indicator", () => {
  it("shows the bell-off indicator when the owner has muted collaborator change emails", () => {
    renderCard({
      ...baseBoard,
      isOwner: true,
      notifyOnCollaboratorChange: false,
    });
    expect(screen.queryByTestId(`indicator-muted-${baseBoard.id}`)).not.toBeNull();
  });

  it("does not show the indicator for owners when notifyOnCollaboratorChange is true", () => {
    renderCard({
      ...baseBoard,
      isOwner: true,
      notifyOnCollaboratorChange: true,
    });
    expect(screen.queryByTestId(`indicator-muted-${baseBoard.id}`)).toBeNull();
  });

  it("does not show the indicator for owners when notifyOnCollaboratorChange is undefined (defaults to on)", () => {
    renderCard({
      ...baseBoard,
      isOwner: true,
    });
    expect(screen.queryByTestId(`indicator-muted-${baseBoard.id}`)).toBeNull();
  });

  it("never shows the indicator for non-owner collaborators, even if the flag is false", () => {
    renderCard({
      ...baseBoard,
      isOwner: false,
      owner: { id: "u-other", name: "Other", email: "other@example.com" },
      notifyOnCollaboratorChange: false,
    });
    expect(screen.queryByTestId(`indicator-muted-${baseBoard.id}`)).toBeNull();
  });
});
