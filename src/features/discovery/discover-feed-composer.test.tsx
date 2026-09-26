import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DiscoveryComposer } from "./discover-feed-composer";

describe("DiscoveryComposer", () => {
  it("opens the Facebook-inspired composer and publishes a decorated Post in demo mode", async () => {
    const onNotify = vi.fn();
    const onPublish = vi.fn();
    render(<DiscoveryComposer demoMode onNotify={onNotify} onPublish={onPublish} />);

    fireEvent.click(screen.getByRole("button", { name: /วันนี้คุณค้นพบอะไรมา/ }));
    fireEvent.change(screen.getByPlaceholderText(/เล่าเรื่องร้าน/), {
      target: { value: "กาแฟดีและเดินต่อไปดูงานออกแบบได้" },
    });
    fireEvent.click(screen.getByRole("button", { name: "เพิ่ม mood" }));
    fireEvent.click(screen.getByRole("button", { name: "Slow morning" }));
    fireEvent.click(screen.getByRole("button", { name: "เผยแพร่" }));

    await waitFor(() => expect(onPublish).toHaveBeenCalledTimes(1));
    expect(onPublish.mock.calls[0]?.[0]).toMatchObject({
      mode: "post",
      body: "กาแฟดีและเดินต่อไปดูงานออกแบบได้",
      feeling: "Slow morning",
    });
    expect(onNotify).toHaveBeenCalledWith("เผยแพร่ Post ในฟีดแล้ว");
  });

  it("requires two stops before publishing a Trace", () => {
    const onPublish = vi.fn();
    render(<DiscoveryComposer demoMode onNotify={vi.fn()} onPublish={onPublish} />);

    fireEvent.click(screen.getByRole("button", { name: "สร้าง Trace" }));
    fireEvent.change(screen.getByPlaceholderText("เช่น เช้าเบา ๆ ที่อารีย์"), {
      target: { value: "Ari slow morning" },
    });
    fireEvent.click(screen.getByRole("button", { name: "เพิ่ม North Star Coffee ใน Trace" }));
    fireEvent.click(screen.getByRole("button", { name: "เผยแพร่" }));

    expect(onPublish).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/อย่างน้อย 2 จุด/);
  });

  it("builds an ordered route from place selection and publishes structured stops", async () => {
    const onPublish = vi.fn();
    render(<DiscoveryComposer demoMode onNotify={vi.fn()} onPublish={onPublish} />);

    fireEvent.click(screen.getByRole("button", { name: "สร้าง Trace" }));
    fireEvent.change(screen.getByPlaceholderText(/เช่น เช้าเบา ๆ ที่อารีย์/), {
      target: { value: "Ari slow morning" },
    });
    fireEvent.click(screen.getByRole("button", { name: "เพิ่ม North Star Coffee ใน Trace" }));
    fireEvent.click(screen.getByRole("button", { name: "เพิ่ม Ari Ceramic House ใน Trace" }));
    fireEvent.click(screen.getByRole("button", { name: "เผยแพร่" }));

    await waitFor(() => expect(onPublish).toHaveBeenCalledTimes(1));
    expect(onPublish.mock.calls[0]?.[0]).toMatchObject({
      mode: "trace",
      stops: ["North Star Coffee", "Ari Ceramic House"],
      routeStops: [
        { id: "north-star-coffee", area: "Ari" },
        { id: "ari-ceramic-house", area: "Ari" },
      ],
    });
  });
});
