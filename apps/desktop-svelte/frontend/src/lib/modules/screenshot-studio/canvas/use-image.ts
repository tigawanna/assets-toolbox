import { useEffect, useState } from "react";

/** Load a data URL or remote image for Konva. */
export function useImage(url: string): HTMLImageElement | undefined {
  const [image, setImage] = useState<HTMLImageElement | undefined>(undefined);
  useEffect(() => {
    if (url === "") {
      setImage(undefined);
      return;
    }
    const element = new window.Image();
    element.onload = () => setImage(element);
    element.onerror = () => setImage(undefined);
    element.src = url;
    return () => {
      element.onload = null;
      element.onerror = null;
    };
  }, [url]);
  return image;
}
