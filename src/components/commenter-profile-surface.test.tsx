import { fireEvent, render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { CommenterIdentity } from "@/components/commenter-profile-surface";
import type { DiscoveryComment } from "@/features/discovery/types";

const comment: DiscoveryComment = {
  id: "commenter-surface-test",
  authorId: "commenter-mook",
  authorName: "Mook",
  authorInitials: "MK",
  authorProfile: {
    id: "commenter-mook",
    name: "Mook",
    initials: "MK",
    bio: "ชอบเส้นทางที่เดินต่อได้จริง",
    area: "Ari",
    expertise: ["กาแฟ"],
    tasteMatchLabel: "91%",
  },
  body: "ช่วงเช้าแสงดีมาก",
  createdAt: "วันนี้",
};

describe("CommenterIdentity", () => {
  it("opens a commenter profile surface for any commenter", () => {
    render(
      <BrowserRouter>
        <CommenterIdentity comment={comment} />
      </BrowserRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "เปิดโปรไฟล์ Mook" }));

    expect(screen.getByRole("dialog", { name: "Mook" })).toBeInTheDocument();
    expect(screen.getByText("91%")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ดู Profile/ })).toHaveAttribute(
      "href",
      "/creators/commenter-mook",
    );
  });

  it("commits follow state only after the relation callback succeeds", async () => {
    const onFollow = vi.fn().mockResolvedValue(undefined);
    render(
      <BrowserRouter>
        <CommenterIdentity comment={comment} onFollow={onFollow} />
      </BrowserRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "เปิดโปรไฟล์ Mook" }));
    fireEvent.click(screen.getByRole("button", { name: "ติดตาม" }));

    expect(onFollow).toHaveBeenCalledWith(expect.objectContaining({ id: "commenter-mook", following: true }));
    expect(await screen.findByRole("button", { name: "ติดตามแล้ว" })).toBeInTheDocument();
  });
});
