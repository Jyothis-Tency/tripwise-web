import { useEffect } from "react";
import { useAuth } from "../hooks/useAuth";

export type UserBrandFields = {
  email?: string;
  company?: string;
  name?: string;
};

/**
 * Returns true if the user belongs to Inway Cabs based on company, email, or name.
 */
export function isInwayOwner(user?: UserBrandFields | null): boolean {
  if (!user) {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("userData");
        if (raw) {
          const u = JSON.parse(raw);
          return isInwayOwner(u);
        }
      } catch {}
    }
    return false;
  }
  const company = (user.company || "").toLowerCase();
  const email = (user.email || "").toLowerCase();
  const name = (user.name || "").toLowerCase();

  return (
    company.includes("inway") ||
    email.includes("inwaycabs") ||
    name.includes("inway")
  );
}

/**
 * Updates document.title and favicon tags to match the current brand.
 */
export function updateDocumentBrand(isInway?: boolean) {
  if (typeof document === "undefined") return;
  const inway = isInway ?? isInwayOwner();

  const baseTitle = inway ? "Inway Cabs — Trip Management System" : "Tripwise — Trip Management System";
  const iconHref = inway ? "/inway-favicon.svg" : "/favicon.svg?v=8";

  // Update document title if it contains brand text or default
  if (!document.title || document.title.includes("Tripwise") || document.title.includes("Inway Cabs")) {
    document.title = document.title
      .replace(/^Tripwise/i, inway ? "Inway Cabs" : "Tripwise")
      .replace(/^Inway Cabs/i, inway ? "Inway Cabs" : "Tripwise");
    if (!document.title.includes("—")) {
      document.title = baseTitle;
    }
  }

  // Update favicon links
  const links = document.querySelectorAll<HTMLLinkElement>(
    "link[rel~='icon'], link[rel='shortcut icon'], link[rel='apple-touch-icon']"
  );
  links.forEach((link) => {
    link.href = iconHref;
  });
}

/**
 * Hook to get brand information and sync the browser tab & favicon.
 */
export function useBrand() {
  const { user } = useAuth();
  const isInway = isInwayOwner(user);

  useEffect(() => {
    updateDocumentBrand(isInway);
  }, [isInway]);

  return {
    isInway,
    brandName: isInway ? "Inway Cabs" : "Tripwise",
    shortName: isInway ? "Inway" : "Tripwise",
    confidentialNotice: isInway ? "Inway Cabs · Confidential" : "TripWise · Confidential",
    reportPrefix: isInway ? "inway-cabs" : "tripwise",
  };
}

/**
 * Generates a crisp base64 PNG data URL of the official Inway Cabs brand mark tile
 * for PDF exports and raster environments.
 */
export function createInwayLogoPngDataUrl(size = 400): string {
  if (typeof document === "undefined") return "";
  try {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    const scale = size / 400;

    // Background dark tile (#0a0a0a) with rounded corners (rx=80 at 400x400)
    ctx.fillStyle = "#0a0a0a";
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(0, 0, size, size, 80 * scale);
    } else {
      const r = 80 * scale;
      ctx.moveTo(r, 0);
      ctx.lineTo(size - r, 0);
      ctx.quadraticCurveTo(size, 0, size, r);
      ctx.lineTo(size, size - r);
      ctx.quadraticCurveTo(size, size, size - r, size);
      ctx.lineTo(r, size);
      ctx.quadraticCurveTo(0, size, 0, size - r);
      ctx.lineTo(0, r);
      ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.closePath();
    }
    ctx.fill();

    // Draw Inway white chevron & check mark
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-340, -187);

    // Chevron
    ctx.fillStyle = "#ffffff";
    const p1 = new Path2D(
      "M399 296 L411 272 Q418 260 432 265 L676 358 Q692 366 688 382 Q686 388 678 392 L497 508 Q485 515 474 510 Q464 504 468 490 L512 392 L408 315 Q396 308 399 296 Z"
    );
    ctx.fill(p1);

    // Checkmark
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 32;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const p2 = new Path2D("M408 429 L424 458 L467 393");
    ctx.stroke(p2);

    ctx.restore();

    return canvas.toDataURL("image/png");
  } catch (err) {
    console.error("Failed to render Inway logo to canvas:", err);
    return "";
  }
}

/**
 * Generates a crisp base64 PNG data URL of the official Tripwise brand mark tile
 * for PDF exports.
 */
export function createTripwiseLogoPngDataUrl(size = 400): string {
  if (typeof document === "undefined") return "";
  try {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    const scale = size / 120;
    // Tile: #12243A with rounded corners (rx=28)
    ctx.fillStyle = "#12243A";
    const r = 28 * scale;
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(0, 0, size, size, r);
    } else {
      ctx.rect(0, 0, size, size);
    }
    ctx.fill();

    // Tee: #FFFFFF
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(24 * scale, 24 * scale, 72 * scale, 18 * scale, 9 * scale);
      ctx.roundRect(51 * scale, 24 * scale, 18 * scale, 72 * scale, 9 * scale);
    } else {
      ctx.rect(24 * scale, 24 * scale, 72 * scale, 18 * scale);
      ctx.rect(51 * scale, 24 * scale, 18 * scale, 72 * scale);
    }
    ctx.fill();

    return canvas.toDataURL("image/png");
  } catch (err) {
    return "";
  }
}

export function createInwayWatermarkPngDataUrl(size = 600, opacity = 0.085): string {
  if (typeof document === "undefined") return "";
  try {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    const scale = size / 400;
    ctx.clearRect(0, 0, size, size);

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.scale(scale, scale);
    ctx.translate(-340, -187);

    // Chevron
    ctx.fillStyle = "#000000";
    const p1 = new Path2D(
      "M399 296 L411 272 Q418 260 432 265 L676 358 Q692 366 688 382 Q686 388 678 392 L497 508 Q485 515 474 510 Q464 504 468 490 L512 392 L408 315 Q396 308 399 296 Z"
    );
    ctx.fill(p1);

    // Checkmark
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 32;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const p2 = new Path2D("M408 429 L424 458 L467 393");
    ctx.stroke(p2);

    ctx.restore();

    return canvas.toDataURL("image/png");
  } catch (err) {
    console.error("Failed to render Inway watermark to canvas:", err);
    return "";
  }
}



