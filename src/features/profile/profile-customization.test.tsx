import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AvatarDecoration } from "./avatar-decoration";
import { ProfileEffectLayer } from "./profile-effect-layer";
import { ProfileCustomizerModal } from "./profile-customizer-modal";
import {
  defaultProfileCustomization,
  getStoredProfileCustomization,
  saveStoredProfileCustomization,
  processProfileImageUpload,
} from "./profile-storage";

describe("Profile Customization & Storage System", () => {
  it("provides complete default customization and saves/restores from storage", async () => {
    const defaults = defaultProfileCustomization("test-user-1");
    expect(defaults.displayName).toBe("Mina P.");
    expect(defaults.avatarDecorationId).toBe("lightstruck-halo");
    expect(defaults.profileEffectId).toBe("prismatic-sheen");

    await saveStoredProfileCustomization({
      ...defaults,
      displayName: "Alex T.",
      avatarDecorationId: "sakura-orbit",
      profileEffectId: "sakura-breeze",
    });

    const retrieved = await getStoredProfileCustomization("test-user-1");
    expect(retrieved.displayName).toBe("Alex T.");
    expect(retrieved.avatarDecorationId).toBe("sakura-orbit");
    expect(retrieved.profileEffectId).toBe("sakura-breeze");
  });

  it("validates and rejects non-image files in processProfileImageUpload", async () => {
    const fakeTextFile = new File(["dummy text"], "test.txt", { type: "text/plain" });
    await expect(processProfileImageUpload(fakeTextFile)).rejects.toThrow(
      "รองรับเฉพาะไฟล์รูปภาพ (JPEG, PNG, WebP, GIF) เท่านั้น"
    );
  });

  it("renders Discord-style AvatarDecoration variations properly", () => {
    const { container: c1 } = render(<AvatarDecoration decorationId="lightstruck-halo" />);
    expect(c1.querySelector(".decoration-lightstruck")).toBeInTheDocument();

    const { container: c2 } = render(<AvatarDecoration decorationId="sakura-orbit" />);
    expect(c2.querySelector(".decoration-sakura")).toBeInTheDocument();

    const { container: c3 } = render(<AvatarDecoration decorationId="cyber-matrix" />);
    expect(c3.querySelector(".decoration-cyber")).toBeInTheDocument();

    const { container: c4 } = render(<AvatarDecoration decorationId="celestial-stardust" />);
    expect(c4.querySelector(".decoration-celestial")).toBeInTheDocument();

    const { container: c5 } = render(<AvatarDecoration decorationId="none" />);
    expect(c5.firstChild).toBeNull();
  });

  it("renders Discord-style ProfileEffectLayer variations properly", () => {
    const { container: c1 } = render(<ProfileEffectLayer effectId="prismatic-sheen" />);
    expect(c1.querySelector(".effect-prismatic-sheen")).toBeInTheDocument();

    const { container: c2 } = render(<ProfileEffectLayer effectId="sakura-breeze" />);
    expect(c2.querySelector(".effect-sakura-breeze")).toBeInTheDocument();

    const { container: c3 } = render(<ProfileEffectLayer effectId="cyber-scan" />);
    expect(c3.querySelector(".effect-cyber-scan")).toBeInTheDocument();

    const { container: c4 } = render(<ProfileEffectLayer effectId="none" />);
    expect(c4.firstChild).toBeNull();
  });

  it("opens ProfileCustomizerModal, switches tabs, and triggers onSave with updated selections", () => {
    const initialData = defaultProfileCustomization("test-user-modal");
    const onSave = vi.fn();
    const onClose = vi.fn();

    render(
      <ProfileCustomizerModal
        initialData={initialData}
        onSave={onSave}
        onClose={onClose}
      />
    );

    expect(screen.getByRole("heading", { name: "ตกแต่งโปรไฟล์ของคุณ" })).toBeInTheDocument();
    expect(screen.getByText("LIVE PREVIEW")).toBeInTheDocument();

    // Switch to Avatar Decorations Tab
    fireEvent.click(screen.getByRole("button", { name: /กรอบอวาตาร์/ }));
    expect(screen.getByText("Sakura Orbit")).toBeInTheDocument();
    expect(screen.getByText("Cyber Glitch Matrix")).toBeInTheDocument();

    // Select Sakura Orbit
    fireEvent.click(screen.getByRole("button", { name: /Sakura Orbit/ }));

    // Switch to Effects & Banner Tab
    fireEvent.click(screen.getByRole("button", { name: /เอฟเฟกต์ & แบนเนอร์/ }));
    expect(screen.getByText("Sakura Falling Breeze")).toBeInTheDocument();

    // Click Save Changes
    fireEvent.click(screen.getByRole("button", { name: /บันทึกการเปลี่ยนแปลง/ }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        avatarDecorationId: "sakura-orbit",
      })
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
