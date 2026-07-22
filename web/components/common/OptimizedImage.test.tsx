import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import OptimizedImage, { OptimizedImageProps } from "./OptimizedImage";

vi.mock("next/image", () => ({
  default: ({
    priority: _priority,
    fill,
    alt = "",
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    priority?: boolean;
  }) =>
    React.createElement("img", {
      ...props,
      alt,
      "data-fill": fill ? "true" : undefined,
    }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("OptimizedImage", () => {
  it("supports explicit dimensions and fill while forwarding ordinary props", () => {
    const { rerender } = render(
      <OptimizedImage
        src="/teamLogos/BOS.png"
        alt="Boston Bruins"
        width={45}
        height={45}
        className="team-logo"
        loading="lazy"
      />,
    );

    const sizedImage = screen.getByRole("img", { name: "Boston Bruins" });
    expect(sizedImage.getAttribute("width")).toBe("45");
    expect(sizedImage.getAttribute("height")).toBe("45");
    expect(sizedImage.getAttribute("class")).toBe("team-logo");
    expect(sizedImage.getAttribute("loading")).toBe("lazy");

    rerender(
      <OptimizedImage
        src="/background.png"
        alt="Background"
        fill
        sizes="100vw"
      />,
    );

    const fillImage = screen.getByRole("img", { name: "Background" });
    expect(fillImage.getAttribute("data-fill")).toBe("true");
    expect(fillImage.getAttribute("width")).toBeNull();
    expect(fillImage.getAttribute("height")).toBeNull();
    expect(fillImage.getAttribute("sizes")).toBe("100vw");
  });

  it.each([
    ["missing dimensions", { src: "/logo.png", alt: "Logo" }],
    ["missing height", { src: "/logo.png", alt: "Logo", width: 45 }],
    ["missing width", { src: "/logo.png", alt: "Logo", height: 45 }],
    [
      "fill with dimensions",
      { src: "/logo.png", alt: "Logo", fill: true, width: 45, height: 45 },
    ],
  ])("rejects %s at runtime", (_label, invalidProps) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(() =>
      render(<OptimizedImage {...(invalidProps as OptimizedImageProps)} />),
    ).toThrow(
      "OptimizedImage requires either fill or an explicit width and height pair.",
    );
  });

  it("uses safeAlt only when alt is omitted and preserves decorative empty alt", () => {
    render(
      <>
        <OptimizedImage
          src="/missing-alt.png"
          safeAlt="Safe description"
          width={10}
          height={10}
          data-testid="safe-alt"
        />
        <OptimizedImage
          src="/decorative.png"
          alt=""
          safeAlt="Must not replace empty alt"
          width={10}
          height={10}
          data-testid="decorative-alt"
        />
      </>,
    );

    expect(screen.getByTestId("safe-alt").getAttribute("alt")).toBe(
      "Safe description",
    );
    expect(screen.getByTestId("decorative-alt").getAttribute("alt")).toBe("");
  });

  it("applies one fallback attempt before notifying a mutating caller handler", () => {
    const onError = vi.fn();
    onError.mockImplementationOnce(
      (event: React.SyntheticEvent<HTMLImageElement>) => {
        event.currentTarget.setAttribute("src", "/caller-controlled.png");
      },
    );

    render(
      <OptimizedImage
        src="/missing-primary.png"
        alt="Team"
        width={45}
        height={45}
        fallbackSrc="/teamLogos/FHFH.png"
        onError={onError}
      />,
    );

    fireEvent.error(screen.getByRole("img", { name: "Team" }));

    const fallbackImage = screen.getByRole("img", { name: "Team" });
    expect(fallbackImage.getAttribute("src")).toBe("/teamLogos/FHFH.png");
    expect(onError).toHaveBeenCalledTimes(1);

    fireEvent.error(fallbackImage);

    expect(screen.getByRole("img", { name: "Team" }).getAttribute("src")).toBe(
      "/teamLogos/FHFH.png",
    );
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it("uses the canonical local fallback when no override is provided", () => {
    render(
      <OptimizedImage
        src="/missing-primary.png"
        alt="Team"
        width={45}
        height={45}
      />,
    );

    fireEvent.error(screen.getByRole("img", { name: "Team" }));

    expect(screen.getByRole("img", { name: "Team" }).getAttribute("src")).toBe(
      "/teamLogos/FHFH.png",
    );
  });

  it("resets fallback state when the primary or fallback source changes", () => {
    const { rerender } = render(
      <OptimizedImage
        src="/first.png"
        alt="Team"
        width={45}
        height={45}
        fallbackSrc="/first-fallback.png"
      />,
    );

    fireEvent.error(screen.getByRole("img", { name: "Team" }));
    expect(screen.getByRole("img", { name: "Team" }).getAttribute("src")).toBe(
      "/first-fallback.png",
    );

    rerender(
      <OptimizedImage
        src="/first.png"
        alt="Team"
        width={45}
        height={45}
        fallbackSrc="/second-fallback.png"
      />,
    );

    expect(screen.getByRole("img", { name: "Team" }).getAttribute("src")).toBe(
      "/first.png",
    );

    fireEvent.error(screen.getByRole("img", { name: "Team" }));
    expect(screen.getByRole("img", { name: "Team" }).getAttribute("src")).toBe(
      "/second-fallback.png",
    );

    rerender(
      <OptimizedImage
        src="/second.png"
        alt="Team"
        width={45}
        height={45}
        fallbackSrc="/second-fallback.png"
      />,
    );

    expect(screen.getByRole("img", { name: "Team" }).getAttribute("src")).toBe(
      "/second.png",
    );
  });

  it.each([
    ["empty", "/missing.png", ""],
    ["self-referential", "/same.png", "/same.png"],
  ])("does not retry an %s fallback", (_label, src, fallbackSrc) => {
    const onError = vi.fn();

    render(
      <OptimizedImage
        src={src}
        alt="Team"
        width={45}
        height={45}
        fallbackSrc={fallbackSrc}
        onError={onError}
      />,
    );

    const image = screen.getByRole("img", { name: "Team" });
    fireEvent.error(image);
    fireEvent.error(image);

    expect(screen.getByRole("img", { name: "Team" }).getAttribute("src")).toBe(
      src,
    );
    expect(onError).toHaveBeenCalledTimes(2);
  });
});
