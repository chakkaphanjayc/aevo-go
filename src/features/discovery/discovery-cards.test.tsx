import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { PostCard, TraceCard } from "@/features/discovery/discovery-cards";
import { demoPosts, demoTraces } from "@/features/discovery/demo-discovery";

describe("discovery cards Twitter-style UX/UI", () => {
  it("renders TraceCard with creator header leading, photo grid, and Twitter action bar", () => {
    const trace = demoTraces[0];
    render(
      <MemoryRouter>
        <TraceCard item={trace} handlers={{}} />
      </MemoryRouter>,
    );

    // Creator header leads at the top
    expect(screen.getByText(trace.creator.name)).toBeInTheDocument();
    expect(screen.getByText(trace.title)).toBeInTheDocument();
    expect(screen.getByText(trace.description)).toBeInTheDocument();

    // Twitter-style action bar is present with accessible toolbar role
    const toolbar = screen.getByRole("toolbar", { name: "การดำเนินการ Trace" });
    expect(toolbar).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "แสดงความคิดเห็น" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ดัดแปลงเส้นทาง" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "บันทึก Trace" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "แชร์ Trace" })).toBeInTheDocument();
  });

  it("renders PostCard with creator header, body, photo grid, and Twitter action bar with counts", () => {
    const post = demoPosts[0];
    render(
      <MemoryRouter>
        <PostCard item={post} handlers={{}} />
      </MemoryRouter>,
    );

    // Creator header leads at the top
    expect(screen.getByText(post.author.name)).toBeInTheDocument();
    expect(screen.getByText(post.body)).toBeInTheDocument();

    // Action bar is present with comment and like counts
    const toolbar = screen.getByRole("toolbar", { name: "การดำเนินการโพสต์" });
    expect(toolbar).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "แสดงความคิดเห็น" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ถูกใจ" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "แชร์โพสต์" })).toBeInTheDocument();
    expect(screen.getByText(String(post.likeCount))).toBeInTheDocument();
  });

  it("applies data-discovery-item-id and is-active-spy when activeSpyItemId matches", () => {
    const trace = demoTraces[0];
    const { container } = render(
      <MemoryRouter>
        <TraceCard item={trace} handlers={{ activeSpyItemId: trace.id }} />
      </MemoryRouter>,
    );

    const article = container.querySelector(`article[data-discovery-item-id="${trace.id}"]`);
    expect(article).toBeInTheDocument();
    expect(article).toHaveClass("is-active-spy");
    expect(article).toHaveClass("is-selected");
  });

  it("triggers onSelectTrace directly when clicking photo grid tile without lightbox modal", () => {
    let selectedTrace: typeof demoTraces[0] | null = null;
    const trace = demoTraces[0];
    render(
      <MemoryRouter>
        <TraceCard
          item={trace}
          handlers={{
            onSelectTrace: (t) => {
              selectedTrace = t;
            },
          }}
        />
      </MemoryRouter>,
    );

    const photoTile = screen.getByRole("button", { name: /เปิดรูปที่ 1 ของ/i });
    expect(photoTile).toBeInTheDocument();
    photoTile.click();

    expect(selectedTrace).toBe(trace);
    expect(screen.queryByText(/MEDIA PREVIEW/i)).not.toBeInTheDocument();
  });
});

