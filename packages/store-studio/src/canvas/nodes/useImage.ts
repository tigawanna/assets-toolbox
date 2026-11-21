import { useEffect, useState } from "react";

/** Minimal replacement for `use-image`: load an HTMLImageElement from a URL. */
export function useImage(url: string): HTMLImageElement | undefined {
  const [image, setImage] = useState<HTMLImageElement | undefined>(undefined);
  useEffect(() => {
    if (url === "") {
      setImage(undefined);
      return;
    }
    const element = new window.Image();
    element.crossOrigin = "anonymous";
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
