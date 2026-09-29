import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InlineCommentSection } from "@/components/inline-comment-section";

describe("InlineCommentSection", () => {
  it("renders the complete discussion in the detail surface without opening a thread popup", () => {
    render(
      <InlineCommentSection
        title="Ari morning"
        focusRequestKey={1}
        comments={[
          {
            id: "comment-1",
            authorName: "Mook",
            authorInitials: "MK",
            body: "ช่วงเช้าแสงดีมาก",
            createdAt: "วันนี้",
          },
        ]}
        onSubmit={async () => undefined}
      />,
    );

    expect(screen.getByText("ช่วงเช้าแสงดีมาก")).toBeInTheDocument();
    expect(screen.getByLabelText("เขียนความคิดเห็น")).toBeInTheDocument();
    expect(document.querySelector(".comment-thread-dialog")).not.toBeInTheDocument();
    expect(document.querySelector(".comment-drawer__backdrop")).not.toBeInTheDocument();
    expect(screen.queryByText("ดูความคิดเห็นทั้งหมด")).not.toBeInTheDocument();
  });
});
