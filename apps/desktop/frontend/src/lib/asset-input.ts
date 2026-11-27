import type { AssetInput } from "./asset-generation";

export interface WebAssetSelection {
  input: AssetInput;
  preview: string;
}

/**
 * Browser fallback for the native file dialog. It only reads the image for
 * preview — the handle is deliberately non-native, so generation stays disabled
 * outside the Wails app.
 */
export function selectWebImage(): Promise<WebAssetSelection | null> {
  return new Promise((resolve, reject) => {
    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept =
      ".png,.svg,.jpg,.jpeg,.webp,.ico,image/png,image/svg+xml,image/jpeg,image/webp,image/x-icon";
    picker.hidden = true;

    const finish = (selection: WebAssetSelection | null, error?: Error) => {
      picker.remove();
      if (error) reject(error);
      else resolve(selection);
    };

    picker.addEventListener("change", () => {
      const file = picker.files?.[0];
      if (!file) {
        finish(null);
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => finish(null, new Error("Could not read that image."));
      reader.onload = () => {
        const result = reader.result;
        finish({
          input: {
            handle: `web:${file.name}:${file.size}`,
            name: file.name,
            size: file.size,
            mimeType: file.type || "image/png",
          },
          preview: typeof result === "string" ? result : "",
        });
      };
      reader.readAsDataURL(file);
    });

    document.body.append(picker);
    picker.click();
  });
}
