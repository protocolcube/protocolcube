import type {
  PublicationFile,
  PublicationSaveAdapter,
} from "@/features/author/workspace";

interface WritableFile {
  write(data: Uint8Array<ArrayBuffer>): Promise<void>;
  close(): Promise<void>;
}

interface SaveFileHandle {
  name: string;
  createWritable(): Promise<WritableFile>;
}

interface FilePickerWindow extends Window {
  showSaveFilePicker(options: {
    suggestedName: string;
    excludeAcceptAllOption: boolean;
    types: Array<{
      description: string;
      accept: Record<string, string[]>;
    }>;
  }): Promise<SaveFileHandle>;
}

function supportsFilePicker(window: Window): window is FilePickerWindow {
  return typeof Reflect.get(window, "showSaveFilePicker") === "function";
}

export function canSavePublishedProtocol(window: Window): boolean {
  return supportsFilePicker(window);
}

export function createBrowserPublicationSaveAdapter(
  window: Window,
): PublicationSaveAdapter {
  if (!supportsFilePicker(window)) {
    throw new Error("This browser does not support explicit file saving");
  }
  const pickerWindow = window;

  async function save(file: PublicationFile): Promise<{ name: string }> {
    const extension = file.mediaType === "text/html" ? ".html" : ".sha256";
    const handle = await pickerWindow.showSaveFilePicker({
      suggestedName: file.name,
      excludeAcceptAllOption: true,
      types: [
        {
          description:
            file.mediaType === "text/html"
              ? "Published Protocol HTML"
              : "SHA-256 checksum",
          accept: { [file.mediaType]: [extension] },
        },
      ],
    });
    const writable = await handle.createWritable();
    await writable.write(file.bytes);
    await writable.close();
    return { name: handle.name };
  }

  return {
    saveHtml: save,
    saveChecksum: save,
  };
}
