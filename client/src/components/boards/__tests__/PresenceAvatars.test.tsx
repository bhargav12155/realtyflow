import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PresenceAvatars, type PresenceViewer } from "../PresenceAvatars";

afterEach(() => cleanup());

const viewers: PresenceViewer[] = [
  { userId: "u-alice", name: "Alice Anders", email: "alice@example.com" },
  { userId: "u-bob", name: "Bob Brown", email: "bob@example.com" },
  { userId: "u-charlie", name: null, email: "charlie@example.com" },
];

function viewer(id: string, name: string | null = null, email: string | null = null): PresenceViewer {
  return { userId: id, name, email };
}

describe("PresenceAvatars", () => {
  it("renders nothing when there are no viewers", () => {
    const { container } = render(<PresenceAvatars viewers={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the trigger and exposes a viewer-count aria-label", () => {
    render(<PresenceAvatars viewers={viewers} />);
    const trigger = screen.getByTestId("button-presence-avatars");
    expect(trigger.getAttribute("aria-label")).toMatch(/3 other viewers/i);
    // The popover content should not be in the DOM until the trigger is clicked.
    expect(screen.queryByTestId("popover-presence-viewers")).toBeNull();
  });

  it("opens the popover and lists every viewer with name, email and color dot", () => {
    render(<PresenceAvatars viewers={viewers} />);
    fireEvent.click(screen.getByTestId("button-presence-avatars"));

    // Heading reflects the viewer count.
    const heading = screen.getByTestId("text-presence-heading");
    expect(heading.textContent).toBe("3 people here");

    for (const v of viewers) {
      const row = screen.getByTestId(`row-presence-viewer-${v.userId}`);
      expect(row).toBeTruthy();
      const name = screen.getByTestId(`text-presence-name-${v.userId}`);
      const dot = screen.getByTestId(`dot-presence-${v.userId}`);
      expect(dot.className).toMatch(/bg-/);
      // Name falls back to email when the user has no display name.
      const expectedName = v.name?.trim() || v.email?.trim() || "Viewer";
      expect(name.textContent).toBe(expectedName);
    }

    // Email line appears for each viewer (Charlie shows email as the name *and*
    // omits the secondary email row, so check the two named viewers explicitly).
    expect(screen.getByTestId("text-presence-email-u-alice").textContent).toBe(
      "alice@example.com",
    );
    expect(screen.getByTestId("text-presence-email-u-bob").textContent).toBe(
      "bob@example.com",
    );
    // Charlie's name *is* their email, so the secondary email row should be hidden.
    expect(screen.queryByTestId("text-presence-email-u-charlie")).toBeNull();
  });

  it("uses singular wording in the heading when only one viewer is present", () => {
    render(<PresenceAvatars viewers={viewers.slice(0, 1)} />);
    fireEvent.click(screen.getByTestId("button-presence-avatars"));
    expect(screen.getByTestId("text-presence-heading").textContent).toBe(
      "1 person here",
    );
  });

  it("updates the popover heading and viewer rows when the viewers prop changes", () => {
    const { rerender } = render(<PresenceAvatars viewers={viewers} />);
    fireEvent.click(screen.getByTestId("button-presence-avatars"));
    expect(screen.getByTestId("text-presence-heading").textContent).toBe(
      "3 people here",
    );

    // A viewer leaves: heading and row list should both shrink without the
    // popover re-opening.
    rerender(<PresenceAvatars viewers={viewers.slice(0, 2)} />);
    expect(screen.getByTestId("text-presence-heading").textContent).toBe(
      "2 people here",
    );
    expect(screen.getByTestId("row-presence-viewer-u-alice")).toBeTruthy();
    expect(screen.getByTestId("row-presence-viewer-u-bob")).toBeTruthy();
    expect(screen.queryByTestId("row-presence-viewer-u-charlie")).toBeNull();

    // A new viewer joins: their row appears live.
    const joined: PresenceViewer = {
      userId: "u-dana",
      name: "Dana Diaz",
      email: "dana@example.com",
    };
    rerender(<PresenceAvatars viewers={[...viewers.slice(0, 2), joined]} />);
    expect(screen.getByTestId("text-presence-heading").textContent).toBe(
      "3 people here",
    );
    expect(screen.getByTestId("row-presence-viewer-u-dana")).toBeTruthy();
    expect(screen.getByTestId("text-presence-name-u-dana").textContent).toBe(
      "Dana Diaz",
    );
  });

  it("collapses extra avatars into a +N chip while still listing everyone in the popover", () => {
    const many: PresenceViewer[] = Array.from({ length: 6 }, (_, i) => ({
      userId: `u-${i}`,
      name: `User ${i}`,
      email: `u${i}@example.com`,
    }));
    render(<PresenceAvatars viewers={many} max={4} />);
    const overflow = screen.getByTestId("text-presence-overflow");
    expect(overflow.textContent).toBe("+2");

    fireEvent.click(screen.getByTestId("button-presence-avatars"));
    // All 6 viewers should be listed in the popover, regardless of the
    // collapsed avatar cap.
    for (let i = 0; i < 6; i++) {
      expect(screen.getByTestId(`row-presence-viewer-u-${i}`)).toBeTruthy();
    }
  });

  it("renders one circle per viewer with a stable test id derived from the user id", () => {
    render(
      <PresenceAvatars
        viewers={[
          viewer("u1", "Alex Smith"),
          viewer("u2", null, "casey@example.com"),
        ]}
      />,
    );
    expect(screen.getByTestId("avatar-presence-u1").textContent).toBe("AS");
    expect(screen.getByTestId("avatar-presence-u2").textContent).toBe("CE");
    // No overflow chip when count is below the cap.
    expect(screen.queryByTestId("text-presence-overflow")).toBeNull();
  });

  it("falls back to '?' initials when neither name nor email is provided", () => {
    render(<PresenceAvatars viewers={[viewer("anon")]} />);
    expect(screen.getByTestId("avatar-presence-anon").textContent).toBe("?");
  });

  it("caps visible avatars at `max` and renders a +N overflow chip for the rest", () => {
    const v = ["a", "b", "c", "d", "e", "f"].map((id) =>
      viewer(id, id.toUpperCase()),
    );
    render(<PresenceAvatars viewers={v} max={4} />);
    expect(screen.getByTestId("avatar-presence-a")).not.toBeNull();
    expect(screen.getByTestId("avatar-presence-d")).not.toBeNull();
    // 5th and 6th viewer should be collapsed into the overflow chip.
    expect(screen.queryByTestId("avatar-presence-e")).toBeNull();
    expect(screen.queryByTestId("avatar-presence-f")).toBeNull();
    const overflow = screen.getByTestId("text-presence-overflow");
    expect(overflow.textContent).toBe("+2");
    // The overflow tooltip should list the hidden viewers' display labels so
    // hovering surfaces who is being collapsed.
    expect(overflow.getAttribute("title")).toContain("E");
    expect(overflow.getAttribute("title")).toContain("F");
  });

  it("uses the default cap of 4 when no max prop is supplied", () => {
    const v = ["a", "b", "c", "d", "e"].map((id) => viewer(id, id.toUpperCase()));
    render(<PresenceAvatars viewers={v} />);
    expect(screen.getByTestId("avatar-presence-d")).not.toBeNull();
    expect(screen.queryByTestId("avatar-presence-e")).toBeNull();
    expect(screen.getByTestId("text-presence-overflow").textContent).toBe("+1");
  });
});
